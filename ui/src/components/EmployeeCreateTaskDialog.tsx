import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useQuery } from "@tanstack/react-query";
import { agentsApi } from "../api/agents";
import { issuesApi } from "../api/issues";
import { approvalsApi } from "../api/approvals";
import { queryKeys } from "../lib/queryKeys";
import { getEmployeeSession } from "../lib/employeeAuth";
import { useCompany } from "../context/CompanyContext";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Flag, Loader2, ShieldCheck, User, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { IssuePriority } from "@paperclipai/shared";

interface EmployeeCreateTaskDialogProps {
  open: boolean;
  onClose: () => void;
  defaultAssigneeId?: string;
}

const PRIORITIES: { value: IssuePriority; label: string; color: string }[] = [
  { value: "critical", label: "Critical", color: "text-red-400" },
  { value: "high",     label: "High",     color: "text-orange-400" },
  { value: "medium",   label: "Medium",   color: "text-yellow-400" },
  { value: "low",      label: "Low",      color: "text-blue-400" },
];

export function EmployeeCreateTaskDialog({
  open,
  onClose,
  defaultAssigneeId,
}: EmployeeCreateTaskDialogProps) {
  const { selectedCompanyId } = useCompany();
  const queryClient = useQueryClient();
  const session = getEmployeeSession();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<IssuePriority>("medium");
  const [assigneeAgentId, setAssigneeAgentId] = useState(defaultAssigneeId ?? session?.agentId ?? "");
  const [requiresApproval, setRequiresApproval] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: agents = [] } = useQuery({
    queryKey: queryKeys.agents.list(selectedCompanyId!),
    queryFn: () => agentsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setPriority("medium");
    setAssigneeAgentId(defaultAssigneeId ?? session?.agentId ?? "");
    setRequiresApproval(false);
    setError(null);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCompanyId || !title.trim()) return;
    setSubmitting(true);
    setError(null);

    try {
      // Create the issue.
      // Without approval: status "todo" — server auto-sends wakeup to the assigned agent.
      // With approval: status "in_review" — agent waits; board must approve before it starts.
      const issue = await issuesApi.create(selectedCompanyId, {
        title: title.trim(),
        description: description.trim() || null,
        priority,
        assigneeAgentId: assigneeAgentId || null,
        status: requiresApproval ? "in_review" : "todo",
      });

      if (requiresApproval) {
        const assignedAgent = agents.find((a) => a.id === assigneeAgentId);
        const approval = await approvalsApi.create(selectedCompanyId, {
          type: "request_board_approval",
          requestedByAgentId: session?.agentId ?? null,
          payload: {
            taskTitle: issue.title,
            taskIdentifier: issue.identifier,
            taskPriority: priority,
            taskDescription: description.trim() || null,
            assignedTo: assignedAgent?.name ?? null,
            issueId: issue.id,
            note: "This task requires board approval before the assigned agent begins execution.",
          },
        });
        await issuesApi.linkApproval(issue.id, approval.id);
      }

      await queryClient.invalidateQueries({ queryKey: ["issues", selectedCompanyId] });
      await queryClient.invalidateQueries({ queryKey: ["approvals", selectedCompanyId] });

      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create task.");
    } finally {
      setSubmitting(false);
    }
  };

  const selectedPriority = PRIORITIES.find((p) => p.value === priority)!;
  const assignedAgent = agents.find((a) => a.id === assigneeAgentId);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="bg-[#1e293b] border-white/10 text-white max-w-lg p-0 gap-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-white/10">
          <DialogTitle className="text-white text-lg font-semibold">New Task</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-5">
          {/* Title */}
          <div>
            <label className="block text-xs font-medium text-gray-400 uppercase tracking-wide mb-1.5">
              Title <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="What needs to be done?"
              className="w-full bg-[#0f172a] border border-white/20 rounded-lg px-4 py-2.5 text-white text-sm placeholder:text-gray-600 focus:border-purple-500 focus:outline-none"
              required
              autoFocus
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-medium text-gray-400 uppercase tracking-wide mb-1.5">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add details, context, or acceptance criteria…"
              rows={3}
              className="w-full bg-[#0f172a] border border-white/20 rounded-lg px-4 py-2.5 text-white text-sm placeholder:text-gray-600 focus:border-purple-500 focus:outline-none resize-none"
            />
          </div>

          {/* Priority + Assignee row */}
          <div className="grid grid-cols-2 gap-4">
            {/* Priority */}
            <div>
              <label className="block text-xs font-medium text-gray-400 uppercase tracking-wide mb-1.5">
                Priority
              </label>
              <div className="relative">
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as IssuePriority)}
                  className="w-full appearance-none bg-[#0f172a] border border-white/20 rounded-lg pl-3 pr-8 py-2.5 text-sm focus:border-purple-500 focus:outline-none text-white"
                >
                  {PRIORITIES.map((p) => (
                    <option key={p.value} value={p.value}>
                      {p.label}
                    </option>
                  ))}
                </select>
                <div className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                  <Flag className={cn("w-3.5 h-3.5", selectedPriority.color)} />
                  <ChevronDown className="w-3 h-3 text-gray-500" />
                </div>
              </div>
            </div>

            {/* Assignee */}
            <div>
              <label className="block text-xs font-medium text-gray-400 uppercase tracking-wide mb-1.5">
                Assign To
              </label>
              <div className="relative">
                <select
                  value={assigneeAgentId}
                  onChange={(e) => setAssigneeAgentId(e.target.value)}
                  className="w-full appearance-none bg-[#0f172a] border border-white/20 rounded-lg pl-3 pr-8 py-2.5 text-sm focus:border-purple-500 focus:outline-none text-white"
                >
                  <option value="">Unassigned</option>
                  {agents.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.id === session?.agentId ? `Myself (${a.name})` : a.name}
                    </option>
                  ))}
                </select>
                <div className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-gray-500" />
                  <ChevronDown className="w-3 h-3 text-gray-500" />
                </div>
              </div>
            </div>
          </div>

          {/* Approval toggle */}
          <button
            type="button"
            onClick={() => setRequiresApproval((v) => !v)}
            className={cn(
              "w-full flex items-center gap-3 px-4 py-3 rounded-lg border transition-colors text-left",
              requiresApproval
                ? "bg-amber-500/10 border-amber-500/40 text-amber-300"
                : "bg-white/5 border-white/10 text-gray-400 hover:bg-white/10 hover:text-gray-300",
            )}
          >
            <ShieldCheck className="w-4 h-4 shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium">Requires human approval</div>
              <div className="text-xs opacity-70 mt-0.5">
                {requiresApproval
                  ? "Task will wait in review until the board approves it"
                  : "Task will be assigned directly — agent starts immediately"}
              </div>
            </div>
            <div
              className={cn(
                "w-9 h-5 rounded-full transition-colors shrink-0",
                requiresApproval ? "bg-amber-500" : "bg-white/20",
              )}
            >
              <div
                className={cn(
                  "w-4 h-4 bg-white rounded-full mt-0.5 transition-transform shadow-sm",
                  requiresApproval ? "translate-x-4" : "translate-x-0.5",
                )}
              />
            </div>
          </button>

          {/* Approval info banner */}
          {requiresApproval && assignedAgent && (
            <div className="flex items-start gap-2 bg-amber-500/5 border border-amber-500/20 rounded-lg px-4 py-3">
              <ShieldCheck className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
              <p className="text-xs text-amber-300/80">
                An approval request will be sent to the board. <strong>{assignedAgent.name}</strong> will
                only begin execution after the board approves.
              </p>
            </div>
          )}

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-sm text-red-400">
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-1">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !title.trim()}
              className="flex items-center gap-2 px-5 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-medium text-sm rounded-lg transition-colors"
            >
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              {submitting ? "Creating…" : "Create Task"}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
