import { getAnimeById } from "@/lib/anilist";
import { WatchClient } from "./client";

export async function generateMetadata({ params }) {
  const { id, ep } = await params;
  const anime = await getAnimeById(id);
  const title = anime.title.english || anime.title.romaji;
  return { title: `${title} Ep ${ep} — AniCult` };
}

export default async function WatchPage({ params }) {
  const { id, ep } = await params;
  const anime = await getAnimeById(id);
  const episodeNumber = parseInt(ep);
  const validEpisode =
    isNaN(episodeNumber) || episodeNumber <= 0 ? 1 : episodeNumber;
  return <WatchClient anime={anime} episode={validEpisode} />;
}
