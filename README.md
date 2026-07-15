# AniCult

A clean anime streaming experience built with Next.js. Browse anime via AniList, search for torrents on Nyaa, and stream episodes directly in your browser using WebTorrent.

## Features

- **Anime Discovery** -- Browse trending, popular, and recently updated anime via the AniList API
- **Search & Filters** -- Full-text search with sort (relevance, trending, popularity, score, newest) and format filters (TV, Movie, OVA, ONA, Special)
- **Anime Details** -- Rich detail pages with synopsis, genres, metadata, episode grid, and related anime (sequels, prequels, side stories)
- **Torrent Streaming** -- Search Nyaa for torrents, add them via magnet link, and stream video files directly in the browser
- **Range Requests** -- Chunked streaming with 2 MB range support for smooth playback without buffering the entire file
- **Watchlist** -- Add/remove anime to a local watchlist with per-anime episode progress tracking
- **Watch History** -- Automatic watch history with "Continue Watching" card for quick resume
- **Infinite Scroll** -- Lazy-loading popular anime grid using Intersection Observer
- **Dark UI** -- Minimal dark theme with Inter font, responsive down to mobile

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 15 (App Router) |
| UI | React 19, plain CSS |
| Anime Data | AniList GraphQL API |
| Torrents | WebTorrent (Node.js), Nyaa.si RSS |
| Persistence | localStorage (client-side) |
| Language | JavaScript (no TypeScript) |

## Getting Started

### Prerequisites

- Node.js 18+
- npm

### Install

```bash
npm install
```

### Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Build & Start

```bash
npm run build
npm run start
```

## Project Structure

```
app/
  layout.js              Root layout (nav, footer, fonts)
  page.js                Home page (trending, recently updated, popular)
  search-bar.js          Client search bar component
  actions.js             Server actions (fetchPopularAnime)
  globals.css            All styles (dark theme)
  anime/[id]/
    page.js              Anime detail (server component)
    client.js            Anime detail (client: watchlist, episodes, relations)
  watch/[id]/[ep]/
    page.js              Episode watch (server component)
    client.js            Video player, torrent picker, stream stats
  search/page.js         Search results with filters and pagination
  watchlist/page.js      Local watchlist with progress
  history/page.js        Watch history with continue watching
  api/nyaa/route.js      GET /api/nyaa?q=...&c=... -- search Nyaa torrents
  api/torrent/route.js   POST /api/torrent -- add magnet, GET -- status, DELETE -- remove
  api/stream/route.js    GET /api/stream?hash=...&file=... -- stream video via range requests

lib/
  anilist.js             AniList GraphQL client (getTrending, getPopular, searchAnime, getAnimeById, etc.)
  torrent-client.js      WebTorrent singleton with LRU eviction (max 5 torrents)
  storage.js             localStorage helpers (watchlist, history, progress, magnets)

components/
  AnimeCard.js           Reusable anime card (cover, score, format, episodes)
  InfinitePopularGrid.js Infinite-scroll grid using Intersection Observer

public/
  favicon.ico            Site icon
```

## API Routes

| Route | Method | Description |
|-------|--------|-------------|
| `/api/nyaa?q=...&c=...&f=...` | GET | Search Nyaa.si RSS. `c` = category (`1_2` = English subs), `f` = filter. Returns sorted results with magnet links. |
| `/api/torrent` | POST | Add a torrent by magnet URI. Returns infoHash, file list, total size. |
| `/api/torrent?hash=...` | GET | Get torrent status: progress, speeds, peers, downloaded/total. |
| `/api/torrent?hash=...` | DELETE | Remove a torrent and destroy its data. |
| `/api/stream?hash=...&file=...` | GET | Stream a video file from an active torrent. Supports `Range` headers for chunked delivery. |

## How It Works

1. **Browse** -- Home page fetches trending, recently updated, and popular anime from AniList
2. **Select** -- Click an anime to view details, episodes, and related titles
3. **Watch** -- Click an episode to open the player. The app auto-searches Nyaa for matching torrents
4. **Pick Source** -- Choose a torrent from the results (shows seeders, leechers, size, trust badges)
5. **Stream** -- The server adds the torrent via WebTorrent, then streams the selected video file through a range-request proxy. Stats (download/upload speed, peers, progress) update in real time
6. **Track** -- Watch history and episode progress are saved to localStorage automatically

## Notes

- WebTorrent runs server-side in Node.js. It connects to traditional BitTorrent peers via TCP/UDP (not WebRTC)
- Maximum 5 concurrent torrents with LRU eviction to control memory
- MKV files may not play in Chrome/Safari natively; Firefox has better MKV support. MP4 releases are recommended
- All user data (watchlist, history, progress) is stored in the browser's localStorage
- This project is for personal use only. Anime metadata is provided by AniList.

## License

For personal use only.
