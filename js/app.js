// Loads the tour data, runs the engine and renders the page for the current URL hash.
// Routes: #tavlingar/<eventId>, #leaderboard, #regler/<section>
import { hcpHistory, orderOfMerit } from './engine.js';
import { currentEventId, countdown } from './time.js';
import { renderTavlingar, renderLeaderboard } from './views.js';
import { renderRegler } from './rules.js';

const app = document.getElementById('app');

const getJson = async (path) => {
  const res = await fetch(path, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`${path}: ${res.status}`);
  return res.json();
};

async function loadData() {
  const [players, events] = await Promise.all([getJson('data/players.json'), getJson('data/events.json')]);
  const resultList = await Promise.all(events.map((e) => getJson(`data/results/${e.id}.json`)));
  const results = Object.fromEntries(events.map((e, i) => [e.id, resultList[i]]));
  return {
    players,
    events,
    results,
    playersById: Object.fromEntries(players.map((p) => [p.id, p])),
    history: hcpHistory(players, events, results),
    oom: orderOfMerit(players, events, results),
  };
}

function route(data) {
  const [page = 'tavlingar', param] = location.hash.slice(1).split('/');

  if (page === 'leaderboard') {
    app.innerHTML = renderLeaderboard(data);
  } else if (page === 'regler') {
    app.innerHTML = renderRegler(data);
  } else {
    const eventId = data.events.some((e) => e.id === param) ? param : currentEventId(data.events);
    app.innerHTML = renderTavlingar(data, eventId);
    app.querySelector('.event-tab[aria-current]')?.scrollIntoView({ block: 'nearest', inline: 'center' });
  }

  const active = page === 'leaderboard' || page === 'regler' ? page : 'tavlingar';
  for (const link of document.querySelectorAll('.main-nav a')) {
    link.toggleAttribute('aria-current', link.getAttribute('href') === `#${active}`);
  }

  const anchor = page === 'regler' && param ? document.getElementById(`regel-${param}`) : null;
  if (anchor) anchor.scrollIntoView();
  else window.scrollTo(0, 0);
}

// Keep the deadline countdown ticking.
setInterval(() => {
  for (const el of document.querySelectorAll('[data-deadline]')) {
    el.textContent = countdown(new Date(el.dataset.deadline));
  }
}, 30_000);

try {
  const data = await loadData();
  route(data);
  window.addEventListener('hashchange', () => route(data));
} catch (err) {
  console.error(err);
  app.innerHTML = '<p class="note error">Kunde inte ladda tourdata. Försök igen om en stund.</p>';
}
