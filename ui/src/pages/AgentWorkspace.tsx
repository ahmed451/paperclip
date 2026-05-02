import { useEffect, useMemo, useState } from "react";
import { Link, useParams, useNavigate } from "@/lib/router";
import { useQuery } from "@tanstack/react-query";
import { issuesApi } from "../api/issues";
import { agentsApi } from "../api/agents";
import { approvalsApi } from "../api/approvals";
import { heartbeatsApi } from "../api/heartbeats";
import { activityApi } from "../api/activity";
import { companySkillsApi } from "../api/companySkills";
import { useCompany } from "../context/CompanyContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { queryKeys } from "../lib/queryKeys";
import { isUuidLike } from "@paperclipai/shared";
import { cn, agentUrl } from "../lib/utils";
import { StatusBadge } from "../components/StatusBadge";
import { StatusIcon } from "../components/StatusIcon";
import { PageSkeleton } from "../components/PageSkeleton";
import { EmptyState } from "../components/EmptyState";
import { AgentIcon } from "../components/AgentIconPicker";
import { timeAgo } from "../lib/timeAgo";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Inbox,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Play,
  Settings,
  Activity,
  Target,
  ChevronRight,
  Zap,
  User,
  Briefcase,
  Shield,
} from "lucide-react";
import type { AgentDetail, Issue, Approval, HeartbeatRun, ActivityEvent, CompanySkillListItem } from "@paperclipai/shared";

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
  const { companyPrefix, agentId } = useParams<{ companyPrefix?: string; agentId: string }>();
  const navigate = useNavigate();
  const { companies, selectedCompanyId } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();

  const [activeTab, setActiveTab] = useState<WorkspaceTab>("inbox");

  // Resolve company ID from URL prefix or use selected company
  const routeCompanyId = useMemo(() => {
    if (!companyPrefix) return null;
    const requestedPrefix = companyPrefix.toUpperCase();
    return companies.find((company) => company.issuePrefix.toUpperCase() === requestedPrefix)?.id ?? null;
  }, [companies, companyPrefix]);
  const lookupCompanyId = routeCompanyId ?? selectedCompanyId ?? undefined;
  const routeAgentRef = agentId ?? "";
  const canFetchAgent = routeAgentRef.length > 0 && (isUuidLike(routeAgentRef) || Boolean(lookupCompanyId));

  // Fetch agent details
  const { data: agent, isLoading: agentLoading, error: agentError } = useQuery({
    queryKey: [...queryKeys.agents.detail(routeAgentRef), lookupCompanyId ?? null],
    queryFn: () => agentsApi.get(routeAgentRef, lookupCompanyId),
    enabled: canFetchAgent,
  });

  const resolvedCompanyId = agent?.companyId ?? selectedCompanyId;

  // Fetch issues assigned to this agent
  const { data: allIssues = [], isLoading: issuesLoading } = useQuery({
    queryKey: queryKeys.issues.list(resolvedCompanyId!),
    queryFn: () => issuesApi.list(resolvedCompanyId!),
    enabled: !!resolvedCompanyId,
  });

  const assignedIssues = useMemo(() => {
    return allIssues.filter(issue => issue.assigneeAgentId === agent?.id);
  }, [allIssues, agent?.id]);

  // Fetch pending approvals
  const { data: allApprovals = [], isLoading: approvalsLoading } = useQuery({
    queryKey: queryKeys.approvals.list(resolvedCompanyId!),
    queryFn: () => approvalsApi.list(resolvedCompanyId!),
    enabled: !!resolvedCompanyId,
  });

  const pendingApprovals = useMemo(() => {
    return allApprovals.filter(approval => 
      approval.status === "pending" && approval.requestedByAgentId === agent?.id
    );
  }, [allApprovals, agent?.id]);

  // Fetch recent runs
  const { data: recentRuns = [], isLoading: runsLoading } = useQuery({
    queryKey: [...queryKeys.heartbeats(resolvedCompanyId!, agent?.id), "workspace"],
    queryFn: () => heartbeatsApi.list(resolvedCompanyId!, agent?.id, 20),
    enabled: !!resolvedCompanyId && !!agent?.id,
  });

  // Fetch activity - returns ActivityEvent[] directly
  const { data: activityEvents = [], isLoading: activityLoading } = useQuery({
    queryKey: [...queryKeys.activity(resolvedCompanyId!), "workspace", agent?.id],
    queryFn: () => activityApi.list(resolvedCompanyId!, { agentId: agent?.id, limit: 50 }),
    enabled: !!resolvedCompanyId && !!agent?.id,
  });

  // Fetch skills
  const { data: skills = [], isLoading: skillsLoading } = useQuery({
    queryKey: queryKeys.companySkills.list(resolvedCompanyId!),
    queryFn: () => companySkillsApi.list(resolvedCompanyId!),
    enabled: !!resolvedCompanyId,
  });

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
          description: `Assigned ${timeAgo(new Date(issue.createdAt))}`,
          timestamp: new Date(issue.updatedAt || issue.createdAt),
          priority: issue.priority === "critical" ? "high" : issue.priority === "high" ? "high" : "medium",
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
        title: approval.type || "Approval Required",
        description: `Requested ${timeAgo(new Date(approval.createdAt))}`,
        timestamp: new Date(approval.createdAt),
        priority: "high",
        read: false,
        approvalId: approval.id,
      });
    });

    // Add recent run completions/failures
    recentRuns.slice(0, 5).forEach(run => {
      if (run.status === "succeeded" || run.status === "failed") {
        items.push({
          id: `run-${run.id}`,
          type: run.status === "succeeded" ? "run_completed" : "run_failed",
          title: run.status === "succeeded" ? "Task Completed" : "Task Failed",
          description: `Run ${run.id.slice(0, 8)}`,
          timestamp: new Date(run.finishedAt || run.startedAt || run.createdAt),
          priority: run.status === "failed" ? "high" : "low",
          read: true,
          runId: run.id,
        });
      }
    });

    // Sort by timestamp (most recent first)
    return items.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }, [assignedIssues, pendingApprovals, recentRuns]);

  const unreadCount = inboxItems.filter(item => !item.read).length;
  const activeTasksCount = assignedIssues.filter(i => i.status === "in_progress").length;
  const pendingTasksCount = assignedIssues.filter(i => i.status === "todo" || i.status === "backlog").length;

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

  if (agentLoading) {
    return <PageSkeleton />;
  }

  if (agentError || !agent) {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <EmptyState
          icon={AlertTriangle}
          message="The agent you're looking for doesn't exist or you don't have access."
        />
      </div>
    );
  }

  const isActive = agent.status === "active" || agent.status === "running" || agent.status === "idle";
  const isPaused = agent.status === "paused";

  return (
    <div className="h-full flex flex-col">
      {/* Workspace Header */}
      <div className="border-b border-border bg-card">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="relative">
                <div className="h-12 w-12 rounded-lg bg-accent flex items-center justify-center">
                  <AgentIcon icon={agent.icon} className="h-6 w-6" />
                </div>
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
        <div className="px-6 flex gap-1 border-t border-border pt-2">
          {[
            { id: "inbox", label: "Inbox", icon: Inbox, badge: unreadCount },
            { id: "tasks", label: "My Tasks", icon: Target, badge: assignedIssues.length },
            { id: "approvals", label: "Approvals", icon: Shield, badge: pendingApprovals.length },
            { id: "activity", label: "Activity", icon: Activity },
            { id: "skills", label: "Skills", icon: Zap },
            { id: "settings", label: "Settings", icon: Settings },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as WorkspaceTab)}
              className={cn(
                "flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-t-md transition-colors",
                activeTab === tab.id
                  ? "bg-background text-foreground border-b-2 border-primary"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              )}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
              {tab.badge !== undefined && tab.badge > 0 && (
                <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                  {tab.badge}
                </Badge>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-auto p-6">
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
            activity={activityEvents}
            isLoading={activityLoading}
          />
        )}

        {activeTab === "skills" && (
          <SkillsTabContent
            skills={skills}
            isLoading={skillsLoading}
          />
        )}

        {activeTab === "settings" && (
          <SettingsTabContent agent={agent} />
        )}
      </div>
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
        icon={Inbox}
        message="You're all caught up. No new notifications."
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
                {timeAgo(item.timestamp)}
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
}: { 
  issues: Issue[]; 
  isLoading: boolean;
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
  const pending = issues.filter(i => i.status === "todo" || i.status === "backlog");
  const blocked = issues.filter(i => i.status === "blocked");
  const completed = issues.filter(i => i.status === "done").slice(0, 5);

  if (issues.length === 0) {
    return (
      <EmptyState
        icon={Target}
        message="This agent doesn't have any tasks assigned yet."
      />
    );
  }

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
          Updated {timeAgo(new Date(issue.updatedAt || issue.createdAt))}
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
        icon={Shield}
        message="There are no approvals waiting for action."
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
              <div className="font-medium">{approval.type}</div>
              <div className="text-sm text-muted-foreground mt-1">
                Requested {timeAgo(new Date(approval.createdAt))}
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
  activity: ActivityEvent[]; 
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
        icon={Activity}
        message="Activity will appear here as the agent works on tasks."
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
              {timeAgo(new Date(entry.createdAt))}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function SkillsTabContent({ 
  skills, 
  isLoading,
}: { 
  skills: CompanySkillListItem[]; 
  isLoading: boolean;
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
        icon={Zap}
        message="Skills define what capabilities this agent has. Configure skills in agent settings."
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

function SettingsTabContent({ agent }: { agent: AgentDetail }) {
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
            {!agent.permissions && (
              <p className="text-muted-foreground col-span-2">No permissions configured.</p>
            )}
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
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default AgentWorkspace;
