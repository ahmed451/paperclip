import type { Agent } from "@paperclipai/shared";

const SESSION_KEY = "ep_session";
export const EMPLOYEE_PORTAL_PASSWORD = "checkN124!";

const ADMIN_ROLES = new Set(["ceo", "cto", "cmo", "cfo"]);

export interface EmployeeSession {
  agentId: string;
  role: string;
  companyId: string;
  loggedInAt: number;
}

export function getEmployeeSession(): EmployeeSession | null {
  try {
    const stored = localStorage.getItem(SESSION_KEY);
    if (!stored) return null;
    return JSON.parse(stored) as EmployeeSession;
  } catch {
    return null;
  }
}

export function setEmployeeSession(session: EmployeeSession): void {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function clearEmployeeSession(): void {
  localStorage.removeItem(SESSION_KEY);
}

export function isAdminRole(role: string): boolean {
  return ADMIN_ROLES.has(role.toLowerCase());
}

export function canAccessAgentPortal(
  session: EmployeeSession,
  targetAgentId: string,
  allAgents: Agent[],
): boolean {
  if (session.agentId === targetAgentId) return true;
  if (isAdminRole(session.role)) return true;
  return isSubordinate(session.agentId, targetAgentId, allAgents);
}

function isSubordinate(managerId: string, agentId: string, allAgents: Agent[]): boolean {
  const agent = allAgents.find((a) => a.id === agentId);
  if (!agent || !agent.reportsTo) return false;
  if (agent.reportsTo === managerId) return true;
  return isSubordinate(managerId, agent.reportsTo, allAgents);
}

export function getAccessibleAgents(session: EmployeeSession, allAgents: Agent[]): Agent[] {
  return allAgents.filter((a) => canAccessAgentPortal(session, a.id, allAgents));
}
