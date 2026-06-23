import Link from "next/link";

export default function AnimeCard({ anime }) {
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
