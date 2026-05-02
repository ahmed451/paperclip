import { type ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams, useNavigate, Navigate } from "@/lib/router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { issuesApi } from "../api/issues";
import { agentsApi } from "../api/agents";
import { approvalsApi } from "../api/approvals";
import { heartbeatsApi } from "../api/heartbeats";
import { activityApi } from "../api/activity";
import { companySkillsApi } from "../api/companySkills";
import { useCompany } from "../context/CompanyContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { useSidebar } from "../context/SidebarContext";
import { useToastActions } from "../context/ToastContext";
import { queryKeys } from "../lib/queryKeys";
import { cn, formatDate, relativeTime, agentUrl } from "../lib/utils";
import { StatusBadge } from "../components/StatusBadge";
import { StatusIcon } from "../components/StatusIcon";
import { PageSkeleton } from "../components/PageSkeleton";
import { EmptyState } from "../components/EmptyState";
import { AgentIcon } from "../components/AgentIconPicker";
import { approvalLabel, defaultTypeIcon, typeIcon } from "../components/ApprovalPayload";
import { timeAgo } from "../lib/timeAgo";
import { Button } from "@/components/ui/button";
import { Tabs } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Inbox,
  Bell,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Play,
  Pause,
  Settings,
  Activity,
  Target,
  FileText,
  MessageSquare,
  ChevronRight,
  Filter,
  MoreHorizontal,
  Zap,
  BarChart3,
  Layers,
  RefreshCw,
  ExternalLink,
  User,
  Briefcase,
  Mail,
  Shield,
} from "lucide-react";
import type { Agent, Issue, Approval, HeartbeatRun, ActivityEntry } from "@paperclipai/shared";

type WorkspaceTab = "inbox" | "tasks" | "approvals" | "activity" | "skills" | "settings";

interface InboxItem {
  id: string;
  type: "issue_assigned" | "issue_mentioned" | "approval_pending" | "run_completed" | "run_failed";
  title: string;
  description?: string;
  timestamp: Date;
  priority: "high" | "medium" | "low";
  read: boolean;
  issueId?: string;
  approvalId?: string;
  runId?: string;
}

