import { getAnimeById } from "@/lib/anilist";
import { AnimeDetailClient } from "./client";

export async function generateMetadata({ params }) {
  const { id } = await params;
  const anime = await getAnimeById(id);
  const title = anime.title.english || anime.title.romaji;
  return { title: `${title} — AniCult` };
}

export default async function AnimeDetailPage({ params }) {
  const { id } = await params;
  const anime = await getAnimeById(id);
  return <AnimeDetailClient anime={anime} />;
}
