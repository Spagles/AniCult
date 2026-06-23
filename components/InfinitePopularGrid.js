"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import AnimeCard from "./AnimeCard";
import { fetchPopularAnime } from "@/app/actions";

export default function InfinitePopularGrid({ initialAnime, pageInfo }) {
  const [animeList, setAnimeList] = useState(initialAnime);
  const [page, setPage] = useState(2); // Since page 1 is loaded initially
  const [loading, setLoading] = useState(false);
  const [hasNextPage, setHasNextPage] = useState(pageInfo?.hasNextPage);
  const loaderRef = useRef(null);

  const loadMore = useCallback(async () => {
    if (loading || !hasNextPage) return;
    setLoading(true);
    try {
      const data = await fetchPopularAnime(page);
      if (data) {
        setAnimeList((prev) => [...prev, ...data.media]);
        setHasNextPage(data.pageInfo.hasNextPage);
        setPage((prev) => prev + 1);
      }
    } catch (error) {
      console.error("Error loading more anime:", error);
    } finally {
      setLoading(false);
    }
  }, [loading, hasNextPage, page]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          loadMore();
        }
      },
      { rootMargin: "200px" }, // trigger load a bit before reaching the exact bottom
    );

    if (loaderRef.current) {
      observer.observe(loaderRef.current);
    }

    return () => observer.disconnect();
  }, [loadMore]);

  return (
    <>
      <div className="grid">
        {animeList.map((anime) => (
          <AnimeCard key={anime.id} anime={anime} />
        ))}
      </div>
      {hasNextPage && (
        <div
          ref={loaderRef}
          style={{
            textAlign: "center",
            padding: "2rem",
            color: "var(--text-muted, #888)",
          }}
        >
          {loading ? "Loading more..." : ""}
        </div>
      )}
    </>
  );
}