export function AgentWorkspace() {
  const { agentId } = useParams<{ agentId: string }>();
  const navigate = useNavigate();
  const { selectedCompanyId } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();
  const { setSidebarCollapsed } = useSidebar();
  const { showToast } = useToastActions();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<WorkspaceTab>("inbox");
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());

  // Fetch agent details
  const { data: agent, isLoading: agentLoading, error: agentError } = useQuery({
    queryKey: queryKeys.agents.detail(agentId!),
    queryFn: () => agentsApi.get(agentId!),
    enabled: !!agentId,
  });

  // Fetch issues assigned to this agent
  const { data: assignedIssues = [], isLoading: issuesLoading } = useQuery({
    queryKey: [...queryKeys.issues.list(selectedCompanyId!), "assigned", agentId],
    queryFn: async () => {
      const all = await issuesApi.list(selectedCompanyId!);
      return all.filter(issue => issue.assigneeAgentId === agentId);
    },
    enabled: !!selectedCompanyId && !!agentId,
  });

  // Fetch issues where agent is mentioned or involved
  const { data: relatedIssues = [], isLoading: relatedLoading } = useQuery({
    queryKey: [...queryKeys.issues.list(selectedCompanyId!), "related", agentId],
    queryFn: async () => {
      const all = await issuesApi.list(selectedCompanyId!);
      return all.filter(issue => 
        issue.createdByAgentId === agentId || 
        (issue.participantAgentIds && issue.participantAgentIds.includes(agentId!))
      );
    },
    enabled: !!selectedCompanyId && !!agentId,
  });

  // Fetch pending approvals for this agent
  const { data: pendingApprovals = [], isLoading: approvalsLoading } = useQuery({
    queryKey: [...queryKeys.approvals.list(selectedCompanyId!), "pending", agentId],
    queryFn: async () => {
      const all = await approvalsApi.list(selectedCompanyId!);
      return all.filter(approval => 
        approval.status === "pending" && 
        (approval.requestedByAgentId === agentId || approval.targetAgentId === agentId)
      );
    },
    enabled: !!selectedCompanyId && !!agentId,
  });

  // Fetch recent runs
  const { data: recentRuns = [], isLoading: runsLoading } = useQuery({
    queryKey: queryKeys.heartbeats.list(agentId!),
    queryFn: () => heartbeatsApi.list(agentId!, { limit: 20 }),
    enabled: !!agentId,
  });

  // Fetch activity
  const { data: activityData, isLoading: activityLoading } = useQuery({
    queryKey: queryKeys.activity.list(selectedCompanyId!),
    queryFn: () => activityApi.list(selectedCompanyId!, { limit: 50 }),
    enabled: !!selectedCompanyId,
  });

  const agentActivity = useMemo(() => {
    if (!activityData?.entries) return [];
    return activityData.entries.filter(entry => 
      entry.actorAgentId === agentId || entry.targetAgentId === agentId
    );
  }, [activityData, agentId]);

  // Fetch skills
  const { data: skills = [], isLoading: skillsLoading } = useQuery({
    queryKey: queryKeys.companySkills.list(selectedCompanyId!),
    queryFn: () => companySkillsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const agentSkills = useMemo(() => {
    if (!agent?.skills) return [];
    return skills.filter(skill => agent.skills?.includes(skill.key));
  }, [skills, agent?.skills]);

  // Build inbox items
  const inboxItems = useMemo((): InboxItem[] => {
    const items: InboxItem[] = [];

    // Add assigned issues
    assignedIssues.forEach(issue => {
      if (issue.status !== "done" && issue.status !== "cancelled") {
        items.push({
          id: `issue-${issue.id}`,
          type: "issue_assigned",
          title: issue.title || "Untitled Issue",
          description: `Assigned ${relativeTime(new Date(issue.createdAt))}`,
          timestamp: new Date(issue.updatedAt || issue.createdAt),
          priority: issue.priority === "urgent" ? "high" : issue.priority === "high" ? "high" : "medium",
          read: false,
          issueId: issue.id,
        });
      }
    });

    // Add pending approvals
    pendingApprovals.forEach(approval => {
      items.push({
        id: `approval-${approval.id}`,
        type: "approval_pending",
        title: approvalLabel(approval) || "Approval Required",
        description: `Requested ${relativeTime(new Date(approval.createdAt))}`,
        timestamp: new Date(approval.createdAt),
        priority: "high",
        read: false,
        approvalId: approval.id,
      });
    });

    // Add recent run completions/failures
    recentRuns.slice(0, 5).forEach(run => {
      if (run.status === "completed" || run.status === "failed") {
        items.push({
          id: `run-${run.id}`,
          type: run.status === "completed" ? "run_completed" : "run_failed",
          title: run.status === "completed" ? "Task Completed" : "Task Failed",
          description: run.issueTitle || `Run ${run.id.slice(0, 8)}`,
          timestamp: new Date(run.endedAt || run.startedAt),
          priority: run.status === "failed" ? "high" : "low",
          read: true,
          runId: run.id,
          issueId: run.issueId,
        });
      }
    });

    // Sort by timestamp (most recent first)
    return items.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }, [assignedIssues, pendingApprovals, recentRuns]);

  const unreadCount = inboxItems.filter(item => !item.read).length;
  const activeTasksCount = assignedIssues.filter(i => i.status === "in_progress").length;
  const pendingTasksCount = assignedIssues.filter(i => i.status === "open" || i.status === "todo").length;

  // Set breadcrumbs
  useEffect(() => {
    if (agent) {
      setBreadcrumbs([
        { label: "Agents", href: "/agents" },
        { label: agent.name, href: agentUrl(agent) },
        { label: "Workspace" },
      ]);
    }
  }, [agent, setBreadcrumbs]);

  // Collapse sidebar for workspace view
  useEffect(() => {
    setSidebarCollapsed(true);
    return () => setSidebarCollapsed(false);
  }, [setSidebarCollapsed]);

  if (agentLoading) {
    return <PageSkeleton />;
  }

  if (agentError || !agent) {
    return (
      <div className="flex items-center justify-center h-full">
        <EmptyState
          icon={<AlertTriangle className="h-8 w-8" />}
          title="Agent Not Found"
          description="The agent you're looking for doesn't exist or you don't have access."
        />
      </div>
    );
  }

  const isActive = agent.status === "active" || agent.status === "running";
  const isPaused = agent.status === "paused";

  return (
    <div className="h-full flex flex-col">
      {/* Workspace Header */}
      <div className="border-b border-border bg-card">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="relative">
                <AgentIcon agent={agent} size="lg" />
                <div 
                  className={cn(
                    "absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-background",
                    isActive ? "bg-green-500" : isPaused ? "bg-yellow-500" : "bg-gray-400"
                  )}
                />
              </div>
              <div>
                <h1 className="text-xl font-semibold flex items-center gap-2">
                  {agent.name}
                  <span className="text-muted-foreground font-normal text-sm">Workspace</span>
                </h1>
                <p className="text-sm text-muted-foreground">
                  {agent.title || agent.role}
                  {agent.reportsToName && ` · Reports to ${agent.reportsToName}`}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Quick Stats */}
              <div className="flex items-center gap-4 mr-4">
                <div className="text-center">
                  <div className="text-2xl font-semibold">{unreadCount}</div>
                  <div className="text-xs text-muted-foreground">Unread</div>
                </div>
                <Separator orientation="vertical" className="h-8" />
                <div className="text-center">
                  <div className="text-2xl font-semibold">{activeTasksCount}</div>
                  <div className="text-xs text-muted-foreground">Active</div>
                </div>
                <Separator orientation="vertical" className="h-8" />
                <div className="text-center">
                  <div className="text-2xl font-semibold">{pendingTasksCount}</div>
                  <div className="text-xs text-muted-foreground">Pending</div>
                </div>
              </div>

              <Button variant="outline" size="sm" asChild>
                <Link to={agentUrl(agent)}>
                  <Settings className="h-4 w-4 mr-1" />
                  Configure
                </Link>
              </Button>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="px-6">
          <Tabs
            tabs={[
              { 
                id: "inbox", 
                label: "Inbox", 
                icon: <Inbox className="h-4 w-4" />,
                badge: unreadCount > 0 ? unreadCount : undefined,
              },
              { 
                id: "tasks", 
                label: "My Tasks", 
                icon: <Target className="h-4 w-4" />,
                badge: assignedIssues.length > 0 ? assignedIssues.length : undefined,
              },
              { 
                id: "approvals", 
                label: "Approvals", 
                icon: <Shield className="h-4 w-4" />,
                badge: pendingApprovals.length > 0 ? pendingApprovals.length : undefined,
              },
              { 
                id: "activity", 
                label: "Activity", 
                icon: <Activity className="h-4 w-4" />,
              },
              { 
                id: "skills", 
                label: "Skills", 
                icon: <Zap className="h-4 w-4" />,
              },
              { 
                id: "settings", 
                label: "Settings", 
                icon: <Settings className="h-4 w-4" />,
              },
            ]}
            activeTab={activeTab}
            onTabChange={(id) => setActiveTab(id as WorkspaceTab)}
          />
        </div>
      </div>

      {/* Tab Content */}
      <ScrollArea className="flex-1">
        <div className="p-6">
          {activeTab === "inbox" && (
            <InboxTabContent 
              items={inboxItems}
              isLoading={issuesLoading || approvalsLoading || runsLoading}
              onItemClick={(item) => {
                if (item.issueId) navigate(`/issues/${item.issueId}`);
                else if (item.approvalId) navigate(`/approvals/${item.approvalId}`);
              }}
            />
          )}

          {activeTab === "tasks" && (
            <TasksTabContent
              issues={assignedIssues}
              isLoading={issuesLoading}
              agentId={agentId!}
            />
          )}

          {activeTab === "approvals" && (
            <ApprovalsTabContent
              approvals={pendingApprovals}
              isLoading={approvalsLoading}
            />
          )}

          {activeTab === "activity" && (
            <ActivityTabContent
              activity={agentActivity}
              isLoading={activityLoading}
            />
          )}

          {activeTab === "skills" && (
            <SkillsTabContent
              skills={agentSkills}
              allSkills={skills}
              isLoading={skillsLoading}
              agentId={agentId!}
            />
          )}

          {activeTab === "settings" && (
            <SettingsTabContent agent={agent} />
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

// Sub-components for each tab

function InboxTabContent({ 
  items, 
  isLoading, 
  onItemClick 
}: { 
  items: InboxItem[]; 
  isLoading: boolean;
  onItemClick: (item: InboxItem) => void;
}) {
  if (isLoading) {
    return (
      <div className="space-y-2">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <EmptyState
        icon={<Inbox className="h-8 w-8" />}
        title="Inbox Zero!"
        description="You're all caught up. No new notifications."
      />
    );
  }

  const priorityOrder = { high: 0, medium: 1, low: 2 };

  return (
    <div className="space-y-2">
      {items
        .sort((a, b) => {
          if (a.read !== b.read) return a.read ? 1 : -1;
          if (a.priority !== b.priority) return priorityOrder[a.priority] - priorityOrder[b.priority];
          return b.timestamp.getTime() - a.timestamp.getTime();
        })
        .map(item => (
          <div
            key={item.id}
            onClick={() => onItemClick(item)}
            className={cn(
              "flex items-center gap-4 p-4 border border-border rounded-lg cursor-pointer transition-colors",
              "hover:bg-muted/50",
              !item.read && "bg-primary/5 border-primary/20"
            )}
          >
            <div className="flex-shrink-0">
              {item.type === "issue_assigned" && <Target className="h-5 w-5 text-blue-500" />}
              {item.type === "issue_mentioned" && <MessageSquare className="h-5 w-5 text-purple-500" />}
              {item.type === "approval_pending" && <Shield className="h-5 w-5 text-orange-500" />}
              {item.type === "run_completed" && <CheckCircle2 className="h-5 w-5 text-green-500" />}
              {item.type === "run_failed" && <AlertTriangle className="h-5 w-5 text-red-500" />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-medium truncate">{item.title}</div>
              {item.description && (
                <div className="text-sm text-muted-foreground truncate">{item.description}</div>
              )}
            </div>
            <div className="flex items-center gap-2">
              {item.priority === "high" && (
                <Badge variant="destructive" className="text-xs">High</Badge>
              )}
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                {relativeTime(item.timestamp)}
              </span>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </div>
          </div>
        ))}
    </div>
  );
}

function TasksTabContent({ 
  issues, 
  isLoading,
  agentId 
}: { 
  issues: Issue[]; 
  isLoading: boolean;
  agentId: string;
}) {
  const navigate = useNavigate();
  
  if (isLoading) {
    return (
      <div className="space-y-2">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  const inProgress = issues.filter(i => i.status === "in_progress");
  const pending = issues.filter(i => i.status === "open" || i.status === "todo");
  const blocked = issues.filter(i => i.status === "blocked");
  const completed = issues.filter(i => i.status === "done").slice(0, 5);

  return (
    <div className="space-y-6">
      {inProgress.length > 0 && (
        <div>
          <h3 className="font-medium mb-3 flex items-center gap-2">
            <Play className="h-4 w-4 text-green-500" />
            In Progress ({inProgress.length})
          </h3>
          <div className="space-y-2">
            {inProgress.map(issue => (
              <IssueCard key={issue.id} issue={issue} onClick={() => navigate(`/issues/${issue.id}`)} />
            ))}
          </div>
        </div>
      )}

      {blocked.length > 0 && (
        <div>
          <h3 className="font-medium mb-3 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-red-500" />
            Blocked ({blocked.length})
          </h3>
          <div className="space-y-2">
            {blocked.map(issue => (
              <IssueCard key={issue.id} issue={issue} onClick={() => navigate(`/issues/${issue.id}`)} />
            ))}
          </div>
        </div>
      )}

      {pending.length > 0 && (
        <div>
          <h3 className="font-medium mb-3 flex items-center gap-2">
            <Clock className="h-4 w-4 text-yellow-500" />
            Pending ({pending.length})
          </h3>
          <div className="space-y-2">
            {pending.map(issue => (
              <IssueCard key={issue.id} issue={issue} onClick={() => navigate(`/issues/${issue.id}`)} />
            ))}
          </div>
        </div>
      )}

      {completed.length > 0 && (
        <div>
          <h3 className="font-medium mb-3 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
            Recently Completed
          </h3>
          <div className="space-y-2 opacity-60">
            {completed.map(issue => (
              <IssueCard key={issue.id} issue={issue} onClick={() => navigate(`/issues/${issue.id}`)} />
            ))}
          </div>
        </div>
      )}

      {issues.length === 0 && (
        <EmptyState
          icon={<Target className="h-8 w-8" />}
          title="No Tasks Assigned"
          description="This agent doesn't have any tasks assigned yet."
        />
      )}
    </div>
  );
}

function IssueCard({ issue, onClick }: { issue: Issue; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      className="flex items-center gap-4 p-4 border border-border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors"
    >
      <StatusIcon status={issue.status} className="h-5 w-5" />
      <div className="flex-1 min-w-0">
        <div className="font-medium truncate">{issue.title || "Untitled"}</div>
        <div className="text-sm text-muted-foreground">
          {issue.projectName && `${issue.projectName} · `}
          Updated {relativeTime(new Date(issue.updatedAt || issue.createdAt))}
        </div>
      </div>
      <ChevronRight className="h-4 w-4 text-muted-foreground" />
    </div>
  );
}

function ApprovalsTabContent({ 
  approvals, 
  isLoading 
}: { 
  approvals: Approval[]; 
  isLoading: boolean;
}) {
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[...Array(3)].map((_, i) => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </div>
    );
  }

  if (approvals.length === 0) {
    return (
      <EmptyState
        icon={<Shield className="h-8 w-8" />}
        title="No Pending Approvals"
        description="There are no approvals waiting for action."
      />
    );
  }

  return (
    <div className="space-y-2">
      {approvals.map(approval => (
        <div
          key={approval.id}
          onClick={() => navigate(`/approvals/${approval.id}`)}
          className="p-4 border border-orange-200 bg-orange-50 dark:border-orange-900 dark:bg-orange-950/30 rounded-lg cursor-pointer hover:bg-orange-100 dark:hover:bg-orange-950/50 transition-colors"
        >
          <div className="flex items-start gap-3">
            <Shield className="h-5 w-5 text-orange-500 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <div className="font-medium">{approvalLabel(approval)}</div>
              <div className="text-sm text-muted-foreground mt-1">
                Requested {relativeTime(new Date(approval.createdAt))}
              </div>
            </div>
            <Button size="sm" variant="outline">
              Review
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}

function ActivityTabContent({ 
  activity, 
  isLoading 
}: { 
  activity: ActivityEntry[]; 
  isLoading: boolean;
}) {
  if (isLoading) {
    return (
      <div className="space-y-2">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  if (activity.length === 0) {
    return (
      <EmptyState
        icon={<Activity className="h-8 w-8" />}
        title="No Activity Yet"
        description="Activity will appear here as the agent works on tasks."
      />
    );
  }

  return (
    <div className="space-y-1">
      {activity.map((entry, idx) => (
        <div key={entry.id || idx} className="flex items-start gap-3 py-2">
          <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground mt-2" />
          <div className="flex-1">
            <div className="text-sm">{entry.action}</div>
            <div className="text-xs text-muted-foreground">
              {relativeTime(new Date(entry.createdAt))}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function SkillsTabContent({ 
  skills, 
  allSkills,
  isLoading,
  agentId 
}: { 
  skills: any[]; 
  allSkills: any[];
  isLoading: boolean;
  agentId: string;
}) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
    );
  }

  if (skills.length === 0) {
    return (
      <EmptyState
        icon={<Zap className="h-8 w-8" />}
        title="No Skills Assigned"
        description="Skills define what capabilities this agent has. Configure skills in agent settings."
      />
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {skills.map(skill => (
        <Card key={skill.key}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Zap className="h-4 w-4 text-yellow-500" />
              {skill.name || skill.key}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <CardDescription className="text-xs line-clamp-2">
              {skill.description || "No description available"}
            </CardDescription>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function SettingsTabContent({ agent }: { agent: Agent }) {
  return (
    <div className="max-w-2xl space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Agent Profile
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-sm text-muted-foreground">Name</div>
              <div className="font-medium">{agent.name}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Title</div>
              <div className="font-medium">{agent.title || "—"}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Role</div>
              <div className="font-medium capitalize">{agent.role}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Status</div>
              <StatusBadge status={agent.status} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Permissions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-2 text-sm">
            {agent.permissions && Object.entries(agent.permissions).map(([key, value]) => (
              <div key={key} className="flex items-center justify-between py-1">
                <span className="text-muted-foreground">{key.replace(/_/g, " ")}</span>
                <Badge variant={value ? "default" : "secondary"}>
                  {value ? "Enabled" : "Disabled"}
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Briefcase className="h-5 w-5" />
            Adapter Configuration
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Adapter Type</span>
              <span className="font-medium">{agent.adapterType}</span>
            </div>
            {agent.model && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Model</span>
                <span className="font-medium">{agent.model}</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default AgentWorkspace;
