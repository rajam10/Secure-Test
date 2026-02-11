import { Router } from "express";
import { getPool } from "../db.js";

const router = Router();

// GET /api/admin/logs/candidates - list distinct candidate IDs with basic stats
router.get("/logs/candidates", async (_req, res) => {
  try {
    const pool = getPool();
    const [rows] = await pool.query(
      `
        SELECT
          candidate_id,
          COUNT(*) AS attempts,
          MIN(started_at) AS first_started_at,
          MAX(started_at) AS last_started_at
        FROM attempts
        GROUP BY candidate_id
        ORDER BY candidate_id ASC
      `
    );

    res.json({ candidates: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load candidates" });
  }
});

// GET /api/admin/logs/candidates/:candidateId/events - events for a given candidate
router.get("/logs/candidates/:candidateId/events", async (req, res) => {
  try {
    const { candidateId } = req.params;
    const pool = getPool();

    const [events] = await pool.query(
      `
        SELECT
          e.id,
          e.attempt_id,
          a.candidate_id,
          e.event_type,
          e.event_ts,
          e.metadata
        FROM events e
        JOIN attempts a ON a.id = e.attempt_id
        WHERE a.candidate_id = ?
        ORDER BY e.event_ts ASC, e.id ASC
      `,
      [candidateId]
    );

    res.json({ events });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load events" });
  }
});

export default router;

