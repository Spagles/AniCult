"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { getWatchlist, removeFromWatchlist, getProgress } from "@/lib/storage";

export default function WatchlistPage() {
  const [list, setList] = useState([]);
  const [progressMap, setProgressMap] = useState({});
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setList(getWatchlist());
    const progress = {};
    const storedList = getWatchlist();
    storedList.forEach((anime) => {
      progress[anime.id] = getProgress(anime.id);
    });
    setProgressMap(progress);
    setMounted(true);
  }, []);

  function handleRemove(id, e) {
    e.preventDefault();
    e.stopPropagation();
    const updated = removeFromWatchlist(id);
    setList(updated);
  }

  if (!mounted) {
    return <div className="loading">Loading watchlist...</div>;
  }

  return (
    <>
      <h1 className="section-title" style={{ marginBottom: 24 }}>
        My Watchlist
      </h1>
      {list.length === 0 ? (
        <div className="empty">
          <div className="empty-title">Your watchlist is empty</div>
          <div className="empty-text">
            Find anime you like and add them to your list.
          </div>
          <Link href="/" className="btn btn-primary">
            Browse Anime
          </Link>
        </div>
      ) : (
        <div className="grid grid-wide">
          {list.map((anime) => {
            const title = anime.title.english || anime.title.romaji;
            const image = anime.coverImage.extraLarge || anime.coverImage.large;
            const score = anime.averageScore;
            const format = anime.format;
            const eps = anime.episodes || 0;
            const watched = progressMap[anime.id] || 0;

            return (
              <div
                key={anime.id}
                className="card"
                style={{ position: "relative" }}
                id={`watchlist-card-${anime.id}`}
              >
                <Link href={`/anime/${anime.id}`}>
                  <div className="card-image">
                    <img src={image} alt={title} />
                    {score && <span className="card-score">{score}%</span>}
                    {format && <span className="card-format">{format}</span>}
                  </div>
                  <div className="card-body">
                    <div className="card-title" style={{ marginBottom: 4 }}>
                      {title}
                    </div>
                    <div className="watchlist-progress">
                      Progress: {watched} / {eps || "?"}
                    </div>
                  </div>
                </Link>
                <button
                  onClick={(e) => handleRemove(anime.id, e)}
                  style={{
                    position: "absolute",
                    top: "8px",
                    right: "8px",
                    background: "rgba(0, 0, 0, 0.7)",
                    color: "var(--accent)",
                    border: "1px solid var(--accent)",
                    borderRadius: "3px",
                    fontSize: "10px",
                    padding: "2px 6px",
                    zIndex: 2,
                  }}
                  id={`remove-btn-${anime.id}`}
                >
                  Remove
                </button>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
