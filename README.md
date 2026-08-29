# KCC Grand Prix 🏁

A GitHub contribution dashboard shaped like a car race. Every merged PR, closed
issue and code review a teammate lands during the period pushes their car
further down the track — and not everyone drives the same car, so a Formula car
covers twice the ground of a tractor for the same work.

## Quick start

```bash
node scripts/fetch.js --demo     # fake but plausible race, no network needed
open index.html                  # (Windows: start index.html)
```

Then, for real data:

1. Edit `config.json` — the org/repos to look at, the period, and the grid.
2. Create a GitHub token with `repo` scope (classic) or read access to the repos
   you're scoring: https://github.com/settings/tokens
3. Run the fetch:

```bash
# PowerShell
$env:GITHUB_TOKEN="ghp_xxx"; npm run fetch

# bash
GITHUB_TOKEN=ghp_xxx npm run fetch
```

That writes `data.json` and `data.js`. Open `index.html` — it reads `data.js`, so
it works straight off disk with no server. If you'd rather serve it:
`npm run serve` → http://localhost:5173

## config.json

```jsonc
{
  "title": "KCC Grand Prix",
  "period": { "since": "2026-08-01", "until": "2026-08-31" },
  "scope": {
    "orgs":  ["my-org"],              // org:my-org
    "repos": ["my-org/api", "x/y"]    // repo:my-org/api  (OR'd with the orgs)
  },
  "scoring": { "mergedPR": 3, "issueClosed": 2, "reviewSubmitted": 1 },
  "racers": [
    { "login": "octocat", "name": "Octo", "car": "f1", "color": "#ff2e63" },
    { "login": "someone", "name": "Sam",  "car": "van", "color": "#00e5ff", "speed": 0.9 }
  ]
}
```

- `login` — GitHub username. The only required field.
- `name` — what shows on the track. Optional, defaults to the login.
- `car` — one of the garage below. Optional, defaults to `muscle` (×1.00) so
  nobody is handicapped by accident — hand the fast cars out on purpose.
- `color` — the paint job. Optional; racers without one get the next colour from
  a 20-colour palette in `scripts/cars.js`. Purely cosmetic.
- `speed` — optional override of the car's speed multiplier.

**Field size.** The grid is built for up to about 20 racers. Lane height, car
size and label width are derived from the racer count and the window height, so
the whole field is on screen at once — 6 racers get big cars and a two-line
label, 18 get thin lanes, small cars and a one-line label with the score on the
right. Past ~20 the lanes get too thin to read; split the field into two races
(two config files, two folders) instead.

## The garage

| `car` | Label | Speed (distance per point) |
| --- | --- | --- |
| `f1` | Formula | 2 |
| `supercar` | Supercar | 2 |
| `sports` | Sports | 2 |
| `muscle` | Muscle | 1 |
| `hatchback` | Hot hatch | 1 |
| `pickup` | Pickup | 1 |
| `van` | Van | 1 |
| `tractor` | Tractor | 1 |

**Distance = points × car speed.** The car with the most distance takes the
chequered flag, so the handicap is real: give the fast cars out as a prize, or
to even out a lopsided team.

Speeds live in `scripts/cars.js` — change them, or add a car by adding an entry
there plus a matching SVG in the `SHAPES` map near the top of `index.html`.

Every car is drawn in a 120×44 box and **faces right**, the direction of travel.
Keep the convention when adding one: nose, windscreen and headlight at high x;
boot, tail light and rear wheel at low x; front wheel forward of the rear one.
The `lamp()`, `tail()` and `wheel()` helpers place those parts.

## How the numbers are found

Three GitHub search queries per racer, per period:

| Counts | Query | Dated by |
| --- | --- | --- |
| Merged PRs | `is:pr is:merged author:LOGIN merged:SINCE..UNTIL` | close date |
| Issues closed | `is:issue is:closed assignee:LOGIN closed:SINCE..UNTIL` | close date |
| Reviews | `is:pr -author:LOGIN reviewed-by:LOGIN updated:SINCE..UNTIL` | last update |

Caveats worth knowing before anyone argues about the standings:

- Reviews are counted **per pull request reviewed**, not per review comment —
  the search API has no per-review date, so a reviewed PR is dated by its last
  update. Close enough for a race, not an audit.
- Issues are attributed by **assignee**, so unassigned issues score nobody.
- Search only sees repos your token can read; without a token it's public repos
  only and 10 requests/minute.
- Each query pulls up to 300 items (`--pages=N` to change it).

## Watching the race

- **Space** play/pause · **←/→** step a day · drag the scrubber to any date
- 1× / 2× / 4× playback; a full period plays in about 18 seconds at 1×
- Lanes stay in config order — the standings panel on the right does the ranking,
  so the finish is still a surprise
- Each lane carries its own live rank and distance, so a 20-car grid is readable
  without cross-referencing the sidebar
- The commentary feed lists everything landed up to the current day; click through
  to the PR or issue
- The winner appears as a dismissable toast, so it never lands below the fold

## Files

```
config.json        the grid, the period, the scoring
scripts/fetch.js   GitHub → data.json / data.js
scripts/cars.js    car catalogue and speeds
scripts/serve.js   optional static server
index.html         the whole dashboard, one file
```

## Ideas worth stealing later

- Schedule `npm run fetch` weekly and keep a season of results.
- Weight by PR size (additions + deletions) instead of a flat 3 points.
- Give the previous winner the tractor next round.
