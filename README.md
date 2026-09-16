# Dynasty Ticker

Sleeper dynasty league ticker: live scores, standings, playoff odds, awards, archive, and a trade lab. Values are built from Sleeper dynasty trades across many leagues, mixed with KeepTradeCut. The site is static. It talks to Sleeper from the browser.

## What is in this repo
- **Web app:** `docs/` — League Command Center at [dynastyticker.com](https://dynastyticker.com/).
- **Kernels:** `docs/modules/` — parse, Sleeper client, values, live poll, recap card, season engine.
- **Tests:** `tests/` — Node + Python. Run `npm test`.
- **Python CLI:** `src/` — still there if you want terminal trade suggestions.

## Web app

Open `docs/` locally (`npm run serve`) or [dynastyticker.com](https://dynastyticker.com/).

1. Type a **Sleeper username** and press **Find leagues**.
2. Pick the league.
3. League ID / URL still lives behind “Have a league ID or URL instead?”

Share URLs are ordinary query strings: `?league=&me=&tab=&view=&week=&tone=`. `tab` is the page, `view` is the room inside it. Old links (`tab=trader`, `tab=analytics`, `tab=team`, `view=passport`, ...) still resolve. Recap can copy that link or save a PNG image card.

### Pages
Four pages. Each page has a row of rooms under it, so every feature is at most two taps away.

1. **League** — this season.
   - **Scores** — live scoreboard with pre-game win%, pulse tiles that jump to the right room.
   - **Standings** — overall / divisions, all-play, luck index.
   - **Power** — dynasty value board (starters, depth, picks, age). Tap a team to open its scout card.
   - **Awards** — weekly honors (marked live if the week is still going) and season superlatives.
   - **Recap** — group-chat paste in broadcast / hype / roast voice. Copy text, copy a recap link, or save the image card.
2. **Teams** — every roster.
   - **Roster** — tap any team: power scout card, optimal lineup, bench, nicknames, pick vault, season log, jump into a trade.
   - **Loyalty** — kept / gone / new since last season, iron share, DNA keep rate.
   - **Passports** — career stamps for every player on the roster.
   - A **Viewing** picker on Loyalty and Passports switches which roster you are looking at.
3. **Trades** — deals.
   - **Log** — graded trade log with the trade wire. Tap a row to open the trade file (record since, market now, later finishes). Optional league board reads this room’s taste.
   - **Calculator** — build both sides by hand and get a verdict.
   - **Find deals** — shop an asset, target a player, or generate a blockbuster.
4. **History** — the archive.
   - **Hall** — all-time titles, finish matrix, rivalry ledger, league eras, manager lens.
   - **Seasons** — season archive and side-by-side comparisons.
   - **Records** — all-time record book from archive matchups.

Demo league: [Try Hard or Die Hard](https://sleeper.app/leagues/1315165104303513600) (`1315165104303513600`).

### Live Sunday scores
The app polls Sleeper matchups on the NFL window (Thu–Mon UTC) and whenever the current week already has points. Scoreboard, ticker, awards, and recap refresh. The 4000-season Monte Carlo does **not** rerun on every point tick. It refreshes when a week finals, remaining games change, or ~3 minutes have passed.

### Value source
Sleeper trades first, KeepTradeCut as the prior:
- Superflex vs 1QB KeepTradeCut files (`docs/data/ktc_values_sf.csv`, `docs/data/ktc_values_1qb.csv`), plus optional `ktc_values.json`.
- Sleeper trade market (`docs/data/sleeper_trade_values.json`) fitted from completed dynasty trades snowballed from public leagues.
- Those two are blended so frequently traded players follow the Sleeper market; thin names stay closer to KeepTradeCut.
- Optional **league board** inferred from this league’s own trades (positions, youth, boom-bust skill players, and specific names). Apply it when you want room prices.
- TE premium bump from Sleeper `bonus_rec_te`.
- Missing assets get a position/age estimate labeled **est**.
- Elite players still get a premium so one star is not a pile of scraps.

Refresh rankings with `python scripts/update_ktc_values.py`. Refresh the Sleeper trade market with `python scripts/update_sleeper_trade_market.py`. Live deploys try both scrapes and keep the last files if a source is down.

## Live site (dynastyticker.com)

The app is a static site. Host is **Netlify**, not GitHub Pages. Public URL: `https://dynastyticker.com/`.

1. Open [Netlify](https://app.netlify.com/), sign up with GitHub, **Add new site → Import an existing project**, pick this repo.
2. Netlify reads `netlify.toml` (`publish = docs`). First deploy gives a `*.netlify.app` URL.
3. **Domain management → Add custom domain:** `dynastyticker.com` and `www.dynastyticker.com`.
4. In **Namecheap** (you just bought this name there), paste the DNS records Netlify shows. Apex `A` / `www` `CNAME`. Wait for SSL.
5. Optional: Netlify **Build hooks** → copy URL into GitHub secret `NETLIFY_BUILD_HOOK`. Daily workflow `.github/workflows/deploy-site.yml` hits it so values refresh.
6. Repo **Settings → Pages**: turn GitHub Pages **off** so the old `github.io` URL dies.

Tests: `.github/workflows/test.yml`.

## CLI

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

python -m src.cli \
  --league <LEAGUE_ID> \
  --me niko \
  --target-manager demetri \
  --target-player "Jahmyr Gibbs" \
  --allow-extra-target-assets \
  --fairness-pct 15 \
  --max-results 5
```

No league id? Discover it:

```bash
python -m src.cli \
  --username <YOUR_SLEEPER_USERNAME> \
  --season 2026 \
  --me niko \
  --target-manager demetri \
  --target-player "Jahmyr Gibbs"
```

## Notes
- Player assets: `player:<sleeper_player_id>`
- Pick assets: `pick:<season>:r<round>:<original_owner|any>`
- Playoff odds are a 4000-season Monte Carlo. Early weeks shrink last year's pace toward the league mean so one 11-3 campaign is not a 99% lock in Week 1.
- Phone layout (`max-width: 700px`) pins the four page tabs to the bottom edge and keeps the room strip sticky under the header. A share button sits in the header. iPad and desktop keep the tabs inline above the room strip.
