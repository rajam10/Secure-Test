import mysql from "mysql2/promise";
import dotenv from "dotenv";

dotenv.config();

const pool = mysql.createPool({
  host: process.env.MYSQLHOST || process.env.DB_HOST ,
  port: Number(process.env.MYSQLPORT || process.env.DB_PORT),
  user: process.env.MYSQLUSER || process.env.DB_USER ,
  password: process.env.MYSQLPASSWORD || process.env.DB_PASSWORD ,
  database: process.env.MYSQL_DATABASE || process.env.DB_NAME ,
  connectionLimit: 10
});
 

// retry helper
async function wait(ms) {
  return new Promise(res => setTimeout(res, ms));
}

export async function initSchema(retries = 5) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      console.log(`DB init attempt ${attempt}...`);

      await pool.query(`
        CREATE TABLE IF NOT EXISTS attempts (
          id VARCHAR(64) PRIMARY KEY,
          candidate_id VARCHAR(64) NOT NULL,
          duration_seconds INT NOT NULL,
          started_at DATETIME NOT NULL,
          expires_at DATETIME NOT NULL,
          status ENUM('in_progress','submitted','expired') NOT NULL DEFAULT 'in_progress',
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
      `);

      await pool.query(`
        CREATE TABLE IF NOT EXISTS timer_states (
          attempt_id VARCHAR(64) PRIMARY KEY,
          remaining_ms BIGINT NOT NULL,
          last_updated_at DATETIME NOT NULL,
          is_paused TINYINT(1) NOT NULL DEFAULT 0,
          CONSTRAINT fk_timer_attempt FOREIGN KEY (attempt_id)
          REFERENCES attempts(id) ON DELETE CASCADE
        )
      `);

      await pool.query(`
        CREATE TABLE IF NOT EXISTS events (
          id BIGINT AUTO_INCREMENT PRIMARY KEY,
          attempt_id VARCHAR(64) NOT NULL,
          question_id VARCHAR(64) NULL,
          event_type VARCHAR(64) NOT NULL,
          event_ts DATETIME NOT NULL,
          metadata JSON NULL,
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT fk_events_attempt FOREIGN KEY (attempt_id)
          REFERENCES attempts(id) ON DELETE CASCADE
        )
      `);

      console.log("✅ Schema ready");
      return;

    } catch (err) {
      console.error(`DB init failed (attempt ${attempt}):`, err.message);

      if (attempt === retries) {
        console.error("❌ DB init permanently failed");
        return; // don't crash app
      }

      await wait(3000); // wait 3 seconds before retry
    }
  }
}

export function getPool() {
  return pool;
}
