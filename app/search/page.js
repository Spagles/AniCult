import Link from "next/link";
import { searchAnime, getTrending } from "@/lib/anilist";

export default async function SearchPage({ searchParams }) {
  const params = await searchParams;
  const q = params.q || "";
  const page = parseInt(params.page) || 1;
  const format = params.format || "";
  const sort = params.sort || (q ? "SEARCH_MATCH" : "TRENDING_DESC");

  let result;
  if (q) {
    result = await searchAnime(q, page, 24, format || null, sort);
  } else {
    result = await getTrending(page, 24);
  }

  const sortOptions = [
    { value: "SEARCH_MATCH", label: "Relevance" },
    { value: "TRENDING_DESC", label: "Trending" },
    { value: "POPULARITY_DESC", label: "Popularity" },
    { value: "SCORE_DESC", label: "Score" },
    { value: "START_DATE_DESC", label: "Newest" },
  ];

  const formatOptions = [
    { value: "", label: "All Formats" },
    { value: "TV", label: "TV" },
    { value: "MOVIE", label: "Movie" },
    { value: "OVA", label: "OVA" },
    { value: "ONA", label: "ONA" },
    { value: "SPECIAL", label: "Special" },
  ];

  function buildUrl(overrides) {
    const p = { q, page: String(page), format, sort, ...overrides };
    const sp = new URLSearchParams();
    Object.entries(p).forEach(([k, v]) => {
      if (v) sp.set(k, v);
    });
    return `/search?${sp.toString()}`;
  }

  return (
    <>
      <h1 className="section-title" style={{ marginBottom: 16 }}>
        {q ? `Results for "${q}"` : "Browse Anime"}
      </h1>

      <div className="filters">
        {sortOptions.map((opt) => (
          <Link
            key={opt.value}
            href={buildUrl({ sort: opt.value, page: "1" })}
            className={`btn btn-sm ${sort === opt.value ? "btn-primary" : "btn-outline"}`}
          >
            {opt.label}
          </Link>
        ))}
        <span style={{ color: "var(--text-dim)" }}>|</span>
        {formatOptions.map((opt) => (
          <Link
            key={opt.value}
            href={buildUrl({ format: opt.value, page: "1" })}
            className={`btn btn-sm ${format === opt.value ? "btn-primary" : "btn-outline"}`}
          >
            {opt.label}
          </Link>
        ))}
      </div>

      {result.media.length === 0 ? (
        <div className="empty">
          <div className="empty-title">No results found</div>
          <div className="empty-text">
            Try a different search term or filter
          </div>
        </div>
      ) : (
        <div className="grid grid-wide">
          {result.media.map((anime) => {
            const title = anime.title.english || anime.title.romaji;
            const image = anime.coverImage.extraLarge || anime.coverImage.large;
            const score = anime.averageScore;
            const ep = anime.nextAiringEpisode
              ? `Ep ${anime.nextAiringEpisode.episode - 1}`
              : anime.episodes
                ? `${anime.episodes} eps`
                : null;
            return (
              <Link
                href={`/anime/${anime.id}`}
                className="card"
                key={anime.id}
                id={`search-card-${anime.id}`}
              >
                <div className="card-image">
                  <img src={image} alt={title} loading="lazy" />
                  {score && <span className="card-score">{score}%</span>}
                  {anime.format && (
                    <span className="card-format">{anime.format}</span>
                  )}
                  {ep && <span className="card-ep">{ep}</span>}
                </div>
                <div className="card-body">
                  <div className="card-title">{title}</div>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {result.pageInfo && (
        <div className="pagination">
          {page > 1 && (
            <Link
              href={buildUrl({ page: String(page - 1) })}
              className="page-btn"
            >
              Previous
            </Link>
          )}
          {Array.from(
            { length: Math.min(result.pageInfo.lastPage || 1, 10) },
            (_, i) => i + 1,
          )
            .filter(
              (p) =>
                p === 1 ||
                p === (result.pageInfo.lastPage || 1) ||
                Math.abs(p - page) <= 2,
            )
            .map((p) => (
              <Link
                key={p}
                href={buildUrl({ page: String(p) })}
                className={`page-btn ${p === page ? "page-btn-active" : ""}`}
              >
                {p}
              </Link>
            ))}
          {result.pageInfo.hasNextPage && (
            <Link
              href={buildUrl({ page: String(page + 1) })}
              className="page-btn"
            >
              Next
            </Link>
          )}
        </div>
      )}
    </>
  );
}
