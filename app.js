(function () {
  "use strict";

  const ANILIST_URL = "https://graphql.anilist.co";

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

  const app = document.getElementById("app");
  const searchInput = document.getElementById("nav-search-input");
  const searchForm = document.getElementById("nav-search-form");

  let currentPage = { destroy: null };

  // ── API Layer ──────────────────────────────────────────

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
    const data = await gql(q, { page, perPage });
    return data.Page;
  }

  async function getPopular(page = 1, perPage = 20) {
    const q = `query($page:Int,$perPage:Int){Page(page:$page,perPage:$perPage){pageInfo{total currentPage lastPage hasNextPage}media(type:ANIME,sort:POPULARITY_DESC){${MEDIA_FIELDS_SMALL}}}}`;
    const data = await gql(q, { page, perPage });
    return data.Page;
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
    const data = await gql(q, variables);
    return data.Page;
  }

  async function getAnimeById(id) {
    const q = `query($id:Int){Media(id:$id,type:ANIME){${MEDIA_FIELDS}}}`;
    const data = await gql(q, { id: parseInt(id) });
    return data.Media;
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

    // Infinite scroll for popular
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
      loader.textContent = popHasNext ? "" : "";
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
    if (q) {
      result = await searchAnime(q, page, 24, format || null, sort);
    } else {
      result = await getTrending(page, 24);
    }

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
          <div class="card-image">
            <img src="${esc(img)}" alt="${esc(t)}" loading="lazy">
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
          return `<a href="#/anime/${r.id}" class="card" key="${r.id}" id="related-${r.id}">
          <div class="card-image">
            <img src="${esc(r.coverImage.large)}" alt="${esc(rT)}">
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

    // Watchlist toggle
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

  // ── Watch Page ─────────────────────────────────────────

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

      // Header
      html += `<div class="player-info"><div>
        <a href="#/anime/${anime.id}" class="player-title" id="player-title">${esc(t)}</a>
        <div class="player-episode">Episode ${episode}</div>
      </div><div class="player-nav">`;
      if (episode > 1)
        html += `<a href="#/watch/${anime.id}/${episode - 1}" class="btn btn-outline btn-sm">${icons.arrowLeft()} Prev</a>`;
      if (episode < totalEps)
        html += `<a href="#/watch/${anime.id}/${episode + 1}" class="btn btn-primary btn-sm">Next ${icons.arrowRight()}</a>`;
      html += `</div></div>`;

      // Video player
      html += `<div class="player-wrapper">`;
      if (streamUrl) {
        html += `<video id="video-player" src="${esc(streamUrl)}" controls autoplay></video>`;
      } else if (loading) {
        html += `<div class="loading"><div class="loading-spinner"></div><div>Connecting to peers...</div><div style="font-size:12px;color:var(--text-dim);margin-top:6px">Waiting for at least one peer to connect. This may take a moment.</div></div>`;
      } else {
        html += `<div class="loading">${icons.download(32)}<div>Select a torrent below to start streaming</div></div>`;
      }
      html += `</div>`;

      // Stream stats
      if (torrentStatus && streamUrl) {
        html += `<div class="stream-stats">
          <span class="stat-item"><span class="stat-icon">${icons.download(14)}</span> ${formatSpeed(torrentStatus.downloadSpeed)}</span>
          <span class="stat-item"><span class="stat-icon">${icons.upload(14)}</span> ${formatSpeed(torrentStatus.uploadSpeed)}</span>
          <span class="stat-item"><span class="stat-icon">${icons.users(14)}</span> ${torrentStatus.numPeers} peers</span>
          <span class="stat-item">${torrentStatus.progress}%</span>
          <div class="stream-progress-bar"><div class="stream-progress-fill" style="width:${torrentStatus.progress}%"></div></div>
        </div>`;
      }

      // MKV warning
      if (currentFile && !isPlayable(currentFile.name)) {
        html += `<div class="mkv-warning"><strong>${icons.alert(16)} MKV Format</strong> — This video may not play in Chrome/Safari. It works natively in Firefox. If playback fails, try selecting an MP4 release from the torrent picker.</div>`;
      }

      // File picker
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

      // Torrent picker toggle
      html += `<button class="torrent-picker-toggle ${showPicker ? "open" : ""}" id="torrent-toggle">
        <span>${selectedTorrent ? esc(selectedTorrent.title.substring(0, 60) + (selectedTorrent.title.length > 60 ? "..." : "")) : "Torrent Sources"}</span>
        <span class="toggle-icon">${showPicker ? icons.chevronUp() : icons.chevronDown()}</span>
      </button>`;

      // Torrent picker
      if (showPicker) {
        html += `<div class="torrent-picker">
          <form class="torrent-search" id="nyaa-search-form">
            <input type="text" value="${esc(searchInputVal)}" placeholder="Search nyaa.si for torrents..." id="nyaa-search">
            <select class="torrent-category" id="nyaa-category">
              <option value="1_2" ${category === "1_2" ? "selected" : ""}>English Subs</option>
              <option value="1_4" ${category === "1_4" ? "selected" : ""}>Raw</option>
              <option value="1_0" ${category === "1_0" ? "selected" : ""}>All Anime</option>
            </select>
            <button type="submit" class="btn btn-primary btn-sm" id="nyaa-search-btn">Search</button>
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

      // Episodes
      if (totalEps > 0) {
        html += `<div style="margin-top:24px"><h3 class="episodes-title" style="margin-bottom:12px">Episodes</h3><div class="episodes-grid">${Array.from(
          { length: totalEps },
          (_, i) => i + 1,
        )
          .map(
            (ep) =>
              `<a href="#/watch/${anime.id}/${ep}" class="ep-btn ${ep === episode ? "ep-btn-current" : ""}" id="ep-${ep}">${ep}</a>`,
          )
          .join("")}</div></div>`;
      }

      html += `</div>`;
      app.innerHTML = html;
      bindEvents();
    }

    function bindEvents() {
      // Search form
      const form = document.getElementById("nyaa-search-form");
      if (form)
        form.addEventListener("submit", (e) => {
          e.preventDefault();
          doSearch();
        });

      // Category change
      const cat = document.getElementById("nyaa-category");
      if (cat)
        cat.addEventListener("change", (e) => {
          category = e.target.value;
          doSearch();
        });

      // Torrent toggle
      const toggle = document.getElementById("torrent-toggle");
      if (toggle)
        toggle.addEventListener("click", () => {
          showPicker = !showPicker;
          render();
        });

      // Torrent selection
      document.querySelectorAll("[data-torrent-index]").forEach((btn) => {
        btn.addEventListener("click", () =>
          selectTorrent(torrents[parseInt(btn.dataset.torrentIndex)]),
        );
      });

      // File selection
      document.querySelectorAll("[data-file-index]").forEach((btn) => {
        btn.addEventListener("click", async () => {
          const idx = parseInt(btn.dataset.fileIndex);
          loading = true;
          streamUrl = "";
          selectedFileIndex = idx;
          render();
          await waitForPeers(torrentInfo.infoHash);
          pickFile(torrentInfo.infoHash, idx);
          loading = false;
          render();
        });
      });

      // Search input sync
      const si = document.getElementById("nyaa-search");
      if (si)
        si.addEventListener("input", (e) => {
          searchInputVal = e.target.value;
        });
    }

    async function doSearch() {
      if (!searchInputVal.trim()) return;
      searching = true;
      error = null;
      render();
      try {
        const res = await fetch(
          `/api/nyaa?q=${encodeURIComponent(searchInputVal.trim())}&c=${category}`,
        );
        const data = await res.json();
        if (!res.ok) {
          const msg = data.error || "Search failed";
          if (msg.includes("timeout") || msg.includes("connect"))
            throw new Error(
              "Cannot reach nyaa.si — your network may be blocking it. Set NYAA_PROXY in .env to use a proxy.",
            );
          throw new Error(msg);
        }
        torrents = data.results || [];
        if (!data.results || data.results.length === 0)
          error = "No torrents found. Try adjusting your search query.";
      } catch (e) {
        if (
          e.name === "TypeError" ||
          e.message.includes("fetch") ||
          e.message.includes("network")
        ) {
          error =
            "Cannot reach nyaa.si — your network may be blocking it. Set NYAA_PROXY in .env to use a proxy.";
        } else {
          error = e.message;
        }
        torrents = [];
      }
      searching = false;
      render();
    }

    function startStatusPolling(hash) {
      if (statusInterval) clearInterval(statusInterval);
      statusInterval = setInterval(async () => {
        try {
          const res = await fetch(`/api/torrent?hash=${hash}`);
          if (res.ok) {
            torrentStatus = await res.json();
            render();
            if (torrentStatus.progress >= 100) {
              clearInterval(statusInterval);
              statusInterval = null;
            }
          }
        } catch {}
      }, 3000);
    }

    function waitForPeers(hash, maxWaitMs = 30000) {
      return new Promise((resolve) => {
        const start = Date.now();
        const poll = async () => {
          try {
            const res = await fetch(`/api/torrent?hash=${hash}`);
            if (res.ok) {
              const s = await res.json();
              torrentStatus = s;
              if (s.numPeers > 0 || s.progress > 0) {
                resolve();
                return;
              }
            }
          } catch {}
          if (Date.now() - start > maxWaitMs) {
            resolve();
            return;
          }
          setTimeout(poll, 1500);
        };
        poll();
      });
    }

    function pickFile(hash, fileIndex) {
      selectedFileIndex = fileIndex;
      streamUrl = `/api/stream?hash=${hash}&file=${fileIndex}`;
      startStatusPolling(hash);
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
      render();
      try {
        const res = await fetch("/api/torrent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ magnet: t.magnet }),
        });
        if (!res.ok) {
          const d = await res.json().catch(() => ({}));
          throw new Error(d.error || "Failed to start torrent");
        }
        const data = await res.json();
        torrentInfo = data;
        const vf = data.files.filter((f) => VIDEO_RE.test(f.name));
        if (vf.length === 0)
          throw new Error("No video files found in this torrent.");
        loading = false;
        showPicker = false;
        if (vf.length === 1) {
          await waitForPeers(data.infoHash);
          pickFile(data.infoHash, vf[0].index);
        }
        render();
      } catch (e) {
        error = e.message;
        selectedTorrent = null;
        loading = false;
        render();
      }
    }

    // Auto-search on mount
    doSearch();
    render();

    currentPage.destroy = () => {
      if (statusInterval) clearInterval(statusInterval);
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
