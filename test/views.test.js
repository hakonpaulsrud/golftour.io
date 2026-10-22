import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { hcpHistory, orderOfMerit } from '../js/engine.js';
import { stockholmTime, eventPhase, currentEventId, countdown, dateRange } from '../js/time.js';
import { renderTavlingar, renderLeaderboard } from '../js/views.js';
import { renderRegler } from '../js/rules.js';

const load = (path) => JSON.parse(readFileSync(new URL(`../data/${path}`, import.meta.url)));

function makeData(results) {
  const players = load('players.json');
  const events = load('events.json');
  const all = Object.fromEntries(events.map((e) => [e.id, results[e.id] ?? { status: 'upcoming', scores: {}, played: [] }]));
  return {
    players,
    events,
    results: all,
    playersById: Object.fromEntries(players.map((p) => [p.id, p])),
    history: hcpHistory(players, events, all),
    oom: orderOfMerit(players, events, all),
  };
}

// --- time -------------------------------------------------------------------------

test('deadline is 23:59 Stockholm time, in winter (CET) and summer (CEST)', () => {
  assert.equal(stockholmTime('2026-11-10', '23:59:59').toISOString(), '2026-11-10T22:59:59.000Z');
  assert.equal(stockholmTime('2027-03-29', '23:59:59').toISOString(), '2027-03-29T21:59:59.000Z');
});

test('event phase follows the calendar until the results file says closed', () => {
  const e = { start: '2026-11-01', end: '2026-11-10' };
  assert.equal(eventPhase(e, {}, new Date('2026-10-31T22:59:00Z')), 'upcoming');
  assert.equal(eventPhase(e, {}, new Date('2026-10-31T23:00:00Z')), 'ongoing'); // 00:00 Stockholm
  assert.equal(eventPhase(e, {}, new Date('2026-11-10T22:59:00Z')), 'ongoing');
  assert.equal(eventPhase(e, {}, new Date('2026-11-10T23:00:00Z')), 'awaiting');
  assert.equal(eventPhase(e, { status: 'closed' }, new Date('2026-11-05T12:00:00Z')), 'closed');
});

test('default tab is the ongoing event, else the latest started, else the first', () => {
  const events = load('events.json');
  assert.equal(currentEventId(events, new Date('2026-10-22T12:00:00Z')), '01');
  assert.equal(currentEventId(events, new Date('2026-11-15T12:00:00Z')), '02');
  assert.equal(currentEventId(events, new Date('2026-12-25T12:00:00Z')), '05'); // Christmas break
  assert.equal(currentEventId(events, new Date('2027-03-15T12:00:00Z')), '12');
  assert.equal(currentEventId(events, new Date('2027-03-22T12:00:00Z')), 'final');
});

test('countdown and Swedish date ranges', () => {
  const deadline = new Date('2026-11-10T22:59:59Z');
  assert.equal(countdown(deadline, new Date('2026-11-07T18:00:00Z')), '3 d 4 h');
  assert.equal(countdown(deadline, new Date('2026-11-10T20:00:00Z')), '2 h 59 min');
  assert.equal(dateRange('2026-11-01', '2026-11-10'), '1–10 nov 2026');
  assert.equal(dateRange('2027-02-21', '2027-03-02'), '21 feb–2 mars 2027');
  assert.equal(dateRange('2027-03-27', '2027-03-27'), '27 mars 2027');
});

// --- views -------------------------------------------------------------------------

test('secrecy: an ongoing event never renders scores, even if the file has them', () => {
  const data = makeData({ '01': { status: 'open', played: ['hakon'], scores: { hakon: 77 } } });
  const html = renderTavlingar(data, '01', new Date('2026-11-05T12:00:00Z'));
  assert.match(html, /Har spelat/);
  assert.match(html, /1 av 12/);
  assert.doesNotMatch(html, />77</);
  assert.doesNotMatch(html, /scoreboard/);
});

test('a closed event renders the results table with points', () => {
  const data = makeData({ '01': { status: 'closed', scores: { hakon: 90, erik: 95 } } });
  const html = renderTavlingar(data, '01', new Date('2026-11-12T12:00:00Z'));
  assert.match(html, /scoreboard/);
  assert.match(html, />100</); // winner's points
  assert.match(html, /Ej spelat/); // the 10 others
});

test('leaderboard shows the cut line after 6th and HCP with one decimal', () => {
  const html = renderLeaderboard(makeData({}));
  assert.equal((html.match(/class="cut"/g) ?? []).length, 1);
  assert.match(html, /20,5/); // Håkon's starting HCP, Swedish format
});

test('final tab and rules render', () => {
  const data = makeData({});
  assert.match(renderTavlingar(data, 'final', new Date('2026-11-01T12:00:00Z')), /Preliminärt/);
  const rules = renderRegler(data);
  assert.match(rules, /Lofoten Links/);
  assert.match(rules, /Winter Tour Champion/);
});
