import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  POINTS,
  difficultyAdjustment,
  playingHcp,
  netScore,
  performanceHcp,
  updateHcp,
  hcpHistory,
  eventStandings,
  orderOfMerit,
  finalResults,
} from '../js/engine.js';

// 12 players, all starting on HCP 20 unless overridden
const makePlayers = (hcps = {}) =>
  Array.from({ length: 12 }, (_, i) => {
    const id = `p${i + 1}`;
    return { id, name: `Spelare ${i + 1}`, startHcp: hcps[id] ?? 20 };
  });

const hcpMap = (players) => Object.fromEntries(players.map((p) => [p.id, p.startHcp]));

const event = (id, overrides = {}) => ({ id, difficulty: 3, par: 72, multiplier: 1, ...overrides });

// Scores where p1 is best, p2 second, … (all on the same HCP)
const ladder = (players, base = 80) =>
  Object.fromEntries(players.map((p, i) => [p.id, base + i]));

const pointsOf = (rows) => Object.fromEntries(rows.map((r) => [r.playerId, r.points]));

// --- §4 Tourhandicap ---------------------------------------------------------

test('§4.2 difficulty adjustments', () => {
  assert.deepEqual([1, 2, 3, 4, 5].map(difficultyAdjustment), [3, 1.5, 0, -1.5, -3]);
  assert.throws(() => difficultyAdjustment(6));
});

test('§4.3 rulebook example: HCP 25.0 on 4/5 → SHCP 27, gross 100 → net 73', () => {
  const shcp = playingHcp(25.0, 4);
  assert.equal(shcp, 27);
  assert.equal(netScore(100, shcp), 73);
});

test('§4.3 rounding: nearest integer, exact halves up', () => {
  assert.equal(playingHcp(20.5, 3), 21);
  assert.equal(playingHcp(20.4, 3), 20);
  assert.equal(playingHcp(22.0, 2), 21); // 20.5 → 21
  assert.equal(playingHcp(19.0, 4), 21); // 20.5 → 21
  assert.equal(playingHcp(8.7, 1), 6); // 5.7 → 6
  assert.equal(playingHcp(0.1 + 0.2 + 20.2, 3), 21); // float noise around 20.5
});

test('§4.4 rulebook example: HCP 25.0, performance 17.0 → 23.0', () => {
  assert.equal(updateHcp(25.0, 17.0), 23.0);
});

test('§4.4 performance HCP = gross − par + adjustment', () => {
  assert.equal(performanceHcp(95, 72, 3), 23);
  assert.equal(performanceHcp(95, 72, 5), 20);
  assert.equal(performanceHcp(95, 72, 1), 26);
});

test('§4.4 change clamped to −3.0 and +1.0', () => {
  assert.equal(updateHcp(30, 10), 27); // −5 → −3
  assert.equal(updateHcp(10, 20), 11); // +2.5 → +1
  assert.equal(updateHcp(20, 22), 20.5); // +0.5 within limits
});

test('§4.4–4.5 history is sequential and a missed event keeps the HCP', () => {
  const players = makePlayers().slice(0, 2);
  const events = [event('01'), event('02'), event('03')];
  const results = {
    '01': { status: 'closed', scores: { p1: 72 + 12, p2: 72 + 28 } }, // perf 12, 28
    '02': { status: 'closed', scores: { p1: 72 + 12 } }, // p2 misses
    '03': { status: 'open', scores: { p1: 60 } }, // open events never count
  };
  const { byEvent, current } = hcpHistory(players, events, results);
  assert.equal(byEvent['01'].after.p1, 18); // 20 + clamp(−2) = 18
  assert.equal(byEvent['01'].after.p2, 21); // 20 + clamp(+2 → +1)
  assert.equal(byEvent['02'].before.p1, 18);
  assert.equal(byEvent['02'].after.p1, 16.5); // 18 + 0.25·(12 − 18)
  assert.equal(byEvent['02'].after.p2, 21); // unchanged
  assert.equal(byEvent['03'], undefined);
  assert.deepEqual(current, { p1: 16.5, p2: 21 });
});

// --- §5 Order of Merit -------------------------------------------------------

