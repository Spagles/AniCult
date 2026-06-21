"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { getHistory, clearHistory } from "@/lib/storage";

export default function HistoryPage() {
  const [historyList, setHistoryList] = useState([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setHistoryList(getHistory());
    setMounted(true);
  }, []);

  function handleClear() {
    clearHistory();
    setHistoryList([]);
  }

  if (!mounted) {
    return <div className="loading">Loading history...</div>;
  }

  const latest = historyList[0];

  return (
    <>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 24,
        }}
      >
        <h1 className="section-title">Watch History</h1>
        {historyList.length > 0 && (
          <button
            onClick={handleClear}
            className="btn btn-outline btn-sm"
            id="clear-history-btn"
          >
            Clear History
          </button>
        )}
      </div>

      {historyList.length === 0 ? (
        <div className="empty">
          <div className="empty-title">No watch history</div>
          <div className="empty-text">Anime you watch will show up here.</div>
          <Link href="/" className="btn btn-primary">
            Browse Anime
          </Link>
        </div>
      ) : (
        <>
          {latest && (
            <div className="continue-card" id="continue-watching-card">
              <div className="history-thumb">
                <img
                  src={latest.coverImage.large || latest.coverImage.extraLarge}
                  alt={latest.title}
                />
              </div>
              <div className="history-info">
                <div className="continue-label">Continue Watching</div>
                <h2
                  className="history-title"
                  style={{ fontSize: 16, fontWeight: 600 }}
                >
                  {latest.title}
                </h2>
                <div className="history-ep">Episode {latest.episode}</div>
              </div>
              <div>
                <Link
                  href={`/watch/${latest.animeId}/${latest.episode}`}
                  className="btn btn-primary btn-sm"
                >
                  Resume Ep {latest.episode}
                </Link>
              </div>
            </div>
          )}

          <div>
            {historyList.map((item, index) => {
              const formattedTime = new Date(item.timestamp).toLocaleDateString(
                undefined,
                {
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                },
              );

              return (
                <div
                  key={`${item.animeId}-${item.episode}-${item.timestamp}`}
                  className="history-item"
                  id={`history-item-${index}`}
                >
                  <div className="history-thumb">
                    <img
                      src={item.coverImage.large || item.coverImage.extraLarge}
                      alt={item.title}
                    />
                  </div>
                  <div className="history-info">
                    <Link
                      href={`/anime/${item.animeId}`}
                      className="history-title"
                      style={{ fontWeight: 600, display: "block" }}
                    >
                      {item.title}
                    </Link>
                    <div className="history-ep">Episode {item.episode}</div>
                    <div className="history-time">{formattedTime}</div>
                  </div>
                  <div className="history-actions">
                    <Link
                      href={`/watch/${item.animeId}/${item.episode}`}
                      className="btn btn-outline btn-sm"
                    >
                      Watch Again
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </>
  );
}
