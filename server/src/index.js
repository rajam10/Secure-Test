import express from "express";
import cors from "cors";
import morgan from "morgan";
import dotenv from "dotenv";

import { initSchema } from "./db.js";
import routes from "./routes/index.js";
import adminLogsRouter from "./routes/adminLogs.js";

dotenv.config();

const app = express();

// 🚨 Railway requires PORT (not APP_PORT)
const port = process.env.PORT || 4000;

// allow Railway + local frontend
const corsOrigin = process.env.CORS_ORIGIN || "*";

app.use(cors({ origin: corsOrigin, credentials: true }));
app.use(express.json());
app.use(morgan("dev"));

app.use("/api/attempts", routes);
app.use("/api/admin", adminLogsRouter);

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

// start server safely (never crash container)
(async () => {
  try {
    await initSchema();
    console.log("✅ Schema initialized");
  } catch (err) {
    console.error("⚠ Schema init failed:", err.message);
  }

  app.listen(port, () => {
    console.log(`🚀 Secure test server running on port ${port}`);
  });
})();
