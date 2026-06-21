import Link from "next/link";
import { getTrending, getRecentlyUpdated, getPopular } from "@/lib/anilist";

function AnimeCard({ anime }) {
  const title = anime.title.english || anime.title.romaji;
  const image = anime.coverImage.extraLarge || anime.coverImage.large;
  const score = anime.averageScore;
  const format = anime.format;
  const ep = anime.nextAiringEpisode
    ? `Ep ${anime.nextAiringEpisode.episode - 1}`
    : anime.episodes
      ? `${anime.episodes} eps`
      : null;

  return (
    <Link href={`/anime/${anime.id}`} className="card" id={`card-${anime.id}`}>
      <div className="card-image">
        <img src={image} alt={title} loading="lazy" />
        {score && <span className="card-score">{score}%</span>}
        {format && <span className="card-format">{format}</span>}
        {ep && <span className="card-ep">{ep}</span>}
      </div>
      <div className="card-body">
        <div className="card-title">{title}</div>
      </div>
    </Link>
  );
}

export default async function HomePage() {
  const [trending, recent, popular] = await Promise.all([
    getTrending(1, 20),
    getRecentlyUpdated(1, 20),
    getPopular(1, 20),
  ]);

  const heroAnime = trending.media[0];
  const heroTitle = heroAnime?.title.english || heroAnime?.title.romaji;

  return (
    <>
      {heroAnime && (
        <div className="banner-section">
          <div
            className="banner-bg"
            style={{
              backgroundImage: `url(${heroAnime.bannerImage || heroAnime.coverImage.extraLarge})`,
            }}
          />
          <div className="banner-fade" />
          <div className="banner-content">
            <div className="banner-cover">
              <img
                src={
                  heroAnime.coverImage.extraLarge || heroAnime.coverImage.large
                }
                alt={heroTitle}
              />
            </div>
            <div className="banner-info">
              <div className="banner-title">{heroTitle}</div>
              {heroAnime.genres && (
                <div className="banner-genres">
                  {heroAnime.genres.slice(0, 4).map((g) => (
                    <span key={g}>{g}</span>
                  ))}
                </div>
              )}
              {heroAnime.description && (
                <div
                  className="banner-desc"
                  dangerouslySetInnerHTML={{
                    __html: heroAnime.description.replace(/<br\s*\/?>/g, " "),
                  }}
                />
              )}
              <div className="banner-actions">
                <Link
                  href={`/anime/${heroAnime.id}`}
                  className="btn btn-primary"
                >
                  View Details
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}

      <section className="section">
        <div className="section-header">
          <h2 className="section-title">Trending Now</h2>
          <Link href="/search?sort=TRENDING_DESC" className="section-link">
            View All
          </Link>
        </div>
        <div className="scroll-row">
          {trending.media.map((anime) => (
            <AnimeCard key={anime.id} anime={anime} />
          ))}
        </div>
      </section>

      <section className="section">
        <div className="section-header">
          <h2 className="section-title">Recently Updated</h2>
          <Link href="/search?sort=UPDATED_AT_DESC" className="section-link">
            View All
          </Link>
        </div>
        <div className="scroll-row">
          {recent.media.map((anime) => (
            <AnimeCard key={anime.id} anime={anime} />
          ))}
        </div>
      </section>

      <section className="section">
        <div className="section-header">
          <h2 className="section-title">All Time Popular</h2>
          <Link href="/search?sort=POPULARITY_DESC" className="section-link">
            View All
          </Link>
        </div>
        <div className="grid">
          {popular.media.slice(0, 12).map((anime) => (
            <AnimeCard key={anime.id} anime={anime} />
          ))}
        </div>
      </section>
    </>
  );
}
