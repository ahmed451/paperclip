import { useMemo, useState } from "react";
import { useParams, Link } from "@/lib/router";
import { useQuery } from "@tanstack/react-query";
import { agentsApi } from "../api/agents";
import { issuesApi } from "../api/issues";
import { useCompany } from "../context/CompanyContext";
import { queryKeys } from "../lib/queryKeys";
import { EmployeeLayout } from "../components/EmployeeLayout";
import { EmployeeCreateTaskDialog } from "../components/EmployeeCreateTaskDialog";
import { cn } from "@/lib/utils";
import { StatusIcon } from "../components/StatusIcon";
import { Flag, Plus } from "lucide-react";

type KanbanColumn = "todo" | "in_progress" | "blocked" | "done";

export function EmployeeRealtimeKanban() {
  const { agentId } = useParams<{ agentId: string }>();
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

  const assignedIssues = useMemo(
    () => (agent ? allIssues.filter((i) => i.assigneeAgentId === agent.id) : []),
    [allIssues, agent],
  );

  // Also show in_review tasks (awaiting approval) in the To Do column so they're visible
  const columns = {
    todo: assignedIssues.filter(
      (i) => i.status === "todo" || i.status === "backlog" || i.status === "in_review",
    ),
    in_progress: assignedIssues.filter((i) => i.status === "in_progress"),
    blocked: assignedIssues.filter((i) => i.status === "blocked"),
    done: assignedIssues.filter((i) => i.status === "done").slice(0, 10),
  };

  const colStyles: Record<KanbanColumn, string> = {
    todo: "border-gray-500/50",
    in_progress: "border-green-500/50",
    blocked: "border-red-500/50",
    done: "border-gray-500/50",
  };
  const colTitles: Record<KanbanColumn, string> = {
    todo: "To Do",
    in_progress: "In Progress",
    blocked: "Blocked",
    done: "Done",
  };

  if (isLoading) return <div className="h-full bg-[#0f172a]" />;

  return (
    <EmployeeLayout>
      <EmployeeCreateTaskDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        defaultAssigneeId={agentId}
      />
      <div className="h-full overflow-auto p-6 flex flex-col gap-4">
        {/* Header */}
        <div className="flex items-center justify-between shrink-0">
          <h2 className="text-lg font-semibold text-white">Kanban</h2>
          <button
            onClick={() => setCreateOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Task
          </button>
        </div>

        {/* Board */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 flex-1 min-h-0">
          {(Object.keys(colStyles) as KanbanColumn[]).map((col) => (
            <div key={col} className="flex flex-col min-h-[400px]">
              {/* Column header */}
              <div
                className={cn(
                  "mb-3 p-3 rounded-lg border-2 flex items-center justify-between",
                  colStyles[col],
                )}
              >
                <h3 className="font-semibold text-white">{colTitles[col]}</h3>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400 bg-white/10 px-2 py-0.5 rounded-full">
                    {columns[col].length}
                  </span>
                  {col === "todo" && (
                    <button
                      onClick={() => setCreateOpen(true)}
                      className="w-5 h-5 rounded flex items-center justify-center text-gray-500 hover:text-white hover:bg-white/10 transition-colors"
                      title="Add task"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Cards */}
              <div className="flex-1 space-y-2 overflow-auto">
                {columns[col].map((issue) => (
                  <Link
                    key={issue.id}
                    to={`/issues/${issue.id}`}
                    className="block p-3 bg-[#1e293b] rounded-lg border border-white/10 hover:border-white/30 transition-colors"
                  >
                    <div className="flex items-start gap-2">
                      <StatusIcon status={issue.status} className="w-4 h-4 mt-0.5 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium text-white truncate">
                          {issue.identifier}
                        </div>
                        <div className="text-xs text-gray-400 truncate mt-0.5">
                          {issue.title || "Untitled"}
                        </div>
                        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                          {(issue.priority === "critical" || issue.priority === "high") && (
                            <span className="flex items-center gap-1 text-xs text-red-400">
                              <Flag className="w-3 h-3" />
                              {issue.priority}
                            </span>
                          )}
                          {issue.status === "in_review" && (
                            <span className="text-xs text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded">
                              awaiting approval
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
                {columns[col].length === 0 && (
                  <p className="text-sm text-gray-600 text-center py-8">No tasks</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </EmployeeLayout>
  );
}

export default EmployeeRealtimeKanban;
