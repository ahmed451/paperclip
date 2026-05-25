import { Outlet, useParams, Navigate, useLocation } from "@/lib/router";
import { useQuery } from "@tanstack/react-query";
import { agentsApi } from "../api/agents";
import { getEmployeeSession, canAccessAgentPortal } from "../lib/employeeAuth";

export function EmployeeAuthGate() {
  const { agentId } = useParams<{ agentId: string }>();
  const location = useLocation();
  const session = getEmployeeSession();

  const { data: agents, isLoading } = useQuery({
    queryKey: ["ep-agents", session?.companyId ?? ""],
    queryFn: () => agentsApi.list(session!.companyId),
    enabled: !!session,
  });

  if (!session) {
    const next = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/employee-portal/login?next=${next}`} replace />;
  }

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-[#0f172a]">
        <div className="text-white text-sm">Authenticating…</div>
      </div>
    );
  }

  if (agentId && agents && !canAccessAgentPortal(session, agentId, agents)) {
    return <Navigate to={`/employee-portal/${session.agentId}/dashboard`} replace />;
  }

  return <Outlet />;
}
