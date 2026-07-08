import { Router, type IRouter } from "express";
import { and, eq, sql } from "drizzle-orm";
import { db, marketsTable, mandiPricesTable, mspTable } from "@workspace/db";
import {
  ListMarketsQueryParams,
  ListMarketsResponse,
  RecommendMarketsQueryParams,
  RecommendMarketsResponse,
} from "@workspace/api-zod";
import { normalizeCropName } from "./prices.js";

const router: IRouter = Router();

// Haversine formula — returns distance in km between two GPS points
function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

router.get("/markets/states", async (req, res): Promise<void> => {
  const rows = await db
    .selectDistinct({ state: marketsTable.state })
    .from(marketsTable)
    .orderBy(marketsTable.state);

  res.json({ states: rows.map((r) => r.state) });
});

const STATE_COORDS: Record<string, { lat: number; lng: number }> = {
  "punjab": { lat: 31.1471, lng: 75.3412 },
  "bihar": { lat: 25.0961, lng: 85.3131 },
  "delhi": { lat: 28.7041, lng: 77.1025 },
  "nct of delhi": { lat: 28.7041, lng: 77.1025 },
  "maharashtra": { lat: 19.7515, lng: 75.7139 },
  "gujarat": { lat: 22.2587, lng: 71.1924 },
  "rajasthan": { lat: 27.0238, lng: 74.2179 },
  "telangana": { lat: 18.1124, lng: 79.0193 },
  "madhya pradesh": { lat: 22.9734, lng: 78.6569 },
  "haryana": { lat: 29.0588, lng: 76.0856 },
  "uttar pradesh": { lat: 26.8467, lng: 80.9462 },
  "karnataka": { lat: 15.3173, lng: 75.7139 },
  "tamil nadu": { lat: 11.1271, lng: 78.6569 },
  "andhra pradesh": { lat: 15.9129, lng: 79.7400 },
  "west bengal": { lat: 22.9868, lng: 87.8550 },
  "kerala": { lat: 10.8505, lng: 76.2711 },
  "keralam": { lat: 10.8505, lng: 76.2711 },
  "odisha": { lat: 20.9517, lng: 85.0985 },
  "andaman and nicobar": { lat: 11.7401, lng: 92.6586 },
  "arunachal pradesh": { lat: 28.2180, lng: 94.7278 },
  "assam": { lat: 26.2006, lng: 92.9376 },
  "chandigarh": { lat: 30.7333, lng: 76.7794 },
  "chattisgarh": { lat: 21.2787, lng: 81.8661 },
  "chhattisgarh": { lat: 21.2787, lng: 81.8661 },
  "goa": { lat: 15.2993, lng: 74.1240 },
  "himachal pradesh": { lat: 31.1048, lng: 77.1734 },
  "jammu and kashmir": { lat: 33.7782, lng: 76.5762 },
  "manipur": { lat: 24.6637, lng: 93.9063 },
  "meghalaya": { lat: 25.4670, lng: 91.3662 },
  "nagaland": { lat: 26.1584, lng: 94.5624 },
  "pondicherry": { lat: 11.9416, lng: 79.8083 },
  "puducherry": { lat: 11.9416, lng: 79.8083 },
  "tripura": { lat: 23.9408, lng: 91.9882 },
  "uttarakhand": { lat: 30.0668, lng: 79.0193 }
};

