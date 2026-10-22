import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { orderOfMerit, finalResults } from '../js/engine.js';

const load = (path) => JSON.parse(readFileSync(new URL(`../data/${path}`, import.meta.url)));

const players = load('players.json');
const events = load('events.json');
const results = Object.fromEntries(events.map((e) => [e.id, load(`results/${e.id}.json`)]));
const playerIds = new Set(players.map((p) => p.id));

test('12 players with unique ids and numeric starting HCP', () => {
  assert.equal(players.length, 12);
  assert.equal(playerIds.size, 12);
  for (const p of players) assert.equal(typeof p.startHcp, 'number', p.id);
});

test('calendar matches the rulebook: 12 events + final, multipliers 1.5/1.5/2', () => {
  assert.deepEqual(
    events.map((e) => e.id),
    ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12', 'final'],
  );
  const multipliers = Object.fromEntries(events.map((e) => [e.id, e.multiplier]));
  assert.equal(multipliers['05'], 1.5);
  assert.equal(multipliers['08'], 1.5);
  assert.equal(multipliers['12'], 2);
  for (const e of events) {
    assert.ok([1, 2, 3, 4, 5].includes(e.difficulty), e.id);
    assert.equal(typeof e.par, 'number', e.id);
    assert.ok(e.start <= e.end, e.id);
  }
});

test('results files are valid', () => {
  for (const [id, r] of Object.entries(results)) {
    assert.ok(['upcoming', 'open', 'closed'].includes(r.status), `${id}: status`);
    for (const [pid, gross] of Object.entries(r.scores ?? {})) {
      assert.ok(playerIds.has(pid), `${id}: unknown player "${pid}" in scores`);
      assert.ok(Number.isInteger(gross) && gross > 40 && gross < 200, `${id}: bad score for ${pid}`);
    }
    for (const pid of r.played ?? []) assert.ok(playerIds.has(pid), `${id}: unknown player "${pid}" in played`);
    for (const pid of r.declined ?? []) assert.ok(playerIds.has(pid), `${id}: unknown player "${pid}" in declined`);
  }
});

test('secrecy: open and upcoming events contain no scores', () => {
  for (const [id, r] of Object.entries(results)) {
    if (id === 'final') continue; // the final may be shown live (§7)
    if (r.status !== 'closed') {
      assert.deepEqual(r.scores ?? {}, {}, `${id} is ${r.status} but has scores`);
    }
  }
});

test('engine runs on the real data', () => {
  const oom = orderOfMerit(players, events, results);
  assert.equal(oom.rows.length, 12);
  assert.equal(finalResults(players, events, results).rows.length, 6);
});
