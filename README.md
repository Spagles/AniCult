<h1 align="center">AniCult</h1>

<p align="center">
  A clean anime streaming experience — browse via AniList, find torrents on Nyaa, stream directly in your browser.
</p>

---

## About

AniCult is a fully client-side single-page application. No server, no build step, no runtime dependencies. Open `index.html` and it works.

- **Anime browsing** uses the AniList GraphQL API (CORS-enabled)
- **Torrent search** uses Nyaa.si RSS via a CORS proxy
- **Streaming** uses WebTorrent in the browser (WebRTC)

## Features

- **Anime Discovery** — Trending, popular, and recently updated anime from AniList
- **Search & Filters** — Full-text search with sort and format filters
- **Anime Details** — Synopsis, genres, episode grid, related anime
- **Torrent Streaming** — Nyaa search, magnet links, in-browser video playback via WebTorrent
- **Watchlist & History** — LocalStorage persistence with episode progress tracking
- **Infinite Scroll** — Intersection Observer for lazy-loading
- **Dark UI** — Inter font, responsive, minimal

## Getting Started

```
open index.html
```

No server required. Works entirely in the browser.

## Files

| File | What it does |
|------|-------------|
| `index.html` | Nav, search bar, main container, footer |
| `styles.css` | All styles — dark theme, responsive, components |
| `app.js` | SPA router, AniList API, WebTorrent client, rendering, localStorage |

## How It Works

1. Browse anime on the home page (trending, popular, recent)
2. Click into a detail page, pick an episode
3. App auto-searches Nyaa for matching torrents
4. Pick a torrent, WebTorrent connects to peers via WebRTC
5. Video streams directly in the browser
6. History and progress save to localStorage

## License

[MIT](LICENSE)
