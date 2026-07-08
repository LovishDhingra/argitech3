/**
 * RAG (Retrieval-Augmented Generation) Pipeline
 *
 * Architecture:
 * 1. Embedding Layer: Converts text chunks into vector representations
 *    using in-memory cosine similarity search (simulated vector DB)
 * 2. Retrieval Layer: Finds semantically relevant context for a user query
 * 3. Generation Layer: Uses OpenAI to generate answers with retrieved context
 *
 * In production, replace the in-memory store with FAISS, ChromaDB, or pgvector.
 */

import { logger } from "./logger";

export function isGroqKeyValid(): boolean {
  const key = process.env.GROQ_API_KEY;
  if (!key) return false;
  const trimmed = key.trim();
  if (
    trimmed === "" ||
    trimmed === "undefined" ||
    trimmed.includes("YOUR_API_KEY") ||
    trimmed.includes("placeholder") ||
    trimmed.length < 15
  ) {
    return false;
  }
  return true;
}

async function generateWithGroq(prompt: string, systemPrompt: string): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("GROQ_API_KEY is not configured.");
  }

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: prompt }
      ],
      temperature: 0.7,
      max_tokens: 1024,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Groq API returned error status ${response.status}: ${errText}`);
  }

  const data = await response.json() as any;
  const content = data?.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("No response content from Groq API.");
  }
  return content;
}

/**
 * A single "document chunk" in the vector store.
 * In production: replace with FAISS index or ChromaDB collection.
 */
interface VectorDocument {
  id: string;
  text: string;
  type: "price" | "msp" | "market" | "scheme" | "trend" | "advisory";
  embedding?: number[];
  metadata?: Record<string, unknown>;
}

/** In-memory vector store (replace with FAISS/ChromaDB in production) */
const vectorStore: VectorDocument[] = [];

/**
 * Embedding Layer: Generate a text embedding via OpenAI.
 * In production: use sentence-transformers or a dedicated embedding model.
 */
async function generateEmbedding(text: string): Promise<number[]> {
  // Use a simple TF-IDF-like hash for fast in-memory similarity
  // In production: call openai.embeddings.create({ model: "text-embedding-3-small", input: text })
  const words = text.toLowerCase().split(/\s+/);
  const vocab: Record<string, number> = {};
  words.forEach((w) => {
    vocab[w] = (vocab[w] || 0) + 1;
  });
  // Return a fixed-length hash vector (dimension 128 for demo)
  const vec = new Array(128).fill(0);
  Object.entries(vocab).forEach(([word, count]) => {
    let hash = 0;
    for (let i = 0; i < word.length; i++) {
      hash = (hash * 31 + word.charCodeAt(i)) % 128;
    }
    vec[Math.abs(hash)] += count;
  });
  const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0)) || 1;
  return vec.map((v) => v / norm);
}

/** Cosine similarity between two vectors */
function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB) + 1e-8);
}

/**
 * Retrieval Layer: Find top-k most relevant documents for a query.
 * Performs cosine similarity search over all vectors in the store.
 */
async function retrieveContext(
  query: string,
  topK = 5,
): Promise<Array<{ doc: VectorDocument; score: number }>> {
  if (vectorStore.length === 0) {
    return [];
  }

  const queryEmbedding = await generateEmbedding(query);

  const scored = vectorStore.map((doc) => ({
    doc,
    score: doc.embedding ? cosineSimilarity(queryEmbedding, doc.embedding) : 0,
  }));

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, topK).filter((s) => s.score > 0.1);
}

/**
 * Index Layer: Add a document to the vector store with its embedding.
 * Call this whenever new data is inserted into the DB.
 */
export async function indexDocument(doc: Omit<VectorDocument, "embedding">): Promise<void> {
  const embedding = await generateEmbedding(doc.text);
  vectorStore.push({ ...doc, embedding });
}

/**
 * Seed the vector store with initial knowledge base documents.
 * This simulates loading mandi data, MSP data, and advisories.
 */
export async function seedVectorStore(): Promise<void> {
  if (vectorStore.length > 0) return;

  const documents: Array<Omit<VectorDocument, "embedding">> = [
    {
      id: "msp_wheat_2024",
      text: "The Minimum Support Price (MSP) for wheat in 2024-25 is Rs. 2275 per quintal. MSP is the price guaranteed by the government for procurement. If a mandi price is lower than MSP, it may indicate price suppression.",
      type: "msp",
    },
    {
      id: "msp_rice_2024",
      text: "MSP for Paddy (Common) is Rs. 2300 per quintal for Kharif 2024-25. Paddy prices below this threshold suggest farmers are not getting fair value.",
      type: "msp",
    },
    {
      id: "msp_maize_2024",
      text: "MSP for Maize is Rs. 2090 per quintal. Maize is widely grown across Rajasthan, Madhya Pradesh, and Uttar Pradesh.",
      type: "msp",
    },
    {
      id: "msp_soybean_2024",
      text: "MSP for Soybean (Yellow) is Rs. 4892 per quintal for Kharif 2024-25. Soybean prices often fluctuate due to international market dynamics.",
      type: "msp",
    },
    {
      id: "exploitation_pattern",
      text: "Common middleman exploitation patterns: (1) Buying at 20-40% below mandi price citing quality issues, (2) Delaying payment beyond 7 days, (3) Charging unofficial commissions above the regulated 1-2%, (4) Inflating weighing scales, (5) Forcing distress sales during harvest glut.",
      type: "advisory",
    },
    {
      id: "price_fairness_guide",
      text: "A price deviation of more than 20% below the mandi modal price is a strong indicator of exploitation. Deviations of 10-20% may suggest market friction. Anything within 10% of modal price is considered fair.",
      type: "advisory",
    },
    {
      id: "pm_kisan_scheme",
      text: "PM-KISAN scheme provides Rs. 6000/year direct income support to farmer families. All land-holding farmers except institutional landholders are eligible. Apply at pmkisan.gov.in.",
      type: "scheme",
    },
    {
      id: "pmfby_scheme",
      text: "PM Fasal Bima Yojana (PMFBY) is a crop insurance scheme covering all food crops, oilseeds, and commercial/horticultural crops. Premium is 2% for Kharif crops and 1.5% for Rabi crops.",
      type: "scheme",
    },
    {
      id: "market_timing_advice",
      text: "Generally, prices are lower immediately after harvest due to supply glut. Storing crops for 2-3 months post-harvest often yields 15-25% higher prices. States with Bhawantar Bhugtan Yojana (MP) offer price deficiency payments.",
      type: "advisory",
    },
    {
      id: "weather_price_correlation",
      text: "Unseasonal rainfall or drought increases vegetable prices by 30-80% within 2 weeks. Wheat prices typically rise 8-12% during summer (March-May). Onion and tomato show highest weather-price correlation.",
      type: "advisory",
    },
    {
      id: "apmc_regulations",
      text: "APMC (Agricultural Produce Market Committee) mandis are regulated markets. Commission agents (arthiyas) charge 2-2.5% for wheat and paddy. Farmers have the right to sell outside APMC in states with amended APMC acts.",
      type: "advisory",
    },
    {
      id: "e_nam_market",
      text: "e-NAM (National Agriculture Market) is an online trading platform connecting 1000+ mandis. Farmers can get better prices by accessing buyers from across India. Minimum lot size and quality standards apply.",
      type: "market",
    },
  ];

  for (const doc of documents) {
    await indexDocument(doc);
  }

  logger.info({ count: documents.length }, "RAG vector store seeded");
}

export interface RAGSource {
  text: string;
  type: string;
  relevanceScore: number;
}

export interface RAGResult {
  answer: string;
  sources: RAGSource[];
  latencyMs: number;
  model: string;
}

export function runLocalExpertEngine(
  query: string,
  retrieved: Array<{ doc: VectorDocument; score: number }>,
): string {
  // Crop reference data for local intelligence engine
  const CROP_DATA: Record<string, { msp: number; modal: number; name: string }> = {
    wheat: { name: "Wheat (Gehun)", msp: 2275, modal: 2400 },
    gehun: { name: "Wheat (Gehun)", msp: 2275, modal: 2400 },
    rice: { name: "Paddy (Dhan/Rice)", msp: 2300, modal: 2450 },
    paddy: { name: "Paddy (Dhan/Rice)", msp: 2300, modal: 2450 },
    dhan: { name: "Paddy (Dhan/Rice)", msp: 2300, modal: 2450 },
    maize: { name: "Maize (Makka)", msp: 2090, modal: 2200 },
    makka: { name: "Maize (Makka)", msp: 2090, modal: 2200 },
    corn: { name: "Maize (Makka)", msp: 2090, modal: 2200 },
    soybean: { name: "Soybean", msp: 4892, modal: 5050 },
    soy: { name: "Soybean", msp: 4892, modal: 5050 },
    cotton: { name: "Cotton", msp: 7121, modal: 7250 },
    onion: { name: "Onion", msp: 1500, modal: 1900 },
    tomato: { name: "Tomato", msp: 1200, modal: 1250 },
  };

  let priceAnalysisBlock = "";
  const numbers = query.match(/\b\d{3,5}\b/g);
  if (numbers) {
    let matchedCropKey = "";
    const lowerQuery = query.toLowerCase();
    for (const key of Object.keys(CROP_DATA)) {
      if (lowerQuery.includes(key)) {
        matchedCropKey = key;
        break;
      }
    }

    if (matchedCropKey) {
      const cropInfo = CROP_DATA[matchedCropKey];
      const offeredPrice = parseInt(numbers[0], 10);
      const fairness = calculateFairnessScore(offeredPrice, cropInfo.modal, cropInfo.msp);

      let verdictBadge = "";
      let verdictDesc = "";
      if (fairness.verdict === "exploitative") {
        verdictBadge = "🔴 **CRITICAL: EXPLOITATIVE OFFER**";
        verdictDesc = `⚠️ This offered price (**Rs. ${offeredPrice}**) is significantly lower than both the current Mandi Modal Price (**Rs. ${cropInfo.modal}**) and the Government MSP (**Rs. ${cropInfo.msp}**). Selling at this rate will result in heavy losses. We strongly advise rejecting this offer and negotiating or reporting commission agent violations if applicable.`;
      } else if (fairness.verdict === "suspicious") {
        verdictBadge = "🟡 **WARNING: SUSPICIOUS OFFER**";
        verdictDesc = `⚠️ The offered price (**Rs. ${offeredPrice}**) is below the expected market average or MSP. Middlemen might be citing false quality/moisture issues or trying to charge illegal commission fees. Negotiate closer to the Mandi Modal Price of **Rs. ${cropInfo.modal}**.`;
      } else {
        verdictBadge = "🟢 **FAIR OFFER**";
        verdictDesc = `✅ The offered price (**Rs. ${offeredPrice}**) is close to or above the current market rates and MSP. This is a fair transaction.`;
      }

      priceAnalysisBlock = `
