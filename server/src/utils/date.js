/**
 * Date/time helpers for consistent server-side handling.
 * Uses local time for MySQL DATETIME to avoid timezone double-conversion issues.
 */

export function nowUtc() {
  return new Date();
}

/**
 * Format a Date for MySQL DATETIME (local time).
 */
export function toMySqlDate(d) {
  const pad = (n) => n.toString().padStart(2, "0");
  const year = d.getFullYear();
  const month = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  const hours = pad(d.getHours());
  const minutes = pad(d.getMinutes());
  const seconds = pad(d.getSeconds());
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}
