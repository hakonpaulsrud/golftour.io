// Scoring and handicap engine for the Winter Simulator Tour 2026/27.
// Pure functions only (no DOM) so they run in both the browser and Node.
// Section references (§) point to the tour rulebook (Regelbok).

// §5.1 – points always based on 12 places
export const POINTS = [100, 80, 65, 50, 40, 35, 30, 25, 20, 15, 10, 5];

// §6.2 – head start by finalist position
export const FINAL_HEAD_START = [3, 2, 2, 1, 1, 0];

const FINAL_ID = 'final';

// §4.2
const ADJUSTMENT = { 1: 3.0, 2: 1.5, 3: 0, 4: -1.5, 5: -3.0 };

export function difficultyAdjustment(difficulty) {
  const adj = ADJUSTMENT[difficulty];
  if (adj === undefined) throw new Error(`Okänd svårighet: ${difficulty}`);
  return adj;
}

// Strip floating-point noise (e.g. 26.499999999) before rounding.
const clean = (x) => Math.round(x * 1e9) / 1e9;

// §4.3 – rounded to nearest integer, exact halves rounded up
export function playingHcp(tourHcp, difficulty) {
  return Math.floor(clean(tourHcp - difficultyAdjustment(difficulty)) + 0.5);
}

// §4.3
export function netScore(gross, shcp) {
  return gross - shcp;
}

// §4.4
export function performanceHcp(gross, par, difficulty) {
  return gross - par + difficultyAdjustment(difficulty);
}

// §4.4 – change limited to −3.0 / +1.0 per event, stored at full precision
export function updateHcp(oldHcp, perfHcp) {
  const change = Math.min(1, Math.max(-3, 0.25 * (perfHcp - oldHcp)));
  return clean(oldHcp + change);
}

const isClosed = (results, eventId) => results[eventId]?.status === 'closed';

export const regularEvents = (events) => events.filter((e) => e.id !== FINAL_ID);

// §4.4–4.5 – walk the closed events in calendar order.
// Returns { byEvent: { [eventId]: { before, after } }, current } with HCP maps keyed by player id.
export function hcpHistory(players, events, results) {
  let hcp = Object.fromEntries(players.map((p) => [p.id, p.startHcp]));
  const byEvent = {};

  for (const event of regularEvents(events)) {
    if (!isClosed(results, event.id)) continue;
    const scores = results[event.id].scores ?? {};
    const before = hcp;
    const after = { ...before };
    for (const [pid, gross] of Object.entries(scores)) {
      if (!(pid in before)) continue;
      after[pid] = updateHcp(before[pid], performanceHcp(gross, event.par, event.difficulty));
    }
    byEvent[event.id] = { before, after };
    hcp = after;
  }

  return { byEvent, current: hcp };
}

// Average points for places [from, to] (1-based, inclusive).
function sharedPoints(from, to) {
  let sum = 0;
  for (let place = from; place <= to; place++) sum += POINTS[place - 1] ?? 0;
  return sum / (to - from + 1);
}

// §5.1–5.4 – results for one closed event, given each player's HCP before it.
// Rows are sorted: players who played (by net), then players who missed.
// Row: { playerId, played, gross, shcp, net, position, tied, points }
export function eventStandings(event, result, hcpBefore, players) {
  const multiplier = event.multiplier ?? 1;
  const scores = result?.scores ?? {};

  const played = players
    .filter((p) => scores[p.id] !== undefined)
    .map((p) => {
      const gross = scores[p.id];
      const shcp = playingHcp(hcpBefore[p.id], event.difficulty);
      return { playerId: p.id, played: true, gross, shcp, net: netScore(gross, shcp) };
    })
    .sort((a, b) => a.net - b.net);

  // §5.3 – equal net shares the points of the places it occupies, then multiplier
  for (let i = 0; i < played.length; ) {
    let j = i;
    while (j + 1 < played.length && played[j + 1].net === played[i].net) j++;
    const points = sharedPoints(i + 1, j + 1) * multiplier;
    for (let k = i; k <= j; k++) {
      Object.assign(played[k], { position: i + 1, tied: j > i, points });
    }
    i = j + 1;
  }

  // §5.4 – non-participants share the last places, always behind participants
  const missed = players.filter((p) => scores[p.id] === undefined);
  const missedPoints = missed.length
    ? sharedPoints(played.length + 1, played.length + missed.length) * multiplier
    : 0;
  const missedRows = missed.map((p) => ({
    playerId: p.id,
    played: false,
    gross: null,
    shcp: null,
    net: null,
    position: null,
    tied: false,
    points: missedPoints,
  }));

  return [...played, ...missedRows];
}

