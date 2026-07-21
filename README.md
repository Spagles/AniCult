<h1 align="center">AniCult</h1>

<p align="center">
  A clean anime streaming experience — browse via AniList, find torrents on Nyaa, stream directly in your browser.
</p>

---

## About

AniCult is a single-page application built with zero frameworks. Open `index.html` and it works. Anime browsing uses the AniList GraphQL API directly from the browser. Torrent streaming requires a small Node.js backend for the `/api` routes.

## Features

- **Anime Discovery** — Trending, popular, and recently updated anime from AniList
- **Search & Filters** — Full-text search with sort and format filters
- **Anime Details** — Synopsis, genres, episode grid, related anime
- **Torrent Streaming** — Nyaa search, magnet links, in-browser video playback via WebTorrent
- **Range Requests** — Chunked streaming without buffering the full file
- **Watchlist & History** — LocalStorage persistence with episode progress tracking
- **Infinite Scroll** — Intersection Observer for lazy-loading
- **Dark UI** — Inter font, responsive, minimal

## Getting Started

### Browse Only (No Server)

```
open index.html
```

That's it. AniList has a public CORS-enabled API.

### With Torrent Streaming

```bash
npm install
npm run dev
```

Requires Node.js 18+. Set `NYAA_PROXY` in `.env` if nyaa.si is blocked in your region.

## Files

| File         | What it does                                     |
| ------------ | ------------------------------------------------ |
| `index.html` | Nav, search bar, main container, footer          |
| `styles.css` | All styles — dark theme, responsive, components  |
| `app.js`     | SPA router, AniList API, rendering, localStorage |

## API Routes (Backend)

| Route                           | Method | Description                              |
| ------------------------------- | ------ | ---------------------------------------- |
| `/api/nyaa?q=...&c=...`         | GET    | Search Nyaa.si RSS, returns magnet links |
| `/api/torrent`                  | POST   | Add torrent by magnet URI                |
| `/api/torrent?hash=...`         | GET    | Torrent status (progress, speed, peers)  |
| `/api/torrent?hash=...`         | DELETE | Remove torrent                           |
| `/api/stream?hash=...&file=...` | GET    | Stream video with range request support  |

## How It Works

1. Browse anime on the home page (trending, popular, recent)
2. Click into a detail page, pick an episode
3. App auto-searches Nyaa for matching torrents
4. Pick a torrent, server adds it via WebTorrent
5. Video streams through a range-request proxy
6. History and progress save to localStorage

## License

[MIT](LICENSE)
