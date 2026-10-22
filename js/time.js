// Date helpers. All tour deadlines are in Swedish time (Europe/Stockholm).

export const TZ = 'Europe/Stockholm';

// Offset (ms) between Stockholm wall-clock time and UTC at a given instant.
function tzOffset(ts) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: TZ,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
      .formatToParts(new Date(ts))
      .map((p) => [p.type, p.value]),
  );
  const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  return asUtc - Math.floor(ts / 1000) * 1000;
}

// Stockholm wall-clock time ("2026-11-10", "23:59:59") → Date.
export function stockholmTime(dateStr, timeStr = '00:00:00') {
  const [y, m, d] = dateStr.split('-').map(Number);
  const [hh, mm, ss] = timeStr.split(':').map(Number);
  const guess = Date.UTC(y, m - 1, d, hh, mm, ss);
  const first = guess - tzOffset(guess);
  return new Date(guess - tzOffset(first));
}

export const eventStart = (event) => stockholmTime(event.start, '00:00:00');
export const eventDeadline = (event) => stockholmTime(event.end, '23:59:59');

// Where an event is in its life cycle at `now`, combining the calendar with the results file.
// 'closed' | 'upcoming' | 'ongoing' | 'awaiting' (deadline passed, results not published yet)
export function eventPhase(event, result, now = new Date()) {
  if (result?.status === 'closed') return 'closed';
  if (now < eventStart(event)) return 'upcoming';
  if (now <= eventDeadline(event)) return 'ongoing';
  return 'awaiting';
}

// The tab to show by default: the ongoing event, else the latest one that has started, else the first.
export function currentEventId(events, now = new Date()) {
  const started = events.filter((e) => eventStart(e) <= now);
  const ongoing = started.find((e) => now <= eventDeadline(e));
  if (ongoing) return ongoing.id;
  return (started.at(-1) ?? events[0]).id;
}

// "3 d 4 h" / "4 h 12 min" / "12 min" until the deadline.
export function countdown(deadline, now = new Date()) {
  const mins = Math.max(0, Math.floor((deadline - now) / 60000));
  const d = Math.floor(mins / 1440);
  const h = Math.floor((mins % 1440) / 60);
  const m = mins % 60;
  if (d > 0) return `${d} d ${h} h`;
  if (h > 0) return `${h} h ${m} min`;
  return `${m} min`;
}

const MONTHS = ['jan', 'feb', 'mars', 'apr', 'maj', 'juni', 'juli', 'aug', 'sep', 'okt', 'nov', 'dec'];

// "1–10 nov 2026", "21 feb–2 mars 2027", "27 mars 2027"
export function dateRange(start, end) {
  const [y1, m1, d1] = start.split('-').map(Number);
  const [y2, m2, d2] = end.split('-').map(Number);
  if (start === end) return `${d1} ${MONTHS[m1 - 1]} ${y1}`;
  if (y1 === y2 && m1 === m2) return `${d1}–${d2} ${MONTHS[m2 - 1]} ${y2}`;
  if (y1 === y2) return `${d1} ${MONTHS[m1 - 1]}–${d2} ${MONTHS[m2 - 1]} ${y2}`;
  return `${d1} ${MONTHS[m1 - 1]} ${y1}–${d2} ${MONTHS[m2 - 1]} ${y2}`;
}
