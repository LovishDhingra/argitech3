import { eq, and, sql } from "drizzle-orm";
import { db, marketsTable, mandiPricesTable } from "@workspace/db";
import { fetchLiveMandiRecords, parseArrivalDate, type RawMandiRecord } from "./dataGovIn";
import { geocodeIndianLocation } from "./openMeteo";
import { logger } from "./logger";

export async function getMarketsCount(): Promise<number> {
  const [row] = await db.select({ count: sql<string>`COUNT(*)` }).from(marketsTable);
  return Number(row?.count ?? 0);
}

async function seedFallbackMandiData() {
  const sampleMarkets = [
    { name: "Khanna Mandi", state: "Punjab", district: "Ludhiana", latitude: "30.7018", longitude: "76.2201", type: "APMC" },
    { name: "Patna Market", state: "Bihar", district: "Patna", latitude: "25.5941", longitude: "85.1376", type: "APMC" },
    { name: "Azadpur Mandi", state: "Delhi", district: "North Delhi", latitude: "28.7161", longitude: "77.1705", type: "APMC" },
    { name: "Lasalgaon Mandi", state: "Maharashtra", district: "Nashik", latitude: "20.1475", longitude: "74.2241", type: "APMC" },
    { name: "Rajkot Mandi", state: "Gujarat", district: "Rajkot", latitude: "22.3039", longitude: "70.8022", type: "APMC" },
    { name: "Kota Mandi", state: "Rajasthan", district: "Kota", latitude: "25.1825", longitude: "75.8391", type: "APMC" },
    { name: "Warangal Mandi", state: "Telangana", district: "Warangal", latitude: "17.9784", longitude: "79.5941", type: "APMC" },
    { name: "Indore Mandi", state: "Madhya Pradesh", district: "Indore", latitude: "22.7196", longitude: "75.8577", type: "APMC" },
  ];

  for (const m of sampleMarkets) {
    await db
      .insert(marketsTable)
      .values(m)
      .onConflictDoNothing({ target: [marketsTable.name, marketsTable.state, marketsTable.district] });
  }

  const samplePrices = [
    // Wheat
    { crop: "Wheat", variety: "Lokwan", market: "Khanna Mandi", state: "Punjab", district: "Ludhiana", minPrice: "2350", maxPrice: "2450", modalPrice: "2400", priceDate: "2026-07-07" },
    { crop: "Wheat", variety: "Lokwan", market: "Patna Market", state: "Bihar", district: "Patna", minPrice: "2100", maxPrice: "2250", modalPrice: "2180", priceDate: "2026-07-07" },
    { crop: "Wheat", variety: "Kalyan Sona", market: "Azadpur Mandi", state: "Delhi", district: "North Delhi", minPrice: "2380", maxPrice: "2500", modalPrice: "2440", priceDate: "2026-07-07" },
    // Paddy
    { crop: "Paddy", variety: "Common", market: "Patna Market", state: "Bihar", district: "Patna", minPrice: "2200", maxPrice: "2350", modalPrice: "2280", priceDate: "2026-07-07" },
    { crop: "Paddy", variety: "Common", market: "Warangal Mandi", state: "Telangana", district: "Warangal", minPrice: "2320", maxPrice: "2420", modalPrice: "2380", priceDate: "2026-07-07" },
    // Maize
    { crop: "Maize", variety: "General", market: "Kota Mandi", state: "Rajasthan", district: "Kota", minPrice: "2100", maxPrice: "2250", modalPrice: "2180", priceDate: "2026-07-07" },
    { crop: "Maize", variety: "General", market: "Indore Mandi", state: "Madhya Pradesh", district: "Indore", minPrice: "2150", maxPrice: "2280", modalPrice: "2220", priceDate: "2026-07-07" },
    // Soybean
    { crop: "Soybean", variety: "Yellow", market: "Indore Mandi", state: "Madhya Pradesh", district: "Indore", minPrice: "4900", maxPrice: "5200", modalPrice: "5050", priceDate: "2026-07-07" },
    { crop: "Soybean", variety: "Yellow", market: "Rajkot Mandi", state: "Gujarat", district: "Rajkot", minPrice: "4850", maxPrice: "5100", modalPrice: "4980", priceDate: "2026-07-07" },
    // Cotton
    { crop: "Cotton", variety: "Medium Staple", market: "Rajkot Mandi", state: "Gujarat", district: "Rajkot", minPrice: "7100", maxPrice: "7400", modalPrice: "7250", priceDate: "2026-07-07" },
    // Onion
    { crop: "Onion", variety: "Red", market: "Lasalgaon Mandi", state: "Maharashtra", district: "Nashik", minPrice: "1600", maxPrice: "2200", modalPrice: "1900", priceDate: "2026-07-07" },
    { crop: "Onion", variety: "Red", market: "Azadpur Mandi", state: "Delhi", district: "North Delhi", minPrice: "1800", maxPrice: "2400", modalPrice: "2100", priceDate: "2026-07-07" },
    // Tomato
    { crop: "Tomato", variety: "Local", market: "Lasalgaon Mandi", state: "Maharashtra", district: "Nashik", minPrice: "1000", maxPrice: "1500", modalPrice: "1250", priceDate: "2026-07-07" },
    { crop: "Tomato", variety: "Local", market: "Indore Mandi", state: "Madhya Pradesh", district: "Indore", minPrice: "1100", maxPrice: "1600", modalPrice: "1350", priceDate: "2026-07-07" },
  ];

  for (const p of samplePrices) {
    await db
      .insert(mandiPricesTable)
      .values({
        ...p,
        arrivals: null,
        source: "demo-seed",
      })
      .onConflictDoNothing();
  }

  logger.info("Pre-seeded fallback mandi and price data successfully!");
}

