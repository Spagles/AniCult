// Server-side only — WebTorrent client singleton
// This module keeps a single WebTorrent instance alive across API requests.
// In Node.js, WebTorrent connects to traditional BitTorrent peers via TCP/UDP.

if (!globalThis.webtorrentClientPromise) {
  globalThis.webtorrentClientPromise = (async () => {
    const WebTorrent = (await import("webtorrent")).default;
    const client = new WebTorrent({
      tracker: true,
      dht: true,
      utp: true,
    });
    client.on("error", (err) => {
      console.error("[WebTorrent] Client error:", err.message);
    });
    return client;
  })();
}

async function getClient() {
  return globalThis.webtorrentClientPromise;
}

// Track last-access times for LRU eviction
if (!globalThis.webtorrentTorrentMeta) {
  globalThis.webtorrentTorrentMeta = new Map();
}
const torrentMeta = globalThis.webtorrentTorrentMeta;
const MAX_TORRENTS = 5;
const METADATA_TIMEOUT = 60000; // 60 seconds

function waitForMetadata(torrent) {
  if (torrent.ready) return Promise.resolve(torrent);
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error("Timeout waiting for torrent metadata (60s)"));
    }, METADATA_TIMEOUT);
    torrent.on("ready", () => {
      clearTimeout(timeout);
      resolve(torrent);
    });
    torrent.on("error", (err) => {
      clearTimeout(timeout);
      reject(err);
    });
  });
}

async function cleanupOldest(client) {
  let oldest = null;
  let oldestTime = Infinity;
  for (const torrent of client.torrents) {
    const meta = torrentMeta.get(torrent.infoHash);
    const time = meta ? meta.lastAccess : 0;
    if (time < oldestTime) {
      oldestTime = time;
      oldest = torrent;
    }
  }
  if (oldest) {
    console.log(
      `[WebTorrent] Evicting old torrent: ${oldest.name || oldest.infoHash}`,
    );
    torrentMeta.delete(oldest.infoHash);
    return new Promise((resolve) => {
      oldest.destroy({ destroyStore: true }, resolve);
    });
  }
}

export async function addTorrent(magnetURI) {
  const client = await getClient();

  // Check if this torrent already exists
  const existing = client.torrents.find(
    (t) => t.magnetURI === magnetURI || magnetURI.includes(t.infoHash),
  );
  if (existing) {
    torrentMeta.set(existing.infoHash, { lastAccess: Date.now() });
    return waitForMetadata(existing);
  }

  // Evict oldest if at capacity
  if (client.torrents.length >= MAX_TORRENTS) {
    await cleanupOldest(client);
  }

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error("Timeout waiting for torrent metadata (60s)"));
    }, METADATA_TIMEOUT);

    client.add(magnetURI, { deselect: true }, (torrent) => {
      clearTimeout(timeout);
      torrentMeta.set(torrent.infoHash, { lastAccess: Date.now() });
      console.log(
        `[WebTorrent] Torrent ready: ${torrent.name} (${torrent.files.length} files)`,
      );
      resolve(torrent);
    });
  });
}

export async function getTorrent(infoHash) {
  const client = await getClient();
  const torrent = client.torrents.find((t) => t.infoHash === infoHash);
  if (torrent) {
    torrentMeta.set(torrent.infoHash, { lastAccess: Date.now() });
  }
  return torrent || null;
}

export async function removeTorrent(infoHash) {
  const client = await getClient();
  const torrent = client.torrents.find((t) => t.infoHash === infoHash);
  if (torrent) {
    torrentMeta.delete(infoHash);
    console.log(`[WebTorrent] Removing torrent: ${torrent.name || infoHash}`);
    return new Promise((resolve) => {
      torrent.destroy({ destroyStore: true }, resolve);
    });
  }
}
