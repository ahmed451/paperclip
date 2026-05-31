import { Router } from "express";
import { z } from "zod";
import type { Db } from "@paperclipai/db";
import { knowledgeDocuments } from "@paperclipai/db";
import { eq, and, sql, desc } from "drizzle-orm";
import { assertBoard, assertCompanyAccess, getActorInfo } from "./authz.js";
import { validate } from "../middleware/validate.js";

const createDocumentSchema = z.object({
  title: z.string().min(1).max(500),
  content: z.string().min(1).max(500_000),
  fileName: z.string().max(255).optional().nullable(),
  sourceType: z.enum(["upload", "url", "issue"]).default("upload"),
  sourceRef: z.string().max(1000).optional().nullable(),
});

const searchSchema = z.object({
  q: z.string().min(1).max(500),
  limit: z.coerce.number().int().min(1).max(20).default(5),
});

export function knowledgeBaseRoutes(db: Db) {
  const router = Router();

  // List documents
  router.get("/companies/:companyId/knowledge-base/documents", async (req, res) => {
    try {
      assertBoard(req);
      const { companyId } = req.params;
      assertCompanyAccess(req, companyId);

      const docs = await db
        .select({
          id: knowledgeDocuments.id,
          title: knowledgeDocuments.title,
          fileName: knowledgeDocuments.fileName,
          sourceType: knowledgeDocuments.sourceType,
          sourceRef: knowledgeDocuments.sourceRef,
          contentLength: sql<number>`length(${knowledgeDocuments.content})`,
          createdAt: knowledgeDocuments.createdAt,
          updatedAt: knowledgeDocuments.updatedAt,
        })
        .from(knowledgeDocuments)
        .where(eq(knowledgeDocuments.companyId, companyId))
        .orderBy(desc(knowledgeDocuments.createdAt));

      res.json(docs);
    } catch (err) {
      if (err instanceof Error && "statusCode" in err) {
        res.status((err as { statusCode: number }).statusCode).json({ error: err.message });
      } else {
        res.status(500).json({ error: "Internal server error" });
      }
    }
  });

  // Upload / create document
  router.post(
    "/companies/:companyId/knowledge-base/documents",
    validate(createDocumentSchema),
    async (req, res) => {
      try {
        assertBoard(req);
        const companyId = req.params.companyId as string;
        assertCompanyAccess(req, companyId);
        const actor = getActorInfo(req);
        const body = req.body as z.infer<typeof createDocumentSchema>;

        const createdByUserId = actor.actorType === "user" ? actor.actorId : null;
        const createdByAgentId = actor.actorType === "agent" ? actor.agentId : null;

        const [doc] = await db
          .insert(knowledgeDocuments)
          .values({
            companyId,
            title: body.title,
            content: body.content,
            fileName: body.fileName ?? null,
            sourceType: body.sourceType,
            sourceRef: body.sourceRef ?? null,
            createdByUserId,
            createdByAgentId: createdByAgentId ?? undefined,
          })
          .returning();

        res.status(201).json(doc);
      } catch (err) {
        if (err instanceof Error && "statusCode" in err) {
          res.status((err as { statusCode: number }).statusCode).json({ error: err.message });
        } else {
          res.status(500).json({ error: "Internal server error" });
        }
      }
    },
  );

  // Get single document (with full content)
  router.get("/knowledge-base/documents/:id", async (req, res) => {
    try {
      assertBoard(req);
      const { id } = req.params;

      const [doc] = await db
        .select()
        .from(knowledgeDocuments)
        .where(eq(knowledgeDocuments.id, id))
        .limit(1);

      if (!doc) return res.status(404).json({ error: "Document not found" });
      assertCompanyAccess(req, doc.companyId);
      return res.json(doc);
    } catch (err) {
      if (err instanceof Error && "statusCode" in err) {
        return res.status((err as { statusCode: number }).statusCode).json({ error: err.message });
      }
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  // Delete document
  router.delete("/knowledge-base/documents/:id", async (req, res) => {
    try {
      assertBoard(req);
      const { id } = req.params;

      const [doc] = await db
        .select({ id: knowledgeDocuments.id, companyId: knowledgeDocuments.companyId })
        .from(knowledgeDocuments)
        .where(eq(knowledgeDocuments.id, id))
        .limit(1);

      if (!doc) return res.status(404).json({ error: "Document not found" });
      assertCompanyAccess(req, doc.companyId);

      await db.delete(knowledgeDocuments).where(eq(knowledgeDocuments.id, id));
      return res.json({ ok: true });
    } catch (err) {
      if (err instanceof Error && "statusCode" in err) {
        return res.status((err as { statusCode: number }).statusCode).json({ error: err.message });
      }
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  // Full-text search — used by both UI and MCP tool
  router.get("/companies/:companyId/knowledge-base/search", async (req, res) => {
    try {
      // Allow both board users and agents to search
      const { companyId } = req.params;
      assertCompanyAccess(req, companyId);

      const parsed = searchSchema.safeParse(req.query);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid search parameters", details: parsed.error.flatten() });
      }
      const { q, limit } = parsed.data;

      const results = await db.execute(sql`
        SELECT
          id,
          title,
          file_name AS "fileName",
          source_type AS "sourceType",
          -- return a 300-char headline excerpt around the matching terms
          ts_headline(
            'english',
            content,
            plainto_tsquery('english', ${q}),
            'MaxWords=60, MinWords=20, ShortWord=3, HighlightAll=FALSE, MaxFragments=2, FragmentDelimiter=" … "'
          ) AS excerpt,
          ts_rank(
            to_tsvector('english', title || ' ' || content),
            plainto_tsquery('english', ${q})
          ) AS rank,
          created_at AS "createdAt"
        FROM knowledge_documents
        WHERE
          company_id = ${companyId}
          AND to_tsvector('english', title || ' ' || content) @@ plainto_tsquery('english', ${q})
        ORDER BY rank DESC
        LIMIT ${limit}
      `);

      return res.json({ query: q, results: Array.from(results) });
    } catch (err) {
      if (err instanceof Error && "statusCode" in err) {
        return res.status((err as { statusCode: number }).statusCode).json({ error: err.message });
      }
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  return router;
}
