import express from "express";
import fetch from "node-fetch";
import cors from "cors";

const app = express();
app.use(express.json());
app.use(cors());

const APIFY_TOKEN = process.env.APIFY_TOKEN;
const RUN_URL = "https://api.apify.com/v2/acts/SbK00X0JYCPblD2wp/runs";
const RESULT_URL = "https://api.apify.com/v2/actor-runs/";

// 🟣 POST /run — Apify'ye yeni bir işlem başlatır
app.post("/run", async (req, res) => {
  try {
    const { url, numComments } = req.body;

    const response = await fetch(RUN_URL, {
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
    });

    const data = await response.json();
    return res.json({ id: data?.data?.id || null });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ error: "Failed to start run" });
  }
});

// 🟠 GET /result/:id — Apify'den sonucu çeker
app.get("/result/:id", async (req, res) => {
  const id = req.params.id;
  try {
    const response = await fetch(`${RESULT_URL}${id}`, {
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Bearer ${APIFY_TOKEN}`,
      },
    });
    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ error: "Failed to fetch result" });
  }
});

app.get("/", (req, res) => {
  res.send("✅ Giveaway Picker API is running!");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚄 Server running on port ${PORT}`));
