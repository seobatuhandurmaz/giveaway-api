// index.js (CommonJS)
const express = require("express");
const cors = require("cors");

const APIFY_TOKEN = process.env.APIFY_API_TOKEN; // 🔒 Railway Variable
const APIFY_BASE = "https://api.apify.com/v2";

const app = express();
app.use(cors());
app.use(express.json());

app.get("/", (_req, res) => {
  res.send("✅ Giveaway API is running");
});

app.get("/health", (_req, res) => {
  if (!APIFY_TOKEN) return res.status(500).json({ ok: false, error: "APIFY_API_TOKEN missing" });
  res.json({ ok: true });
});

// 1) Actor’ı başlat
app.post("/start", async (req, res, next) => {
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

    const text = await runRes.text();
    let json;
    try { json = JSON.parse(text); } catch {
      return res.status(502).json({ success: false, error: "Apify returned non-JSON", raw: text.slice(0,300) });
    }
    if (!runRes.ok || !json?.data?.id) {
      return res.status(runRes.status).json({ success: false, error: "Failed to start actor", details: json });
    }

    res.json({ success: true, runId: json.data.id });
  } catch (err) { next(err); }
});

// 2) Run durumu + datasetId
app.get("/status/:runId", async (req, res, next) => {
  try {
    const { runId } = req.params;
    const r = await fetch(`${APIFY_BASE}/actor-runs/${runId}`, {
      headers: { "Accept": "application/json", "Authorization": `Bearer ${APIFY_TOKEN}` },
    });
    const text = await r.text();
    let json; try { json = JSON.parse(text); } catch {
      return res.status(502).json({ success: false, error: "Apify returned non-JSON", raw: text.slice(0,300) });
    }
    if (!r.ok || !json?.data) {
      return res.status(r.status).json({ success: false, error: "Failed to get actor status", details: json });
    }
    res.json({
      success: true,
      status: json.data.status,
      datasetId: json.data.defaultDatasetId || null,
    });
  } catch (err) { next(err); }
});

// 3) Dataset sonuçları
app.get("/winners/:datasetId", async (req, res, next) => {
  try {
    const { datasetId } = req.params;
    const r = await fetch(`${APIFY_BASE}/datasets/${datasetId}/items`, {
      headers: { "Accept": "application/json", "Authorization": `Bearer ${APIFY_TOKEN}` },
    });
    const text = await r.text();
    let items; try { items = JSON.parse(text); } catch {
      return res.status(502).json({ success: false, error: "Apify returned non-JSON", raw: text.slice(0,300) });
    }
    if (!r.ok || !Array.isArray(items)) {
      return res.status(r.status).json({ success: false, error: "Failed to fetch dataset items", details: items });
    }
    res.json({ success: true, items });
  } catch (err) { next(err); }
});

// Global error handler → her zaman JSON
app.use((err, _req, res, _next) => {
  console.error("❌ Server error:", err);
  res.status(500).json({ success: false, error: err.message || "Internal server error" });
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`🚀 Giveaway API on ${PORT}`));