### 📊 Price Fairness Analysis for ${cropInfo.name}

* **Offered Price:** Rs. ${offeredPrice} per quintal
* **Government MSP (2024-25):** Rs. ${cropInfo.msp} per quintal
* **Mandi Modal Price:** Rs. ${cropInfo.modal} per quintal
* **Deviation from Mandi:** ${fairness.deviationFromMandi}%
* **Deviation from MSP:** ${fairness.deviationFromMsp !== null ? `${fairness.deviationFromMsp}%` : "N/A"}

#### **Verdict:** ${verdictBadge}
${verdictDesc}

---
`;
    } else {
      priceAnalysisBlock = `
### 📊 Price Fairness Inquiry
I noticed you mentioned a price or amount of **Rs. ${numbers[0]}**. To analyze whether this is a fair price or middleman exploitation:
1. Please tell me the **Crop Name** (e.g., Wheat, Paddy, Maize, Soybean).
2. Let me know if you are selling inside a regulated **APMC Mandi** or to a local trader/buyer.
`;
    }
  }

  const lowerQuery = query.toLowerCase();
  const responseParts: string[] = [];

  responseParts.push(`### 🌱 FarmSphere Offline Assistant`);
  responseParts.push(`*FarmSphere is currently operating in **Local Expert Mode** using our high-speed, local agricultural knowledge base. (Configure **GROQ_API_KEY** in **Settings > Secrets** to enable full AI features)*`);

  if (priceAnalysisBlock) {
    responseParts.push(priceAnalysisBlock);
  }

  if (retrieved.length > 0) {
    responseParts.push(`#### 📚 Key Market Intelligence Found:`);
    retrieved.forEach((r, idx) => {
      responseParts.push(`**${idx + 1}. [${r.doc.type.toUpperCase()}]** ${r.doc.text}`);
    });
  }

  responseParts.push(`\n#### 💡 Actionable Farmer Advisories:`);

  let addedAdvice = false;

  if (lowerQuery.includes("wheat") || lowerQuery.includes("gehun")) {
    responseParts.push(`* **Wheat Action Plan:** The MSP of **Rs. 2275/quintal** is your legal/procurement safeguard. Do not sell below this unless there's a heavy quality degradation. If local buyers cite moisture, ask for a proper moisture meter check (standard limit is 12-14%).`);
    addedAdvice = true;
  }
  if (lowerQuery.includes("rice") || lowerQuery.includes("paddy") || lowerQuery.includes("dhan")) {
    responseParts.push(`* **Paddy/Rice Action Plan:** The common paddy MSP is **Rs. 2300/quintal** for 2024-25. Beware of commission agents charging more than the regulated 1-2% fee in APMC mandis.`);
    addedAdvice = true;
  }
  if (lowerQuery.includes("maize") || lowerQuery.includes("makka") || lowerQuery.includes("corn")) {
    responseParts.push(`* **Maize Action Plan:** Maize MSP is **Rs. 2090/quintal**. Harvest gluts cause prices to crash temporarily. If you can store your maize in a warehouse for 6-8 weeks, prices typically rebound by 15-20%.`);
    addedAdvice = true;
  }
  if (lowerQuery.includes("soybean") || lowerQuery.includes("soy")) {
    responseParts.push(`* **Soybean Action Plan:** Yellow soybean has a high MSP of **Rs. 4892/quintal**. Ensure proper sun-drying before bringing your stock to the mandi to prevent traders from offering low rates due to high moisture.`);
    addedAdvice = true;
  }
  if (lowerQuery.includes("scheme") || lowerQuery.includes("kisan") || lowerQuery.includes("bima") || lowerQuery.includes("insurance") || lowerQuery.includes("pm")) {
    responseParts.push(`* **PM-KISAN Assistance:** Direct income support of Rs. 6,000/year is paid in 3 equal installments directly to bank accounts. Check your beneficiary status at \`pmkisan.gov.in\`.
* **PM Fasal Bima Yojana (Crop Insurance):** Secure your harvest against climate risks. Premium rates are very low: only 2% for Kharif crops and 1.5% for Rabi crops.`);
    addedAdvice = true;
  }
  if (lowerQuery.includes("exploit") || lowerQuery.includes("middleman") || lowerQuery.includes("fraud") || lowerQuery.includes("cheat") || lowerQuery.includes("broker") || lowerQuery.includes("commission")) {
    responseParts.push(`* **Middleman Exploitation Warnings:**
  1. **Regulated Fees:** Commission agents (arthiyas) cannot legally charge farmers more than 1.5% to 2% commission. Any higher is illegal.
  2. **Weighing Scales:** Ensure the mandi uses digital scales verified by the Weights and Measures Department.
  3. **Payment Terms:** By law, payment must be made on the same day or within a maximum of 3 days depending on the state APMC guidelines. Delayed payments should be reported to the Mandi Secretary.`);
    addedAdvice = true;
  }

  if (!addedAdvice) {
    responseParts.push(`* **Verify Price Fairness:** You can ask me about specific crops (Wheat, Paddy, Maize, Soybean) and enter the price you are being offered to check for exploitation.
* **APMC vs Outside APMC:** You are legally allowed to sell outside regulated APMC mandis if you get a better price. Compare local trader offers against e-NAM online rates.
* **Storage Strategy:** Prices are typically at their lowest during harvest seasons (supply glut). Storing your crops safely for 2-3 months often results in 15% to 25% higher profit margins.`);
  }

  responseParts.push(`\n*How can I help you further today? Ask about crop MSPs, report a suspicious middleman price, or get details on farmer support schemes!*`);

  return responseParts.join("\n");
}