/**
 * Syncs live mandi price + market data from data.gov.in into Postgres.
 * The government API only exposes a current-day snapshot (no historical
 * range query), so each sync appends today's real prices — trend history
 * accumulates naturally as this runs over time instead of being backfilled
 * with synthetic data.
 */
export async function syncMandiData(): Promise<{ marketsUpserted: number; pricesUpserted: number }> {
  // Ensure database has fallback sample mandis and prices if empty
  try {
    const existingCount = await getMarketsCount();
    if (existingCount === 0) {
      logger.info("No markets found in database. Seeding sample Indian mandis and prices...");
      await seedFallbackMandiData();
    }
  } catch (err) {
    logger.error({ err }, "Failed to check or seed fallback mandi data");
  }

  const apiKey = process.env.DATA_GOV_IN_API_KEY;
  if (!apiKey) {
    logger.warn("DATA_GOV_IN_API_KEY is not set. Skipping live mandi data sync from data.gov.in. App will rely on existing pre-seeded database records.");
    return { marketsUpserted: 0, pricesUpserted: 0 };
  }

  logger.info("starting live mandi data sync from data.gov.in");

  const records = await fetchLiveMandiRecords();
  logger.info({ count: records.length }, "fetched live mandi records");

  const marketKey = (r: RawMandiRecord) => `${r.market}||${r.state}||${r.district}`;
  const uniqueMarkets = new Map<string, RawMandiRecord>();
  for (const r of records) {
    uniqueMarkets.set(marketKey(r), r);
  }

  let marketsUpserted = 0;
  for (const r of uniqueMarkets.values()) {
    const existing = await db
      .select({ id: marketsTable.id, latitude: marketsTable.latitude })
      .from(marketsTable)
      .where(
        and(
          eq(marketsTable.name, r.market),
          eq(marketsTable.state, r.state),
          eq(marketsTable.district, r.district),
        ),
      )
      .limit(1);

    if (existing.length > 0) {
      continue;
    }

    const geo = await geocodeIndianLocation(
      `${r.market}, ${r.district}, ${r.state}`,
      `${r.district}, ${r.state}`,
    );

    await db
      .insert(marketsTable)
      .values({
        name: r.market,
        state: r.state,
        district: r.district,
        latitude: geo ? String(geo.latitude) : null,
        longitude: geo ? String(geo.longitude) : null,
        type: "APMC",
      })
      .onConflictDoNothing({ target: [marketsTable.name, marketsTable.state, marketsTable.district] });

    marketsUpserted++;
  }

  let pricesUpserted = 0;
  for (const r of records) {
    const priceDate = parseArrivalDate(r.arrival_date);
    const minPrice = Number(r.min_price);
    const maxPrice = Number(r.max_price);
    const modalPrice = Number(r.modal_price);
    if (!Number.isFinite(minPrice) || !Number.isFinite(maxPrice) || !Number.isFinite(modalPrice)) {
      continue;
    }

    await db
      .insert(mandiPricesTable)
      .values({
        crop: r.commodity,
        variety: r.variety || "General",
        market: r.market,
        state: r.state,
        district: r.district,
        minPrice: String(minPrice),
        maxPrice: String(maxPrice),
        modalPrice: String(modalPrice),
        arrivals: null,
        priceDate,
        source: "data.gov.in",
      })
      .onConflictDoUpdate({
        target: [
          mandiPricesTable.market,
          mandiPricesTable.crop,
          mandiPricesTable.variety,
          mandiPricesTable.priceDate,
        ],
        set: {
          minPrice: String(minPrice),
          maxPrice: String(maxPrice),
          modalPrice: String(modalPrice),
        },
      });

    pricesUpserted++;
  }

  logger.info({ marketsUpserted, pricesUpserted }, "completed live mandi data sync");
  return { marketsUpserted, pricesUpserted };
}

/** Total count of price rows currently stored — used to decide if an initial sync is needed. */
export async function getMandiPriceCount(): Promise<number> {
  const [row] = await db.select({ count: sql<string>`COUNT(*)` }).from(mandiPricesTable);
  return Number(row?.count ?? 0);
}
