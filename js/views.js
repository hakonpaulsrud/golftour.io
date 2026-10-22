// Page rendering. Pure functions returning HTML strings, so they can be tested in Node.
import { eventStandings, finalResults } from './engine.js';
import { eventPhase, eventDeadline, countdown, dateRange } from './time.js';

export const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const num = new Intl.NumberFormat('sv-SE', { maximumFractionDigits: 2 });
const hcp1 = new Intl.NumberFormat('sv-SE', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
export const fmtPoints = (p) => num.format(p);
const fmtHcp = (h) => hcp1.format(h);
const fmtPos = (pos, tied) => (pos === null ? '–' : `${tied ? 'T' : ''}${pos}`);

// Full name on wide screens, "Andreas A." on narrow ones.
function playerName(player) {
  const [first, ...rest] = player.name.split(' ');
  const short = rest.length ? `${first} ${rest.at(-1)[0]}.` : first;
  return `<span class="name-full">${esc(player.name)}</span><span class="name-short">${esc(short)}</span>`;
}

const tabLabel = (event) => (event.id === 'final' ? 'Final' : String(Number(event.id)));

const difficultyDots = (d) =>
  `<span class="dots" aria-label="Svårighet ${d} av 5">${'●'.repeat(d)}${'○'.repeat(5 - d)}</span>`;

const PHASE_LABEL = {
  upcoming: 'Kommande',
  ongoing: 'Pågår',
  awaiting: 'Inväntar resultat',
  closed: 'Avslutad',
};

// --- Tävlingar -------------------------------------------------------------------

export function renderTavlingar(data, eventId, now = new Date()) {
  const event = data.events.find((e) => e.id === eventId) ?? data.events[0];
  const result = data.results[event.id] ?? {};

  const tabs = data.events
    .map((e) => {
      const phase = eventPhase(e, data.results[e.id], now);
      const current = e.id === event.id ? ' aria-current="page"' : '';
      return `<a class="event-tab phase-${phase}" href="#tavlingar/${e.id}"${current}>${tabLabel(e)}</a>`;
    })
    .join('');

  const body = event.id === 'final' ? finalBody(data, event, result, now) : eventBody(data, event, result, now);

  return `
    <nav class="event-tabs" aria-label="Tävlingar">${tabs}</nav>
    <article class="event">
      ${eventHeader(event, result, now)}
      ${body}
    </article>`;
}

function eventHeader(event, result, now) {
  const phase = eventPhase(event, result, now);
  const isFinal = event.id === 'final';
  const multiplier =
    !isFinal && event.multiplier !== 1 ? `<span class="badge badge-gold">${num.format(event.multiplier)}× poäng</span>` : '';
  const when = isFinal
    ? result.date
      ? dateRange(result.date, result.date)
      : `${dateRange(event.start, event.end)} · datum meddelas senare`
    : dateRange(event.start, event.end);
  const clock =
    phase === 'ongoing' && !isFinal
      ? `<p class="countdown">Stänger om <strong data-deadline="${eventDeadline(event).toISOString()}">${countdown(eventDeadline(event), now)}</strong> · 23:59 ${esc(dateRange(event.end, event.end))}</p>`
      : '';

  return `
    <header class="event-header">
      <p class="event-kicker">${isFinal ? 'Säsongsavslutning' : `Deltävling ${Number(event.id)} av 12`}</p>
      <h2 class="event-name">${esc(event.name)}</h2>
      <p class="event-course">${esc(event.course)}</p>
      <p class="event-meta">
        <span>${esc(when)}</span>
        <span>Svårighet ${difficultyDots(event.difficulty)}</span>
        <span>Par ${event.par}${event.parConfirmed === false ? '*' : ''}</span>
      </p>
      <p class="event-badges"><span class="badge phase-badge phase-${phase}">${PHASE_LABEL[phase]}</span>${multiplier}</p>
      ${clock}
    </header>`;
}

function eventBody(data, event, result, now) {
  const phase = eventPhase(event, result, now);

  if (phase === 'closed') {
    const before = data.history.byEvent[event.id]?.before ?? data.history.current;
    const rows = eventStandings(event, result, before, data.players);
    return resultsTable(data, event, rows);
  }

  if (phase === 'upcoming') {
    return `<p class="note">Spelperioden öppnar ${esc(dateRange(event.start, event.start))}. Resultaten publiceras när tävlingen har stängt.</p>`;
  }

  // ongoing / awaiting: only who has played – never scores (§7)
  const played = new Set(result.played ?? []);
  const list = data.players
    .map(
      (p) =>
        `<li class="${played.has(p.id) ? 'has-played' : ''}"><span class="check" aria-hidden="true">${played.has(p.id) ? '✓' : ''}</span>${playerName(p)}${played.has(p.id) ? '<span class="sr-only"> – har spelat</span>' : ''}</li>`,
    )
    .join('');
  const text =
    phase === 'awaiting'
      ? 'Tävlingen har stängt. Resultaten publiceras när de har godkänts.'
      : 'Resultaten är hemliga tills tävlingen har stängt. Här syns vilka som har spelat sin runda.';
  return `
    <section class="board">
      <h3 class="board-title">Har spelat <span class="count">${played.size} av ${data.players.length}</span></h3>
      <ul class="played-list">${list}</ul>
    </section>
    <p class="note">${text}</p>`;
}

function resultsTable(data, event, rows) {
  const body = rows
    .map((r) => {
      const p = data.playersById[r.playerId];
      if (!r.played) {
        return `<tr class="missed"><td class="pos">–</td><td class="player">${playerName(p)}</td><td colspan="3" class="dns">Ej spelat</td><td class="num pts">${fmtPoints(r.points)}</td></tr>`;
      }
      const under = r.net < event.par ? ' under-par' : '';
      return `<tr${r.position === 1 ? ' class="leader"' : ''}><td class="pos">${fmtPos(r.position, r.tied)}</td><td class="player">${playerName(p)}</td><td class="num">${r.gross}</td><td class="num">${r.shcp}</td><td class="num net${under}">${r.net}</td><td class="num pts">${fmtPoints(r.points)}</td></tr>`;
    })
    .join('');
  return `
    <section class="board">
      <div class="table-wrap">
        <table class="scoreboard">
          <thead><tr><th class="pos">Pos</th><th class="player">Spelare</th><th class="num" title="Bruttoslag">Brutto</th><th class="num" title="Spelhandicap">SHCP</th><th class="num" title="Nettoresultat">Netto</th><th class="num" title="Order of Merit-poäng">Poäng</th></tr></thead>
          <tbody>${body}</tbody>
        </table>
      </div>
    </section>`;
}

function finalBody(data, event, result, now) {
  const { rows, provisional } = finalResults(data.players, data.events, data.results);
  const closed = result.status === 'closed';
  const anyScores = rows.some((r) => r.total !== null);

  const champions = closed ? rows.filter((r) => r.position === 1) : [];
  const banner =
    champions.length === 1
      ? `<div class="champion"><p class="champion-kicker">Winter Tour Champion 2026/27</p><p class="champion-name">${esc(data.playersById[champions[0].playerId].name)}</p></div>`
      : champions.length > 1
        ? `<div class="champion"><p class="champion-kicker">Delad ledning – särspel</p><p class="champion-name">${champions.map((c) => esc(data.playersById[c.playerId].name)).join(' · ')}</p></div>`
        : '';

  const body = rows
    .map((r) => {
      const p = data.playersById[r.playerId];
      const score =
        r.total === null
          ? `<td class="num opt">–</td><td class="num opt">${r.shcp}</td><td class="num">–</td><td class="num total">–</td>`
          : `<td class="num opt">${r.gross}</td><td class="num opt">${r.shcp}</td><td class="num">${r.net}</td><td class="num total${r.total < event.par ? ' under-par' : ''}">${r.total}</td>`;
      const pos = anyScores ? fmtPos(r.position, r.tied) : r.oomPosition;
      return `<tr${champions.includes(r) ? ' class="leader"' : ''}><td class="pos">${pos}</td><td class="player">${playerName(p)}</td><td class="num head-start">${r.headStart ? `−${r.headStart}` : '0'}</td>${score}</tr>`;
    })
    .join('');

  const note = provisional
    ? '<p class="note"><strong>Preliminärt:</strong> nuvarande topp 6 i Order of Merit. Finalisterna är klara när deltävling 12 har stängt.</p>'
    : '';

  return `
    ${banner}
    ${note}
    <section class="board">
      <div class="table-wrap">
        <table class="scoreboard">
          <thead><tr><th class="pos">${anyScores ? 'Pos' : 'OoM'}</th><th class="player">Finalist</th><th class="num" title="Startfördel">Start</th><th class="num opt">Brutto</th><th class="num opt">SHCP</th><th class="num">Netto</th><th class="num">Res.</th></tr></thead>
          <tbody>${body}</tbody>
        </table>
      </div>
    </section>
    <p class="note">Resultat = brutto − spelhandicap − startfördel. Lägst resultat vinner. Under finalen visas resultaten live.</p>`;
}

// --- Leaderboard -----------------------------------------------------------------

export function renderLeaderboard(data) {
  const { rows, eventsClosed } = data.oom;
  const started = eventsClosed > 0;
  const finalists = 6;

  const body = rows
    .map((r, i) => {
      const p = data.playersById[r.playerId];
      const cut = i === finalists - 1 ? ' class="cut"' : '';
      return `<tr${cut}><td class="pos">${started ? fmtPos(r.position, r.tied) : '–'}</td><td class="player">${playerName(p)}</td><td class="num pts">${fmtPoints(r.points)}</td><td class="num">${fmtHcp(r.hcp)}</td></tr>`;
    })
    .join('');

  const status = started
    ? `Efter ${eventsClosed} av 12 deltävlingar`
    : 'Säsongen startar 1 november 2026. Handicap visas som starthandicap.';

  return `
    <section class="page">
      <header class="page-header">
        <h2>Order of Merit</h2>
        <p class="page-sub">${status}</p>
      </header>
      <div class="table-wrap">
        <table class="scoreboard leaderboard">
          <thead><tr><th class="pos">Pos</th><th class="player">Spelare</th><th class="num">Poäng</th><th class="num" title="Tourhandicap">HCP</th></tr></thead>
          <tbody>${body}</tbody>
        </table>
      </div>
      <p class="note"><span class="cut-legend"></span> Topp 6 kvalificerar sig till Grand Final på Oakmont.</p>
    </section>`;
}
