import { pgTable, uuid, text, timestamp, index } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { companies } from "./companies.js";

export const knowledgeDocuments = pgTable(
  "knowledge_documents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    content: text("content").notNull(),
    fileName: text("file_name"),
    // 'upload' | 'url' | 'issue'
    sourceType: text("source_type").notNull().default("upload"),
    sourceRef: text("source_ref"),
    createdByUserId: text("created_by_user_id"),
    createdByAgentId: uuid("created_by_agent_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("knowledge_documents_company_id_idx").on(t.companyId),
    // GIN index on full-text search vector
    index("knowledge_documents_fts_idx").using(
      "gin",
      sql`to_tsvector('english', ${t.title} || ' ' || ${t.content})`,
    ),
  ],
);
