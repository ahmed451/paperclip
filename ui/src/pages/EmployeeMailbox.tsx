import { useMemo, useState } from "react";
import { useParams, useNavigate } from "@/lib/router";
import { useQuery } from "@tanstack/react-query";
import { agentsApi } from "../api/agents";
import { issuesApi } from "../api/issues";
import { approvalsApi } from "../api/approvals";
import { heartbeatsApi } from "../api/heartbeats";
import { useCompany } from "../context/CompanyContext";
import { queryKeys } from "../lib/queryKeys";
import { EmployeeLayout } from "../components/EmployeeLayout";
import { EmployeeCreateTaskDialog } from "../components/EmployeeCreateTaskDialog";
import { cn } from "@/lib/utils";
import { timeAgo } from "../lib/timeAgo";
import { Inbox, Shield, CheckCircle2, AlertTriangle, Target, ChevronRight, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export function EmployeeMailbox() {
  const { agentId } = useParams<{ agentId: string }>();
  const navigate = useNavigate();
  const { selectedCompanyId } = useCompany();
  const [createOpen, setCreateOpen] = useState(false);

  const { data: agent, isLoading } = useQuery({
    queryKey: [...queryKeys.agents.detail(agentId!), selectedCompanyId ?? null],
    queryFn: () => agentsApi.get(agentId!, selectedCompanyId!),
    enabled: !!selectedCompanyId && !!agentId,
  });

  const { data: allIssues = [] } = useQuery({
    queryKey: queryKeys.issues.list(selectedCompanyId!),
    queryFn: () => issuesApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const { data: allApprovals = [] } = useQuery({
    queryKey: queryKeys.approvals.list(selectedCompanyId!),
    queryFn: () => approvalsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const { data: recentRuns = [] } = useQuery({
    queryKey: [...queryKeys.heartbeats(selectedCompanyId!, agent?.id), "mailbox"],
    queryFn: () => heartbeatsApi.list(selectedCompanyId!, agent?.id, 10),
    enabled: !!selectedCompanyId && !!agent?.id,
  });

  const inboxItems = useMemo(() => {
    if (!agent) return [];
    const items: any[] = [];
    allIssues.filter(i => i.assigneeAgentId === agent.id && i.status !== "done" && i.status !== "cancelled")
      .forEach(i => items.push({ id: `issue-${i.id}`, type: "task" as const, title: i.identifier, description: i.title || "Untitled", timestamp: new Date(i.updatedAt || i.createdAt), priority: i.priority === "critical" || i.priority === "high" ? "high" : "medium", issueId: i.id }));
    allApprovals.filter(a => a.status === "pending")
      .forEach(a => items.push({ id: `approval-${a.id}`, type: "approval" as const, title: "Approval Required", description: a.type || "Pending", timestamp: new Date(a.createdAt), priority: "high" as const, approvalId: a.id }));
    recentRuns.slice(0, 5).filter(r => r.status === "succeeded" || r.status === "failed")
      .forEach(r => items.push({ id: `run-${r.id}`, type: r.status === "succeeded" ? "success" : "error", title: r.status === "succeeded" ? "Completed" : "Failed", description: `Run ${r.id.slice(0, 8)}`, timestamp: new Date(r.finishedAt || r.startedAt || r.createdAt), priority: r.status === "failed" ? "high" : "low" }));
    return items.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }, [allIssues, allApprovals, recentRuns, agent]);

  if (isLoading) return <div className="h-full bg-[#0f172a]" />;

  return (
    <EmployeeLayout>
      <EmployeeCreateTaskDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        defaultAssigneeId={agentId}
      />
      <div className="p-6">
        <div className="mb-6 flex items-start justify-between">
          <div>
            <h2 className="text-xl font-semibold text-white mb-2">Mailbox & Approvals</h2>
            <p className="text-sm text-gray-400">Notifications, tasks, and approvals</p>
          </div>
          <button
            onClick={() => setCreateOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded-lg transition-colors shrink-0"
          >
            <Plus className="w-4 h-4" />
            New Task
          </button>
        </div>
        <div className="space-y-3">
          {inboxItems.length === 0 ? (
            <div className="bg-[#1e293b] rounded-lg border border-white/10 p-12 text-center">
              <Inbox className="w-16 h-16 text-gray-500 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-white mb-2">All caught up!</h3>
              <p className="text-sm text-gray-400">No new notifications</p>
            </div>
          ) : (
            inboxItems.map(item => {
              // Approval items are for the board to action — employees see status only, no navigation.
              const isApproval = item.type === "approval";
              const handleClick = isApproval
                ? undefined
                : () => { if ("issueId" in item && item.issueId) navigate(`/issues/${item.issueId}`); };

              return (
                <div
                  key={item.id}
                  onClick={handleClick}
                  className={cn(
                    "p-4 rounded-lg border transition-all",
                    isApproval
                      ? "bg-amber-500/5 border-amber-500/20 cursor-default"
                      : item.priority === "high"
                      ? "bg-orange-500/5 border-orange-500/30 cursor-pointer hover:bg-orange-500/10"
                      : "bg-[#1e293b] border-white/10 cursor-pointer hover:bg-white/5",
                  )}
                >
                  <div className="flex items-start gap-4">
                    <div className="p-2 rounded-lg bg-white/5 shrink-0">
                      {item.type === "task" && <Target className="w-5 h-5 text-blue-400" />}
                      {item.type === "approval" && <Shield className="w-5 h-5 text-amber-400" />}
                      {item.type === "success" && <CheckCircle2 className="w-5 h-5 text-green-400" />}
                      {item.type === "error" && <AlertTriangle className="w-5 h-5 text-red-400" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <h3 className="font-medium text-white truncate">{item.title}</h3>
                        {item.priority === "high" && !isApproval && (
                          <Badge variant="destructive" className="text-xs">High Priority</Badge>
                        )}
                        {isApproval && (
                          <Badge className="text-xs bg-amber-500/20 text-amber-300 border border-amber-500/30">
                            Awaiting board approval
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-gray-400 truncate">{item.description}</p>
                      {isApproval && (
                        <p className="text-xs text-amber-400/60 mt-1">
                          The board will review this before the task begins.
                        </p>
                      )}
                      <p className="text-xs text-gray-500 mt-1">{timeAgo(item.timestamp)}</p>
                    </div>
                    {!isApproval && <ChevronRight className="w-5 h-5 text-gray-400 shrink-0" />}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </EmployeeLayout>
  );
}

export default EmployeeMailbox;
