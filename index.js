// index.js — Cloudflare Workers (no Express, native fetch handler)

const APIFY_BASE = "https://api.apify.com/v2";

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders() },
  });
}

async function handleRequest(request, env) {
  const APIFY_TOKEN = env.APIFY_API_TOKEN || env.APIFY_TOKEN || env.APIFY;
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;

  // CORS preflight
  if (method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }

  // GET /
  if (method === "GET" && path === "/") {
    return new Response("✅ Giveaway API is running", {
      headers: { "Content-Type": "text/plain", ...corsHeaders() },
    });
  }

  // GET /health
  if (method === "GET" && path === "/health") {
    return json({ ok: true, hasToken: Boolean(APIFY_TOKEN) });
  }

  // GET /debug/apify
  if (method === "GET" && path === "/debug/apify") {
    if (!APIFY_TOKEN) return json({ ok: false, error: "APIFY_API_TOKEN missing" }, 500);
    const r = await fetch(`${APIFY_BASE}/me`, {
      headers: { Accept: "application/json", Authorization: `Bearer ${APIFY_TOKEN}` },
    });
    const text = await r.text();
    let data = null;
    try { data = JSON.parse(text); } catch {}
    return json({
      ok: r.ok,
      status: r.status,
      account: data?.data?.id ? { id: data.data.id, username: data.data.username } : null,
      raw: data || text.slice(0, 300),
    }, r.status);
  }

  // POST /start
  if (method === "POST" && path === "/start") {
    let body = {};
    try { body = await request.json(); } catch {}

    const { url: postUrl } = body;
    const rawLimit = body.resultsLimit ?? body.limit ?? body.count ?? body.numberOfComments;
    const resultsLimit = Math.max(1, Math.min(500, Number(rawLimit) || 2));

    if (!postUrl) return json({ success: false, error: "Missing Instagram post URL" }, 400);
    if (!APIFY_TOKEN) return json({ success: false, error: "APIFY_API_TOKEN missing in server" }, 500);

    const runRes = await fetch(`${APIFY_BASE}/acts/SbK00X0JYCPblD2wp/runs`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Bearer ${APIFY_TOKEN}`,
      },
      body: JSON.stringify({
        directUrls: [postUrl],
        includeNestedComments: false,
        isNewestComments: false,
        resultsLimit,
      }),
    });

    const bodyText = await runRes.text();
    let runJson;
    try { runJson = JSON.parse(bodyText); } catch {
      return json({ success: false, error: "Apify returned non-JSON", status: runRes.status, raw: bodyText.slice(0, 300) }, 502);
    }

    if (runRes.status === 401 || runRes.status === 403) {
      return json({ success: false, error: "Unauthorized: Check APIFY_API_TOKEN or actor access permissions.", details: runJson }, runRes.status);
    }

    if (!runRes.ok || !runJson?.data?.id) {
      return json({ success: false, error: "Failed to start actor", details: runJson }, runRes.status);
    }

    return json({ success: true, runId: runJson.data.id });
  }

  // GET /status/:runId
  const statusMatch = path.match(/^\/status\/([^/]+)$/);
  if (method === "GET" && statusMatch) {
    const runId = statusMatch[1];
    if (!APIFY_TOKEN) return json({ success: false, error: "APIFY_API_TOKEN missing" }, 500);
    const r = await fetch(`${APIFY_BASE}/actor-runs/${runId}`, {
      headers: { Accept: "application/json", Authorization: `Bearer ${APIFY_TOKEN}` },
    });
    const text = await r.text();
    let data;
    try { data = JSON.parse(text); } catch {
      return json({ success: false, error: "Apify returned non-JSON", raw: text.slice(0, 300) }, 502);
    }
    if (!r.ok || !data?.data) {
      return json({ success: false, error: "Failed to get actor status", details: data }, r.status);
    }
    return json({ success: true, status: data.data.status, datasetId: data.data.defaultDatasetId || null });
  }

  // GET /winners/:datasetId?limit=N
  const winnersMatch = path.match(/^\/winners\/([^/]+)$/);
  if (method === "GET" && winnersMatch) {
    const datasetId = winnersMatch[1];
    if (!APIFY_TOKEN) return json({ success: false, error: "APIFY_API_TOKEN missing" }, 500);
    const limit = url.searchParams.get("limit");
    const apiUrl = new URL(`${APIFY_BASE}/datasets/${datasetId}/items`);
    apiUrl.searchParams.set("clean", "true");
    if (limit) apiUrl.searchParams.set("limit", limit);

    const r = await fetch(apiUrl.toString(), {
      headers: { Accept: "application/json", Authorization: `Bearer ${APIFY_TOKEN}` },
    });
    const text = await r.text();
    let items;
    try { items = JSON.parse(text); } catch {
      return json({ success: false, error: "Apify returned non-JSON", raw: text.slice(0, 300) }, 502);
    }
    if (!r.ok || !Array.isArray(items)) {
      return json({ success: false, error: "Failed to fetch dataset items", details: items }, r.status);
    }
    return json({ success: true, items });
  }

  // 404
  return json({ error: "Not found" }, 404);
}

export default {
  fetch(request, env) {
    return handleRequest(request, env).catch((err) =>
      new Response(JSON.stringify({ ok: false, error: err.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      })
    );
  },
};
