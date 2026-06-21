"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import {
  isInWatchlist,
  addToWatchlist,
  removeFromWatchlist,
  getProgress,
} from "@/lib/storage";

export function AnimeDetailClient({ anime }) {
  const [inList, setInList] = useState(false);
  const [watched, setWatched] = useState(0);

  useEffect(() => {
    setInList(isInWatchlist(anime.id));
    setWatched(getProgress(anime.id));
  }, [anime.id]);

  function toggleWatchlist() {
    if (inList) {
      removeFromWatchlist(anime.id);
      setInList(false);
    } else {
      addToWatchlist(anime);
      setInList(true);
    }
  }

  const title = anime.title.english || anime.title.romaji;
  const altTitle =
    anime.title.english && anime.title.romaji !== anime.title.english
      ? anime.title.romaji
      : anime.title.native || "";
  const image = anime.coverImage.extraLarge || anime.coverImage.large;
  const banner = anime.bannerImage;
  const totalEps =
    anime.episodes ||
    (anime.nextAiringEpisode ? anime.nextAiringEpisode.episode - 1 : 0);
  const studio = anime.studios?.nodes?.[0]?.name || "Unknown";

  const description = anime.description
    ? anime.description.replace(/<br\s*\/?>/g, "\n").replace(/<[^>]*>/g, "")
    : "No description available.";

  const relations =
    anime.relations?.edges?.filter(
      (e) =>
        e.relationType === "SEQUEL" ||
        e.relationType === "PREQUEL" ||
        e.relationType === "SIDE_STORY" ||
        e.relationType === "PARENT",
    ) || [];

  return (
    <>
      {banner && (
        <div className="banner-section">
          <div
            className="banner-bg"
            style={{ backgroundImage: `url(${banner})` }}
          />
          <div className="banner-fade" />
        </div>
      )}

      <div className="detail-page">
        <div className="detail-sidebar">
          <img src={image} alt={title} />
          <div style={{ marginTop: 12 }}>
            <button
              className={`btn ${inList ? "btn-danger" : "btn-primary"}`}
              onClick={toggleWatchlist}
              style={{ width: "100%" }}
              id="watchlist-btn"
            >
              {inList ? "Remove from List" : "Add to Watchlist"}
            </button>
          </div>
          {totalEps > 0 && (
            <div style={{ marginTop: 8 }}>
              <Link
                href={`/watch/${anime.id}/1`}
                className="btn btn-outline"
                style={{ width: "100%", display: "flex" }}
              >
                {watched > 0 ? `Continue Ep ${watched + 1}` : "Start Watching"}
              </Link>
            </div>
          )}
        </div>

        <div className="detail-main">
          <h1 className="detail-title">{title}</h1>
          {altTitle && <div className="detail-alt-title">{altTitle}</div>}

          <div className="detail-meta">
            {anime.genres?.map((g) => (
              <span key={g} className="detail-tag">
                {g}
              </span>
            ))}
            {anime.averageScore && (
              <span className="detail-tag detail-tag-accent">
                {anime.averageScore}%
              </span>
            )}
          </div>

          <div className="detail-info-grid">
            <div className="detail-info-item">
              <label>Format</label>
              <span>{anime.format || "—"}</span>
            </div>
            <div className="detail-info-item">
              <label>Status</label>
              <span>{anime.status?.replace(/_/g, " ") || "—"}</span>
            </div>
            <div className="detail-info-item">
              <label>Episodes</label>
              <span>{anime.episodes || "?"}</span>
            </div>
            <div className="detail-info-item">
              <label>Duration</label>
              <span>{anime.duration ? `${anime.duration} min` : "—"}</span>
            </div>
            <div className="detail-info-item">
              <label>Season</label>
              <span>
                {anime.season
                  ? `${anime.season} ${anime.seasonYear || ""}`
                  : "—"}
              </span>
            </div>
            <div className="detail-info-item">
              <label>Studio</label>
              <span>{studio}</span>
            </div>
          </div>

          <div className="detail-synopsis">{description}</div>

          {totalEps > 0 && (
            <div>
              <div className="episodes-header">
                <h2 className="episodes-title">Episodes</h2>
                <span style={{ fontSize: 13, color: "var(--text-muted)" }}>
                  {watched}/{totalEps} watched
                </span>
              </div>
              <div className="episodes-grid">
                {Array.from({ length: totalEps }, (_, i) => i + 1).map((ep) => (
                  <Link
                    key={ep}
                    href={`/watch/${anime.id}/${ep}`}
                    className={`ep-btn ${ep <= watched ? "ep-btn-watched" : ""} ${ep === watched + 1 ? "ep-btn-current" : ""}`}
                    id={`ep-${ep}`}
                  >
                    {ep}
                  </Link>
                ))}
              </div>
            </div>
          )}

          {relations.length > 0 && (
            <div style={{ marginTop: 32 }}>
              <h2 className="section-title" style={{ marginBottom: 12 }}>
                Related
              </h2>
              <div className="scroll-row">
                {relations.map((rel) => {
                  const r = rel.node;
                  const rTitle = r.title.english || r.title.romaji;
                  return (
                    <Link
                      href={`/anime/${r.id}`}
                      className="card"
                      key={r.id}
                      id={`related-${r.id}`}
                    >
                      <div className="card-image">
                        <img src={r.coverImage.large} alt={rTitle} />
                        {r.averageScore && (
                          <span className="card-score">{r.averageScore}%</span>
                        )}
                        <span className="card-format">
                          {rel.relationType.replace(/_/g, " ")}
                        </span>
                      </div>
                      <div className="card-body">
                        <div className="card-title">{rTitle}</div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
