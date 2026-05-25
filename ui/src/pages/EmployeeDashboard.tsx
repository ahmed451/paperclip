import { useMemo, useState } from "react";
import { useParams } from "@/lib/router";
import { useQuery } from "@tanstack/react-query";
import { agentsApi } from "../api/agents";
import { issuesApi } from "../api/issues";
import { useCompany } from "../context/CompanyContext";
import { queryKeys } from "../lib/queryKeys";
import { cn } from "../lib/utils";
import { EmployeeLayout } from "../components/EmployeeLayout";
import { EmployeeCreateTaskDialog } from "../components/EmployeeCreateTaskDialog";
import { useTranslations } from "../lib/translations";
import {
  LayoutDashboard,
  TrendingUp,
  CheckCircle2,
  Clock,
  AlertCircle,
  Target,
  Activity,
  Users,
  Briefcase,
  Plus,
} from "lucide-react";
import type { Agent, Issue } from "@paperclipai/shared";

export function EmployeePortfolioDashboard() {
  const { agentId } = useParams<{ agentId: string }>();
  const { selectedCompanyId } = useCompany();
  const { t } = useTranslations();
  const [createOpen, setCreateOpen] = useState(false);

  // Fetch agent
  const { data: agent, isLoading: agentLoading } = useQuery({
    queryKey: [...queryKeys.agents.detail(agentId!), selectedCompanyId ?? null],
    queryFn: () => agentsApi.get(agentId!, selectedCompanyId!),
    enabled: !!selectedCompanyId && !!agentId,
  });

  // Fetch issues assigned to this agent
  const { data: allIssues = [] } = useQuery({
    queryKey: queryKeys.issues.list(selectedCompanyId!),
    queryFn: () => issuesApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const assignedIssues = useMemo(() => {
    if (!agent) return [];
    return allIssues.filter(issue => issue.assigneeAgentId === agent.id);
  }, [allIssues, agent]);

  // Calculate stats
  const stats = useMemo(() => {
    const total = assignedIssues.length;
    const inProgress = assignedIssues.filter(i => i.status === "in_progress").length;
    const completed = assignedIssues.filter(i => i.status === "done").length;
    const blocked = assignedIssues.filter(i => i.status === "blocked").length;
    const pending = assignedIssues.filter(i => i.status === "todo" || i.status === "backlog").length;

    return { total, inProgress, completed, blocked, pending };
  }, [assignedIssues]);

  if (agentLoading) {
    return <EmployeeDashboardSkeleton />;
  }

  return (
    <EmployeeLayout>
      <EmployeeCreateTaskDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        defaultAssigneeId={agentId}
      />
      <div className="p-6 space-y-6">
        {/* Page header */}
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">Dashboard</h2>
          <button
            onClick={() => setCreateOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Task
          </button>
        </div>
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            icon={Target}
            label={t("totalTasks")}
            value={stats.total}
            subtext={t("assignedToYou")}
            color="blue"
          />
          <StatCard
            icon={Activity}
            label={t("inProgress")}
            value={stats.inProgress}
            subtext={t("activeWork")}
            color="green"
          />
          <StatCard
            icon={Clock}
            label={t("todoLowercase")}
            value={stats.pending}
            subtext={t("waitingToStart")}
            color="yellow"
          />
          <StatCard
            icon={AlertCircle}
            label={t("blocked")}
            value={stats.blocked}
            subtext={t("needsAttention")}
            color="red"
          />
        </div>

        {/* Recent Activity Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Current Work */}
          <div className="bg-[#1e293b] rounded-lg border border-white/10 p-4">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Briefcase className="w-5 h-5 text-purple-400" />
              {t("currentWork")}
            </h3>
            <div className="space-y-2">
              {assignedIssues.filter(i => i.status === "in_progress").slice(0, 5).map(issue => (
                <div
                  key={issue.id}
                  className="p-3 bg-white/5 rounded-lg border border-white/10 hover:bg-white/10 transition-colors"
                >
                  <div className="text-sm font-medium text-white">{issue.identifier}</div>
                  <div className="text-xs text-gray-400 truncate mt-1">{issue.title || "Untitled"}</div>
                </div>
              ))}
              {assignedIssues.filter(i => i.status === "in_progress").length === 0 && (
                <p className="text-sm text-gray-400 text-center py-4">{t("noActiveTasks")}</p>
              )}
            </div>
          </div>

          {/* Portfolio Summary */}
          <div className="bg-[#1e293b] rounded-lg border border-white/10 p-4">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-green-400" />
              {t("portfolioSummary")}
            </h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-400">{t("completionRate")}</span>
                <span className="text-sm font-semibold text-white">
                  {stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0}%
                </span>
              </div>
              <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-purple-500 to-green-500 transition-all duration-500"
                  style={{ width: `${stats.total > 0 ? (stats.completed / stats.total) * 100 : 0}%` }}
                />
              </div>
              <div className="grid grid-cols-2 gap-4 pt-2">
                <div className="p-3 bg-white/5 rounded-lg text-center">
                  <div className="text-lg font-bold text-green-400">{stats.completed}</div>
                  <div className="text-xs text-gray-400">{t("completedStatus")}</div>
                </div>
                <div className="p-3 bg-white/5 rounded-lg text-center">
                  <div className="text-lg font-bold text-red-400">{stats.blocked}</div>
                  <div className="text-xs text-gray-400">{t("blocked")}</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Org Chart Preview */}
        {agent && (
          <div className="bg-[#1e293b] rounded-lg border border-white/10 p-4">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Users className="w-5 h-5 text-blue-400" />
              {t("yourRoleInOrg")}
            </h3>
            <div className="flex items-center gap-4 text-sm">
              <div className="flex-1 p-3 bg-white/5 rounded-lg border border-white/10">
                <div className="text-gray-400">{t("agentName")}</div>
                <div className="text-white font-medium">{agent.name}</div>
              </div>
              <div className="flex-1 p-3 bg-white/5 rounded-lg border border-white/10">
                <div className="text-gray-400">{t("role")}</div>
                <div className="text-white font-medium capitalize">{agent.role}</div>
              </div>
              <div className="flex-1 p-3 bg-white/5 rounded-lg border border-white/10">
                <div className="text-gray-400">{t("title")}</div>
                <div className="text-white font-medium">{agent.title || "—"}</div>
              </div>
            </div>
            {agent.reportsTo && (
              <div className="mt-4 p-3 bg-white/5 rounded-lg border border-white/10">
                <div className="text-gray-400 text-sm">{t("reportsTo")}</div>
                <div className="text-white font-medium">{agent.reportsTo.slice(0, 8)}</div>
              </div>
            )}
          </div>
        )}
      </div>
    </EmployeeLayout>
  );
}

function StatCard({ icon: Icon, label, value, subtext, color }: {
  icon: React.ElementType;
  label: string;
  value: number;
  subtext: string;
  color: "blue" | "green" | "yellow" | "red";
}) {
  const colorClasses = {
    blue: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    green: "bg-green-500/20 text-green-400 border-green-500/30",
    yellow: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
    red: "bg-red-500/20 text-red-400 border-red-500/30",
  };

  return (
    <div className="bg-[#1e293b] rounded-lg border border-white/10 p-4 hover:border-white/20 transition-colors">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-400">{label}</p>
          <p className="text-3xl font-bold text-white mt-1">{value}</p>
          <p className="text-xs text-gray-500 mt-1">{subtext}</p>
        </div>
        <div className={cn("p-2 rounded-lg", colorClasses[color])}>
          <Icon className="w-6 h-6" />
        </div>
      </div>
    </div>
  );
}

function EmployeeDashboardSkeleton() {
  return (
    <div className="h-full flex flex-col bg-[#0f172a]">
      <header className="h-16 border-b border-white/10 bg-[#1e293b]" />
      <div className="flex-1 p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-[#1e293b] rounded-lg h-32 animate-pulse" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-[#1e293b] rounded-lg h-64 animate-pulse" />
          <div className="bg-[#1e293b] rounded-lg h-64 animate-pulse" />
        </div>
      </div>
    </div>
  );
}

export default EmployeePortfolioDashboard;