const DISTRICT_COORDS: Record<string, Record<string, { lat: number; lng: number }>> = {
  "punjab": {
    "ludhiana": { lat: 30.9010, lng: 75.8573 },
    "amritsar": { lat: 31.6340, lng: 74.8723 },
    "bhatinda": { lat: 30.2110, lng: 74.9455 },
    "bathinda": { lat: 30.2110, lng: 74.9455 },
    "fatehgarh": { lat: 30.6416, lng: 76.3888 },
    "fatehgarh sahib": { lat: 30.6416, lng: 76.3888 },
    "fazilka": { lat: 30.4030, lng: 74.0300 },
    "ferozpur": { lat: 30.9249, lng: 74.6204 },
    "firozpur": { lat: 30.9249, lng: 74.6204 },
    "gurdaspur": { lat: 32.0401, lng: 75.4053 },
    "hoshiarpur": { lat: 31.5143, lng: 75.9115 },
    "jalandhar": { lat: 31.3260, lng: 75.5762 },
    "kapurthala": { lat: 31.3811, lng: 75.3800 },
    "moga": { lat: 30.8012, lng: 75.1741 },
    "mohali": { lat: 30.7046, lng: 76.7179 },
    "sas nagar": { lat: 30.7046, lng: 76.7179 },
    "nawanshahr": { lat: 31.1256, lng: 76.1245 },
    "sbs nagar": { lat: 31.1256, lng: 76.1245 },
    "pathankot": { lat: 32.2659, lng: 75.6464 },
    "patiala": { lat: 30.3398, lng: 76.3869 },
    "ropar (rupnagar)": { lat: 30.9664, lng: 76.5331 },
    "rupnagar": { lat: 30.9664, lng: 76.5331 },
    "ropar": { lat: 30.9664, lng: 76.5331 },
    "sangrur": { lat: 30.2290, lng: 75.8430 },
    "tarntaran": { lat: 31.4484, lng: 74.9181 },
    "tarn taran": { lat: 31.4484, lng: 74.9181 }
  },
  "haryana": {
    "ambala": { lat: 30.3782, lng: 76.7767 },
    "karnal": { lat: 29.6857, lng: 76.9905 },
    "kurukshetra": { lat: 29.9695, lng: 76.8497 },
    "panipat": { lat: 29.3909, lng: 76.9635 },
    "sonipat": { lat: 28.9931, lng: 77.0151 },
    "rohtak": { lat: 28.8955, lng: 76.6066 },
    "hisar": { lat: 29.1492, lng: 75.7217 },
    "sirsa": { lat: 29.5312, lng: 75.0318 },
    "gurgaon": { lat: 28.4595, lng: 77.0266 },
    "gurugram": { lat: 28.4595, lng: 77.0266 },
    "faridabad": { lat: 28.4089, lng: 77.3178 }
  },
  "madhya pradesh": {
    "indore": { lat: 22.7196, lng: 75.8577 },
    "bhopal": { lat: 23.2599, lng: 77.4126 },
    "ujjain": { lat: 23.1760, lng: 75.7885 },
    "jabalpur": { lat: 23.1815, lng: 79.9864 },
    "gwalior": { lat: 26.2183, lng: 78.1828 },
    "satna": { lat: 24.5808, lng: 80.8299 },
    "dewas": { lat: 22.9676, lng: 76.0534 }
  },
  "maharashtra": {
    "nashik": { lat: 19.9975, lng: 73.7898 },
    "pune": { lat: 18.5204, lng: 73.8567 },
    "mumbai": { lat: 19.0760, lng: 72.8777 },
    "nagpur": { lat: 21.1458, lng: 79.0882 },
    "aurangabad": { lat: 19.8762, lng: 75.3433 },
    "jalgaon": { lat: 21.0077, lng: 75.5626 },
    "solapur": { lat: 17.6599, lng: 75.9064 }
  }
};

