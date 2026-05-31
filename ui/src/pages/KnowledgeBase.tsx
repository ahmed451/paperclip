import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { knowledgeBaseApi } from "../api/knowledgeBase";
import type { KnowledgeDocument } from "../api/knowledgeBase";
import { useCompany } from "../context/CompanyContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { useEffect } from "react";
import {
  BookOpen,
  Upload,
  Search,
  Trash2,
  FileText,
  Loader2,
  X,
  Plus,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { cn } from "@/lib/utils";

function bytesToKb(n: number) {
  return n < 1024 ? `${n} B` : `${(n / 1024).toFixed(1)} KB`;
}

function timeAgo(d: Date) {
  const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export function KnowledgeBase() {
  const { selectedCompanyId, selectedCompany } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();
  const queryClient = useQueryClient();

  const [uploadOpen, setUploadOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchSubmit, setSearchSubmit] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    if (selectedCompany) {
      setBreadcrumbs([
        { label: "Knowledge Base", href: `/${selectedCompany.issuePrefix}/knowledge-base` },
      ]);
    }
  }, [setBreadcrumbs, selectedCompany]);

  const { data: docs = [], isLoading } = useQuery({
    queryKey: ["knowledge-base", selectedCompanyId],
    queryFn: () => knowledgeBaseApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const { data: searchResults, isFetching: searching } = useQuery({
    queryKey: ["knowledge-base-search", selectedCompanyId, searchSubmit],
    queryFn: () => knowledgeBaseApi.search(selectedCompanyId!, searchSubmit, 8),
    enabled: !!selectedCompanyId && !!searchSubmit,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => knowledgeBaseApi.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["knowledge-base", selectedCompanyId] }),
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearchSubmit(searchQuery.trim());
  };

  return (
    <div className="max-w-4xl mx-auto py-8 px-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-blue-500/10 flex items-center justify-center">
            <BookOpen className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <h1 className="text-xl font-semibold">Knowledge Base</h1>
            <p className="text-sm text-muted-foreground">
              Documents indexed for agent RAG search via{" "}
              <code className="text-xs bg-muted px-1 py-0.5 rounded">paperclipKbSearch</code>
            </p>
          </div>
        </div>
        <button
          onClick={() => setUploadOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-lg hover:opacity-90 transition-opacity"
        >
          <Plus className="w-4 h-4" />
          Add Document
        </button>
      </div>

      {/* Search bar */}
      <form onSubmit={handleSearch} className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Test the search index — try a query agents would ask…"
            className="w-full pl-9 pr-4 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:border-primary"
          />
        </div>
        <button
          type="submit"
          disabled={!searchQuery.trim() || searching}
          className="px-4 py-2 bg-muted hover:bg-muted/80 text-sm font-medium rounded-lg disabled:opacity-40 transition-colors"
        >
          {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : "Search"}
        </button>
        {searchSubmit && (
          <button
            type="button"
            onClick={() => { setSearchQuery(""); setSearchSubmit(""); }}
            className="px-3 py-2 text-muted-foreground hover:text-foreground"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </form>

      {/* Search results */}
      {searchSubmit && searchResults && (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            {searchResults.results.length} result{searchResults.results.length !== 1 ? "s" : ""} for{" "}
            <span className="text-foreground font-medium">"{searchResults.query}"</span>
          </p>
          {searchResults.results.length === 0 ? (
            <div className="border border-border rounded-lg p-6 text-center text-sm text-muted-foreground">
              No matching documents. Try different search terms.
            </div>
          ) : (
            searchResults.results.map((r) => (
              <div key={r.id} className="border border-border rounded-lg p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-blue-400 shrink-0" />
                  <span className="font-medium text-sm">{r.title}</span>
                  <span className="ml-auto text-xs text-muted-foreground">
                    score: {r.rank.toFixed(4)}
                  </span>
                </div>
                <p
                  className="text-sm text-muted-foreground leading-relaxed"
                  dangerouslySetInnerHTML={{ __html: r.excerpt.replace(/<b>/g, "<mark>").replace(/<\/b>/g, "</mark>") }}
                />
              </div>
            ))
          )}
          <hr className="border-border" />
        </div>
      )}

      {/* Document list */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : docs.length === 0 ? (
        <div className="border border-dashed border-border rounded-lg p-12 text-center space-y-3">
          <BookOpen className="w-10 h-10 text-muted-foreground mx-auto" />
          <p className="font-medium">No documents yet</p>
          <p className="text-sm text-muted-foreground">
            Add documentation, guides, or policies. Agents will search them with{" "}
            <code className="text-xs bg-muted px-1 py-0.5 rounded">paperclipKbSearch</code>.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">{docs.length} document{docs.length !== 1 ? "s" : ""} indexed</p>
          {docs.map((doc) => (
            <DocumentRow
              key={doc.id}
              doc={doc}
              expanded={expandedId === doc.id}
              onToggle={() => setExpandedId(expandedId === doc.id ? null : doc.id)}
              onDelete={() => deleteMutation.mutate(doc.id)}
              deleting={deleteMutation.isPending && deleteMutation.variables === doc.id}
            />
          ))}
        </div>
      )}

      {/* Upload dialog */}
      {uploadOpen && (
        <UploadDialog
          companyId={selectedCompanyId!}
          onClose={() => setUploadOpen(false)}
          onSaved={() => {
            queryClient.invalidateQueries({ queryKey: ["knowledge-base", selectedCompanyId] });
            setUploadOpen(false);
          }}
        />
      )}
    </div>
  );
}

function DocumentRow({
  doc,
  expanded,
  onToggle,
  onDelete,
  deleting,
}: {
  doc: KnowledgeDocument;
  expanded: boolean;
  onToggle: () => void;
  onDelete: () => void;
  deleting: boolean;
}) {
  const { data: detail } = useQuery({
    queryKey: ["knowledge-base-doc", doc.id],
    queryFn: () => knowledgeBaseApi.get(doc.id),
    enabled: expanded,
  });

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-muted/40 transition-colors"
        onClick={onToggle}
      >
        <FileText className="w-4 h-4 text-blue-400 shrink-0" />
        <div className="flex-1 min-w-0">
          <span className="text-sm font-medium">{doc.title}</span>
          {doc.fileName && (
            <span className="ml-2 text-xs text-muted-foreground">{doc.fileName}</span>
          )}
        </div>
        <div className="flex items-center gap-4 shrink-0">
          {doc.contentLength !== undefined && (
            <span className="text-xs text-muted-foreground hidden sm:block">
              {bytesToKb(doc.contentLength)}
            </span>
          )}
          <span className="text-xs text-muted-foreground hidden sm:block">{timeAgo(doc.createdAt)}</span>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            disabled={deleting}
            className="p-1 text-muted-foreground hover:text-destructive transition-colors disabled:opacity-40"
            title="Delete document"
          >
            {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
          </button>
          {expanded ? (
            <ChevronUp className="w-4 h-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          )}
        </div>
      </div>
      {expanded && (
        <div className="border-t border-border px-4 py-3 bg-muted/20">
          {detail ? (
            <pre className="text-xs text-muted-foreground whitespace-pre-wrap font-mono max-h-64 overflow-y-auto">
              {detail.content}
            </pre>
          ) : (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading…
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function UploadDialog({
  companyId,
  onClose,
  onSaved,
}: {
  companyId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    if (!title) setTitle(file.name.replace(/\.[^.]+$/, ""));
    const reader = new FileReader();
    reader.onload = (ev) => setContent((ev.target?.result as string) ?? "");
    reader.readAsText(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await knowledgeBaseApi.create(companyId, {
        title: title.trim(),
        content: content.trim(),
        fileName: fileName || null,
        sourceType: "upload",
      });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save document.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-background border border-border rounded-xl shadow-2xl w-full max-w-xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="font-semibold text-base flex items-center gap-2">
            <Upload className="w-4 h-4" /> Add Document
          </h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {/* File picker */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5">
              File (optional — .txt, .md, .csv)
            </label>
            <div className="flex items-center gap-2">
              <input ref={fileRef} type="file" accept=".txt,.md,.markdown,.csv,.json" className="hidden" onChange={handleFile} />
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="flex items-center gap-2 px-3 py-2 border border-border rounded-lg text-sm hover:bg-muted transition-colors"
              >
                <Upload className="w-4 h-4" />
                {fileName || "Choose file…"}
              </button>
              {fileName && (
                <button type="button" onClick={() => { setFileName(""); setContent(""); }} className="text-muted-foreground hover:text-foreground">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5">
              Title <span className="text-destructive">*</span>
            </label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. API Rate Limits, Onboarding Guide…"
              className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-background focus:outline-none focus:border-primary"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5">
              Content <span className="text-destructive">*</span>
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Paste or type the document content…"
              rows={8}
              className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-background focus:outline-none focus:border-primary font-mono resize-none"
              required
            />
            <p className="text-xs text-muted-foreground mt-1">
              {content.length.toLocaleString()} chars · Markdown and plain text work best
            </p>
          </div>

          {error && (
            <div className="bg-destructive/10 border border-destructive/30 rounded-lg px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-1">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !title.trim() || !content.trim()}
              className="flex items-center gap-2 px-5 py-2 bg-primary text-primary-foreground font-medium text-sm rounded-lg hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {saving ? "Saving…" : "Save & Index"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
