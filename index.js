// index.js (CommonJS)
const express = require("express");
const cors = require("cors");

const APIFY_TOKEN = process.env.APIFY_API_TOKEN; // 🔒 Railway Variables
const APIFY_BASE = "https://api.apify.com/v2";

const app = express();
app.use(cors());
app.use(express.json());

// Basit sağlık kontrolü
app.get("/health", (_req, res) => {
  res.json({ ok: true, hasToken: Boolean(APIFY_TOKEN) });
});

// Token geçerliyse /v2/me 200 döner
app.get("/debug/apify", async (_req, res) => {
  try {
    if (!APIFY_TOKEN) return res.status(500).json({ ok: false, error: "APIFY_API_TOKEN missing" });
    const r = await fetch(`${APIFY_BASE}/me`, {
      headers: { Accept: "application/json", Authorization: `Bearer ${APIFY_TOKEN}` },
    });
    const text = await r.text();
    let json = null;
    try { json = JSON.parse(text); } catch {}
    res.status(r.status).json({
      ok: r.ok,
      status: r.status,
      account: json?.data?.id ? { id: json.data.id, username: json.data.username } : null,
      raw: json || text.slice(0, 300)
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// 1) Actor’ı başlat
app.post("/start", async (req, res) => {
  try {
    const { url, limit } = req.body || {};
    if (!url) return res.status(400).json({ success: false, error: "Missing Instagram post URL" });
    if (!APIFY_TOKEN) return res.status(500).json({ success: false, error: "APIFY_API_TOKEN missing in server" });

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

    const bodyText = await runRes.text();
    let runJson;
    try { runJson = JSON.parse(bodyText); } catch {
      return res.status(502).json({
        success: false,
        error: "Apify returned non-JSON",
        status: runRes.status,
        raw: bodyText.slice(0, 300)
      });
    }

    // 401/403 için daha açıklayıcı mesaj
    if (runRes.status === 401 || runRes.status === 403) {
      return res.status(runRes.status).json({
        success: false,
        error: "Unauthorized: Check APIFY_API_TOKEN or actor access permissions.",
        details: runJson
      });
    }

    if (!runRes.ok || !runJson?.data?.id) {
      return res.status(runRes.status).json({
        success: false,
        error: "Failed to start actor",
        details: runJson
      });
    }

    return res.json({ success: true, runId: runJson.data.id });
  } catch (err) {
    console.error("POST /start error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 2) Run durumu + datasetId
app.get("/status/:runId", async (req, res) => {
  try {
    const { runId } = req.params;
    const r = await fetch(`${APIFY_BASE}/actor-runs/${runId}`, {
      headers: { Accept: "application/json", Authorization: `Bearer ${APIFY_TOKEN}` },
    });
    const text = await r.text();
    let json; try { json = JSON.parse(text); } catch {
      return res.status(502).json({ success: false, error: "Apify returned non-JSON", raw: text.slice(0, 300) });
    }
    if (!r.ok || !json?.data) {
      return res.status(r.status).json({ success: false, error: "Failed to get actor status", details: json });
    }
    res.json({
      success: true,
      status: json.data.status,
      datasetId: json.data.defaultDatasetId || null,
    });
  } catch (err) {
    console.error("GET /status error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 3) Dataset sonuçları
app.get("/winners/:datasetId", async (req, res) => {
  try {
    const { datasetId } = req.params;
    const r = await fetch(`${APIFY_BASE}/datasets/${datasetId}/items`, {
      headers: { Accept: "application/json", Authorization: `Bearer ${APIFY_TOKEN}` },
    });
    const text = await r.text();
    let items; try { items = JSON.parse(text); } catch {
      return res.status(502).json({ success: false, error: "Apify returned non-JSON", raw: text.slice(0, 300) });
    }
    if (!r.ok || !Array.isArray(items)) {
      return res.status(r.status).json({ success: false, error: "Failed to fetch dataset items", details: items });
    }
    res.json({ success: true, items });
  } catch (err) {
    console.error("GET /winners error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`🚀 Giveaway API on ${PORT}`));
