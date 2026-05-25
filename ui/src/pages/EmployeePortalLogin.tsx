import { useEffect, useMemo, useState } from "react";
import { useNavigate, useLocation } from "@/lib/router";
import { useQuery } from "@tanstack/react-query";
import { companiesApi } from "../api/companies";
import { agentsApi } from "../api/agents";
import { setEmployeeSession, EMPLOYEE_PORTAL_PASSWORD } from "../lib/employeeAuth";
import { CompanyPatternIcon } from "../components/CompanyPatternIcon";
import { AGENT_ROLE_LABELS } from "@paperclipai/shared";
import type { Agent, Company } from "@paperclipai/shared";
import { User, LogIn, Building2 } from "lucide-react";

export function EmployeePortalLogin() {
  const navigate = useNavigate();
  const location = useLocation();
  const next = new URLSearchParams(location.search).get("next");

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [selectedCompanyId, setSelectedCompanyId] = useState(
    localStorage.getItem("paperclip.selectedCompanyId") ?? "",
  );
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [ambiguousAgents, setAmbiguousAgents] = useState<Agent[] | null>(null);

  const { data: companies = [], isLoading: companiesLoading } = useQuery({
    queryKey: ["ep-login-companies"],
    queryFn: () => companiesApi.list(),
  });

  const { data: agents = [] } = useQuery({
    queryKey: ["ep-login-agents", selectedCompanyId],
    queryFn: () => agentsApi.list(selectedCompanyId),
    enabled: !!selectedCompanyId,
  });

  useEffect(() => {
    if (!selectedCompanyId && companies.length === 1) {
      setSelectedCompanyId(companies[0]!.id);
    }
  }, [companies, selectedCompanyId]);

  const selectedCompany = useMemo<Company | null>(
    () => companies.find((c) => c.id === selectedCompanyId) ?? null,
    [companies, selectedCompanyId],
  );

  const accentColor = selectedCompany?.brandColor ?? "#7c3aed";

  const doLogin = (agent: Agent) => {
    setEmployeeSession({
      agentId: agent.id,
      role: agent.role,
      companyId: selectedCompanyId,
      loggedInAt: Date.now(),
    });
    navigate(next ?? `/employee-portal/${agent.id}/dashboard`);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setAmbiguousAgents(null);
    setLoading(true);

    if (password !== EMPLOYEE_PORTAL_PASSWORD) {
      setError("Invalid password.");
      setLoading(false);
      return;
    }

    const normalizedRole = username.toLowerCase().trim();
    const matching = agents.filter((a) => a.role.toLowerCase() === normalizedRole);

    if (matching.length === 0) {
      setError(`No employee found with role "${username}". Try: ceo, cto, engineer…`);
      setLoading(false);
      return;
    }

    if (matching.length === 1) {
      doLogin(matching[0]!);
    } else {
      setAmbiguousAgents(matching);
    }
    setLoading(false);
  };

  const roleLabel = (role: string) =>
    (AGENT_ROLE_LABELS as Record<string, string>)[role] ?? role;

  return (
    <div className="fixed inset-0 flex bg-[#0f172a]">
      {/* ── Left panel: company branding ── */}
      <div
        className="hidden md:flex md:w-5/12 lg:w-2/5 flex-col items-center justify-center p-10 relative overflow-hidden"
        style={{ backgroundColor: `${accentColor}18` }}
      >
        {/* Subtle radial glow behind the logo */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: `radial-gradient(ellipse 70% 55% at 50% 45%, ${accentColor}30 0%, transparent 70%)`,
          }}
        />

        <div className="relative z-10 flex flex-col items-center text-center max-w-xs gap-6">
          {/* Logo / pattern icon */}
          {selectedCompany ? (
            <CompanyPatternIcon
              companyName={selectedCompany.name}
              logoUrl={selectedCompany.logoUrl}
              brandColor={selectedCompany.brandColor}
              className="w-24 h-24 rounded-2xl shadow-2xl"
              logoFit="contain"
            />
          ) : (
            <div className="w-24 h-24 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center">
              <Building2 className="w-10 h-10 text-white/20" />
            </div>
          )}

          {/* Company name */}
          <div>
            <h1 className="text-3xl font-bold text-white leading-tight">
              {selectedCompany?.name ?? "Employee Portal"}
            </h1>

            {/* Motto / description */}
            {selectedCompany?.description && (
              <p
                className="mt-3 text-sm leading-relaxed"
                style={{ color: `${accentColor}cc` }}
              >
                {selectedCompany.description}
              </p>
            )}
          </div>

          {/* Decorative divider */}
          <div
            className="w-12 h-0.5 rounded-full opacity-40"
            style={{ backgroundColor: accentColor }}
          />

          <p className="text-xs text-white/30 tracking-widest uppercase">
            Employee Workspace
          </p>
        </div>

        {/* Bottom-left corner accent */}
        <div
          className="absolute bottom-0 left-0 w-48 h-48 rounded-tr-full opacity-10"
          style={{ backgroundColor: accentColor }}
        />
        {/* Top-right corner accent */}
        <div
          className="absolute top-0 right-0 w-32 h-32 rounded-bl-full opacity-10"
          style={{ backgroundColor: accentColor }}
        />
      </div>

      {/* ── Right panel: login form ── */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 overflow-y-auto">
        {/* Mobile-only branding header */}
        <div className="md:hidden flex flex-col items-center gap-3 mb-8">
          {selectedCompany ? (
            <CompanyPatternIcon
              companyName={selectedCompany.name}
              logoUrl={selectedCompany.logoUrl}
              brandColor={selectedCompany.brandColor}
              className="w-16 h-16 rounded-xl shadow-lg"
              logoFit="contain"
            />
          ) : (
            <div className="w-16 h-16 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
              <Building2 className="w-7 h-7 text-white/20" />
            </div>
          )}
          <div className="text-center">
            <h1 className="text-xl font-bold text-white">
              {selectedCompany?.name ?? "Employee Portal"}
            </h1>
            {selectedCompany?.description && (
              <p className="text-xs text-white/40 mt-1">{selectedCompany.description}</p>
            )}
          </div>
        </div>

        <div className="w-full max-w-sm">
          <div className="mb-6">
            <h2 className="text-xl font-semibold text-white">Welcome back</h2>
            <p className="text-sm text-gray-500 mt-1">Sign in to access your workspace</p>
          </div>

          <div className="bg-[#1e293b] border border-white/10 rounded-xl p-7 shadow-2xl">
            {ambiguousAgents ? (
              /* Account picker */
              <div className="space-y-4">
                <p className="text-sm text-gray-300 text-center">
                  Multiple accounts found for{" "}
                  <span className="text-white font-medium">{username}</span>.
                  Select yours:
                </p>
                <div className="space-y-2">
                  {ambiguousAgents.map((agent) => (
                    <button
                      key={agent.id}
                      onClick={() => doLogin(agent)}
                      className="w-full flex items-center gap-3 px-4 py-3 bg-[#0f172a] hover:bg-white/5 border border-white/10 hover:border-white/20 rounded-lg transition-colors text-left"
                    >
                      <div
                        className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                        style={{ backgroundColor: `${accentColor}25` }}
                      >
                        <User className="w-4 h-4" style={{ color: accentColor }} />
                      </div>
                      <div>
                        <div className="text-sm font-medium text-white">{agent.name}</div>
                        <div className="text-xs text-gray-500">{agent.title || roleLabel(agent.role)}</div>
                      </div>
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => setAmbiguousAgents(null)}
                  className="w-full text-xs text-gray-600 hover:text-gray-400 transition-colors py-1"
                >
                  ← Back
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
                {/* Company selector — only when multiple companies exist */}
                {companies.length > 1 && (
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wide">
                      Company
                    </label>
                    <select
                      value={selectedCompanyId}
                      onChange={(e) => setSelectedCompanyId(e.target.value)}
                      className="w-full bg-[#0f172a] border border-white/20 rounded-lg px-4 py-2.5 text-white text-sm focus:border-purple-500 focus:outline-none appearance-none"
                      required
                    >
                      <option value="">Select company…</option>
                      {companies.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wide">
                    Username
                  </label>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Your role — e.g. ceo, engineer…"
                    autoComplete="username"
                    className="w-full bg-[#0f172a] border border-white/20 rounded-lg px-4 py-2.5 text-white text-sm placeholder:text-gray-700 focus:outline-none transition-colors"
                    style={username ? { borderColor: `${accentColor}66` } : {}}
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wide">
                    Password
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••"
                    autoComplete="current-password"
                    className="w-full bg-[#0f172a] border border-white/20 rounded-lg px-4 py-2.5 text-white text-sm placeholder:text-gray-700 focus:outline-none transition-colors"
                    style={password ? { borderColor: `${accentColor}66` } : {}}
                    required
                  />
                </div>

                {error && (
                  <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-sm text-red-400">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading || !selectedCompanyId || companiesLoading}
                  className="w-full flex items-center justify-center gap-2 text-white font-medium py-2.5 px-4 rounded-lg transition-all text-sm disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{ backgroundColor: accentColor }}
                >
                  <LogIn className="w-4 h-4" />
                  {loading ? "Signing in…" : "Sign In"}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
