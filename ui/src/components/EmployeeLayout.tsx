import { useEffect, useMemo, useState } from "react";
import { Link, useParams, useLocation, useNavigate } from "@/lib/router";
import { useQuery } from "@tanstack/react-query";
import { agentsApi } from "../api/agents";
import { useCompany } from "../context/CompanyContext";
import { queryKeys } from "../lib/queryKeys";
import { cn } from "../lib/utils";
import { cn as cnUtils } from "@/lib/utils";
import { useTranslations, type TranslationKey } from "../lib/translations";
import {
  LayoutDashboard,
  Inbox,
  Kanban,
  Settings,
  ChevronLeft,
  ChevronRight,
  User,
  Menu,
  X,
  Languages,
} from "lucide-react";
import type { Agent } from "@paperclipai/shared";

interface EmployeeLayoutProps {
  children: React.ReactNode;
}

type EmployeeTab = "dashboard" | "studio" | "kanban" | "mailbox";

export function EmployeeLayout({ children }: EmployeeLayoutProps) {
  const { agentId } = useParams<{ agentId: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const { selectedCompanyId } = useCompany();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { t, language, toggleLanguage, isRTL } = useTranslations();

  // Fetch agent
  const { data: agent, isLoading } = useQuery({
    queryKey: [...queryKeys.agents.detail(agentId!), selectedCompanyId ?? null],
    queryFn: () => agentsApi.get(agentId!, selectedCompanyId!),
    enabled: !!selectedCompanyId && !!agentId,
  });

  // Determine active tab from route
  const getActiveTab = (): EmployeeTab => {
    if (location.pathname.includes("/dashboard")) return "dashboard";
    if (location.pathname.includes("/studio")) return "studio";
    if (location.pathname.includes("/kanban")) return "kanban";
    if (location.pathname.includes("/mailbox")) return "mailbox";
    return "dashboard";
  };

  const activeTab = getActiveTab();

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center bg-[#0f172a]">
        <div className="text-white text-lg">Loading...</div>
      </div>
    );
  }

  return (
    <div className="h-full flex bg-[#0f172a] text-white overflow-hidden">
      {/* Mobile menu toggle */}
      <button
        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 bg-[#1e293b] rounded-lg border border-white/10"
      >
        {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
      </button>

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed lg:relative z-40 h-full transition-all duration-300 border-r border-white/10 flex flex-col bg-[#1e293b]",
          mobileMenuOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
          sidebarCollapsed ? "w-16" : "w-64"
        )}
      >
        {/* Branding Area - Top */}
        <div className="h-14 border-b border-white/10 flex items-center px-4 bg-[#0f172a]">
          {!sidebarCollapsed && (
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-purple-700 flex items-center justify-center">
                <span className="text-white font-bold text-sm">N</span>
              </div>
              <div>
                <div className="text-xs text-gray-400">Company</div>
                <div className="text-sm font-semibold text-white">NextAI</div>
              </div>
            </div>
          )}
        </div>

        {/* Employee Portal Branding */}
        <div className="h-16 flex items-center justify-center border-b border-white/10 px-4 bg-[#1e293b]">
          {!sidebarCollapsed && (
            <span className="text-lg font-bold text-white">{t("portalTitle")}</span>
          )}
        </div>

        {/* Language Toggle */}
        <button
          onClick={toggleLanguage}
          className="mx-2 mb-2 p-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 transition-colors flex items-center justify-center gap-2"
          title={language === "en" ? "Switch to Arabic" : "Switch to English"}
        >
          <Languages className="w-4 h-4 text-white" />
          {!sidebarCollapsed && (
            <span className="text-xs text-white font-medium">{language === "en" ? "العربية" : "English"}</span>
          )}
        </button>

        {/* Toggle Button */}
        <button
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          className="hidden lg:flex absolute -right-3 top-20 w-6 h-6 rounded-full bg-purple-600 hover:bg-purple-700 items-center justify-center border-2 border-white/20 transition-colors"
          style={{ right: sidebarCollapsed ? "auto" : "-12px" }}
        >
          {sidebarCollapsed ? (
            <ChevronRight className="w-4 h-4 text-white" />
          ) : (
            <ChevronLeft className="w-4 h-4 text-white" />
          )}
        </button>

        {/* Navigation Menu */}
        <nav className="flex-1 py-4 px-2 space-y-1">
          <Link
            to={`/employee-portal/${agentId}/dashboard`}
            className={cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200",
              activeTab === "dashboard"
                ? "bg-purple-600/20 text-white border-l-3 border-purple-500"
                : "text-gray-400 hover:bg-white/5 hover:text-white"
            )}
          >
            <LayoutDashboard className="w-5 h-5 shrink-0" />
            {!sidebarCollapsed && <span className="text-sm font-medium">{t("portfolioDashboard")}</span>}
          </Link>

          <Link
            to={`/employee-portal/${agentId}/studio`}
            className={cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200",
              activeTab === "studio"
                ? "bg-purple-600/20 text-white border-l-3 border-purple-500"
                : "text-gray-400 hover:bg-white/5 hover:text-white"
            )}
          >
            <Settings className="w-5 h-5 shrink-0" />
            {!sidebarCollapsed && <span className="text-sm font-medium">{t("agentStudio")}</span>}
          </Link>

          <Link
            to={`/employee-portal/${agentId}/kanban`}
            className={cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200",
              activeTab === "kanban"
                ? "bg-purple-600/20 text-white border-l-3 border-purple-500"
                : "text-gray-400 hover:bg-white/5 hover:text-white"
            )}
          >
            <Kanban className="w-5 h-5 shrink-0" />
            {!sidebarCollapsed && <span className="text-sm font-medium">{t("realtimeKanban")}</span>}
          </Link>

          <Link
            to={`/employee-portal/${agentId}/mailbox`}
            className={cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200",
              activeTab === "mailbox"
                ? "bg-purple-600/20 text-white border-l-3 border-purple-500"
                : "text-gray-400 hover:bg-white/5 hover:text-white"
            )}
          >
            <Inbox className="w-5 h-5 shrink-0" />
            {!sidebarCollapsed && <span className="text-sm font-medium">{t("mailboxApprovals")}</span>}
          </Link>
        </nav>

        {/* Agent Info at Bottom */}
        {!sidebarCollapsed && agent && (
          <div className="p-4 border-t border-white/10">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-purple-600/20 flex items-center justify-center">
                <User className="w-5 h-5 text-purple-400" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-white truncate">{agent.name}</div>
                <div className="text-xs text-gray-400 truncate">{agent.title || agent.role}</div>
              </div>
            </div>
          </div>
        )}
      </aside>

      {/* Overlay for mobile */}
      {mobileMenuOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-30"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <header className="h-16 border-b border-white/10 flex items-center justify-between px-6 bg-[#1e293b]">
          <div className="flex items-center gap-4">
            {agent && (
              <>
                <div className="w-10 h-10 rounded-lg bg-purple-600 flex items-center justify-center">
                  <User className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h1 className="text-lg font-bold text-white">{agent.name}</h1>
                  <p className="text-xs text-gray-400">{agent.title || agent.role}</p>
                </div>
              </>
            )}
          </div>

          <div className="flex items-center gap-3">
            {/* Language Toggle in Header */}
            <button
              onClick={toggleLanguage}
              className="p-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 transition-colors flex items-center gap-2"
              title={language === "en" ? "Switch to Arabic" : "Switch to English"}
            >
              <Languages className="w-4 h-4 text-white" />
              <span className="text-xs text-white font-medium">{language === "en" ? "العربية" : "English"}</span>
            </button>
            
            {agent && (
              <span
                className={cnUtils(
                  "px-3 py-1 rounded-full text-xs font-medium",
                  agent.status === "active" || agent.status === "running" || agent.status === "idle"
                    ? "bg-green-500/20 text-green-400 border border-green-500/30"
                    : agent.status === "paused"
                    ? "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30"
                    : "bg-gray-500/20 text-gray-400 border border-gray-500/30"
                )}
              >
                {t(agent.status.toLowerCase() as TranslationKey) || agent.status}
              </span>
            )}
          </div>
        </header>

        {/* Content Area */}
        <div className="flex-1 overflow-auto bg-[#0f172a]">
          {children}
        </div>
      </main>
    </div>
  );
}

export default EmployeeLayout;
