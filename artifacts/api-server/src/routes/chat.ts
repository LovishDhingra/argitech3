import { Router, type IRouter } from "express";
import { eq, desc } from "drizzle-orm";
import { getAuth } from "@clerk/express";
import { db, chatMessagesTable } from "@workspace/db";
import {
  ChatQueryBody,
  ChatQueryResponse,
  GetChatHistoryQueryParams,
  GetChatHistoryResponse,
} from "@workspace/api-zod";
import { ragQuery, seedVectorStore } from "../lib/rag";
import { randomUUID } from "crypto";
import { logger } from "../lib/logger";

const router: IRouter = Router();

/**
 * POST /chat
 * RAG-powered chatbot endpoint. When the user is authenticated via Clerk,
 * uses their userId as the sessionId so each user gets a private chat history.
 */
router.post("/chat", async (req, res): Promise<void> => {
  const parsed = ChatQueryBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { query, sessionId: incomingSessionId, context } = parsed.data;

  await seedVectorStore();

  let userId: string | null = null;
  try {
    const auth = getAuth(req);
    userId = auth?.userId || null;
  } catch (err) {
    logger.warn({ err }, "Failed to retrieve authenticated user from Clerk. Proceeding as guest.");
  }

  const sessionId = userId ?? incomingSessionId ?? randomUUID();

  try {
    await db.insert(chatMessagesTable).values({
      sessionId,
      role: "user",
      content: query,
      latencyMs: null,
    });
  } catch (dbErr) {
    logger.error({ dbErr }, "Failed to log user query to database");
  }

  try {
    const ragResult = await ragQuery(query, context ?? {});

    try {
      await db.insert(chatMessagesTable).values({
        sessionId,
        role: "assistant",
        content: ragResult.answer,
        latencyMs: ragResult.latencyMs,
      });
    } catch (dbErr) {
      logger.error({ dbErr }, "Failed to log assistant response to database");
    }

    const result = {
      answer: ragResult.answer,
      sources: ragResult.sources,
      sessionId,
      latencyMs: ragResult.latencyMs,
      model: ragResult.model,
    };

    res.json(ChatQueryResponse.parse(result));
  } catch (error: any) {
    logger.error({ error }, "Error in chat generation pipeline");
    
    const fallbackAnswer = `I'm sorry, I encountered an error processing your request. 

${error?.message?.includes("GROQ_API_KEY")
  ? "⚠️ **API Key is missing or invalid.** Please add **GROQ_API_KEY** in your **Settings > Secrets** panel in the top-right corner of Google AI Studio." 
  : `Details: ${error?.message || error}`}`;

    const result = {
      answer: fallbackAnswer,
      sources: [],
      sessionId,
      latencyMs: 0,
      model: "error-fallback",
    };
    res.json(ChatQueryResponse.parse(result));
  }
});

/**
 * GET /chat/history
 * Returns chat history for the authenticated user (filtered by their userId).
 * Falls back to returning recent global messages if not authenticated.
 */
router.get("/chat/history", async (req, res): Promise<void> => {
  const parsed = GetChatHistoryQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { limit } = parsed.data;

  let userId: string | null = null;
  try {
    const auth = getAuth(req);
    userId = auth?.userId || null;
  } catch (err) {
    logger.warn({ err }, "Failed to retrieve authenticated user from Clerk for history. Proceeding as guest.");
  }

  const rows = userId
    ? await db
        .select()
        .from(chatMessagesTable)
        .where(eq(chatMessagesTable.sessionId, userId))
        .orderBy(desc(chatMessagesTable.createdAt))
        .limit(limit ?? 20)
    : await db
        .select()
        .from(chatMessagesTable)
        .orderBy(desc(chatMessagesTable.createdAt))
        .limit(limit ?? 20);

  const result = rows.reverse().map((r) => ({
    ...r,
    role: r.role as "user" | "assistant",
    createdAt: r.createdAt.toISOString(),
    latencyMs: r.latencyMs ?? null,
  }));

  res.json(GetChatHistoryResponse.parse(result));
});

export default router;
