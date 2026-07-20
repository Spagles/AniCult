<p align="center">
  <img src="favicon.ico" width="80" alt="AniCult logo">
</p>

<h1 align="center">AniCult</h1>

<p align="center">
  A clean anime streaming experience — browse via AniList, find torrents on Nyaa, stream directly in your browser.
</p>

<p align="center">
  <a href="#features">Features</a> ·
  <a href="#demo">Demo</a> ·
  <a href="#getting-started">Getting Started</a> ·
  <a href="#api">API</a> ·
  <a href="#tech-stack">Tech Stack</a>
</p>

---

## Features

- **Anime Discovery** — Browse trending, popular, and recently updated anime via the AniList GraphQL API
- **Search & Filters** — Full-text search with sort (relevance, trending, popularity, score, newest) and format filters (TV, Movie, OVA, ONA, Special)
- **Anime Details** — Rich detail pages with synopsis, genres, metadata, episode grid, and related anime (sequels, prequels, side stories)
- **Torrent Streaming** — Search Nyaa for torrents, add them via magnet link, and stream video files directly in the browser
- **Range Requests** — Chunked streaming with range support for smooth playback without buffering the entire file
- **Watchlist** — Add/remove anime to a local watchlist with per-anime episode progress tracking
- **Watch History** — Automatic watch history with a "Continue Watching" card for quick resume
- **Infinite Scroll** — Lazy-loading popular anime grid using Intersection Observer
- **Dark UI** — Minimal dark theme with Inter font, responsive down to mobile

## Demo

Open `index.html` in a browser — no build step required. Anime browsing works instantly (AniList has a public CORS-enabled API). Torrent features require the companion API server (see [Torrent Backend](#torrent-backend)).

## Getting Started

### Prerequisites

- Node.js 18+ (only needed for torrent streaming)
- A modern web browser

### Browse Anime (No Server)

Simply open `index.html` in your browser. All anime data is fetched directly from the AniList API.

### Torrent Streaming (Requires Backend)

The torrent features (`/api/nyaa`, `/api/torrent`, `/api/stream`) require a server to handle Nyaa RSS fetching and WebTorrent operations. To run the full stack:

```bash
# Install dependencies
npm install

# (Optional) Set a proxy if nyaa.si is blocked in your region
# Copy .env.example to .env and configure NYAA_PROXY

# Start the server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Project Structure

```
index.html          Entry point — nav, search bar, main container, footer
styles.css          All styles (dark theme, responsive, components)
app.js              SPA router, AniList API, rendering, localStorage
favicon.ico         Site icon
```

## API

AniCult communicates with these backend routes for torrent features:

| Route | Method | Description |
|-------|--------|-------------|
| `/api/nyaa?q=...&c=...&f=...` | GET | Search Nyaa.si RSS. `c` = category (`1_2` = English subs), `f` = filter. Returns sorted results with magnet links. |
| `/api/torrent` | POST | Add a torrent by magnet URI. Returns infoHash, file list, total size. |
| `/api/torrent?hash=...` | GET | Get torrent status: progress, speeds, peers, downloaded/total. |
| `/api/torrent?hash=...` | DELETE | Remove a torrent and destroy its data. |
| `/api/stream?hash=...&file=...` | GET | Stream a video file from an active torrent. Supports `Range` headers for chunked delivery. |

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Vanilla HTML, CSS, JavaScript |
| Anime Data | AniList GraphQL API |
| Torrents | WebTorrent (Node.js), Nyaa.si RSS |
| Persistence | localStorage (client-side) |

## How It Works

1. **Browse** — Home page fetches trending, recently updated, and popular anime from AniList
2. **Select** — Click an anime to view details, episodes, and related titles
3. **Watch** — Click an episode to open the player. The app auto-searches Nyaa for matching torrents
4. **Pick Source** — Choose a torrent from the results (shows seeders, leechers, size, trust badges)
5. **Stream** — The server adds the torrent via WebTorrent, then streams the selected video file through a range-request proxy
6. **Track** — Watch history and episode progress are saved to localStorage automatically

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `NYAA_PROXY` | Proxy for nyaa.si (HTTP, HTTPS, or SOCKS5) | — |

Example:
```
NYAA_PROXY=socks5://127.0.0.1:1080
```

## Notes

- WebTorrent runs server-side in Node.js. It connects to traditional BitTorrent peers via TCP/UDP (not WebRTC)
- MKV files may not play in Chrome/Safari natively; Firefox has better MKV support. MP4 releases are recommended
- All user data (watchlist, history, progress) is stored in the browser's localStorage
- Maximum 5 concurrent torrents with LRU eviction to control memory

## License

[MIT](LICENSE)

---

<p align="center">
  For personal use only. Anime metadata provided by <a href="https://anilist.co">AniList</a>.
</p>
