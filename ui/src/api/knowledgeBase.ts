import { api } from "./client";

export interface KnowledgeDocument {
  id: string;
  title: string;
  fileName: string | null;
  sourceType: "upload" | "url" | "issue";
  sourceRef: string | null;
  contentLength?: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface KnowledgeDocumentDetail extends KnowledgeDocument {
  content: string;
}

export interface KbSearchResult {
  id: string;
  title: string;
  fileName: string | null;
  sourceType: string;
  excerpt: string;
  rank: number;
  createdAt: Date;
}

export interface KbSearchResponse {
  query: string;
  results: KbSearchResult[];
}

export const knowledgeBaseApi = {
  list: (companyId: string) =>
    api.get<KnowledgeDocument[]>(`/companies/${companyId}/knowledge-base/documents`),

  get: (id: string) =>
    api.get<KnowledgeDocumentDetail>(`/knowledge-base/documents/${id}`),

  create: (
    companyId: string,
    data: { title: string; content: string; fileName?: string | null; sourceType?: string; sourceRef?: string | null },
  ) => api.post<KnowledgeDocument>(`/companies/${companyId}/knowledge-base/documents`, data),

  delete: (id: string) => api.delete<{ ok: boolean }>(`/knowledge-base/documents/${id}`),

  search: (companyId: string, q: string, limit = 5) =>
    api.get<KbSearchResponse>(
      `/companies/${companyId}/knowledge-base/search?q=${encodeURIComponent(q)}&limit=${limit}`,
    ),
};
