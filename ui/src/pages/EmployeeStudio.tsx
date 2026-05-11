import { useMemo } from "react";
import { useParams } from "@/lib/router";
import { useQuery } from "@tanstack/react-query";
import { agentsApi } from "../api/agents";
import { issuesApi } from "../api/issues";
import { heartbeatsApi } from "../api/heartbeats";
import { activityApi } from "../api/activity";
import { useCompany } from "../context/CompanyContext";
import { queryKeys } from "../lib/queryKeys";
import { EmployeeLayout } from "../components/EmployeeLayout";
import { Activity, Cpu, Play, Zap } from "lucide-react";
import { timeAgo } from "../lib/timeAgo";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function EmployeeAgentStudio() {
  const { agentId } = useParams<{ agentId: string }>();
  const { selectedCompanyId } = useCompany();

  // Fetch agent
  const { data: agent, isLoading: agentLoading } = useQuery({
    queryKey: [...queryKeys.agents.detail(agentId!), selectedCompanyId ?? null],
    queryFn: () => agentsApi.get(agentId!, selectedCompanyId!),
    enabled: !!selectedCompanyId && !!agentId,
  });

  const resolvedCompanyId = agent?.companyId ?? selectedCompanyId;

  // Fetch recent runs
  const { data: recentRuns = [] } = useQuery({
    queryKey: [...queryKeys.heartbeats(resolvedCompanyId!, agent?.id), "studio"],
    queryFn: () => heartbeatsApi.list(resolvedCompanyId!, agent?.id, 10),
    enabled: !!selectedCompanyId && !!agent?.id,
  });

  // Fetch activity
  const { data: activityEvents = [] } = useQuery({
    queryKey: [...queryKeys.activity(resolvedCompanyId!), "studio", agent?.id],
    queryFn: () => activityApi.list(resolvedCompanyId!, { agentId: agent?.id, limit: 20 }),
    enabled: !!selectedCompanyId && !!agent?.id,
  });

  if (agentLoading || !agent) {
    return (
      <div className="h-full flex flex-col bg-[#0f172a]">
        <div className="flex-1 p-6">
          <div className="animate-pulse space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="bg-[#1e293b] rounded-lg h-48" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <EmployeeLayout>
      <div className="p-6 space-y-6">
        {/* Agent Configuration Card */}
        <Card className="bg-[#1e293b] border-white/10">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Cpu className="w-5 h-5 text-purple-400" />
              Agent Configuration
            </CardTitle>
            <CardDescription className="text-gray-400">
              Current runtime settings and capabilities
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 bg-white/5 rounded-lg border border-white/10">
                <div className="text-sm text-gray-400">Adapter Type</div>
                <div className="text-white font-medium">{agent.adapterType}</div>
              </div>
              <div className="p-3 bg-white/5 rounded-lg border border-white/10">
                <div className="text-sm text-gray-400">Monthly Budget</div>
                <div className="text-white font-medium">${(agent.budgetMonthlyCents / 100).toFixed(2)}</div>
              </div>
              <div className="p-3 bg-white/5 rounded-lg border border-white/10">
                <div className="text-sm text-gray-400">Spent This Month</div>
                <div className="text-white font-medium">${(agent.spentMonthlyCents / 100).toFixed(2)}</div>
              </div>
              <div className="p-3 bg-white/5 rounded-lg border border-white/10">
                <div className="text-sm text-gray-400">Last Heartbeat</div>
                <div className="text-white font-medium">
                  {agent.lastHeartbeatAt ? timeAgo(new Date(agent.lastHeartbeatAt)) : "Never"}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Recent Runs & Activity */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="bg-[#1e293b] border-white/10">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Play className="w-5 h-5 text-green-400" />
                Recent Runs
              </CardTitle>
              <CardDescription className="text-gray-400">
                Last 10 heartbeat executions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {recentRuns.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-4">No runs yet</p>
                ) : (
                  recentRuns.map(run => (
                    <div
                      key={run.id}
                      className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/10"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <Badge
                            variant={run.status === "succeeded" ? "default" : run.status === "failed" ? "destructive" : "secondary"}
                            className="text-xs"
                          >
                            {run.status}
                          </Badge>
                          <span className="text-sm text-gray-400">{run.id.slice(0, 8)}</span>
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          {run.triggerDetail || "Manual"} • {timeAgo(new Date(run.createdAt))}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-[#1e293b] border-white/10">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Activity className="w-5 h-5 text-blue-400" />
                Activity Log
              </CardTitle>
              <CardDescription className="text-gray-400">
                Recent agent actions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-[400px] overflow-auto">
                {activityEvents.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-4">No activity yet</p>
                ) : (
                  activityEvents.map((event, idx) => (
                    <div key={event.id || idx} className="flex items-start gap-3 py-2 border-b border-white/5 last:border-0">
                      <div className="w-2 h-2 rounded-full bg-purple-400 mt-1.5" />
                      <div className="flex-1">
                        <p className="text-sm text-white">{event.action}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{timeAgo(new Date(event.createdAt))}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Permissions */}
        <Card className="bg-[#1e293b] border-white/10">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Zap className="w-5 h-5 text-yellow-400" />
              Permissions & Capabilities
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {agent.permissions && Object.entries(agent.permissions).map(([key, value]) => (
                <div
                  key={key}
                  className={cn(
                    "p-3 rounded-lg border text-center",
                    value
                      ? "bg-green-500/10 border-green-500/30"
                      : "bg-gray-500/10 border-gray-500/30"
                  )}
                >
                  <div className="text-xs text-gray-400 mb-1">{key.replace(/_/g, " ")}</div>
                  <div className={cn("text-sm font-semibold", value ? "text-green-400" : "text-gray-500")}>
                    {value ? "Enabled" : "Disabled"}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </EmployeeLayout>
  );
}

export default EmployeeAgentStudio;
