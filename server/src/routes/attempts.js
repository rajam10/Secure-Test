import { Router } from "express";
import { v4 as uuidv4 } from "uuid";
import { getPool } from "../db.js";
import { nowUtc, toMySqlDate } from "../utils/date.js";

const router = Router();

/** POST /api/attempts/start - Start a new assessment attempt */
router.post("/start", async (req, res) => {
  try {
    const { candidateId, durationSeconds } = req.body || {};
    if (!candidateId || !durationSeconds) {
      return res.status(400).json({ error: "candidateId and durationSeconds are required" });
    }
    const pool = getPool();
    const [rows] = await pool.query(
      `select candidate_id from attempts where candidate_id=?`,
      [candidateId]
    );
    if (rows.length > 0) {
      return res.status(400).json({ error: "Candidate already has an attempt" });
    }

    const attemptId = uuidv4();
    const start = nowUtc();
    const expires = new Date(start.getTime() + durationSeconds * 1000);

    await pool.query(
      `INSERT INTO attempts (id, candidate_id, duration_seconds, started_at, expires_at, status)
       VALUES (?, ?, ?, ?, ?, 'in_progress')`,
      [attemptId, candidateId, durationSeconds, toMySqlDate(start), toMySqlDate(expires)]
    );

    await pool.query(
      `INSERT INTO timer_states (attempt_id, remaining_ms, last_updated_at, is_paused)
       VALUES (?, ?, ?, 0)`,
      [attemptId, durationSeconds * 1000, toMySqlDate(start)]
    );

    res.json({
      attemptId,
      serverNow: start.toISOString(),
      expiresAt: expires.toISOString(),
      remainingMs: durationSeconds * 1000
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to start attempt" });
  }
});

/** GET /api/attempts/:id/timer - Get authoritative timer state */
router.get("/:id/timer", async (req, res) => {
  try {
    const { id } = req.params;
    const pool = getPool();
    const [rows] = await pool.query(`SELECT * FROM attempts WHERE id = ?`, [id]);
    if (!rows.length) {
      return res.status(404).json({ error: "Attempt not found" });
    }
    const attempt = rows[0];
    const now = nowUtc();
    const expiresAt = new Date(attempt.expires_at);
    let remainingMs = Math.max(0, expiresAt.getTime() - now.getTime());

    const [timerRows] = await pool.query(`SELECT * FROM timer_states WHERE attempt_id = ?`, [id]);
    if (timerRows.length) {
      const timer = timerRows[0];
      if (timer.is_paused) {
        remainingMs = Number(timer.remaining_ms);
      }
    }

    const status = remainingMs <= 0 ? "expired" : attempt.status;

    if (remainingMs <= 0 && attempt.status === "in_progress") {
      await pool.query(`UPDATE attempts SET status = 'expired' WHERE id = ?`, [id]);
    }

    res.json({
      attemptId: id,
      status,
      serverNow: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      remainingMs
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch timer" });
  }
});

/** POST /api/attempts/:id/timer/pause */
router.post("/:id/timer/pause", async (req, res) => {
  try {
    const { id } = req.params;
    const pool = getPool();
    const [rows] = await pool.query(`SELECT * FROM attempts WHERE id = ?`, [id]);
    if (!rows.length) return res.status(404).json({ error: "Attempt not found" });

    const attempt = rows[0];
    if (attempt.status !== "in_progress") {
      return res.status(400).json({ error: "Attempt not in progress" });
    }

    const now = nowUtc();
    const expiresAt = new Date(attempt.expires_at);
    const remainingMs = Math.max(0, expiresAt.getTime() - now.getTime());

    await pool.query(
      `UPDATE timer_states SET remaining_ms = ?, last_updated_at = ?, is_paused = 1 WHERE attempt_id = ?`,
      [remainingMs, toMySqlDate(now), id]
    );

    res.json({ attemptId: id, remainingMs, paused: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to pause timer" });
  }
});

/** POST /api/attempts/:id/timer/resume */
router.post("/:id/timer/resume", async (req, res) => {
  try {
    const { id } = req.params;
    const pool = getPool();
    const [rows] = await pool.query(`SELECT * FROM attempts WHERE id = ?`, [id]);
    if (!rows.length) return res.status(404).json({ error: "Attempt not found" });

    const attempt = rows[0];
    if (attempt.status !== "in_progress") {
      return res.status(400).json({ error: "Attempt not in progress" });
    }

    const now = nowUtc();
    const [timerRows] = await pool.query(`SELECT * FROM timer_states WHERE attempt_id = ?`, [id]);
    if (!timerRows.length) {
      return res.status(400).json({ error: "Timer state missing" });
    }
    const timer = timerRows[0];

    const expiresAt = new Date(now.getTime() + Number(timer.remaining_ms));
    await pool.query(`UPDATE attempts SET expires_at = ? WHERE id = ?`, [toMySqlDate(expiresAt), id]);
    await pool.query(
      `UPDATE timer_states SET last_updated_at = ?, is_paused = 0 WHERE attempt_id = ?`,
      [toMySqlDate(now), id]
    );

    res.json({
      attemptId: id,
      remainingMs: Number(timer.remaining_ms),
      paused: false,
      expiresAt: expiresAt.toISOString()
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to resume timer" });
  }
});

/** POST /api/attempts/:id/submit - Submit assessment (manual or auto) */
router.post("/:id/submit", async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body || {};
    const pool = getPool();

    const [rows] = await pool.query(`SELECT * FROM attempts WHERE id = ?`, [id]);
    if (!rows.length) return res.status(404).json({ error: "Attempt not found" });
    const attempt = rows[0];

    const now = nowUtc();
    const expiresAt = new Date(attempt.expires_at);
    const isExpiredByTime = now.getTime() >= expiresAt.getTime();
    const newStatus = isExpiredByTime ? "expired" : "submitted";

    await pool.query(`UPDATE attempts SET status = ? WHERE id = ?`, [newStatus, id]);

    await pool.query(
      `INSERT INTO events (attempt_id, question_id, event_type, event_ts, metadata)
       VALUES (?, NULL, ?, ?, ?)`,
      [
        id,
        isExpiredByTime ? "TIMER_AUTO_SUBMIT" : "MANUAL_SUBMIT",
        toMySqlDate(now),
        JSON.stringify({ reason: reason || null })
      ]
    );

    res.json({ attemptId: id, status: newStatus });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to submit attempt" });
  }
});

export default router;
