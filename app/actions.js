"use server";

import { getPopular } from "@/lib/anilist";

export async function fetchPopularAnime(page) {
  return await getPopular(page, 20);
}
