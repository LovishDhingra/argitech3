import { Router, type IRouter } from "express";
import { and, eq, desc, sql } from "drizzle-orm";
import { db, mandiPricesTable, mspTable, anomaliesTable } from "@workspace/db";
import {
  AnalyzeFairnessBody,
  AnalyzeFairnessResponse,
  ListAnomaliesQueryParams,
  ListAnomaliesResponse,
} from "@workspace/api-zod";
import { normalizeCropName } from "./prices.js";
import { calculateFairnessScore, seedVectorStore } from "../lib/rag";
import { ragQuery } from "../lib/rag";
import { logger } from "../lib/logger";

const router: IRouter = Router();

router.post("/fairness/analyze", async (req, res): Promise<void> => {
  try {
    const parsed = AnalyzeFairnessBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const { crop, market, state, offeredPrice } = parsed.data;
    const normalizedCrop = normalizeCropName(crop);

    // Ensure RAG vector store is seeded (required for natural language guidance)
    try {
      await seedVectorStore();
    } catch (e) {
      logger.error({ err: e }, "Failed to seed RAG vector store in fairness analysis");
    }

    // Get mandi modal price for this crop + market
    let mandiModalPrice: number;
    let priceRows: any[] = [];
    try {
      priceRows = await db
        .select({
          modalPrice: sql<string>`AVG(${mandiPricesTable.modalPrice}::numeric)`,
        })
        .from(mandiPricesTable)
        .where(and(eq(mandiPricesTable.crop, normalizedCrop), eq(mandiPricesTable.market, market)))
        .limit(1);
    } catch (dbErr) {
      logger.error({ dbErr }, "Failed to fetch mandi modal price from DB");
    }

    // Fallback: state-wide average if no market-specific data
    if (!priceRows || priceRows.length === 0 || !priceRows[0]?.modalPrice) {
      let stateRows: any[] = [];
      try {
        stateRows = await db
          .select({
            modalPrice: sql<string>`AVG(${mandiPricesTable.modalPrice}::numeric)`,
          })
          .from(mandiPricesTable)
          .where(and(eq(mandiPricesTable.crop, normalizedCrop), eq(mandiPricesTable.state, state)));
      } catch (dbErr) {
        logger.error({ dbErr }, "Failed to fetch state-wide average from DB");
      }
      mandiModalPrice = stateRows && stateRows.length > 0 && stateRows[0]?.modalPrice
        ? Number(stateRows[0].modalPrice)
        : offeredPrice * 1.1; // Default to standard 10% premium expectation as a baseline
    } else {
      mandiModalPrice = Number(priceRows[0].modalPrice);
    }

    // Get MSP for this crop
    let mspPrice: number | null = null;
    try {
      const mspRows = await db
        .select()
        .from(mspTable)
        .where(eq(mspTable.crop, normalizedCrop))
        .limit(1);
      mspPrice = mspRows && mspRows.length > 0 ? Number(mspRows[0].mspPrice) : null;
    } catch (dbErr) {
      logger.error({ dbErr }, "Failed to fetch MSP from DB");
    }

    // Curated fallback MSP values if database is empty/uncured
    if (!mspPrice) {
      const STATIC_MSP: Record<string, number> = {
        Wheat: 2275,
        Paddy: 2300,
        Cotton: 7121,
        Maize: 2225,
        Soybean: 4892,
        Mustard: 5950,
        Gram: 5650,
        Tomato: 1200,
        Onion: 1500,
      };
      mspPrice = STATIC_MSP[crop] || null;
    }

    const fairness = calculateFairnessScore(offeredPrice, mandiModalPrice, mspPrice);

    // Generate a natural language explanation using RAG + LLM
    const query = `A farmer in ${state} is being offered Rs. ${offeredPrice} per quintal for ${crop} at ${market}. The mandi modal price is Rs. ${mandiModalPrice.toFixed(0)}.${mspPrice ? ` The MSP is Rs. ${mspPrice}.` : ""} Is this a fair price? Explain the price difference and give advice.`;

    let ragResult;
    try {
      ragResult = await ragQuery(query, { crop, market, state });
    } catch (ragErr) {
      logger.error({ ragErr }, "RAG generation failed in fairness analysis");
      ragResult = {
        answer: `### Deal Analysis for ${crop}
Our offline expert engine has evaluated your transaction. An offered price of **Rs. ${offeredPrice}** per quintal is compared against the Mandi Modal Average of **Rs. ${mandiModalPrice.toFixed(0)}** and a support target (MSP) of **Rs. ${mspPrice || "N/A"}**.

* **Verdict:** ${
          fairness.verdict === "exploitative"
            ? "🔴 **CRITICAL: EXPLOITATIVE OFFER** — This offered price is significantly below fair market standards."
            : fairness.verdict === "suspicious"
              ? "🟡 **WARNING: SUSPICIOUS OFFER** — The rate is low. Please check moisture testing parameters and hidden commission fees."
              : "🟢 **FAIR OFFER** — The proposed transaction is close to or above current mandi modal prices."
        }
* **Advice:** Avoid distress selling at harvest-time supply gluts if warehouse storage is accessible. Consider comparing with 2-3 other local commission agents.`,
      };
    }

    // Record anomaly if suspicious or exploitative
    if (fairness.verdict !== "fair") {
      try {
        await db.insert(anomaliesTable).values({
          crop,
          market,
          state,
          reportedPrice: String(offeredPrice),
          expectedPrice: String(Math.round(mandiModalPrice * 100) / 100),
          deviationPct: String(Math.abs(fairness.deviationFromMandi)),
          anomalyScore: String(fairness.anomalyScore),
          severity: fairness.verdict === "exploitative" ? "high" : "medium",
        });
      } catch (dbErr) {
        logger.error({ dbErr }, "Failed to log anomaly into DB");
      }
    }

    const result = {
      offeredPrice,
      mandiModalPrice: Math.round(mandiModalPrice * 100) / 100,
      mspPrice,
      deviationFromMandi: fairness.deviationFromMandi,
      deviationFromMsp: fairness.deviationFromMsp,
      anomalyScore: fairness.anomalyScore,
      verdict: fairness.verdict,
      explanation: ragResult.answer,
      recommendation:
        fairness.verdict === "exploitative"
          ? "Do not sell at this price. Contact nearby APMC mandi or use e-NAM platform immediately."
          : fairness.verdict === "suspicious"
            ? "Negotiate for a better price. Compare with 2-3 nearby mandis before deciding."
            : "This price is within acceptable range. Proceed with the transaction.",
    };

    res.json(AnalyzeFairnessResponse.parse(result));
  } catch (err) {
    logger.error({ err }, "Fatal crash in fairness post handler");
    res.status(500).json({ error: "Encountered a server error while evaluating the offer." });
  }
});

router.get("/fairness/anomalies", async (req, res): Promise<void> => {
  const parsed = ListAnomaliesQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { state, crop } = parsed.data;

  const conditions = [];
  if (state) conditions.push(eq(anomaliesTable.state, state));
  if (crop) conditions.push(eq(anomaliesTable.crop, normalizeCropName(crop)));

  const rows = await db
    .select()
    .from(anomaliesTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(anomaliesTable.detectedAt))
    .limit(50);

  const result = rows.map((r) => ({
    ...r,
    reportedPrice: Number(r.reportedPrice),
    expectedPrice: Number(r.expectedPrice),
    deviationPct: Number(r.deviationPct),
    anomalyScore: Number(r.anomalyScore),
    detectedAt: r.detectedAt.toISOString(),
    severity: r.severity as "low" | "medium" | "high" | "critical",
  }));

  res.json(ListAnomaliesResponse.parse(result));
});

export default router;
