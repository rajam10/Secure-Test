import { Router } from "express";
import { getPool } from "../db.js";
import { nowUtc, toMySqlDate } from "../utils/date.js";

const router = Router();

/**
 * POST /api/attempts/:id/events/batch
 * Batch event ingestion – immutable (no update/delete endpoints).
 */
router.post("/:id/events/batch", async (req, res) => {
  try {
    const { id } = req.params;
    const { events } = req.body || {};
    if (!Array.isArray(events) || events.length === 0) {
      return res.status(400).json({ error: "events array required" });
    }

    const pool = getPool();
    const [attemptRows] = await pool.query(`SELECT * FROM attempts WHERE id = ?`, [id]);
    if (!attemptRows.length) {
      return res.status(404).json({ error: "Attempt not found" });
    }

    const now = nowUtc();

    const values = events.map((e) => {
      const safeType = String(e.type || "").slice(0, 64);
      const questionId = e.questionId || null;
      const eventTs = e.timestamp ? new Date(e.timestamp) : now;
      const metadata = JSON.stringify(e.metadata || {});
      return [id, questionId, safeType, toMySqlDate(eventTs), metadata];
    });

    await pool.query(
      `INSERT INTO events (attempt_id, question_id, event_type, event_ts, metadata)
       VALUES ?`,
      [values]
    );

    res.json({ stored: events.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to store events" });
  }
});

export default router;
