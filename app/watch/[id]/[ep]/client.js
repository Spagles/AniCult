"use client";

import Link from "next/link";
import { useEffect, useState, useCallback, useRef } from "react";
import { addToHistory, setProgress } from "@/lib/storage";

const VIDEO_EXTENSIONS = /\.(mp4|mkv|webm|avi|m4v)$/i;
const PLAYABLE_EXTENSIONS = /\.(mp4|webm|m4v|ogv)$/i;

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

function formatSpeed(bytesPerSec) {
  if (!bytesPerSec) return "0 B/s";
  return formatBytes(bytesPerSec) + "/s";
}

function timeAgo(dateStr) {
  if (!dateStr) return "";
  const now = new Date();
  const then = new Date(dateStr);
  const diff = now - then;
  const days = Math.floor(diff / 86400000);
  if (days > 365) return `${Math.floor(days / 365)}y ago`;
  if (days > 30) return `${Math.floor(days / 30)}mo ago`;
  if (days > 0) return `${days}d ago`;
  const hours = Math.floor(diff / 3600000);
  if (hours > 0) return `${hours}h ago`;
  const mins = Math.floor(diff / 60000);
  if (mins > 0) return `${mins}m ago`;
  return "just now";
}

export function WatchClient({ anime, episode }) {
  const [torrents, setTorrents] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [selectedTorrent, setSelectedTorrent] = useState(null);
  const [loading, setLoading] = useState(false);
  const [torrentInfo, setTorrentInfo] = useState(null);
  const [torrentStatus, setTorrentStatus] = useState(null);
  const [streamUrl, setStreamUrl] = useState("");
  const [selectedFileIndex, setSelectedFileIndex] = useState(-1);
  const [error, setError] = useState(null);
  const [showPicker, setShowPicker] = useState(true);
  const [category, setCategory] = useState("1_2"); // 1_2 = Anime English, 1_0 = All Anime
  const videoRef = useRef(null);
  const statusInterval = useRef(null);
  const initialSearchDone = useRef(false);

  const title = anime.title.english || anime.title.romaji;
  const romajiTitle = anime.title.romaji;
  const totalEps =
    anime.episodes ||
    (anime.nextAiringEpisode ? anime.nextAiringEpisode.episode - 1 : 0);

  // Search nyaa.si
  const searchNyaa = useCallback(
    async (q) => {
      if (!q.trim()) return;
      setSearching(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/nyaa?q=${encodeURIComponent(q.trim())}&c=${category}`,
        );
        if (!res.ok) throw new Error("Search failed");
        const data = await res.json();
        setTorrents(data.results || []);
        if (!data.results || data.results.length === 0) {
          setError("No torrents found. Try adjusting your search query.");
        }
      } catch (e) {
        setError(e.message);
        setTorrents([]);
      }
      setSearching(false);
    },
    [category],
  );

  // Build default search query and auto-search on mount
  useEffect(() => {
    const ep = String(episode).padStart(2, "0");
    const q = `${romajiTitle || title} ${ep}`;
    setSearchInput(q);

    if (!initialSearchDone.current) {
      initialSearchDone.current = true;
      searchNyaa(q);
    }
  }, [title, romajiTitle, episode, searchNyaa]);

  // Handle search form submit
  const handleSearch = (e) => {
    e.preventDefault();
    searchNyaa(searchInput);
  };

  // Pick a specific file to stream
  const pickFile = useCallback((hash, fileIndex, magnet) => {
    setSelectedFileIndex(fileIndex);
    const url = `/api/stream?hash=${hash}&file=${fileIndex}`;
    setStreamUrl(url);

    // Start polling torrent status
    if (statusInterval.current) clearInterval(statusInterval.current);
    statusInterval.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/torrent?hash=${hash}`);
        if (res.ok) {
          const status = await res.json();
          setTorrentStatus(status);
          if (status.progress >= 100) {
            clearInterval(statusInterval.current);
            statusInterval.current = null;
          }
        }
      } catch {
        // Ignore polling errors
      }
    }, 3000);
  }, []);

  // Select a torrent and start loading
  const selectTorrent = useCallback(
    async (torrent) => {
      setSelectedTorrent(torrent);
      setLoading(true);
      setError(null);
      setTorrentInfo(null);
      setStreamUrl("");
      setSelectedFileIndex(-1);
      setTorrentStatus(null);

      // Stop any existing status polling
      if (statusInterval.current) {
        clearInterval(statusInterval.current);
        statusInterval.current = null;
      }

      try {
        const res = await fetch("/api/torrent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ magnet: torrent.magnet }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || "Failed to start torrent");
        }
        const data = await res.json();
        setTorrentInfo(data);

        // Find video files
        const videoFiles = data.files.filter((f) =>
          VIDEO_EXTENSIONS.test(f.name),
        );

        if (videoFiles.length === 0) {
          throw new Error("No video files found in this torrent.");
        }

        // Auto-select if only one video file, otherwise user picks
        if (videoFiles.length === 1) {
          pickFile(data.infoHash, videoFiles[0].index, torrent.magnet);
        }

        setShowPicker(false);
      } catch (e) {
        setError(e.message);
        setSelectedTorrent(null);
      }
      setLoading(false);
    },
    [pickFile],
  );

  // Cleanup status polling on unmount
  useEffect(() => {
    return () => {
      if (statusInterval.current) {
        clearInterval(statusInterval.current);
      }
    };
  }, []);

  // Track watch history
  useEffect(() => {
    addToHistory({
      animeId: anime.id,
      title,
      coverImage: anime.coverImage,
      episode,
    });
    setProgress(anime.id, episode);
  }, [anime.id, title, anime.coverImage, episode]);

  // Derived state
  const videoFiles = torrentInfo
    ? torrentInfo.files.filter((f) => VIDEO_EXTENSIONS.test(f.name))
    : [];
  const isPlayable = (name) => PLAYABLE_EXTENSIONS.test(name);
  const currentFile =
    torrentInfo && selectedFileIndex >= 0
      ? torrentInfo.files[selectedFileIndex]
      : null;

  return (
    <div className="player-container">
      {/* Header */}
      <div className="player-info">
        <div>
          <Link
            href={`/anime/${anime.id}`}
            className="player-title"
            id="player-title"
          >
            {title}
          </Link>
          <div className="player-episode">Episode {episode}</div>
        </div>
        <div className="player-nav">
          {episode > 1 && (
            <Link
              href={`/watch/${anime.id}/${episode - 1}`}
              className="btn btn-outline btn-sm"
            >
              ← Prev
            </Link>
          )}
          {episode < totalEps && (
            <Link
              href={`/watch/${anime.id}/${episode + 1}`}
              className="btn btn-primary btn-sm"
            >
              Next →
            </Link>
          )}
        </div>
      </div>

      {/* Video Player */}
      <div className="player-wrapper">
        {streamUrl ? (
          <video
            ref={videoRef}
            src={streamUrl}
            controls
            autoPlay
            id="video-player"
          />
        ) : loading ? (
          <div className="loading">
            <div className="loading-spinner" />
            <div>Connecting to peers & fetching metadata...</div>
            <div
              style={{ fontSize: 12, color: "var(--text-dim)", marginTop: 6 }}
            >
              This may take up to 60 seconds
            </div>
          </div>
        ) : (
          <div className="loading">
            <div style={{ fontSize: 32, marginBottom: 12 }}>🔽</div>
            <div>Select a torrent below to start streaming</div>
          </div>
        )}
      </div>

      {/* Stream Stats */}
      {torrentStatus && streamUrl && (
        <div className="stream-stats">
          <span className="stat-item">
            <span className="stat-icon">↓</span>{" "}
            {formatSpeed(torrentStatus.downloadSpeed)}
          </span>
          <span className="stat-item">
            <span className="stat-icon">↑</span>{" "}
            {formatSpeed(torrentStatus.uploadSpeed)}
          </span>
          <span className="stat-item">
            <span className="stat-icon">👥</span> {torrentStatus.numPeers} peers
          </span>
          <span className="stat-item">{torrentStatus.progress}%</span>
          <div className="stream-progress-bar">
            <div
              className="stream-progress-fill"
              style={{ width: `${torrentStatus.progress}%` }}
            />
          </div>
        </div>
      )}

      {/* MKV Warning */}
      {currentFile && !isPlayable(currentFile.name) && (
        <div className="mkv-warning">
          <strong>⚠ MKV Format</strong> — This video may not play in
          Chrome/Safari. It works natively in Firefox. If playback fails, try
          selecting an MP4 release from the torrent picker.
        </div>
      )}

      {/* File picker (if torrent has multiple video files) */}
      {torrentInfo && videoFiles.length > 1 && (
        <div className="file-list">
          <h3 className="file-list-title">Select Video File</h3>
          {videoFiles.map((f) => (
            <button
              key={f.index}
              className={`file-item ${selectedFileIndex === f.index ? "file-item-active" : ""}`}
              onClick={() =>
                pickFile(torrentInfo.infoHash, f.index, selectedTorrent?.magnet)
              }
            >
              <span className="file-name">{f.name}</span>
              <div className="file-meta">
                <span className="file-size">{formatBytes(f.size)}</span>
                {!isPlayable(f.name) && (
                  <span className="file-warning">MKV</span>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Torrent Picker Toggle */}
      <button
        className={`torrent-picker-toggle ${showPicker ? "open" : ""}`}
        onClick={() => setShowPicker(!showPicker)}
        id="torrent-toggle"
      >
        <span>
          {selectedTorrent
            ? `Source: ${selectedTorrent.title.substring(0, 60)}${selectedTorrent.title.length > 60 ? "…" : ""}`
            : "Torrent Sources"}
        </span>
        <span className="toggle-icon">{showPicker ? "▲" : "▼"}</span>
      </button>

      {/* Torrent Picker */}
      {showPicker && (
        <div className="torrent-picker">
          <form onSubmit={handleSearch} className="torrent-search">
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search nyaa.si for torrents..."
              id="nyaa-search"
            />
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="torrent-category"
              id="nyaa-category"
            >
              <option value="1_2">English Subs</option>
              <option value="1_4">Raw</option>
              <option value="1_0">All Anime</option>
            </select>
            <button
              type="submit"
              className="btn btn-primary btn-sm"
              id="nyaa-search-btn"
            >
              Search
            </button>
          </form>

          {error && !searching && <div className="torrent-error">{error}</div>}

          {searching ? (
            <div className="loading" style={{ padding: 24 }}>
              <div className="loading-spinner" />
              <div>Searching nyaa.si...</div>
            </div>
          ) : (
            <div className="torrent-list">
              {torrents.map((t, i) => (
                <button
                  key={`${t.infoHash}-${i}`}
                  className={`torrent-item ${selectedTorrent?.infoHash === t.infoHash ? "torrent-item-active" : ""}`}
                  onClick={() => selectTorrent(t)}
                  disabled={loading}
                  id={`torrent-${i}`}
                >
                  <div className="torrent-item-title">
                    {t.trusted && (
                      <span className="torrent-badge trusted">✓ Trusted</span>
                    )}
                    {t.remake && (
                      <span className="torrent-badge remake">Remake</span>
                    )}
                    {t.title}
                  </div>
                  <div className="torrent-item-meta">
                    <span className="torrent-size">{t.size}</span>
                    <span className="torrent-seeders">▲ {t.seeders}</span>
                    <span className="torrent-leechers">▼ {t.leechers}</span>
                    <span className="torrent-downloads">⬇ {t.downloads}</span>
                    <span className="torrent-date">{timeAgo(t.pubDate)}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Episodes */}
      {totalEps > 0 && (
        <div style={{ marginTop: 24 }}>
          <h3 className="episodes-title" style={{ marginBottom: 12 }}>
            Episodes
          </h3>
          <div className="episodes-grid">
            {Array.from({ length: totalEps }, (_, i) => i + 1).map((ep) => (
              <Link
                key={ep}
                href={`/watch/${anime.id}/${ep}`}
                className={`ep-btn ${ep === episode ? "ep-btn-current" : ""}`}
                id={`ep-${ep}`}
              >
                {ep}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
