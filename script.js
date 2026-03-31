document.addEventListener("DOMContentLoaded", () => {
  const API_BASE = "https://giveawaypicker.online";

  const startBtn = document.getElementById("startBtn");
  const showWinnersBtn = document.getElementById("showWinnersBtn");
  const postUrlInput = document.getElementById("postUrl");
  const commentCountInput = document.getElementById("commentCount");
  const winnersContainer = document.getElementById("winnersContainer");
  const progressContainer = document.getElementById("progressContainer");
  const progressFill = document.getElementById("progressFill");

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  function runProgressBar(seconds = 30) {
    progressContainer.style.display = "block";
    progressFill.style.width = "0%";
    const total = seconds * 1000, step = 100;
    let elapsed = 0;
    return new Promise((resolve) => {
      const t = setInterval(() => {
        elapsed += step;
        progressFill.style.width = `${Math.min((elapsed / total) * 100, 100)}%`;
        if (elapsed >= total) {
          clearInterval(t);
          resolve();
        }
      }, step);
    });
  }

  async function fetchJSON(url, options) {
    const res = await fetch(url, options);
    const text = await res.text();
    const ct = res.headers.get("content-type") || "";
    if (!ct.includes("application/json")) {
      console.error("Non-JSON response:", res.status, text.slice(0, 500));
      throw new Error(`HTTP ${res.status}. Backend did not return JSON.`);
    }
    const json = JSON.parse(text);
    if (!res.ok || json?.success === false) {
      throw new Error(json?.error || `HTTP ${res.status}`);
    }
    return json;
  }

  // 1) Start
  startBtn.addEventListener("click", async () => {
    const url = postUrlInput.value.trim();
    const resultsLimit = Math.max(1, Math.min(500, Number(commentCountInput.value.trim()) || 5));

    if (!url) return alert("Please enter a valid Instagram post URL.");

    winnersContainer.innerHTML = "";
    showWinnersBtn.style.display = "none";
    startBtn.disabled = true;
    startBtn.textContent = "Starting...";

    try {
      const { runId } = await fetchJSON(`${API_BASE}/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, resultsLimit })
      });
      sessionStorage.setItem("apify_run_id", runId);

      await runProgressBar(30);

      const maxExtraWaitMs = 60000;
      const pollIntervalMs = 2000;
      const started = Date.now();

      let datasetId = null;
      let items = [];

      while (Date.now() - started < maxExtraWaitMs) {
        const sJson = await fetchJSON(`${API_BASE}/status/${runId}`, { method: "GET" });
        datasetId = sJson.datasetId;

        if (datasetId) {
          const wJson = await fetchJSON(`${API_BASE}/winners/${datasetId}?limit=${resultsLimit}`, { method: "GET" });
          items = Array.isArray(wJson.items) ? wJson.items : [];

          if (items.length >= resultsLimit) break;
          if (["SUCCEEDED", "FAILED", "ABORTED"].includes(sJson.status)) break;
        }
        await sleep(pollIntervalMs);
      }

      sessionStorage.setItem("apify_dataset_id", datasetId || "");
      sessionStorage.setItem("apify_prefetched_items", JSON.stringify(items || []));
      showWinnersBtn.style.display = "block";

      alert(`✅ Data ready. Found ${items.length} entr${items.length === 1 ? "y" : "ies"}. Click "Show Winners".`);
    } catch (err) {
      console.error(err);
      alert(`❌ ${err.message}`);
    } finally {
      startBtn.disabled = false;
      startBtn.textContent = "Start Giveaway Picker";
      progressFill.style.width = "100%";
    }
  });

  // 2) Show winners
  showWinnersBtn.addEventListener("click", async () => {
    const datasetId = sessionStorage.getItem("apify_dataset_id");
    const resultsLimit = Math.max(1, Math.min(500, Number(commentCountInput.value.trim()) || 5));
    if (!datasetId) return alert("⚠️ No dataset found. Please start again.");

    try {
      let items = [];
      const cached = sessionStorage.getItem("apify_prefetched_items");
      if (cached) { try { items = JSON.parse(cached); } catch {} }

      if (!items || items.length === 0) {
        const j = await fetchJSON(`${API_BASE}/winners/${datasetId}?limit=${resultsLimit}`, { method: "GET" });
        items = j.items || [];
      }

      winnersContainer.innerHTML =
        items.map((item, i) => `
          <div class="winner-card">
            <div class="winner-avatar"><img src="${item.ownerProfilePicUrl || ""}" alt="${item.ownerUsername || "user"}"></div>
            <div class="winner-info">
              <strong>#${i + 1}: ${item.ownerUsername || "Unknown"}</strong>
              <p>${item.text || ""}</p>
              <a href="${item.postUrl || "#"}" target="_blank" rel="noopener">View Post ↗</a>
            </div>
          </div>
        `).join("") || `<p>No results.</p>`;
    } catch (err) {
      console.error(err);
      winnersContainer.innerHTML = `<p style="color:red;">Failed to fetch winners. ${err.message}</p>`;
    }
  });
});
