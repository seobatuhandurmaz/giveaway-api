// index.js (CommonJS, Node 18+ — fetch globaldır)
const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors()); // istersen origin whitelist ekleyebilirsin
app.use(express.json());

const APIFY_TOKEN = process.env.APIFY_API_TOKEN; // 🔒 Railway Variables
const APIFY_BASE = "https://api.apify.com/v2";

// Basit sağlık kontrolü
app.get("/", (_req, res) => {
  res.send("✅ Giveaway API is running");
});

/**
 * 1) START: Apify Actor'ı başlat
 * body: { url: string, limit: number }
 */
app.post("/start", async (req, res) => {
  try {
    const { url, limit } = req.body || {};
    if (!url) return res.status(400).json({ success: false, error: "Missing Instagram post URL" });

    const runRes = await fetch(`${APIFY_BASE}/acts/SbK00X0JYCPblD2wp/runs`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "Authorization": `Bearer ${APIFY_TOKEN}`,
      },
      body: JSON.stringify({
        directUrls: [url],
        includeNestedComments: false,
        isNewestComments: false,
        resultsLimit: Number(limit) || 2,
      }),
    });

    const runJson = await runRes.json();
    if (!runRes.ok || !runJson?.data?.id) {
      console.error("Apify /runs error:", runJson);
      return res.status(502).json({ success: false, error: "Failed to start actor" });
    }

    // Frontend 30 sn beklerken bu runId'yi saklayacak
    res.json({ success: true, runId: runJson.data.id });
  } catch (err) {
    console.error("POST /start error:", err);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
});

/**
 * 2) STATUS: Run detayını getir (datasetId burada)
 */
app.get("/status/:runId", async (req, res) => {
  try {
    const { runId } = req.params;
    const statusRes = await fetch(`${APIFY_BASE}/actor-runs/${runId}`, {
      headers: {
        "Accept": "application/json",
        "Authorization": `Bearer ${APIFY_TOKEN}`,
      },
    });
    const statusJson = await statusRes.json();

    if (!statusRes.ok || !statusJson?.data) {
      console.error("Apify /actor-runs error:", statusJson);
      return res.status(502).json({ success: false, error: "Failed to get actor status" });
    }

    const { status, defaultDatasetId } = statusJson.data;
    res.json({
      success: true,
      status,
      datasetId: defaultDatasetId || null,
    });
  } catch (err) {
    console.error("GET /status error:", err);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
});

/**
 * 3) WINNERS: Dataset'ten yorumları çek
 */
app.get("/winners/:datasetId", async (req, res) => {
  try {
    const { datasetId } = req.params;
    const itemsRes = await fetch(`${APIFY_BASE}/datasets/${datasetId}/items`, {
      headers: {
        "Accept": "application/json",
        "Authorization": `Bearer ${APIFY_TOKEN}`,
      },
    });

    // Apify burada DİZİ döndürür (JSON array)
    const items = await itemsRes.json();

    if (!itemsRes.ok || !Array.isArray(items)) {
      console.error("Apify /datasets/items error:", items);
      return res.status(502).json({ success: false, error: "Failed to fetch dataset items" });
    }

    res.json({ success: true, items });
  } catch (err) {
    console.error("GET /winners error:", err);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`🚀 Giveaway API running on port ${PORT}`));
