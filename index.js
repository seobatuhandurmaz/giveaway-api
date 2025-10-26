import express from "express";
import fetch from "node-fetch";
import cors from "cors";

const app = express();
app.use(express.json());
app.use(cors({ origin: "*" }));

const PORT = process.env.PORT || 8080;
const APIFY_TOKEN = process.env.APIFY_TOKEN;

// ✅ Test endpoint
app.get("/", (_, res) => res.send("✅ Giveaway Picker API is running!"));

// 🟠 Giveaway başlatma
app.post("/run", async (req, res) => {
  const { url, numComments } = req.body;

  if (!url || !numComments)
    return res.status(400).json({ error: "Missing parameters" });

  try {
    const response = await fetch(
      "https://api.apify.com/v2/acts/SbK00X0JYCPblD2wp/runs",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          Authorization: `Bearer ${APIFY_TOKEN}`,
        },
        body: JSON.stringify({
          directUrls: [url],
          includeNestedComments: false,
          isNewestComments: false,
          resultsLimit: Number(numComments),
        }),
      }
    );

    const data = await response.json();
    if (data.data?.id) {
      return res.json({ id: data.data.id });
    } else {
      console.error("Apify run failed:", data);
      return res.status(500).json({ error: "Apify run failed" });
    }
  } catch (error) {
    console.error("Run error:", error);
    res.status(500).json({ error: "Failed to start Apify run" });
  }
});

// 🟢 Kazananları getir
app.get("/winners/:runId", async (req, res) => {
  const runId = req.params.runId;

  try {
    // 1️⃣ Run tamamlanana kadar bekle
    let runData;
    for (let i = 0; i < 15; i++) {
      const runRes = await fetch(`https://api.apify.com/v2/actor-runs/${runId}`, {
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          Authorization: `Bearer ${APIFY_TOKEN}`,
        },
      });
      runData = await runRes.json();

      const status = runData?.data?.status;
      if (status === "SUCCEEDED") break;

      if (["FAILED", "ABORTED", "TIMED-OUT"].includes(status)) {
        return res.status(500).json({ error: "Apify run failed or aborted" });
      }

      console.log(`Waiting for Apify run to finish... (${status})`);
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }

    // 2️⃣ Dataset ID kontrolü
    let datasetId = runData?.data?.defaultDatasetId;
    if (!datasetId) {
      console.warn("Dataset ID not ready, retrying...");
      await new Promise((resolve) => setTimeout(resolve, 3000));

      const retry = await fetch(`https://api.apify.com/v2/actor-runs/${runId}`, {
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          Authorization: `Bearer ${APIFY_TOKEN}`,
        },
      });
      const retryData = await retry.json();
      datasetId = retryData?.data?.defaultDatasetId;
    }

    if (!datasetId)
      return res.status(404).json({ error: "Dataset not found yet" });

    // 3️⃣ Dataset verisini çek
    const dataRes = await fetch(
      `https://api.apify.com/v2/datasets/${datasetId}/items`,
      {
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          Authorization: `Bearer ${APIFY_TOKEN}`,
        },
      }
    );

    if (!dataRes.ok) {
      const text = await dataRes.text();
      console.error("Dataset fetch failed:", text);
      return res.status(500).json({ error: "Failed to fetch dataset" });
    }

    const items = await dataRes.json();
    res.json(items);
  } catch (error) {
    console.error("Fetch winners error:", error);
    res.status(500).json({ error: "Failed to fetch winners" });
  }
});

app.listen(PORT, () => console.log(`Server listening on port ${PORT}`));
