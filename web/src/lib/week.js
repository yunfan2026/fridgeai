// Calendar-week helpers (weeks start Monday, local time). Used for the
// "this week" consumed/wasted stats so they reset every Monday rather than
// sliding over a rolling 7-day window.

export function weekStartMonday(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  const dow = (x.getDay() + 6) % 7; // Mon=0 … Sun=6
  x.setDate(x.getDate() - dow);
  return x;
}

export function weekRangeLabel(start = weekStartMonday()) {
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  const fmt = (dt) => dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return `${fmt(start)} – ${fmt(end)}`;
}

// Short weekday for a timestamp, e.g. "Mon".
export function shortDay(ts) {
  return new Date(ts).toLocaleDateString('en-US', { weekday: 'short' });
}