/**
 * Generation Layer: The main RAG query function.
 * 1. Retrieve relevant context documents
 * 2. Build an augmented prompt with context
 * 3. Generate answer using OpenAI GPT
 *
 * This is the core of the RAG pipeline.
 */
export async function ragQuery(
  query: string,
  extraContext?: { crop?: string; market?: string; state?: string },
): Promise<RAGResult> {
  const startTime = Date.now();

  // Step 1: Retrieval — find relevant knowledge base entries
  const retrieved = await retrieveContext(query, 5);

  // Step 2: Build context string from retrieved documents
  let contextStr = "";
  if (retrieved.length > 0) {
    contextStr =
      "\n\nRelevant information from the knowledge base:\n" +
      retrieved
        .map((r, i) => `[Source ${i + 1} - ${r.doc.type}]: ${r.doc.text}`)
        .join("\n\n");
  }

  // Add extra context if provided
  if (extraContext) {
    const parts = [];
    if (extraContext.crop) parts.push(`Crop: ${extraContext.crop}`);
    if (extraContext.market) parts.push(`Market: ${extraContext.market}`);
    if (extraContext.state) parts.push(`State: ${extraContext.state}`);
    if (parts.length > 0) {
      contextStr += `\n\nUser context: ${parts.join(", ")}`;
    }
  }

  // Step 3: Generation — use Groq to generate a helpful response, falling back to local expert engine if API keys are not present/invalid
  let answer = "";
  let modelUsed = "";

  const systemPrompt = `You are an expert agricultural market intelligence assistant helping Indian farmers make informed decisions. 
You have deep knowledge of:
- Mandi (wholesale market) prices across India
- Minimum Support Prices (MSP) for various crops
- Middleman exploitation patterns and how to detect them
- Government schemes for farmers
- Weather impacts on agricultural prices
- Market timing and selling strategies

Always provide:
1. Direct, actionable advice in simple language
2. Specific price comparisons when relevant
3. Warnings if exploitation is suspected
4. Recommendations for better alternatives

Be empathetic to farmers' challenges. Detect and flag any exploitation patterns.${contextStr}`;

  if (isGroqKeyValid()) {
    modelUsed = "llama-3.3-70b-versatile";
    try {
      answer = await generateWithGroq(query, systemPrompt);
    } catch (err: any) {
      logger.warn({ err }, "Groq generation failed, falling back to local expert engine");
      modelUsed = "local-expert-engine";
      answer = runLocalExpertEngine(query, retrieved);
    }
  } else {
    modelUsed = "local-expert-engine";
    answer = runLocalExpertEngine(query, retrieved);
  }

  const latencyMs = Date.now() - startTime;

  const sources: RAGSource[] = retrieved.map((r) => ({
    text: r.doc.text.substring(0, 200) + (r.doc.text.length > 200 ? "..." : ""),
    type: r.doc.type,
    relevanceScore: Math.round(r.score * 100) / 100,
  }));

  return { answer, sources, latencyMs, model: modelUsed };
}

