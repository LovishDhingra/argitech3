import * as schema from "./schema";

const DATABASE_URL = process.env.DATABASE_URL;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let db: any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let pool: any;

const makeChainingMock = () => {
  const handler: ProxyHandler<any> = {
    get: (target, prop) => {
      if (prop === "then") {
        return (resolve: any) => resolve([]);
      }
      if (prop === "catch" || prop === "finally") {
        return () => {};
      }
      return () => new Proxy({}, handler);
    }
  };
  return new Proxy({}, handler);
};

if (!DATABASE_URL) {
  console.warn(
    "[AI Studio] DATABASE_URL is not set. Database operations will use in-memory stubs/mocks."
  );

  const fs = await import("fs");
  const path = await import("path");

  const DB_FILE = path.join(process.cwd(), "db_persist.json");

  const mspRecords = [
    { crop: "Wheat", variety: "Lokwan", mspPrice: "2275", season: "Rabi", year: 2025, announcedBy: "Government of India" },
    { crop: "Paddy", variety: "Common", mspPrice: "2300", season: "Kharif", year: 2025, announcedBy: "Government of India" },
    { crop: "Cotton", variety: "Medium Staple", mspPrice: "7121", season: "Kharif", year: 2025, announcedBy: "Government of India" },
    { crop: "Maize", variety: "General", mspPrice: "2225", season: "Kharif", year: 2025, announcedBy: "Government of India" },
    { crop: "Soybean", variety: "Yellow", mspPrice: "4892", season: "Kharif", year: 2025, announcedBy: "Government of India" },
    { crop: "Groundnut", variety: "General", mspPrice: "6783", season: "Kharif", year: 2025, announcedBy: "Government of India" },
    { crop: "Sunflower", variety: "General", mspPrice: "7280", season: "Kharif", year: 2025, announcedBy: "Government of India" },
    { crop: "Mustard", variety: "General", mspPrice: "5950", season: "Rabi", year: 2025, announcedBy: "Government of India" },
    { crop: "Gram", variety: "General", mspPrice: "5650", season: "Rabi", year: 2025, announcedBy: "Government of India" },
    { crop: "Lentil", variety: "General", mspPrice: "6425", season: "Rabi", year: 2025, announcedBy: "Government of India" },
    { crop: "Jowar", variety: "Hybrid", mspPrice: "3371", season: "Kharif", year: 2025, announcedBy: "Government of India" },
    { crop: "Bajra", variety: "General", mspPrice: "2625", season: "Kharif", year: 2025, announcedBy: "Government of India" },
    { crop: "Ragi", variety: "General", mspPrice: "4290", season: "Kharif", year: 2025, announcedBy: "Government of India" },
    { crop: "Sugarcane", variety: "General", mspPrice: "370", season: "Annual", year: 2025, announcedBy: "Government of India" },
    { crop: "Onion", variety: "Red", mspPrice: "800", season: "Annual", year: 2025, announcedBy: "Government of India" },
  ];

  const alerts = [
    {
      id: 1,
      type: "exploitation",
      crop: "Wheat",
      market: "Khanna Mandi",
      state: "Punjab",
      severity: "high",
      title: "Price Suppression Detected at Khanna Mandi",
      description: "Multiple farmers reported being offered Rs. 1850/quintal for wheat against the mandi modal price of Rs. 2420. Arthiyas are citing artificial moisture content issues.",
      affectedFarmers: 450,
      isResolved: false,
    },
    {
      id: 2,
      type: "msp_violation",
      crop: "Paddy",
      market: "Patna Market",
      state: "Bihar",
      severity: "critical",
      title: "MSP Violation - Paddy Prices Below Support Price",
      description: "Paddy prices at Patna Market have dropped to Rs. 1980/quintal, below the MSP of Rs. 2300. Immediate government procurement needed.",
      affectedFarmers: 1200,
      isResolved: false,
    },
    {
      id: 3,
      type: "anomaly",
      crop: "Onion",
      market: "Azadpur Mandi",
      state: "Delhi",
      severity: "medium",
      title: "Unusual Price Drop in Onion Arrivals",
      description: "Onion prices fell 28% in 3 days at Azadpur despite reduced arrivals. Possible hoarding or market manipulation suspected.",
      affectedFarmers: 180,
      isResolved: false,
    },
    {
      id: 4,
      type: "market_crash",
      crop: "Tomato",
      market: "Lasalgaon Mandi",
      state: "Maharashtra",
      severity: "high",
      title: "Tomato Price Crash - Flash Supply Surge",
      description: "Tomato prices crashed 45% due to sudden supply surge from Karnataka. Farmers advised to delay arrivals by 5-7 days if storage is available.",
      affectedFarmers: 320,
      isResolved: false,
    },
    {
      id: 5,
      type: "exploitation",
      crop: "Cotton",
      market: "Rajkot Mandi",
      state: "Gujarat",
      severity: "high",
      title: "Cotton Quality Fraud Reported",
      description: "Traders allegedly using tampered moisture meters to classify Grade A cotton as Grade B, resulting in 15-20% price reduction for farmers.",
      affectedFarmers: 95,
      isResolved: false,
    },
    {
      id: 6,
      type: "anomaly",
      crop: "Mustard",
      market: "Kota Mandi",
      state: "Rajasthan",
      severity: "medium",
      title: "Mustard Prices 12% Below MSP",
      description: "Current mustard prices at Kota Mandi are Rs. 5220/quintal against MSP of Rs. 5950. Farmers urged to approach government procurement centers.",
      affectedFarmers: 275,
      isResolved: false,
    },
    {
      id: 7,
      type: "market_crash",
      crop: "Paddy",
      market: "Warangal Mandi",
      state: "Telangana",
      severity: "critical",
      title: "Warangal Paddy Market Oversupply Crisis",
      description: "Unprecedented paddy arrivals causing severe price depression. State procurement machinery overwhelmed. Government intervention requested.",
      affectedFarmers: 2100,
      isResolved: false,
    },
  ];

  const schemes = [
    {
      id: 1,
      name: "PM Kisan Samman Nidhi (PM-KISAN)",
      ministry: "Ministry of Agriculture",
      description: "Direct income support to farmer families owning cultivable land. Rs. 6000 per year transferred in three equal installments.",
      eligibility: "All land-holding farmer families with cultivable land. Excludes institutional landholders, government employees, income taxpayers, and professionals.",
      benefit: "Rs. 6000 per year direct bank transfer in three installments of Rs. 2000 each (April, August, December).",
      applicationUrl: "https://pmkisan.gov.in",
      applicableCrops: [],
      applicableStates: [],
      deadline: null,
    },
    {
      id: 2,
      name: "PM Fasal Bima Yojana (PMFBY)",
      ministry: "Ministry of Agriculture",
      description: "Comprehensive crop insurance covering pre-sowing to post-harvest losses due to natural calamities, pests, and diseases.",
      eligibility: "All farmers including sharecroppers and tenant farmers growing notified crops. Compulsory for loanee farmers.",
      benefit: "Premium: 2% for Kharif crops, 1.5% for Rabi food crops, 5% for horticulture/commercial crops. Balance premium paid by Government.",
      applicationUrl: "https://pmfby.gov.in",
      applicableCrops: ["Wheat", "Paddy", "Maize", "Cotton", "Soybean", "Mustard", "Groundnut"],
      applicableStates: [],
      deadline: "15 Jul",
    },
    {
      id: 3,
      name: "Kisan Credit Card (KCC)",
      ministry: "Ministry of Finance",
      description: "Provides farmers with affordable credit for agricultural needs including seeds, fertilisers, and post-harvest expenses.",
      eligibility: "All farmers including small, marginal, oral lessees, and sharecroppers. Allied activities and non-farm income also covered.",
      benefit: "Credit up to Rs. 3 lakh at 7% interest rate (effective 4% with government interest subvention). No processing fee for loans up to Rs. 3 lakh.",
      applicationUrl: "https://agricoop.nic.in",
      applicableCrops: [],
      applicableStates: [],
      deadline: null,
    },
    {
      id: 4,
      name: "Pradhan Mantri Krishi Sinchayee Yojana (PMKSY)",
      ministry: "Ministry of Jal Shakti",
      description: "Har Khet Ko Pani — ensuring irrigation access to every farm. Promotes micro-irrigation (drip and sprinkler) for water use efficiency.",
      eligibility: "All farmers. Priority to small and marginal farmers. SC/ST farmers get additional 10% subsidy.",
      benefit: "55-75% subsidy on drip and sprinkler irrigation systems. Subsidised water connections. Free drip irrigation kits for small farmers.",
      applicationUrl: "https://pmksy.gov.in",
      applicableCrops: [],
      applicableStates: [],
      deadline: null,
    },
    {
      id: 5,
      name: "National Agriculture Market (e-NAM)",
      ministry: "Ministry of Agriculture",
      description: "Pan-India electronic trading portal networking existing APMC mandis. Enables farmers to sell produce online across state borders.",
      eligibility: "Any farmer registered at a linked APMC mandi. Requires Aadhaar card and bank account.",
      benefit: "Access to national market. Transparent auction process. Payment within 24 hours. No middlemen. Better price discovery.",
      applicationUrl: "https://enam.gov.in",
      applicableCrops: ["Wheat", "Paddy", "Maize", "Cotton", "Onion", "Tomato", "Mustard"],
      applicableStates: ["Punjab", "Haryana", "Uttar Pradesh", "Madhya Pradesh", "Rajasthan", "Maharashtra", "Gujarat"],
      deadline: null,
    },
    {
      id: 6,
      name: "Soil Health Card Scheme",
      ministry: "Ministry of Agriculture",
      description: "Provides farmers a soil health card with crop-wise recommendations on nutrients and fertilisers to improve productivity.",
      eligibility: "All farmers. Soil tested once every 2 years.",
      benefit: "Free soil testing. Personalised fertiliser recommendations. Reduces input costs by 8-10%. Improves yield by 5-6%.",
      applicationUrl: "https://soilhealth.dac.gov.in",
      applicableCrops: [],
      applicableStates: [],
      deadline: null,
    },
    {
      id: 7,
      name: "Pradhan Mantri Annadata Aay Sanrakshan Abhiyan (PM-AASHA)",
      ministry: "Ministry of Agriculture",
      description: "Price support mechanism to protect farmers from market price crash. Includes Price Support Scheme (PSS) and Price Deficiency Payment Scheme (PDPS).",
      eligibility: "Farmers growing oilseeds, pulses, and copra notified under the scheme in states that have opted in.",
      benefit: "Government procurement at MSP when market prices fall below MSP. Direct bank transfer of price difference under PDPS.",
      applicationUrl: "https://agricoop.nic.in",
      applicableCrops: ["Mustard", "Groundnut", "Soybean", "Gram", "Lentil", "Sunflower"],
      applicableStates: ["Rajasthan", "Madhya Pradesh", "Maharashtra", "Uttar Pradesh", "Karnataka"],
      deadline: null,
    },
  ];

  class LocalDB {
    private filePath: string;
    private data: Record<string, any[]>;

    constructor() {
      this.filePath = DB_FILE;
      this.data = {
        msp_records: [...mspRecords],
        alerts: [...alerts],
        government_schemes: [...schemes],
        markets: [],
        mandi_prices: [],
        chat_messages: [],
        price_anomalies: [],
      };
      this.load();
    }

    private load() {
      try {
        if (fs.existsSync(this.filePath)) {
          const raw = fs.readFileSync(this.filePath, "utf-8");
          const parsed = JSON.parse(raw);
          this.data = { ...this.data, ...parsed };
        } else {
          this.save();
        }
      } catch (e) {
        console.error("[LocalDB] Error loading database file:", e);
      }
    }

    public save() {
      try {
        fs.writeFileSync(this.filePath, JSON.stringify(this.data, null, 2), "utf-8");
      } catch (e) {
        console.error("[LocalDB] Error saving database file:", e);
      }
    }

    public getTableRows(tableName: string): any[] {
      return this.data[tableName] || [];
    }

    public setTableRows(tableName: string, rows: any[]) {
      this.data[tableName] = rows;
      this.save();
    }
  }

  const localDb = new LocalDB();

  function getTableName(table: any): string {
    if (!table) return "";
    if (typeof table === "string") return table;
    if (table._?.name) return table._.name;
    
    const symbols = Object.getOwnPropertySymbols(table);
    for (const sym of symbols) {
      if (sym.toString().includes("drizzle:Name")) {
        return table[sym];
      }
    }
    
    if (table.name) return table.name;
    return "";
  }

  function matchCondition(row: any, cond: any): boolean {
    if (!cond) return true;
    
    if (cond.conditions && Array.isArray(cond.conditions)) {
      const isAnd = cond.operator !== "or";
      if (isAnd) {
        return cond.conditions.every((c: any) => matchCondition(row, c));
      } else {
        return cond.conditions.some((c: any) => matchCondition(row, c));
      }
    }

    let colName = "";
    let val: any = undefined;
    let op = "eq";

    if (cond.left && typeof cond.left === "object") {
      colName = cond.left.name || cond.left.key;
    }
    if (cond.right !== undefined) {
      val = cond.right;
    }
    if (cond.operator) {
      op = cond.operator;
    }

    if (!colName && cond.column) {
      colName = cond.column.name || cond.column.key;
    }
    if (val === undefined && cond.value !== undefined) {
      val = cond.value;
    }

    if (!colName) {
      const sqlStr = String(cond);
      const match = sqlStr.match(/(\w+)\s*(>=|<=|=|>|<)\s*'([^']+)'/);
      if (match) {
        colName = match[1];
        const rawOp = match[2];
        val = match[3];
        op = rawOp === "=" ? "eq" : rawOp === ">=" ? "gte" : rawOp === "<=" ? "lte" : rawOp === ">" ? "gt" : "lt";
      }
    }

    if (!colName) {
      return true;
    }

    let rowVal = row[colName];
    if (rowVal === undefined) {
      const camelKey = colName.replace(/_([a-z])/g, (g) => g[1].toUpperCase());
      rowVal = row[camelKey];
    }

    if (rowVal === undefined) return true;

    switch (op) {
      case "eq":
      case "=":
        return String(rowVal).toLowerCase() === String(val).toLowerCase();
      case "ne":
      case "!=":
      case "<>":
        return String(rowVal).toLowerCase() !== String(val).toLowerCase();
      case "gt":
      case ">":
        return Number(rowVal) > Number(val);
      case "gte":
      case ">=":
        if (isNaN(Number(rowVal)) || isNaN(Number(val))) {
          return String(rowVal) >= String(val);
        }
        return Number(rowVal) >= Number(val);
      case "lt":
      case "<":
        return Number(rowVal) < Number(val);
      case "lte":
      case "<=":
        if (isNaN(Number(rowVal)) || isNaN(Number(val))) {
          return String(rowVal) <= String(val);
        }
        return Number(rowVal) <= Number(val);
      default:
        return true;
    }
  }

  class QueryBuilder {
    private tableName: string;
    private whereCond: any = null;
    private limitCount: number | null = null;
    private orderByCols: any[] = [];
    private distinct: boolean = false;
    private selectFields: any = null;

    constructor(tableName: string, distinct = false, selectFields = null) {
      this.tableName = tableName;
      this.distinct = distinct;
      this.selectFields = selectFields;
    }

    from(table: any) {
      this.tableName = getTableName(table);
      return this;
    }

    where(cond: any) {
      this.whereCond = cond;
      return this;
    }

    orderBy(...cols: any[]) {
      this.orderByCols = cols;
      return this;
    }

    groupBy(...cols: any[]) {
      return this;
    }

    limit(num: number) {
      this.limitCount = num;
      return this;
    }

    then(resolve: any, reject?: any) {
      try {
        const rows = this.execute();
        resolve(rows);
      } catch (err) {
        if (reject) reject(err);
        else throw err;
      }
    }

    execute() {
      let rows = [...localDb.getTableRows(this.tableName)];

      if (this.whereCond) {
        rows = rows.filter((row) => matchCondition(row, this.whereCond));
      }

      // Handle aggregations and groupings if present
      let hasAggregation = false;
      const aggFields: Record<string, { op: "avg" | "sum"; col: string }> = {};

      if (this.selectFields && typeof this.selectFields === "object") {
        for (const [key, val] of Object.entries(this.selectFields)) {
          const valStr = String((val as any)?.sql || val || "");
          if (valStr.includes("AVG")) {
            hasAggregation = true;
            const match = valStr.match(/AVG\([^)]*?(\w+)[^)]*?\)/i) || valStr.match(/AVG\(([^)]+)\)/i);
            const col = match ? match[1].split(".").pop() || "modalPrice" : "modalPrice";
            aggFields[key] = { op: "avg", col };
          } else if (valStr.includes("SUM")) {
            hasAggregation = true;
            const match = valStr.match(/SUM\([^)]*?(\w+)[^)]*?\)/i) || valStr.match(/SUM\(([^)]+)\)/i);
            const col = match ? match[1].split(".").pop() || "arrivals" : "arrivals";
            aggFields[key] = { op: "sum", col };
          }
        }
      }

      if (hasAggregation) {
        const groupByKeys: string[] = [];
        if (this.selectFields) {
          for (const key of Object.keys(this.selectFields)) {
            if (!aggFields[key]) {
              groupByKeys.push(key);
            }
          }
        }

        if (groupByKeys.length > 0) {
          const groups: Record<string, any[]> = {};
          for (const r of rows) {
            const groupValKey = groupByKeys.map((gk) => {
              const colObj = this.selectFields[gk];
              const colName = colObj?.name || colObj?.key || gk;
              const val = r[colName] !== undefined ? r[colName] : r[gk];
              return String(val);
            }).join("||");

            if (!groups[groupValKey]) groups[groupValKey] = [];
            groups[groupValKey].push(r);
          }

          const aggRows: any[] = [];
          for (const [gValKey, gRows] of Object.entries(groups)) {
            const firstRow = gRows[0];
            const rowObj: any = {};
            
            groupByKeys.forEach((gk) => {
              const colObj = this.selectFields[gk];
              const colName = colObj?.name || colObj?.key || gk;
              rowObj[gk] = firstRow[colName] !== undefined ? firstRow[colName] : firstRow[gk];
            });

            for (const [key, agg] of Object.entries(aggFields)) {
              let colName = agg.col;
              colName = colName.replace(/::\w+/g, "").trim();

              const vals = gRows.map((gr) => {
                let v = gr[colName];
                if (v === undefined) {
                  const camelKey = colName.replace(/_([a-z])/g, (g) => g[1].toUpperCase());
                  v = gr[camelKey];
                }
                return Number(v) || 0;
              });

              if (agg.op === "avg") {
                const sum = vals.reduce((a, b) => a + b, 0);
                rowObj[key] = vals.length > 0 ? String(sum / vals.length) : "0";
              } else if (agg.op === "sum") {
                const sum = vals.reduce((a, b) => a + b, 0);
                rowObj[key] = String(sum);
              }
            }
            aggRows.push(rowObj);
          }
          rows = aggRows;
        } else {
          // Global aggregation without groupBy
          const rowObj: any = {};
          for (const [key, agg] of Object.entries(aggFields)) {
            let colName = agg.col;
            colName = colName.replace(/::\w+/g, "").trim();

            const vals = rows.map((gr) => {
              let v = gr[colName];
              if (v === undefined) {
                const camelKey = colName.replace(/_([a-z])/g, (g) => g[1].toUpperCase());
                v = gr[camelKey];
              }
              return Number(v) || 0;
            });

            if (agg.op === "avg") {
              const sum = vals.reduce((a, b) => a + b, 0);
              rowObj[key] = vals.length > 0 ? String(sum / vals.length) : "0";
            } else if (agg.op === "sum") {
              const sum = vals.reduce((a, b) => a + b, 0);
              rowObj[key] = String(sum);
            }
          }
          return [rowObj];
        }
      } else if (this.distinct) {
        const seen = new Set();
        const distinctRows: any[] = [];
        for (const r of rows) {
          let val = "";
          let mappedKey = "state";
          if (this.selectFields && typeof this.selectFields === "object") {
            mappedKey = Object.keys(this.selectFields)[0];
            const colObj = this.selectFields[mappedKey];
            const colName = colObj?.name || colObj?.key || mappedKey;
            val = r[colName] !== undefined ? r[colName] : r[mappedKey];
          } else {
            val = JSON.stringify(r);
          }
          if (!seen.has(val)) {
            seen.add(val);
            if (this.selectFields && typeof this.selectFields === "object") {
              distinctRows.push({ [mappedKey]: val });
            } else {
              distinctRows.push(r);
            }
          }
        }
        rows = distinctRows;
      } else if (this.selectFields && typeof this.selectFields === "object") {
        const firstKey = Object.keys(this.selectFields)[0];
        const fieldVal = this.selectFields[firstKey];
        
        if (fieldVal && (fieldVal.sql || String(fieldVal).includes("COUNT") || String(fieldVal.chunk).includes("COUNT"))) {
          return [{ [firstKey]: rows.length }];
        }
        
        rows = rows.map((r) => {
          const mapped: any = {};
          for (const [key, val] of Object.entries(this.selectFields)) {
            const colName = (val as any)?.name || key;
            mapped[key] = r[colName] !== undefined ? r[colName] : r[key];
          }
          return mapped;
        });
      }

      if (this.orderByCols.length > 0) {
        rows.sort((a, b) => {
          for (const col of this.orderByCols) {
            let isDesc = false;
            let colName = "";
            
            if (col && typeof col === "object") {
              if (col.direction === "desc" || col.constructor?.name === "Desc") {
                isDesc = true;
                colName = col.column?.name || col.column?.key;
              } else {
                colName = col.name || col.key;
              }
            } else if (typeof col === "string") {
              colName = col;
            }

            if (!colName) continue;

            let valA = a[colName];
            let valB = b[colName];

            const numA = Number(valA);
            const numB = Number(valB);
            if (!isNaN(numA) && !isNaN(numB)) {
              valA = numA;
              valB = numB;
            }

            if (valA === valB) continue;
            if (valA === undefined || valA === null) return 1;
            if (valB === undefined || valB === null) return -1;

            if (isDesc) {
              return valA < valB ? 1 : -1;
            } else {
              return valA > valB ? 1 : -1;
            }
          }
          return 0;
        });
      }

      if (this.limitCount !== null) {
        rows = rows.slice(0, this.limitCount);
      }

      return rows;
    }
  }

  class InsertBuilder {
    private tableName: string;
    private insertValues: any[] = [];

    constructor(table: any) {
      this.tableName = getTableName(table);
    }

    values(vals: any | any[]) {
      this.insertValues = Array.isArray(vals) ? vals : [vals];
      return this;
    }

    onConflictDoNothing(options?: any) {
      return this;
    }

    onConflictDoUpdate(options?: any) {
      return this;
    }

    then(resolve: any, reject?: any) {
      try {
        this.execute();
        resolve();
      } catch (err) {
        if (reject) reject(err);
        else throw err;
      }
    }

    execute() {
      const existing = [...localDb.getTableRows(this.tableName)];
      
      for (const val of this.insertValues) {
        const nextId = existing.length > 0 ? Math.max(...existing.map((e) => Number(e.id) || 0)) + 1 : 1;
        const row = {
          id: nextId,
          createdAt: new Date().toISOString(),
          ...val,
        };

        if (this.tableName === "mandi_prices") {
          const idx = existing.findIndex(
            (e) =>
              String(e.market).toLowerCase() === String(row.market).toLowerCase() &&
              String(e.crop).toLowerCase() === String(row.crop).toLowerCase() &&
              String(e.variety).toLowerCase() === String(row.variety).toLowerCase() &&
              String(e.priceDate).toLowerCase() === String(row.priceDate).toLowerCase()
          );
          if (idx !== -1) {
            existing[idx] = { ...existing[idx], ...row };
            continue;
          }
        } else if (this.tableName === "markets") {
          const idx = existing.findIndex(
            (e) =>
              String(e.name).toLowerCase() === String(row.name).toLowerCase() &&
              String(e.state).toLowerCase() === String(row.state).toLowerCase() &&
              String(e.district).toLowerCase() === String(row.district).toLowerCase()
          );
          if (idx !== -1) {
            continue;
          }
        }

        existing.push(row);
      }

      localDb.setTableRows(this.tableName, existing);
    }
  }

  db = {
    select: (fields?: any) => new QueryBuilder("", false, fields),
    selectDistinct: (fields?: any) => new QueryBuilder("", true, fields),
    insert: (table: any) => new InsertBuilder(table),
  };

  pool = {
    query: async () => ({ rows: [] }),
    connect: async () => ({
      query: async () => ({ rows: [] }),
      release: () => {}
    }),
    on: () => {}
  };
} else {
  const isNeon = DATABASE_URL.includes("neon.tech");
  try {
    if (isNeon) {
      const { Pool, neonConfig } = await import("@neondatabase/serverless");
      const { drizzle } = await import("drizzle-orm/neon-serverless");
      const ws = await import("ws");

      // WebSocket constructor is required in Node.js — browsers have it natively
      neonConfig.webSocketConstructor = ws.default;

      pool = new Pool({ connectionString: DATABASE_URL });
      db = drizzle(pool, { schema });
    } else {
      const pg = await import("pg");
      const { drizzle } = await import("drizzle-orm/node-postgres");

      pool = new pg.default.Pool({ connectionString: DATABASE_URL });
      db = drizzle(pool, { schema });
    }
  } catch (error) {
    console.error("[AI Studio] Failed to connect to database:", error);
    db = makeChainingMock();
    pool = {
      query: async () => ({ rows: [] }),
      connect: async () => ({
        query: async () => ({ rows: [] }),
        release: () => {}
      }),
      on: () => {}
    };
  }
}

export { db, pool };
export * from "./schema";