test('§5.1 a clean event hands out the full points table', () => {
  const players = makePlayers();
  const rows = eventStandings(event('01'), { scores: ladder(players) }, hcpMap(players), players);
  assert.deepEqual(rows.map((r) => r.points), POINTS);
  assert.deepEqual(rows.map((r) => r.position), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
});

test('§5.3 rulebook example: two players share 2nd → 72.5 each', () => {
  const players = makePlayers();
  const scores = ladder(players);
  scores.p3 = scores.p2;
  const rows = eventStandings(event('01'), { scores }, hcpMap(players), players);
  const pts = pointsOf(rows);
  assert.equal(pts.p2, 72.5);
  assert.equal(pts.p3, 72.5);
  assert.equal(pts.p4, 50); // next player takes 4th
  const p3 = rows.find((r) => r.playerId === 'p3');
  assert.equal(p3.position, 2);
  assert.equal(p3.tied, true);
});

test('§5.3 three-way tie for 1st', () => {
  const players = makePlayers();
  const scores = ladder(players);
  scores.p2 = scores.p1;
  scores.p3 = scores.p1;
  const pts = pointsOf(eventStandings(event('01'), { scores }, hcpMap(players), players));
  assert.equal(pts.p1, (100 + 80 + 65) / 3);
  assert.equal(pts.p4, 50);
});

test('§5.2/5.3 multiplier applied after sharing: tied 2nd at 1.5× → 108.75', () => {
  const players = makePlayers();
  const scores = ladder(players);
  scores.p3 = scores.p2;
  const pts = pointsOf(
    eventStandings(event('05', { multiplier: 1.5 }), { scores }, hcpMap(players), players),
  );
  assert.equal(pts.p1, 150);
  assert.equal(pts.p2, 108.75);
});

test('§5.4 rulebook example: missed players share the last places', () => {
  const expected = [5, 7.5, 10, 12.5, 15];
  for (let missed = 1; missed <= 5; missed++) {
    const players = makePlayers();
    const scores = ladder(players.slice(0, 12 - missed));
    const rows = eventStandings(event('01'), { scores }, hcpMap(players), players);
    const missedRows = rows.filter((r) => !r.played);
    assert.equal(missedRows.length, missed);
    for (const r of missedRows) assert.equal(r.points, expected[missed - 1]);
  }
});

test('§5.4 missed players rank below participants and get the multiplier', () => {
  const players = makePlayers();
  const scores = ladder(players.slice(0, 11));
  const rows = eventStandings(event('12', { multiplier: 2 }), { scores }, hcpMap(players), players);
  assert.equal(rows.at(-1).playerId, 'p12');
  assert.equal(rows.at(-1).played, false);
  assert.equal(rows.at(-1).position, null);
  assert.equal(rows.at(-1).points, 10);
  assert.equal(rows[0].points, 200);
});

test('§5.1 net score uses each player\'s own playing HCP', () => {
  const players = makePlayers({ p1: 10, p2: 30 });
  const scores = { p1: 85, p2: 100 }; // net 75 vs 70
  const rows = eventStandings(event('01'), { scores }, hcpMap(players), players);
  assert.equal(rows[0].playerId, 'p2');
  assert.equal(rows[0].net, 70);
  assert.equal(rows[1].net, 75);
});

test('§5.5 Order of Merit sums all closed events and carries HCP', () => {
  const players = makePlayers();
  const events = [event('01'), event('02', { multiplier: 2 }), event('03'), event('final', { difficulty: 5 })];
  const results = {
    '01': { status: 'closed', scores: ladder(players) },
    '02': { status: 'closed', scores: ladder(players) },
    '03': { status: 'open', played: ['p1'] },
  };
  const { rows, eventsClosed } = orderOfMerit(players, events, results);
  assert.equal(eventsClosed, 2);
  assert.equal(rows[0].playerId, 'p1');
  assert.equal(rows[0].points, 300);
  assert.equal(rows[0].eventsPlayed, 2);
  const total = rows.reduce((s, r) => s + r.points, 0);
  assert.equal(total, 475 * 3); // points table sums to 475
  for (const r of rows) assert.equal(typeof r.hcp, 'number');
});

test('§5.5 tie on points is broken by most wins, then most 2nds, 3rds, …', () => {
  const players = makePlayers();
  const events = [event('01'), event('02'), event('final', { difficulty: 5 })];
  // Event 1: p1 1st … p12 12th.
  // Event 2: p7 1st, p4 2nd, p3 3rd, p2 4th, p5 5th, p6 6th, p1 7th, p8 8th … p12 12th.
  // Event 2 gross = target net + playing HCP after event 1, so the order is exact.
  const targetNet = { ...ladder(players, 60), p7: 60, p4: 61, p3: 62, p2: 63, p5: 64, p6: 65, p1: 66 };
  const results = { '01': { status: 'closed', scores: ladder(players) } };
  const { current } = hcpHistory(players, events, results);
  results['02'] = {
    status: 'closed',
    scores: Object.fromEntries(
      players.map((p) => [p.id, targetNet[p.id] + playingHcp(current[p.id], 3)]),
    ),
  };
  const rows = orderOfMerit(players, events, results).rows;
  const at = (id) => rows.find((r) => r.playerId === id);

  // Five players on 130 points, separated by placings:
  // p1, p7: 1st + 7th → one win each, fully tied
  // p2, p4: 2nd + 4th → no win, one 2nd, fully tied
  // p3:     3rd + 3rd → no win, no 2nd
  for (const id of ['p1', 'p2', 'p3', 'p4', 'p7']) assert.equal(at(id).points, 130);
  assert.equal(at('p1').position, 1);
  assert.equal(at('p7').position, 1);
  assert.equal(at('p2').position, 3);
  assert.equal(at('p4').position, 3);
  assert.equal(at('p3').position, 5);
  assert.ok(at('p1').tied && at('p4').tied);
  assert.equal(at('p3').tied, false);
});

// --- §6 Grand Final -----------------------------------------------------------

const seasonFixture = () => {
  const players = makePlayers();
  const events = [
    ...Array.from({ length: 12 }, (_, i) => event(String(i + 1).padStart(2, '0'))),
    event('final', { difficulty: 5 }),
  ];
  const results = Object.fromEntries(
    events.filter((e) => e.id !== 'final').map((e) => [e.id, { status: 'closed', scores: ladder(players) }]),
  );
  return { players, events, results };
};

test('§6.2 finalists are the OoM top 6 with head starts −3/−2/−2/−1/−1/0', () => {
  const { players, events, results } = seasonFixture();
  const { rows, provisional } = finalResults(players, events, results);
  assert.equal(provisional, false);
  assert.deepEqual(rows.map((r) => r.playerId), ['p1', 'p2', 'p3', 'p4', 'p5', 'p6']);
  assert.deepEqual(rows.map((r) => r.headStart), [3, 2, 2, 1, 1, 0]);
  assert.ok(rows.every((r) => r.total === null && r.position === null));
});

test('§6.2 rulebook example: OoM winner nets 74, minus 3 → 71', () => {
  const { players, events, results } = seasonFixture();
  const { rows: before } = finalResults(players, events, results);
  const winner = before[0];
  results.final = { status: 'closed', scores: { [winner.playerId]: 74 + winner.shcp } };
  const { rows } = finalResults(players, events, results);
  const w = rows.find((r) => r.playerId === winner.playerId);
  assert.equal(w.net, 74);
  assert.equal(w.total, 71);
  assert.equal(w.position, 1);
});

test('§6 declined qualifier is replaced by the next in the ranking', () => {
  const { players, events, results } = seasonFixture();
  results.final = { status: 'upcoming', declined: ['p3'] };
  const { rows } = finalResults(players, events, results);
  assert.deepEqual(rows.map((r) => r.playerId), ['p1', 'p2', 'p4', 'p5', 'p6', 'p7']);
  assert.equal(rows[2].headStart, 2);
  assert.equal(rows.at(-1).headStart, 0);
});

test('§6 final is provisional until all 12 events are closed', () => {
  const { players, events, results } = seasonFixture();
  results['12'].status = 'open';
  assert.equal(finalResults(players, events, results).provisional, true);
});

test('§6 tied final totals are flagged for a playoff', () => {
  const { players, events, results } = seasonFixture();
  const { rows } = finalResults(players, events, results);
  const [a, b] = rows; // head starts 3 and 2
  results.final = {
    status: 'closed',
    scores: { [a.playerId]: 75 + a.shcp, [b.playerId]: 74 + b.shcp }, // totals 72 and 72
  };
  const final = finalResults(players, events, results).rows;
  assert.equal(final[0].total, 72);
  assert.equal(final[1].total, 72);
  assert.ok(final[0].tied && final[1].tied);
});

// --- Full season consistency ---------------------------------------------------

test('full season: points add up and HCPs stay within clamp bounds', () => {
  const { players, events, results } = seasonFixture();
  // vary scores so handicaps move both ways
  for (const [i, e] of events.filter((e) => e.id !== 'final').entries()) {
    results[e.id].scores = Object.fromEntries(
      players.map((p, j) => [p.id, 85 + ((i * 7 + j * 5) % 23)]),
    );
  }
  results['05'].scores = Object.fromEntries(Object.entries(results['05'].scores).slice(0, 9));
  events.find((e) => e.id === '05').multiplier = 1.5;
  events.find((e) => e.id === '08').multiplier = 1.5;
  events.find((e) => e.id === '12').multiplier = 2;

  const { rows } = orderOfMerit(players, events, results);
  const total = rows.reduce((s, r) => s + r.points, 0);
  assert.ok(Math.abs(total - 475 * (9 + 1.5 + 1.5 + 2)) < 1e-6);

  const { byEvent } = hcpHistory(players, events, results);
  for (const { before, after } of Object.values(byEvent)) {
    for (const id of Object.keys(before)) {
      const change = after[id] - before[id];
      assert.ok(change >= -3 - 1e-9 && change <= 1 + 1e-9);
    }
  }
});
