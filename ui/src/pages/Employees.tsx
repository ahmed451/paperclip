import { useEffect, useMemo } from "react";
import { Link, useNavigate } from "@/lib/router";
import { useQuery } from "@tanstack/react-query";
import { agentsApi } from "../api/agents";
import { issuesApi } from "../api/issues";
import { approvalsApi } from "../api/approvals";
import { useCompany } from "../context/CompanyContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { queryKeys } from "../lib/queryKeys";
import { cn } from "../lib/utils";
import { EmptyState } from "../components/EmptyState";
import { PageSkeleton } from "../components/PageSkeleton";
import { AgentIcon } from "../components/AgentIconPicker";
import { StatusBadge } from "../components/StatusBadge";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Users, Briefcase, AlertCircle } from "lucide-react";
import type { Agent, Issue, Approval } from "@paperclipai/shared";

export function Employees() {
  const { selectedCompanyId, selectedCompany } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();
  const navigate = useNavigate();

  // Set breadcrumbs
  useEffect(() => {
    if (selectedCompany) {
      setBreadcrumbs([
        { label: "Employees", href: `/${selectedCompany.issuePrefix}/employees` },
      ]);
    }
  }, [setBreadcrumbs, selectedCompany]);

  // Fetch all agents
  const { data: allAgents = [], isLoading: agentsLoading } = useQuery({
    queryKey: queryKeys.agents.list(selectedCompanyId!),
    queryFn: () => agentsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  // Fetch all issues for stats
  const { data: allIssues = [] } = useQuery({
    queryKey: queryKeys.issues.list(selectedCompanyId!),
    queryFn: () => issuesApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  // Fetch pending approvals for stats
  const { data: allApprovals = [] } = useQuery({
    queryKey: queryKeys.approvals.list(selectedCompanyId!),
    queryFn: () => approvalsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  // Calculate stats per agent
  const agentStats = useMemo(() => {
    const stats = new Map<string, { 
      totalTasks: number; 
      activeTasks: number; 
      pendingTasks: number; 
      blockedTasks: number;
      pendingApprovals: number;
    }>();

    allAgents.forEach(agent => {
      stats.set(agent.id, {
        totalTasks: 0,
        activeTasks: 0,
        pendingTasks: 0,
        blockedTasks: 0,
        pendingApprovals: 0,
      });
    });

    allIssues.forEach(issue => {
      if (issue.assigneeAgentId && stats.has(issue.assigneeAgentId)) {
        const stat = stats.get(issue.assigneeAgentId)!;
        stat.totalTasks++;
        if (issue.status === "in_progress") stat.activeTasks++;
        else if (issue.status === "todo" || issue.status === "backlog") stat.pendingTasks++;
        else if (issue.status === "blocked") stat.blockedTasks++;
      }
    });

    allApprovals.forEach(approval => {
      if (approval.requestedByAgentId && stats.has(approval.requestedByAgentId)) {
        if (approval.status === "pending") {
          stats.get(approval.requestedByAgentId)!.pendingApprovals++;
        }
      }
    });

    return stats;
  }, [allAgents, allIssues, allApprovals]);

  // Filter to employee agents
  const employeeAgents = useMemo(() => {
    return allAgents;
  }, [allAgents]);

  // Build org tree
  const orgTree = useMemo(() => {
    const roots = employeeAgents.filter(a => !a.reportsTo);
    
    type OrgNode = { agent: Agent; children: OrgNode[] };
    
    const buildTree = (agent: Agent): OrgNode => {
      const reports = employeeAgents.filter(a => a.reportsTo === agent.id);
      return {
        agent,
        children: reports.map(buildTree),
      };
    };

    return roots.map(buildTree);
  }, [employeeAgents]);

  if (agentsLoading) {
    return <PageSkeleton />;
  }

  if (!selectedCompanyId) {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <EmptyState
          icon={AlertCircle}
          message="Please select a company to view employees."
        />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-auto bg-[#0f172a]">
      {/* Header */}
      <div className="border-b border-white/10 bg-[#1e293b]">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-white">Employee Portal</h1>
              <p className="text-sm text-gray-400 mt-1">
                Workspace and task management for all team members
              </p>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-center">
                <div className="text-2xl font-semibold text-white">{employeeAgents.length}</div>
                <div className="text-xs text-gray-400">Team Members</div>
              </div>
              <Separator orientation="vertical" className="h-8 bg-white/10" />
              <div className="text-center">
                <div className="text-2xl font-semibold text-white">
                  {allIssues.filter(i => i.status === "in_progress").length}
                </div>
                <div className="text-xs text-gray-400">Active Tasks</div>
              </div>
              <Separator orientation="vertical" className="h-8 bg-white/10" />
              <div className="text-center">
                <div className="text-2xl font-semibold text-white">
                  {allApprovals.filter(a => a.status === "pending").length}
                </div>
                <div className="text-xs text-gray-400">Pending Approvals</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 p-6 space-y-6 overflow-auto">
        {employeeAgents.length === 0 ? (
          <EmptyState
            icon={Users}
            message="No employees found. Create agents to represent your team members."
            action="Create Agent"
            onAction={() => navigate("/agents/new")}
          />
        ) : (
          <div className="space-y-4">
            {orgTree.map(root => (
              <OrgNode 
                key={root.agent.id} 
                node={root} 
                stats={agentStats.get(root.agent.id)} 
                depth={0} 
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function OrgNode({ node, stats, depth }: { 
  node: { agent: Agent; children: { agent: Agent; children: any[] }[] }; 
  stats?: { totalTasks: number; activeTasks: number; pendingTasks: number; blockedTasks: number; pendingApprovals: number };
  depth: number;
}) {
  const { agent } = node;
  const isActive = agent.status === "active" || agent.status === "running" || agent.status === "idle";
  const isPaused = agent.status === "paused";

  return (
    <div className="space-y-4">
      <AgentCard agent={agent} stats={stats} />
      {node.children.length > 0 && (
        <div 
          className="ml-8 pl-4 border-l-2 border-white/10 relative space-y-4"
        >
          {node.children.map(child => (
            <OrgNode 
              key={child.agent.id} 
              node={child} 
              stats={stats} 
              depth={depth + 1} 
            />
          ))}
        </div>
      )}
    </div>
  );
}

function AgentCard({ agent, stats }: { 
  agent: Agent; 
  stats?: any;
}) {
  const isActive = agent.status === "active" || agent.status === "running" || agent.status === "idle";
  const isPaused = agent.status === "paused";

  return (
    <Card className="bg-[#1e293b] border-white/10 hover:bg-white/5 transition-colors cursor-pointer">
      <CardContent className="p-0">
        <div className="flex items-stretch">
          {/* Left section - Agent Info */}
          <div className="flex-1 p-4 flex items-center gap-4">
            <div className="relative">
              <div className="h-12 w-12 rounded-lg bg-purple-600/20 flex items-center justify-center">
                <AgentIcon icon={agent.icon} className="h-6 w-6 text-purple-400" />
              </div>
              <div 
                className={cn(
                  "absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-[#1e293b]",
                  isActive ? "bg-green-500" : isPaused ? "bg-yellow-500" : "bg-gray-400"
                )}
              />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-base text-white">{agent.name}</h3>
                <StatusBadge status={agent.status} />
              </div>
              <p className="text-sm text-gray-400 truncate">
                {agent.title || agent.role}
              </p>
              {agent.reportsTo && (
                <p className="text-xs text-gray-500 mt-1">
                  Reports to: {agent.reportsTo.slice(0, 8)}
                </p>
              )}
            </div>
          </div>

          {/* Middle section - Stats */}
          {stats && (
            <div className="flex items-center gap-6 px-4 border-l border-white/10">
              <div className="text-center">
                <div className="text-lg font-semibold text-blue-400">{stats.activeTasks}</div>
                <div className="text-xs text-gray-400">Active</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-semibold text-yellow-400">{stats.pendingTasks}</div>
                <div className="text-xs text-gray-400">Pending</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-semibold text-red-400">{stats.blockedTasks}</div>
                <div className="text-xs text-gray-400">Blocked</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-semibold text-orange-400">{stats.pendingApprovals}</div>
                <div className="text-xs text-gray-400">Approvals</div>
              </div>
            </div>
          )}

          {/* Right section - Actions */}
          <div className="flex items-center gap-2 px-4 border-l border-white/10">
            <Button variant="outline" size="sm" className="text-white border-white/20 hover:bg-white/10">
              <Link to={`/employee-portal/${agent.id}/dashboard`}>
                <Briefcase className="h-4 w-4 mr-1" />
                Workspace
              </Link>
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default Employees;
