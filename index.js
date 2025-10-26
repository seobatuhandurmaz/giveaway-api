import express from "express";
import fetch from "node-fetch";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.send("✅ Giveaway Picker API is running!");
});

app.post("/", async (req, res) => {
  try {
    const { directUrls, includeNestedComments, isNewestComments, resultsLimit } = req.body;

    if (!directUrls || !Array.isArray(directUrls) || directUrls.length === 0) {
      return res.status(400).json({ error: "Missing directUrls array" });
    }

    console.log("🎯 Incoming request:", req.body);

    // Apify Actor tetikleme
    const response = await fetch("https://api.apify.com/v2/actor-tasks/instagram-comments-scraper/run-sync-get-dataset-items", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.APIFY_API_TOKEN}`,
      },
      body: JSON.stringify({
        directUrls,
        includeNestedComments: includeNestedComments ?? false,
        isNewestComments: isNewestComments ?? false,
        resultsLimit: resultsLimit ?? 10,
      }),
    });

    const data = await response.json();
    console.log("✅ Apify response:", data);

    // API formatına uygun dönüş
    res.json({
      success: true,
      id: data.defaultDatasetId || "unknown",
      items: data.items || [],
    });

  } catch (error) {
    console.error("❌ Error in /:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`🚀 Giveaway Picker API running on port ${PORT}`));
