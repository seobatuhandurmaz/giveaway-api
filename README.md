# 🎁 Giveaway Picker API

This is a secure backend built with **Express.js** to handle Instagram Giveaway data through the **Apify API**.

## 🔧 Endpoints

| Method | Route | Description |
|--------|--------|-------------|
| POST | `/run` | Starts a new Apify run (requires `url` and `numComments`) |
| GET | `/result/:id` | Fetches the result for a given Apify run ID |

## 🧠 Environment Variables

You must define these in **Railway → Variables**:

