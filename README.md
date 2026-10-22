# # golftour.io

Leaderboard site for the tour, hosted on GitHub Pages. Static HTML/CSS/JS, no build step.

## Updating results after an event

1. Open `data/results/NN.json` for the event (e.g. `01.json` for Nordic Masters).
2. During the event, optionally add player ids to `played` as they finish. **Never add scores while the event is open** – the repo is public.
3. After the deadline (23:59 Swedish time), add every gross score to `scores`, set `"status": "closed"` and push.

```json
{
  "status": "closed",
  "scores": { "hakon": 88, "erik": 95 },
  "played": ["hakon", "erik"]
}
```

Players with no score in a closed event are treated as having missed it. Handicaps, net scores, placings and points are all calculated by the site from these files.

## Development

```sh
npm test                 # runs the engine tests (node --test, no dependencies)
python3 -m http.server   # preview locally at http://localhost:8000
```
