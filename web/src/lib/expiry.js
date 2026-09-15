// ── Live expiry math ────────────────────────────────────────────────────────
// The v1 bug: days-left was stored as a frozen integer, so time never passed.
// v2 stores an absolute `expires_at` (YYYY-MM-DD) and ALWAYS derives days-left
// from today's date, so the countdown is live.

const DAY_MS = 86400000;

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

// Parse a YYYY-MM-DD (date-only) string into a local midnight Date.
function parseDate(dateStr) {
  if (!dateStr) return null;
  const [y, m, d] = String(dateStr).slice(0, 10).split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

// Days from today until `expires_at`. Negative = already expired. null = unknown.
export function daysLeft(expiresAt) {
  const expiry = parseDate(expiresAt);
  if (!expiry) return null;
  return Math.round((expiry - startOfToday()) / DAY_MS);
}

// Add N days to today and return a YYYY-MM-DD string (for shelf-life estimates).
export function todayPlusDays(days) {
  const d = startOfToday();
  d.setDate(d.getDate() + days);
  return toDateInput(d);
}

// Date -> YYYY-MM-DD in local time (avoids the UTC off-by-one from toISOString).
export function toDateInput(date) {
  const d = date instanceof Date ? date : parseDate(date);
  if (!d) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// Color band for the expiry chip.
export function expiryTone(expiresAt) {
  const d = daysLeft(expiresAt);
  if (d === null) return 'unknown';
  if (d < 0) return 'expired';
  if (d <= 2) return 'urgent';
  if (d <= 5) return 'warn';
  return 'safe';
}

// Human label for the expiry chip.
export function expiryLabel(expiresAt) {
  const d = daysLeft(expiresAt);
  if (d === null) return 'No date';
  if (d < 0) return `Expired ${Math.abs(d)}d ago`;
  if (d === 0) return 'Expires today';
  if (d === 1) return 'Expires tomorrow';
  if (d <= 30) return `${d}d left`;
  const expiry = parseDate(expiresAt);
  return `Exp. ${expiry.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}`;
}

// Tailwind classes per tone, for chips.
export const TONE_CLASSES = {
  expired: 'bg-danger/15 text-danger',
  urgent: 'bg-danger/15 text-danger',
  warn: 'bg-warn/20 text-[#8a5a00]',
  safe: 'bg-safe/15 text-safe',
  unknown: 'bg-ink/10 text-ink/60',
};
