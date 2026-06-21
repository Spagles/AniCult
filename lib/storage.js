"use client";

const KEYS = {
  watchlist: "anicult_watchlist",
  history: "anicult_history",
  progress: "anicult_progress",
  magnets: "anicult_magnets",
};

function get(key) {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function set(key, value) {
  if (typeof window === "undefined") return;
  localStorage.setItem(key, JSON.stringify(value));
}

export function getWatchlist() {
  return get(KEYS.watchlist) || [];
}

export function addToWatchlist(anime) {
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
  set(KEYS.watchlist, updated);
  return updated;
}

export function removeFromWatchlist(id) {
  const list = getWatchlist().filter((a) => a.id !== id);
  set(KEYS.watchlist, list);
  return list;
}

export function isInWatchlist(id) {
  return getWatchlist().some((a) => a.id === id);
}

export function getHistory() {
  return get(KEYS.history) || [];
}

export function addToHistory(entry) {
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
  set(KEYS.history, updated);
  return updated;
}

export function clearHistory() {
  set(KEYS.history, []);
}

export function getProgress(animeId) {
  const progress = get(KEYS.progress) || {};
  return progress[animeId] || 0;
}

export function setProgress(animeId, episode) {
  if (!episode || isNaN(episode) || episode <= 0) return;
  const progress = get(KEYS.progress) || {};
  progress[animeId] = Math.max(progress[animeId] || 0, episode);
  set(KEYS.progress, progress);
}

export function getAllProgress() {
  return get(KEYS.progress) || {};
}

export function getLastMagnet(animeId, episode) {
  const magnets = get(KEYS.magnets) || {};
  return magnets[`${animeId}_${episode}`] || null;
}

export function setLastMagnet(animeId, episode, data) {
  const magnets = get(KEYS.magnets) || {};
  magnets[`${animeId}_${episode}`] = data;
  set(KEYS.magnets, magnets);
}