/**
 * Price Fairness Engine
 * Compares a quoted price against mandi price and MSP to detect exploitation
 */
export function calculateFairnessScore(
  offeredPrice: number,
  mandiModalPrice: number,
  mspPrice: number | null,
): {
  deviationFromMandi: number;
  deviationFromMsp: number | null;
  anomalyScore: number;
  verdict: "fair" | "suspicious" | "exploitative";
} {
  const deviationFromMandi = ((offeredPrice - mandiModalPrice) / mandiModalPrice) * 100;
  const deviationFromMsp = mspPrice
    ? ((offeredPrice - mspPrice) / mspPrice) * 100
    : null;

  // Anomaly score: 0 = perfectly fair, 1 = completely exploitative
  // Based on deviation from mandi price and MSP
  let anomalyScore = 0;
  if (deviationFromMandi < -30) anomalyScore += 0.6;
  else if (deviationFromMandi < -20) anomalyScore += 0.4;
  else if (deviationFromMandi < -10) anomalyScore += 0.2;

  if (deviationFromMsp !== null) {
    if (deviationFromMsp < -20) anomalyScore += 0.4;
    else if (deviationFromMsp < -10) anomalyScore += 0.2;
    else if (deviationFromMsp < 0) anomalyScore += 0.1;
  }

  anomalyScore = Math.min(1, anomalyScore);

  let verdict: "fair" | "suspicious" | "exploitative";
  if (anomalyScore >= 0.6) verdict = "exploitative";
  else if (anomalyScore >= 0.25) verdict = "suspicious";
  else verdict = "fair";

  return {
    deviationFromMandi: Math.round(deviationFromMandi * 100) / 100,
    deviationFromMsp: deviationFromMsp !== null ? Math.round(deviationFromMsp * 100) / 100 : null,
    anomalyScore: Math.round(anomalyScore * 1000) / 1000,
    verdict,
  };
}
