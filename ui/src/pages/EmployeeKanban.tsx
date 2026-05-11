import { useMemo } from "react";
import { useParams, Link } from "@/lib/router";
import { useQuery } from "@tanstack/react-query";
import { agentsApi } from "../api/agents";
import { issuesApi } from "../api/issues";
import { useCompany } from "../context/CompanyContext";
import { queryKeys } from "../lib/queryKeys";
import { EmployeeLayout } from "../components/EmployeeLayout";
import { cn } from "@/lib/utils";
import { timeAgo } from "../lib/timeAgo";
import { StatusIcon } from "../components/StatusIcon";
import { Flag, Clock } from "lucide-react";

type KanbanColumn = "todo" | "in_progress" | "blocked" | "done";

export function EmployeeRealtimeKanban() {
  const { agentId } = useParams<{ agentId: string }>();
  const { selectedCompanyId } = useCompany();

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

  const assignedIssues = useMemo(() => agent ? allIssues.filter(i => i.assigneeAgentId === agent.id) : [], [allIssues, agent]);

  const columns = {
    todo: assignedIssues.filter(i => i.status === "todo" || i.status === "backlog"),
    in_progress: assignedIssues.filter(i => i.status === "in_progress"),
    blocked: assignedIssues.filter(i => i.status === "blocked"),
    done: assignedIssues.filter(i => i.status === "done").slice(0, 10),
  };

  const styles = {
    todo: "border-gray-500/50", in_progress: "border-green-500/50",
    blocked: "border-red-500/50", done: "border-gray-500/50",
  };
  const titles = { todo: "To Do", in_progress: "In Progress", blocked: "Blocked", done: "Done" };

  if (isLoading) return <div className="h-full bg-[#0f172a]" />;

  return (
    <EmployeeLayout>
      <div className="h-full overflow-auto p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 h-full">
          {(Object.keys(styles) as KanbanColumn[]).map(col => (
            <div key={col} className="flex flex-col h-full min-h-[400px]">
              <div className={`mb-3 p-3 rounded-lg border-2 flex items-center justify-between ${styles[col]}`}>
                <h3 className="font-semibold text-white">{titles[col]}</h3>
                <span className="text-xs text-gray-400 bg-white/10 px-2 py-0.5 rounded-full">{columns[col].length}</span>
              </div>
              <div className="flex-1 space-y-2 overflow-auto">
                {columns[col].map(issue => (
                  <Link key={issue.id} to={`/issues/${issue.id}`} className="block p-3 bg-[#1e293b] rounded-lg border border-white/10 hover:border-white/30">
                    <div className="flex items-start gap-2">
                      <StatusIcon status={issue.status} className="w-4 h-4 mt-0.5" />
                      <div>
                        <div className="text-sm font-medium text-white truncate">{issue.identifier}</div>
                        <div className="text-xs text-gray-400 truncate">{issue.title || "Untitled"}</div>
                        {(issue.priority === "critical" || issue.priority === "high") && (
                          <span className="flex items-center gap-1 text-xs text-red-400 mt-1"><Flag className="w-3 h-3"/>{issue.priority}</span>
                        )}
                      </div>
                    </div>
                  </Link>
                ))}
                {columns[col].length === 0 && <p className="text-sm text-gray-500 text-center py-8">No issues</p>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </EmployeeLayout>
  );
}

export default EmployeeRealtimeKanban;