router.get("/markets/nearby", async (req, res): Promise<void> => {
  const lat = Number(req.query.lat);
  const lng = Number(req.query.lng);
  const radius = Number(req.query.radius) || 200;

  if (isNaN(lat) || isNaN(lng)) {
    res.status(400).json({ error: "lat and lng query params are required" });
    return;
  }

  const rows = await db.select().from(marketsTable);

  const mappedRows = rows.map((r) => {
    let latVal = r.latitude ? Number(r.latitude) : NaN;
    let lngVal = r.longitude ? Number(r.longitude) : NaN;

    if (isNaN(latVal) || isNaN(lngVal)) {
      const lowerName = r.name.toLowerCase();
      if (lowerName.includes("khanna")) {
        latVal = 30.7018;
        lngVal = 76.2201;
      } else if (lowerName.includes("patna")) {
        latVal = 25.5941;
        lngVal = 85.1376;
      } else if (lowerName.includes("azadpur")) {
        latVal = 28.7161;
        lngVal = 77.1705;
      } else if (lowerName.includes("lasalgaon")) {
        latVal = 20.1475;
        lngVal = 74.2241;
      } else if (lowerName.includes("rajkot")) {
        latVal = 22.3039;
        lngVal = 70.8022;
      } else if (lowerName.includes("kota")) {
        latVal = 25.1825;
        lngVal = 75.8391;
      } else if (lowerName.includes("warangal")) {
        latVal = 17.9784;
        lngVal = 79.5941;
      } else if (lowerName.includes("indore")) {
        latVal = 22.7196;
        lngVal = 75.8577;
      } else {
        const stateKey = r.state.toLowerCase().trim();
        const distKey = r.district.toLowerCase().trim();
        const fallbackDist = DISTRICT_COORDS[stateKey]?.[distKey];
        if (fallbackDist) {
          latVal = fallbackDist.lat;
          lngVal = fallbackDist.lng;
        } else {
          const fallbackState = STATE_COORDS[stateKey];
          if (fallbackState) {
            latVal = fallbackState.lat;
            lngVal = fallbackState.lng;
          } else {
            // Fallback to central India (Madhya Pradesh) coordinates
            latVal = 22.9734;
            lngVal = 78.6569;
          }
        }
      }
    }

    return {
      id: r.id,
      name: r.name,
      state: r.state,
      district: r.district,
      latitude: latVal,
      longitude: lngVal,
      type: r.type,
      distanceKm: haversineKm(lat, lng, latVal, lngVal),
    };
  });

  let nearby = mappedRows
    .filter((r) => r.distanceKm <= radius)
    .sort((a, b) => a.distanceKm - b.distanceKm);

  // If no mandis are within the standard 200km radius, fall back to showing the absolute closest mandis available in India
  if (nearby.length === 0 && mappedRows.length > 0) {
    nearby = [...mappedRows]
      .sort((a, b) => a.distanceKm - b.distanceKm)
      .slice(0, 15);
  }

  res.json(nearby);
});

router.get("/markets", async (req, res): Promise<void> => {
  const parsed = ListMarketsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { state, district } = parsed.data;

  const conditions = [];
  if (state) conditions.push(eq(marketsTable.state, state));
  if (district) conditions.push(eq(marketsTable.district, district));

  const rows = await db
    .select()
    .from(marketsTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(marketsTable.state, marketsTable.name);

  const result = rows.map((r) => ({
    ...r,
    latitude: r.latitude != null ? Number(r.latitude) : null,
    longitude: r.longitude != null ? Number(r.longitude) : null,
  }));

  res.json(ListMarketsResponse.parse(result));
});

router.get("/markets/recommend", async (req, res): Promise<void> => {
  const parsed = RecommendMarketsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { crop, location } = parsed.data;
  const normalizedCrop = normalizeCropName(crop);

  const priceRows = await db
    .select({
      market: mandiPricesTable.market,
      state: mandiPricesTable.state,
      district: mandiPricesTable.district,
      modalPrice: sql<string>`AVG(${mandiPricesTable.modalPrice}::numeric)`,
    })
    .from(mandiPricesTable)
    .where(eq(mandiPricesTable.crop, normalizedCrop))
    .groupBy(mandiPricesTable.market, mandiPricesTable.state, mandiPricesTable.district)
    .orderBy(sql`AVG(${mandiPricesTable.modalPrice}::numeric) DESC`)
    .limit(10);

  const mspRows = await db
    .select()
    .from(mspTable)
    .where(eq(mspTable.crop, normalizedCrop))
    .limit(1);

  const mspPrice = mspRows.length > 0 ? Number(mspRows[0].mspPrice) : null;

  const result = priceRows.map((r, idx) => {
    const modalPrice = Math.round(Number(r.modalPrice) * 100) / 100;
    const premiumOverMsp = mspPrice
      ? Math.round(((modalPrice - mspPrice) / mspPrice) * 10000) / 100
      : null;
    const score = Math.max(0, 100 - idx * 10);

    return {
      market: r.market,
      state: r.state,
      district: r.district,
      modalPrice,
      mspPrice,
      premiumOverMsp,
      distanceKm: null,
      score,
      reason:
        idx === 0
          ? `Best price for ${crop} — ${premiumOverMsp !== null ? `${premiumOverMsp > 0 ? "+" : ""}${premiumOverMsp}% vs MSP` : "highest modal price"}`
          : `Good price with active trading volume for ${crop}`,
    };
  });

  res.json(RecommendMarketsResponse.parse(result));
});

export default router;