// §5.5 – total points; ties broken by most wins, then most 2nds, 3rds, …
// Returns rows sorted by rank:
// { playerId, points, eventsPlayed, placings: [count of 1st, 2nd, …], hcp, position, tied }
export function orderOfMerit(players, events, results) {
  const history = hcpHistory(players, events, results);
  const rows = Object.fromEntries(
    players.map((p) => [
      p.id,
      { playerId: p.id, points: 0, eventsPlayed: 0, placings: new Array(POINTS.length).fill(0) },
    ]),
  );

  const closedEvents = regularEvents(events).filter((e) => isClosed(results, e.id));
  for (const event of closedEvents) {
    const standings = eventStandings(event, results[event.id], history.byEvent[event.id].before, players);
    for (const row of standings) {
      const r = rows[row.playerId];
      r.points += row.points;
      if (row.played) {
        r.eventsPlayed++;
        r.placings[row.position - 1]++;
      }
    }
  }

  const compare = (a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    for (let i = 0; i < POINTS.length; i++) {
      if (b.placings[i] !== a.placings[i]) return b.placings[i] - a.placings[i];
    }
    return 0;
  };

  const sorted = Object.values(rows)
    .map((r) => ({ ...r, points: clean(r.points), hcp: history.current[r.playerId] }))
    .sort(compare);

  sorted.forEach((row, i) => {
    const prev = sorted[i - 1];
    const next = sorted[i + 1];
    row.position = prev && compare(prev, row) === 0 ? prev.position : i + 1;
    row.tied = Boolean((prev && compare(prev, row) === 0) || (next && compare(next, row) === 0));
  });

  return { rows: sorted, eventsClosed: closedEvents.length };
}

// §6 – the six finalists and their results.
// Qualifiers are the top of the OoM, skipping anyone in final.declined (§6: next in ranking moves up).
// Row: { playerId, oomPosition, headStart, hcp, gross, shcp, net, total, position, tied }
export function finalResults(players, events, results) {
  const finalEvent = events.find((e) => e.id === FINAL_ID);
  const final = results[FINAL_ID] ?? {};
  const declined = new Set(final.declined ?? []);
  const scores = final.scores ?? {};
  const oom = orderOfMerit(players, events, results);

  const finalists = oom.rows
    .filter((r) => !declined.has(r.playerId))
    .slice(0, FINAL_HEAD_START.length)
    .map((r, i) => {
      const headStart = FINAL_HEAD_START[i];
      const shcp = playingHcp(r.hcp, finalEvent.difficulty);
      const gross = scores[r.playerId] ?? null;
      const net = gross === null ? null : netScore(gross, shcp);
      return {
        playerId: r.playerId,
        oomPosition: r.position,
        headStart,
        hcp: r.hcp,
        gross,
        shcp,
        net,
        total: net === null ? null : net - headStart,
      };
    });

  // Lowest total wins; players without a score yet go last. Ties go to a playoff (särspel).
  const ranked = finalists
    .filter((f) => f.total !== null)
    .sort((a, b) => a.total - b.total);
  ranked.forEach((row, i) => {
    const prev = ranked[i - 1];
    row.position = prev && prev.total === row.total ? prev.position : i + 1;
    row.tied = ranked.some((o) => o !== row && o.total === row.total);
  });
  const waiting = finalists
    .filter((f) => f.total === null)
    .map((f) => ({ ...f, position: null, tied: false }));

  return { rows: [...ranked, ...waiting], provisional: oom.eventsClosed < regularEvents(events).length };
}
