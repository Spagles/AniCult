(function () {
  "use strict";

  const ANILIST_URL = "https://graphql.anilist.co";
  const NYAA_RSS = "https://nyaa.si/?page=rss";

  const CORS_PROXIES = [
    (url) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
    (url) => `https://corsproxy.io/?${encodeURIComponent(url)}`,
    (url) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`,
  ];

  const MEDIA_FIELDS_SMALL = `
    id
    title { romaji english }
    coverImage { extraLarge large color }
    format status episodes averageScore season seasonYear
    nextAiringEpisode { airingAt episode }
  `;

  const MEDIA_FIELDS = `
    id
    title { romaji english native }
    coverImage { extraLarge large color }
    bannerImage description genres format status episodes duration
    season seasonYear averageScore popularity trending
    studios(isMain: true) { nodes { name } }
    nextAiringEpisode { airingAt episode }
    relations {
      edges {
        relationType
        node {
          id
          title { romaji english }
          coverImage { large }
          format status episodes averageScore
        }
      }
    }
  `;

  const TRACKERS = [
    "wss://tracker.openwebtorrent.com",
    "wss://tracker.btorrent.xyz",
    "wss://tracker.files.fm:7073/announce",
    "wss://tracker.webtorrent.dev",
    "wss://tracker.novg.net",
    "wss://tracker.cluejack.info:6969",
    "wss://tracker.lilithraws.org",
  ];

  const app = document.getElementById("app");
  const searchInput = document.getElementById("nav-search-input");
  const searchForm = document.getElementById("nav-search-form");

  let currentPage = { destroy: null };
  let wtClient = null;

  // ── WebTorrent Client (browser) ────────────────────────

  function getWtClient() {
    if (!wtClient) {
      wtClient = new WebTorrent();
      wtClient.on("error", (err) => console.error("[WebTorrent]", err.message));
    }
    return wtClient;
  }

  // ── AniList GraphQL ────────────────────────────────────

  async function gql(query, variables = {}) {
    const res = await fetch(ANILIST_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, variables }),
    });
    if (!res.ok) throw new Error(`AniList API error: ${res.status}`);
    const json = await res.json();
    if (json.errors) throw new Error(json.errors[0].message);
    return json.data;
  }

  async function getTrending(page = 1, perPage = 20) {
    const q = `query($page:Int,$perPage:Int){Page(page:$page,perPage:$perPage){pageInfo{total currentPage lastPage hasNextPage}media(type:ANIME,sort:TRENDING_DESC){${MEDIA_FIELDS_SMALL}}}}`;
    return (await gql(q, { page, perPage })).Page;
  }

  async function getPopular(page = 1, perPage = 20) {
    const q = `query($page:Int,$perPage:Int){Page(page:$page,perPage:$perPage){pageInfo{total currentPage lastPage hasNextPage}media(type:ANIME,sort:POPULARITY_DESC){${MEDIA_FIELDS_SMALL}}}}`;
    return (await gql(q, { page, perPage })).Page;
  }

  async function getRecentlyUpdated(page = 1, perPage = 20) {
    const q = `query($page:Int,$perPage:Int){Page(page:$page,perPage:$perPage){pageInfo{total currentPage lastPage hasNextPage}airingSchedules(sort:TIME_DESC,notYetAired:false){episode airingAt media{${MEDIA_FIELDS_SMALL}}}}}`;
    const data = await gql(q, { page, perPage });
    const seen = new Set();
    const unique = [];
    for (const s of data.Page.airingSchedules) {
      if (s.media && !seen.has(s.media.id)) {
        seen.add(s.media.id);
        unique.push({ ...s.media, latestEpisode: s.episode });
      }
    }
    return { media: unique, pageInfo: data.Page.pageInfo };
  }

  async function searchAnime(
    searchQuery,
    page = 1,
    perPage = 20,
    format = null,
    sort = "SEARCH_MATCH",
  ) {
    const q = `query($page:Int,$perPage:Int,$search:String,$format:MediaFormat,$sort:[MediaSort]){Page(page:$page,perPage:$perPage){pageInfo{total currentPage lastPage hasNextPage}media(type:ANIME,search:$search,format:$format,sort:$sort){${MEDIA_FIELDS_SMALL}}}}`;
    const variables = { page, perPage, search: searchQuery, sort: [sort] };
    if (format) variables.format = format;
    return (await gql(q, variables)).Page;
  }

  async function getAnimeById(id) {
    const q = `query($id:Int){Media(id:$id,type:ANIME){${MEDIA_FIELDS}}}`;
    return (await gql(q, { id: parseInt(id) })).Media;
  }

  // ── Nyaa RSS via CORS proxy ────────────────────────────

  const NYAA_TRACKERS = [
    "http://nyaa.tracker.wf:7777/announce",
    "udp://open.stealth.si:80/announce",
    "udp://tracker.opentrackr.org:1337/announce",
    "udp://exodus.desync.com:6969/announce",
    "udp://tracker.torrent.eu.org:451/announce",
    "udp://tracker.moeking.me:6969/announce",
    "http://tracker.anirena.com:8080/announce",
    "udp://opentracker.i2p.rocks:6969/announce",
    "https://tracker.bt-hash.com:443/announce",
    "udp://bt1.archive.org:6969/announce",
  ];

  function buildMagnet(infoHash, title) {
    const parts = [`magnet:?xt=urn:btih:${infoHash}`];
    parts.push(`&dn=${encodeURIComponent(title)}`);
    NYAA_TRACKERS.forEach((tr) => parts.push(`&tr=${encodeURIComponent(tr)}`));
    return parts.join("");
  }

  function parseRSS(xml) {
    const items = [];
    const itemRegex = /<item>([\s\S]*?)<\/item>/g;
    let match;
    while ((match = itemRegex.exec(xml)) !== null) {
      const content = match[1];
      const get = (tag) => {
        const escaped = tag.replace(":", "\\:");
        const re = new RegExp(
          `<${escaped}>(?:<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>|([\\s\\S]*?))<\\/${escaped}>`,
        );
        const m = content.match(re);
        return m ? (m[1] || m[2] || "").trim() : "";
      };
      const infoHash = get("nyaa:infoHash");
      const title = get("title");
      if (!infoHash) continue;
      items.push({
        title,
        link: get("link"),
        pubDate: get("pubDate"),
        seeders: parseInt(get("nyaa:seeders")) || 0,
        leechers: parseInt(get("nyaa:leechers")) || 0,
        downloads: parseInt(get("nyaa:downloads")) || 0,
        infoHash,
        size: get("nyaa:size"),
        category: get("nyaa:category"),
        trusted: get("nyaa:trusted") === "Yes",
        remake: get("nyaa:remake") === "Yes",
        magnet: buildMagnet(infoHash, title),
      });
    }
    return items;
  }

  async function searchNyaa(query, category = "1_2") {
    const url = `${NYAA_RSS}&c=${category}&q=${encodeURIComponent(query)}`;
    let lastError = null;
    for (const proxyFn of CORS_PROXIES) {
      const proxyUrl = proxyFn(url);
      try {
        const res = await fetch(proxyUrl, { signal: AbortSignal.timeout(15000) });
        if (!res.ok) continue;
        const text = await res.text();
        if (!text.includes("<item>")) continue;
        const results = parseRSS(text);
        if (results.length === 0) continue;
        results.sort((a, b) => b.seeders - a.seeders);
        return results;
      } catch (e) {
        lastError = e;
        continue;
      }
    }
    throw new Error(
      lastError && lastError.name === "TimeoutError"
        ? "Nyaa search timed out. Try again in a moment."
        : "Could not reach nyaa.si. All CORS proxies failed."
    );
  }

  // ── Storage ────────────────────────────────────────────

  const KEYS = {
    watchlist: "anicult_watchlist",
    history: "anicult_history",
    progress: "anicult_progress",
  };

  function storageGet(key) {
    try {
      const r = localStorage.getItem(key);
      return r ? JSON.parse(r) : null;
    } catch {
      return null;
    }
  }
  function storageSet(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function getWatchlist() {
    return storageGet(KEYS.watchlist) || [];
  }
  function addToWatchlist(anime) {
    const list = getWatchlist();
    if (list.find((a) => a.id === anime.id)) return list;
    const entry = {
      id: anime.id,
      title: anime.title,
      coverImage: anime.coverImage,
      format: anime.format,
      episodes: anime.episodes,
      averageScore: anime.averageScore,
      addedAt: Date.now(),
    };
    const updated = [entry, ...list];
    storageSet(KEYS.watchlist, updated);
    return updated;
  }
  function removeFromWatchlist(id) {
    const list = getWatchlist().filter((a) => a.id !== id);
    storageSet(KEYS.watchlist, list);
    return list;
  }
  function isInWatchlist(id) {
    return getWatchlist().some((a) => a.id === id);
  }

  function getHistory() {
    return storageGet(KEYS.history) || [];
  }
  function addToHistory(entry) {
    if (!entry.episode || isNaN(entry.episode) || entry.episode <= 0)
      return getHistory();
    const history = getHistory();
    const filtered = history.filter(
      (h) => !(h.animeId === entry.animeId && h.episode === entry.episode),
    );
    const newEntry = {
      animeId: entry.animeId,
      title: entry.title,
      coverImage: entry.coverImage,
      episode: entry.episode,
      timestamp: Date.now(),
    };
    const updated = [newEntry, ...filtered].slice(0, 200);
    storageSet(KEYS.history, updated);
    return updated;
  }
  function clearHistory() {
    storageSet(KEYS.history, []);
  }

  function getProgress(animeId) {
    const p = storageGet(KEYS.progress) || {};
    return p[animeId] || 0;
  }
  function setProgress(animeId, episode) {
    if (!episode || isNaN(episode) || episode <= 0) return;
    const p = storageGet(KEYS.progress) || {};
    p[animeId] = Math.max(p[animeId] || 0, episode);
    storageSet(KEYS.progress, p);
  }

  // ── Helpers ────────────────────────────────────────────

  function esc(str) {
    const d = document.createElement("div");
    d.textContent = str;
    return d.innerHTML;
  }

  function stripHtml(html) {
    return html
      ? html.replace(/<br\s*\/?>/g, "\n").replace(/<[^>]*>/g, "")
      : "No description available.";
  }

  function formatBytes(bytes) {
    if (!bytes || bytes === 0) return "0 B";
    const k = 1024,
      sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  }

  function formatSpeed(bps) {
    return bps ? formatBytes(bps) + "/s" : "0 B/s";
  }

  function timeAgo(dateStr) {
    if (!dateStr) return "";
    const diff = Date.now() - new Date(dateStr).getTime();
    const days = Math.floor(diff / 86400000);
    if (days > 365) return Math.floor(days / 365) + "y ago";
    if (days > 30) return Math.floor(days / 30) + "mo ago";
    if (days > 0) return days + "d ago";
    const hours = Math.floor(diff / 3600000);
    if (hours > 0) return hours + "h ago";
    const mins = Math.floor(diff / 60000);
    return mins > 0 ? mins + "m ago" : "just now";
  }

  function title(anime) {
    return anime.title.english || anime.title.romaji;
  }
  function cover(anime) {
    return anime.coverImage.extraLarge || anime.coverImage.large;
  }
  function epText(anime) {
    if (anime.nextAiringEpisode)
      return "Ep " + (anime.nextAiringEpisode.episode - 1);
    return anime.episodes ? anime.episodes + " eps" : null;
  }

  const VIDEO_RE = /\.(mp4|mkv|webm|avi|m4v)$/i;
  const PLAYABLE_RE = /\.(mp4|webm|m4v|ogv)$/i;

  // ── SVG Icons ──────────────────────────────────────────

  const icons = {
    arrowLeft: (s = 16) =>
      `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5"/><polyline points="12 19 5 12 12 5"/></svg>`,
    arrowRight: (s = 16) =>
      `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><polyline points="12 5 19 12 12 19"/></svg>`,
    download: (s = 16) =>
      `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`,
    upload: (s = 16) =>
      `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>`,
    users: (s = 16) =>
      `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`,
    chevronUp: (s = 16) =>
      `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"/></svg>`,
    chevronDown: (s = 16) =>
      `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>`,
    alert: (s = 16) =>
      `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
    check: (s = 16) =>
      `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`,
    arrowUp: (s = 12) =>
      `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>`,
    arrowDown: (s = 12) =>
      `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/></svg>`,
    x: (s = 16) =>
      `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`,
  };

  // ── Anime Card HTML ────────────────────────────────────

  function cardHtml(anime) {
    const t = title(anime);
    const img = cover(anime);
    const score = anime.averageScore;
    const fmt = anime.format;
    const ep = epText(anime);
    return `<a href="#/anime/${anime.id}" class="card" id="card-${anime.id}">
      <div class="card-image">
        <img src="${esc(img)}" alt="${esc(t)}" loading="lazy">
        ${score ? `<span class="card-score">${score}%</span>` : ""}
        ${fmt ? `<span class="card-format">${esc(fmt)}</span>` : ""}
        ${ep ? `<span class="card-ep">${esc(ep)}</span>` : ""}
      </div>
      <div class="card-body"><div class="card-title">${esc(t)}</div></div>
    </a>`;
  }

  // ── Routing ────────────────────────────────────────────

  function parseHash() {
    const hash = location.hash.slice(1) || "/";
    const [path, qs] = hash.split("?");
    const params = new URLSearchParams(qs || "");
    return { path, params };
  }

  async function route() {
    if (currentPage.destroy) {
      currentPage.destroy();
      currentPage = { destroy: null };
    }
    const { path, params } = parseHash();

    app.innerHTML = `<div class="loading"><div class="loading-spinner"></div><div>Loading...</div></div>`;

    try {
      if (path === "/" || path === "") await renderHome();
      else if (path === "/search") await renderSearch(params);
      else if (path.startsWith("/anime/"))
        await renderAnimeDetail(path.split("/")[2]);
      else if (path.startsWith("/watch/")) {
        const parts = path.split("/");
        await renderWatch(parts[2], parseInt(parts[3]) || 1);
      } else if (path === "/watchlist") renderWatchlist();
      else if (path === "/history") renderHistory();
      else
        app.innerHTML = `<div class="empty"><div class="empty-title">404</div><div class="empty-text">Page not found</div><a href="#/" class="btn btn-primary">Go Home</a></div>`;
    } catch (err) {
      console.error(err);
      app.innerHTML = `<div class="empty"><div class="empty-title">Something went wrong</div><div class="empty-text">${esc(err.message)}</div><a href="#/" class="btn btn-primary">Go Home</a></div>`;
    }

    window.scrollTo(0, 0);
  }

  // ── Home Page ──────────────────────────────────────────

  async function renderHome() {
    const [trending, recent, popular] = await Promise.all([
      getTrending(1, 20),
      getRecentlyUpdated(1, 20),
      getPopular(1, 20),
    ]);

    const hero = trending.media[0];
    const heroT = hero ? title(hero) : "";

    let html = "";

    if (hero) {
      html += `<div class="banner-section">
        <div class="banner-bg" style="background-image:url('${esc(hero.bannerImage || cover(hero))}')"></div>
        <div class="banner-fade"></div>
        <div class="banner-content">
          <div class="banner-cover"><img src="${esc(cover(hero))}" alt="${esc(heroT)}"></div>
          <div class="banner-info">
            <div class="banner-title">${esc(heroT)}</div>
            ${
              hero.genres
                ? `<div class="banner-genres">${hero.genres
                    .slice(0, 4)
                    .map((g) => `<span>${esc(g)}</span>`)
                    .join("")}</div>`
                : ""
            }
            ${hero.description ? `<div class="banner-desc">${hero.description.replace(/<br\s*\/?>/g, " ")}</div>` : ""}
            <div class="banner-actions"><a href="#/anime/${hero.id}" class="btn btn-primary">View Details</a></div>
          </div>
        </div>
      </div>`;
    }

    html += `<section class="section"><div class="section-header"><h2 class="section-title">Trending Now</h2><a href="#/search?sort=TRENDING_DESC" class="section-link">View All</a></div><div class="scroll-row">${trending.media.map(cardHtml).join("")}</div></section>`;

    html += `<section class="section"><div class="section-header"><h2 class="section-title">Recently Updated</h2><a href="#/search?sort=UPDATED_AT_DESC" class="section-link">View All</a></div><div class="scroll-row">${recent.media.map(cardHtml).join("")}</div></section>`;

    html += `<section class="section"><div class="section-header"><h2 class="section-title">All Time Popular</h2><a href="#/search?sort=POPULARITY_DESC" class="section-link">View All</a></div><div id="popular-grid" class="grid">${popular.media.map(cardHtml).join("")}</div><div id="popular-loader" style="text-align:center;padding:2rem;color:var(--text-muted)"></div></section>`;

    app.innerHTML = html;

    let popPage = 2;
    let popHasNext = popular.pageInfo.hasNextPage;
    let popLoading = false;
    const loader = document.getElementById("popular-loader");
    const grid = document.getElementById("popular-grid");

    async function loadMorePopular() {
      if (popLoading || !popHasNext) return;
      popLoading = true;
      loader.textContent = "Loading more...";
      try {
        const data = await getPopular(popPage, 20);
        if (data) {
          grid.insertAdjacentHTML(
            "beforeend",
            data.media.map(cardHtml).join(""),
          );
          popHasNext = data.pageInfo.hasNextPage;
          popPage++;
        }
      } catch (e) {
        console.error(e);
      }
      popLoading = false;
      loader.textContent = "";
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) loadMorePopular();
      },
      { rootMargin: "200px" },
    );

    if (loader) observer.observe(loader);
    currentPage.destroy = () => observer.disconnect();
  }

  // ── Search Page ────────────────────────────────────────

  async function renderSearch(params) {
    const q = params.get("q") || "";
    const page = parseInt(params.get("page")) || 1;
    const format = params.get("format") || "";
    const sort = params.get("sort") || (q ? "SEARCH_MATCH" : "TRENDING_DESC");

    let result;
    if (q) result = await searchAnime(q, page, 24, format || null, sort);
    else result = await getTrending(page, 24);

    const sortOpts = [
      { v: "SEARCH_MATCH", l: "Relevance" },
      { v: "TRENDING_DESC", l: "Trending" },
      { v: "POPULARITY_DESC", l: "Popularity" },
      { v: "SCORE_DESC", l: "Score" },
      { v: "START_DATE_DESC", l: "Newest" },
    ];
    const fmtOpts = [
      { v: "", l: "All Formats" },
      { v: "TV", l: "TV" },
      { v: "MOVIE", l: "Movie" },
      { v: "OVA", l: "OVA" },
      { v: "ONA", l: "ONA" },
      { v: "SPECIAL", l: "Special" },
    ];

    function buildUrl(overrides) {
      const p = { q, page: String(page), format, sort, ...overrides };
      const sp = new URLSearchParams();
      Object.entries(p).forEach(([k, v]) => {
        if (v) sp.set(k, v);
      });
      return "#/search?" + sp.toString();
    }

    let html = `<h1 class="section-title" style="margin-bottom:16px">${q ? `Results for "${esc(q)}"` : "Browse Anime"}</h1>`;
    html += `<div class="filters">`;
    sortOpts.forEach((o) => {
      html += `<a href="${buildUrl({ sort: o.v, page: "1" })}" class="btn btn-sm ${sort === o.v ? "btn-primary" : "btn-outline"}">${o.l}</a>`;
    });
    html += `<span style="color:var(--text-dim)">|</span>`;
    fmtOpts.forEach((o) => {
      html += `<a href="${buildUrl({ format: o.v, page: "1" })}" class="btn btn-sm ${format === o.v ? "btn-primary" : "btn-outline"}">${o.l}</a>`;
    });
    html += `</div>`;

    if (result.media.length === 0) {
      html += `<div class="empty"><div class="empty-title">No results found</div><div class="empty-text">Try a different search term or filter</div></div>`;
    } else {
      html += `<div class="grid grid-wide">${result.media
        .map((a) => {
          const t = title(a),
            img = cover(a),
            s = a.averageScore,
            ep = epText(a);
          return `<a href="#/anime/${a.id}" class="card" id="search-card-${a.id}">
          <div class="card-image"><img src="${esc(img)}" alt="${esc(t)}" loading="lazy">
            ${s ? `<span class="card-score">${s}%</span>` : ""}
            ${a.format ? `<span class="card-format">${esc(a.format)}</span>` : ""}
            ${ep ? `<span class="card-ep">${esc(ep)}</span>` : ""}
          </div>
          <div class="card-body"><div class="card-title">${esc(t)}</div></div>
        </a>`;
        })
        .join("")}</div>`;
    }

    if (result.pageInfo) {
      html += `<div class="pagination">`;
      if (page > 1)
        html += `<a href="${buildUrl({ page: String(page - 1) })}" class="page-btn">Previous</a>`;
      Array.from(
        { length: Math.min(result.pageInfo.lastPage || 1, 10) },
        (_, i) => i + 1,
      )
        .filter(
          (p) =>
            p === 1 ||
            p === (result.pageInfo.lastPage || 1) ||
            Math.abs(p - page) <= 2,
        )
        .forEach((p) => {
          html += `<a href="${buildUrl({ page: String(p) })}" class="page-btn ${p === page ? "page-btn-active" : ""}">${p}</a>`;
        });
      if (result.pageInfo.hasNextPage)
        html += `<a href="${buildUrl({ page: String(page + 1) })}" class="page-btn">Next</a>`;
      html += `</div>`;
    }

    app.innerHTML = html;
  }

  // ── Anime Detail Page ──────────────────────────────────

  async function renderAnimeDetail(id) {
    const anime = await getAnimeById(id);
    const t = title(anime);
    const altT =
      anime.title.english && anime.title.romaji !== anime.title.english
        ? anime.title.romaji
        : anime.title.native || "";
    const img = cover(anime);
    const banner = anime.bannerImage;
    const totalEps =
      anime.episodes ||
      (anime.nextAiringEpisode ? anime.nextAiringEpisode.episode - 1 : 0);
    const studio = anime.studios?.nodes?.[0]?.name || "Unknown";
    const desc = stripHtml(anime.description);
    const watched = getProgress(anime.id);
    const inList = isInWatchlist(anime.id);

    const relations = (anime.relations?.edges || []).filter((e) =>
      ["SEQUEL", "PREQUEL", "SIDE_STORY", "PARENT"].includes(e.relationType),
    );

    let html = "";

    if (banner) {
      html += `<div class="banner-section"><div class="banner-bg" style="background-image:url('${esc(banner)}')"></div><div class="banner-fade"></div></div>`;
    }

    html += `<div class="detail-page"><div class="detail-sidebar">
      <img src="${esc(img)}" alt="${esc(t)}">
      <div style="margin-top:12px"><button class="btn ${inList ? "btn-danger" : "btn-primary"}" style="width:100%" id="watchlist-btn">${inList ? "Remove from List" : "Add to Watchlist"}</button></div>
      ${totalEps > 0 ? `<div style="margin-top:8px"><a href="#/watch/${anime.id}/1" class="btn btn-outline" style="width:100%;display:flex">${watched > 0 ? "Continue Ep " + (watched + 1) : "Start Watching"}</a></div>` : ""}
    </div>`;

    html += `<div class="detail-main">
      <h1 class="detail-title">${esc(t)}</h1>
      ${altT ? `<div class="detail-alt-title">${esc(altT)}</div>` : ""}
      <div class="detail-meta">
        ${(anime.genres || []).map((g) => `<span class="detail-tag">${esc(g)}</span>`).join("")}
        ${anime.averageScore ? `<span class="detail-tag detail-tag-accent">${anime.averageScore}%</span>` : ""}
      </div>
      <div class="detail-info-grid">
        <div class="detail-info-item"><label>Format</label><span>${anime.format || "—"}</span></div>
        <div class="detail-info-item"><label>Status</label><span>${(anime.status || "—").replace(/_/g, " ")}</span></div>
        <div class="detail-info-item"><label>Episodes</label><span>${anime.episodes || "?"}</span></div>
        <div class="detail-info-item"><label>Duration</label><span>${anime.duration ? anime.duration + " min" : "—"}</span></div>
        <div class="detail-info-item"><label>Season</label><span>${anime.season ? anime.season + " " + (anime.seasonYear || "") : "—"}</span></div>
        <div class="detail-info-item"><label>Studio</label><span>${esc(studio)}</span></div>
      </div>
      <div class="detail-synopsis">${esc(desc)}</div>`;

    if (totalEps > 0) {
      html += `<div><div class="episodes-header"><h2 class="episodes-title">Episodes</h2><span style="font-size:13px;color:var(--text-muted)">${watched}/${totalEps} watched</span></div>
        <div class="episodes-grid">${Array.from(
          { length: totalEps },
          (_, i) => i + 1,
        )
          .map(
            (ep) =>
              `<a href="#/watch/${anime.id}/${ep}" class="ep-btn ${ep <= watched ? "ep-btn-watched" : ""} ${ep === watched + 1 ? "ep-btn-current" : ""}" id="ep-${ep}">${ep}</a>`,
          )
          .join("")}</div></div>`;
    }

    if (relations.length > 0) {
      html += `<div style="margin-top:32px"><h2 class="section-title" style="margin-bottom:12px">Related</h2><div class="scroll-row">${relations
        .map((rel) => {
          const r = rel.node,
            rT = title(r);
          return `<a href="#/anime/${r.id}" class="card" key="${r.id}">
          <div class="card-image"><img src="${esc(r.coverImage.large)}" alt="${esc(rT)}">
            ${r.averageScore ? `<span class="card-score">${r.averageScore}%</span>` : ""}
            <span class="card-format">${esc(rel.relationType.replace(/_/g, " "))}</span>
          </div>
          <div class="card-body"><div class="card-title">${esc(rT)}</div></div>
        </a>`;
        })
        .join("")}</div></div>`;
    }

    html += `</div></div>`;
    app.innerHTML = html;

    const btn = document.getElementById("watchlist-btn");
    let currentInList = inList;
    btn.addEventListener("click", () => {
      if (currentInList) {
        removeFromWatchlist(anime.id);
        btn.textContent = "Add to Watchlist";
        btn.className = "btn btn-primary";
        currentInList = false;
      } else {
        addToWatchlist(anime);
        btn.textContent = "Remove from List";
        btn.className = "btn btn-danger";
        currentInList = true;
      }
    });
  }

  // ── Watch Page (fully client-side WebTorrent) ──────────

  async function renderWatch(id, episode) {
    const anime = await getAnimeById(id);
    const t = title(anime);
    const romajiT = anime.title.romaji;
    const totalEps =
      anime.episodes ||
      (anime.nextAiringEpisode ? anime.nextAiringEpisode.episode - 1 : 0);

    addToHistory({
      animeId: anime.id,
      title: t,
      coverImage: anime.coverImage,
      episode,
    });
    setProgress(anime.id, episode);

    let torrents = [],
      searching = false,
      searchInputVal = `${romajiT || t} ${String(episode).padStart(2, "0")}`;
    let selectedTorrent = null,
      loading = false,
      torrentInfo = null,
      torrentStatus = null;
    let streamUrl = "",
      selectedFileIndex = -1,
      error = null,
      showPicker = true,
      category = "1_2";
    let statusInterval = null;
    let activeTorrent = null;

    function render() {
      const videoFiles = torrentInfo
        ? torrentInfo.files.filter((f) => VIDEO_RE.test(f.name))
        : [];
      const isPlayable = (name) => PLAYABLE_RE.test(name);
      const currentFile =
        torrentInfo && selectedFileIndex >= 0
          ? torrentInfo.files[selectedFileIndex]
          : null;

      let html = `<div class="player-container">`;

      html += `<div class="player-info"><div>
        <a href="#/anime/${anime.id}" class="player-title">${esc(t)}</a>
        <div class="player-episode">Episode ${episode}</div>
      </div><div class="player-nav">`;
      if (episode > 1)
        html += `<a href="#/watch/${anime.id}/${episode - 1}" class="btn btn-outline btn-sm">${icons.arrowLeft()} Prev</a>`;
      if (episode < totalEps)
        html += `<a href="#/watch/${anime.id}/${episode + 1}" class="btn btn-primary btn-sm">Next ${icons.arrowRight()}</a>`;
      html += `</div></div>`;

      html += `<div class="player-wrapper">`;
      if (loading) {
        html += `<div class="loading"><div class="loading-spinner"></div><div>Connecting to peers...</div><div style="font-size:12px;color:var(--text-dim);margin-top:6px">Waiting for peers via WebRTC. This may take a moment.</div></div>`;
      } else if (streamUrl) {
        html += `<video id="video-player" src="${esc(streamUrl)}" controls autoplay></video>`;
      } else {
        html += `<video id="video-player" controls style="display:none"></video><div class="loading" id="player-placeholder">${icons.download(32)}<div>Select a torrent below to start streaming</div></div>`;
      }
      html += `</div>`;

      if (torrentStatus && streamUrl) {
        html += `<div class="stream-stats">
          <span class="stat-item"><span class="stat-icon">${icons.download(14)}</span> <span class="stat-dl">${formatSpeed(torrentStatus.downloadSpeed)}</span></span>
          <span class="stat-item"><span class="stat-icon">${icons.upload(14)}</span> <span class="stat-ul">${formatSpeed(torrentStatus.uploadSpeed)}</span></span>
          <span class="stat-item"><span class="stat-icon">${icons.users(14)}</span> <span class="stat-peers">${torrentStatus.numPeers} peers</span></span>
          <span class="stat-item stat-pct">${Math.round(torrentStatus.progress * 100)}%</span>
          <div class="stream-progress-bar"><div class="stream-progress-fill" style="width:${Math.round(torrentStatus.progress * 100)}%"></div></div>
        </div>`;
      }

      if (currentFile && !isPlayable(currentFile.name)) {
        html += `<div class="mkv-warning"><strong>${icons.alert(16)} MKV Format</strong> — This video may not play in Chrome/Safari. It works in Firefox. Try selecting an MP4 release.</div>`;
      }

      if (torrentInfo && videoFiles.length > 1) {
        html += `<div class="file-list"><h3 class="file-list-title">Select Video File</h3>`;
        videoFiles.forEach((f) => {
          html += `<button class="file-item ${selectedFileIndex === f.index ? "file-item-active" : ""}" data-file-index="${f.index}">
            <span class="file-name">${esc(f.name)}</span>
            <div class="file-meta"><span class="file-size">${formatBytes(f.size)}</span>${!isPlayable(f.name) ? `<span class="file-warning">MKV</span>` : ""}</div>
          </button>`;
        });
        html += `</div>`;
      }

      html += `<button class="torrent-picker-toggle ${showPicker ? "open" : ""}" id="torrent-toggle">
        <span>${selectedTorrent ? esc(selectedTorrent.title.substring(0, 60) + (selectedTorrent.title.length > 60 ? "..." : "")) : "Torrent Sources"}</span>
        <span class="toggle-icon">${showPicker ? icons.chevronUp() : icons.chevronDown()}</span>
      </button>`;

      if (showPicker) {
        html += `<div class="torrent-picker">
          <form class="torrent-search" id="nyaa-search-form">
            <input type="text" value="${esc(searchInputVal)}" placeholder="Search nyaa.si for torrents..." id="nyaa-search">
            <div class="custom-select" id="nyaa-category-select">
              <button type="button" class="custom-select-trigger" id="nyaa-category-trigger">
                <span>${category === "1_2" ? "English Subs" : category === "1_4" ? "Raw" : "All Anime"}</span>
                <span class="custom-select-arrow">${icons.chevronDown(10)}</span>
              </button>
              <div class="custom-select-dropdown">
                <button type="button" class="custom-select-option ${category === "1_2" ? "active" : ""}" data-value="1_2">English Subs</button>
                <button type="button" class="custom-select-option ${category === "1_4" ? "active" : ""}" data-value="1_4">Raw</button>
                <button type="button" class="custom-select-option ${category === "1_0" ? "active" : ""}" data-value="1_0">All Anime</button>
              </div>
            </div>
            <button type="submit" class="btn btn-primary btn-sm">Search</button>
          </form>`;

        if (error && !searching)
          html += `<div class="torrent-error">${esc(error)}</div>`;

        if (searching) {
          html += `<div class="loading" style="padding:24px"><div class="loading-spinner"></div><div>Searching nyaa.si...</div></div>`;
        } else {
          html += `<div class="torrent-list">${torrents
            .map(
              (t, i) =>
                `<button class="torrent-item ${selectedTorrent && selectedTorrent.infoHash === t.infoHash ? "torrent-item-active" : ""}" data-torrent-index="${i}" ${loading ? "disabled" : ""}>
              <div class="torrent-item-title">
                ${t.trusted ? `<span class="torrent-badge trusted">${icons.check(12)} Trusted</span>` : ""}
                ${t.remake ? `<span class="torrent-badge remake">Remake</span>` : ""}
                ${esc(t.title)}
              </div>
              <div class="torrent-item-meta">
                <span>${esc(t.size)}</span>
                <span class="torrent-seeders">${icons.arrowUp()} ${t.seeders}</span>
                <span class="torrent-leechers">${icons.arrowDown()} ${t.leechers}</span>
                <span>${icons.download(12)} ${t.downloads}</span>
                <span>${timeAgo(t.pubDate)}</span>
              </div>
            </button>`,
            )
            .join("")}</div>`;
        }
        html += `</div>`;
      }

      if (totalEps > 0) {
        html += `<div style="margin-top:24px"><h3 class="episodes-title" style="margin-bottom:12px">Episodes</h3><div class="episodes-grid">${Array.from(
          { length: totalEps },
          (_, i) => i + 1,
        )
          .map(
            (ep) =>
              `<a href="#/watch/${anime.id}/${ep}" class="ep-btn ${ep === episode ? "ep-btn-current" : ""}">${ep}</a>`,
          )
          .join("")}</div></div>`;
      }

      html += `</div>`;
      app.innerHTML = html;
      bindEvents();
    }

    function bindEvents() {
      const form = document.getElementById("nyaa-search-form");
      if (form)
        form.addEventListener("submit", (e) => {
          e.preventDefault();
          doSearch();
        });

      const catSelect = document.getElementById("nyaa-category-select");
      const catTrigger = document.getElementById("nyaa-category-trigger");
      if (catTrigger && catSelect) {
        catTrigger.addEventListener("click", (e) => {
          e.stopPropagation();
          catSelect.classList.toggle("open");
        });
        catSelect.querySelectorAll(".custom-select-option").forEach((opt) => {
          opt.addEventListener("click", () => {
            category = opt.dataset.value;
            catSelect.classList.remove("open");
            doSearch();
          });
        });
      }

      const toggle = document.getElementById("torrent-toggle");
      if (toggle)
        toggle.addEventListener("click", () => {
          showPicker = !showPicker;
          render();
        });

      document.querySelectorAll("[data-torrent-index]").forEach((btn) => {
        btn.addEventListener("click", () =>
          selectTorrent(torrents[parseInt(btn.dataset.torrentIndex)]),
        );
      });

      document.querySelectorAll("[data-file-index]").forEach((btn) => {
        btn.addEventListener("click", () => {
          const idx = parseInt(btn.dataset.fileIndex);
          pickFile(idx);
        });
      });

      const si = document.getElementById("nyaa-search");
      if (si)
        si.addEventListener("input", (e) => {
          searchInputVal = e.target.value;
        });

      document.addEventListener("click", (e) => {
        const sel = document.getElementById("nyaa-category-select");
        if (sel && !sel.contains(e.target)) sel.classList.remove("open");
      });
    }

    async function doSearch() {
      if (!searchInputVal.trim()) return;
      searching = true;
      error = null;
      render();
      try {
        torrents = await searchNyaa(searchInputVal.trim(), category);
        if (torrents.length === 0)
          error = "No torrents found. Try adjusting your search query.";
      } catch (e) {
        error =
          e.message || "Search failed. The CORS proxy may be unavailable.";
        torrents = [];
      }
      searching = false;
      render();
    }

    function startStatusPolling() {
      if (statusInterval) clearInterval(statusInterval);
      statusInterval = setInterval(() => {
        if (!activeTorrent) return;
        torrentStatus = {
          downloadSpeed: activeTorrent.downloadSpeed,
          uploadSpeed: activeTorrent.uploadSpeed,
          numPeers: activeTorrent.numPeers,
          progress: activeTorrent.progress,
          downloaded: activeTorrent.downloaded,
          total: activeTorrent.length,
        };
        const statsEl = document.querySelector(".stream-stats");
        if (statsEl) {
          statsEl.querySelector(".stat-dl").textContent = formatSpeed(torrentStatus.downloadSpeed);
          statsEl.querySelector(".stat-ul").textContent = formatSpeed(torrentStatus.uploadSpeed);
          statsEl.querySelector(".stat-peers").textContent = torrentStatus.numPeers + " peers";
          statsEl.querySelector(".stat-pct").textContent = Math.round(torrentStatus.progress * 100) + "%";
          statsEl.querySelector(".stream-progress-fill").style.width = Math.round(torrentStatus.progress * 100) + "%";
        }
        if (activeTorrent.progress >= 1) { clearInterval(statusInterval); statusInterval = null; }
      }, 2000);
    }

    function pickFile(fileIndex) {
      if (!activeTorrent) return;
      const file = activeTorrent.files[fileIndex];
      if (!file) return;
      selectedFileIndex = fileIndex;
      activeTorrent.files.forEach((f, i) => { if (i !== fileIndex) f.deselect(); });
      file.select();
      loading = true;
      streamUrl = "";
      startStatusPolling();
      render();

      requestAnimationFrame(() => {
        const videoEl = document.getElementById("video-player");
        const placeholder = document.getElementById("player-placeholder");
        if (!videoEl) return;
        if (placeholder) placeholder.style.display = "none";
        videoEl.style.display = "block";

        if (PLAYABLE_RE.test(file.name)) {
          file.renderTo(videoEl, { autoplay: true, controls: true }, (err) => {
            if (err) {
              console.error("renderTo failed, falling back to blob URL", err);
              file.getBlobURL((err2, url) => {
                if (!err2 && url) { streamUrl = url; loading = false; videoEl.src = url; videoEl.play().catch(() => {}); render(); }
              });
            } else {
              loading = false;
              streamUrl = "streaming";
              render();
            }
          });
        } else {
          file.getBlobURL((err, url) => {
            if (!err && url) { streamUrl = url; loading = false; videoEl.src = url; videoEl.play().catch(() => {}); render(); }
          });
        }
      });
    }

    async function selectTorrent(t) {
      selectedTorrent = t;
      loading = true;
      error = null;
      torrentInfo = null;
      streamUrl = "";
      selectedFileIndex = -1;
      torrentStatus = null;
      if (statusInterval) {
        clearInterval(statusInterval);
        statusInterval = null;
      }
      if (activeTorrent) {
        try {
          activeTorrent.destroy();
        } catch {}
        activeTorrent = null;
      }
      render();

      try {
        const client = getWtClient();
        activeTorrent = client.add(t.magnet, { announce: TRACKERS });

        await new Promise((resolve, reject) => {
          const timeout = setTimeout(
            () => reject(new Error("Torrent timed out after 60s")),
            60000,
          );
          activeTorrent.on("ready", () => {
            clearTimeout(timeout);
            resolve();
          });
          activeTorrent.on("error", (err) => {
            clearTimeout(timeout);
            reject(err);
          });
        });

        const files = activeTorrent.files.map((f, i) => ({
          name: f.name,
          size: f.length,
          index: i,
        }));

        torrentInfo = {
          infoHash: activeTorrent.infoHash,
          name: activeTorrent.name,
          files,
        };
        const vf = files.filter((f) => VIDEO_RE.test(f.name));
        if (vf.length === 0)
          throw new Error("No video files found in this torrent.");

        loading = false;
        showPicker = false;
        if (vf.length === 1) pickFile(vf[0].index);
        render();
      } catch (e) {
        error = e.message;
        selectedTorrent = null;
        loading = false;
        render();
      }
    }

    doSearch();
    render();

    currentPage.destroy = () => {
      if (statusInterval) clearInterval(statusInterval);
      if (activeTorrent) {
        try {
          activeTorrent.destroy();
        } catch {}
      }
    };
  }

  // ── Watchlist Page ─────────────────────────────────────

  function renderWatchlist() {
    const list = getWatchlist();
    let html = `<h1 class="section-title" style="margin-bottom:24px">My Watchlist</h1>`;

    if (list.length === 0) {
      html += `<div class="empty"><div class="empty-title">Your watchlist is empty</div><div class="empty-text">Find anime you like and add them to your list.</div><a href="#/" class="btn btn-primary">Browse Anime</a></div>`;
    } else {
      html += `<div class="grid grid-wide">${list
        .map((a) => {
          const t = title(a),
            img = cover(a),
            s = a.averageScore,
            fmt = a.format;
          const eps = a.episodes || 0,
            watched = getProgress(a.id);
          return `<div class="card" style="position:relative" id="watchlist-card-${a.id}">
          <a href="#/anime/${a.id}">
            <div class="card-image">
              <img src="${esc(img)}" alt="${esc(t)}">
              ${s ? `<span class="card-score">${s}%</span>` : ""}
              ${fmt ? `<span class="card-format">${esc(fmt)}</span>` : ""}
            </div>
            <div class="card-body">
              <div class="card-title" style="margin-bottom:4px">${esc(t)}</div>
              <div class="watchlist-progress">Progress: ${watched} / ${eps || "?"}</div>
            </div>
          </a>
          <button class="wl-remove-btn" data-id="${a.id}" style="position:absolute;top:8px;right:8px;background:rgba(0,0,0,0.7);color:var(--accent);border:1px solid var(--accent);border-radius:3px;font-size:10px;padding:2px 6px;z-index:2">Remove</button>
        </div>`;
        })
        .join("")}</div>`;
    }

    app.innerHTML = html;
    document.querySelectorAll(".wl-remove-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        removeFromWatchlist(parseInt(btn.dataset.id));
        renderWatchlist();
      });
    });
  }

  // ── History Page ───────────────────────────────────────

  function renderHistory() {
    const historyList = getHistory();
    let html = `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:24px"><h1 class="section-title">Watch History</h1>`;
    if (historyList.length > 0)
      html += `<button class="btn btn-outline btn-sm" id="clear-history-btn">Clear History</button>`;
    html += `</div>`;

    if (historyList.length === 0) {
      html += `<div class="empty"><div class="empty-title">No watch history</div><div class="empty-text">Anime you watch will show up here.</div><a href="#/" class="btn btn-primary">Browse Anime</a></div>`;
    } else {
      const latest = historyList[0];
      if (latest) {
        html += `<div class="continue-card" id="continue-watching-card">
          <div class="history-thumb"><img src="${esc(latest.coverImage.large || latest.coverImage.extraLarge)}" alt="${esc(latest.title)}"></div>
          <div class="history-info">
            <div class="continue-label">Continue Watching</div>
            <h2 class="history-title" style="font-size:16px;font-weight:600">${esc(latest.title)}</h2>
            <div class="history-ep">Episode ${latest.episode}</div>
          </div>
          <div><a href="#/watch/${latest.animeId}/${latest.episode}" class="btn btn-primary btn-sm">Resume Ep ${latest.episode}</a></div>
        </div>`;
      }

      html += `<div>${historyList
        .map((item, i) => {
          const ft = new Date(item.timestamp).toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          });
          return `<div class="history-item" id="history-item-${i}">
          <div class="history-thumb"><img src="${esc(item.coverImage.large || item.coverImage.extraLarge)}" alt="${esc(item.title)}"></div>
          <div class="history-info">
            <a href="#/anime/${item.animeId}" class="history-title" style="font-weight:600;display:block">${esc(item.title)}</a>
            <div class="history-ep">Episode ${item.episode}</div>
            <div class="history-time">${ft}</div>
          </div>
          <div class="history-actions"><a href="#/watch/${item.animeId}/${item.episode}" class="btn btn-outline btn-sm">Watch Again</a></div>
        </div>`;
        })
        .join("")}</div>`;
    }

    app.innerHTML = html;
    const clearBtn = document.getElementById("clear-history-btn");
    if (clearBtn)
      clearBtn.addEventListener("click", () => {
        clearHistory();
        renderHistory();
      });
  }

  // ── Init ───────────────────────────────────────────────

  searchForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const q = searchInput.value.trim();
    if (q) {
      location.hash = "/search?q=" + encodeURIComponent(q);
      searchInput.value = "";
    }
  });

  window.addEventListener("hashchange", route);
  route();
})();
