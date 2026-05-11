import { useState, useEffect } from "react";

export const translations = {
  en: {
    portalTitle: "EMPLOYEE PORTAL",
    portfolioDashboard: "Portfolio Dashboard",
    agentStudio: "Agent Studio",
    realtimeKanban: "Realtime Kanban",
    mailboxApprovals: "Mailbox & Approvals",
    status: "Status",
    active: "Active",
    paused: "Paused",
    idle: "Idle",
    running: "Running",
    totalTasks: "Total Tasks",
    inProgress: "In Progress",
    todo: "To Do",
    todoLowercase: "pending",
    blocked: "Blocked",
    assignedToYou: "Assigned to you",
    activeWork: "Active work",
    waitingToStart: "Waiting to start",
    needsAttention: "Needs attention",
    currentWork: "Current Work",
    portfolioSummary: "Portfolio Summary",
    completionRate: "Completion Rate",
    completedStatus: "Completed",
    noActiveTasks: "No active tasks",
    yourRoleInOrg: "Your Role in Organization",
    agentName: "Agent Name",
    role: "Role",
    title: "Title",
    reportsTo: "Reports To",
    agentConfiguration: "Agent Configuration",
    currentRuntimeSettings: "Current runtime settings and capabilities",
    adapterType: "Adapter Type",
    monthlyBudget: "Monthly Budget",
    spentThisMonth: "Spent This Month",
    lastHeartbeat: "Last Heartbeat",
    recentRuns: "Recent Runs",
    last10Heartbeat: "Last 10 heartbeat executions",
    noRunsYet: "No runs yet",
    manual: "Manual",
    activityLog: "Activity Log",
    recentAgentActions: "Recent agent actions",
    noActivityYet: "No activity yet",
    permissionsCapabilities: "Permissions & Capabilities",
    enabled: "Enabled",
    disabled: "Disabled",
    todoKanban: "To Do",
    done: "Done",
    noIssues: "No issues",
    mailboxAndApprovals: "Mailbox & Approvals",
    notificationsTasksApprovals: "Notifications, tasks, and approvals",
    allCaughtUp: "All caught up!",
    noNewNotifications: "No new notifications",
    highPriority: "High Priority",
    approval: "Approval",
    approvalRequired: "Approval Required",
    todoStatus: "Pending",
    doneStatus: "Completed",
    failed: "Failed",
  },
  ar: {
    portalTitle: "بوابة الموظفين",
    portfolioDashboard: "لوحة المحافظ",
    agentStudio: "استوديو الوكيل",
    realtimeKanban: "كانبان في الوقت الفعلي",
    mailboxApprovals: "البريد والموافقات",
    status: "الحالة",
    active: "نشط",
    paused: "موقوف",
    idle: "خامل",
    running: "يعمل",
    totalTasks: "إجمالي المهام",
    inProgress: "قيد التنفيذ",
    todo: "للعمل",
    todoLowercase: "معلق",
    blocked: "محظور",
    assignedToYou: "مخصص لك",
    activeWork: "العمل النشط",
    waitingToStart: "في انتظار البدء",
    needsAttention: "يحتاج إلى انتباه",
    currentWork: "العمل الحالي",
    portfolioSummary: "ملخص المحفظة",
    completionRate: "معدل الإكمال",
    completedStatus: "مكتمل",
    noActiveTasks: "لا توجد مهام نشطة",
    yourRoleInOrg: "دورك في المنظمة",
    agentName: "اسم الوكيل",
    role: "الدور",
    title: "العنوان",
    reportsTo: "يُرفع إلى",
    agentConfiguration: "تكوين الوكيل",
    currentRuntimeSettings: "إعدادات وقدرات التشغيل الحالية",
    adapterType: "نوع المحول",
    monthlyBudget: "الميزانية الشهرية",
    spentThisMonth: "تم إنفاقه هذا الشهر",
    lastHeartbeat: "آخر نبض",
    recentRuns: "التشغيلات الأخيرة",
    last10Heartbeat: "آخر 10 تنفيذات للنبض",
    noRunsYet: "لا توجد تشغيلات بعد",
    manual: "يدوي",
    activityLog: "سجل النشاط",
    recentAgentActions: "إجراءات الوكيل الأخيرة",
    noActivityYet: "لا يوجد نشاط بعد",
    permissionsCapabilities: "الأذونات والقدرات",
    enabled: "ممكن",
    disabled: "معطل",
    todoKanban: "للعمل",
    done: "تم",
    noIssues: "لا توجد قضايا",
    mailboxAndApprovals: "البريد والموافقات",
    notificationsTasksApprovals: "الإشعارات والمهام والموافقات",
    allCaughtUp: "كل شيء محدث!",
    noNewNotifications: "لا توجد إشعارات جديدة",
    highPriority: "عالية الأولوية",
    approval: "موافقة",
    approvalRequired: "موافقة مطلوبة",
    todoStatus: "معلق",
    doneStatus: "مكتمل",
    failed: "فشل",
  },
};

export type Language = "en" | "ar";
export type TranslationKey = keyof typeof translations.en;

export function useTranslations(): {
  t: (key: TranslationKey) => string;
  language: Language;
  toggleLanguage: () => void;
  isRTL: boolean;
} {
  const [language, setLanguage] = useState<Language>("en");

  useEffect(() => {
    const stored = localStorage.getItem("employee-portal-language");
    if (stored === "ar" || stored === "en") {
      setLanguage(stored);
      document.documentElement.dir = stored === "ar" ? "rtl" : "ltr";
      document.documentElement.lang = stored;
    }
  }, []);

  const toggleLanguage = () => {
    const newLang = language === "en" ? "ar" : "en";
    setLanguage(newLang);
    localStorage.setItem("employee-portal-language", newLang);
    document.documentElement.dir = newLang === "ar" ? "rtl" : "ltr";
    document.documentElement.lang = newLang;
  };

  const t = (key: TranslationKey): string => {
    return translations[language][key] || translations.en[key] || key;
  };

  return { t, language, toggleLanguage, isRTL: language === "ar" };
}
