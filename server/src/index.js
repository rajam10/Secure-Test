import express from "express";
import cors from "cors";
import morgan from "morgan";
import dotenv from "dotenv";

import { initSchema } from "./db.js";
import routes from "./routes/index.js";
import adminLogsRouter from "./routes/adminLogs.js";

dotenv.config();

const app = express();
const port = process.env.APP_PORT || 4000;
const corsOrigin = process.env.CORS_ORIGIN || "http://localhost:3000";

app.use(cors({ origin: corsOrigin, credentials: true }));
app.use(express.json());
app.use(morgan("dev"));

app.use("/api/attempts", routes);
app.use("/api/admin", adminLogsRouter);

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

(async () => {
  try {
    await initSchema();
    app.listen(port, () => {
      console.log(`Secure test server listening on port ${port}`);
    });
  } catch (err) {
    console.error("Failed to initialize schema:", err);
    process.exit(1);
  }
})();
