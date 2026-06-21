const ANILIST_URL = "https://graphql.anilist.co";

const MEDIA_FIELDS = `
  id
  title {
    romaji
    english
    native
  }
  coverImage {
    extraLarge
    large
    color
  }
  bannerImage
  description
  genres
  format
  status
  episodes
  duration
  season
  seasonYear
  averageScore
  popularity
  trending
  studios(isMain: true) {
    nodes {
      name
    }
  }
  nextAiringEpisode {
    airingAt
    episode
  }
  relations {
    edges {
      relationType
      node {
        id
        title {
          romaji
          english
        }
        coverImage {
          large
        }
        format
        status
        episodes
        averageScore
      }
    }
  }
`;

const MEDIA_FIELDS_SMALL = `
  id
  title {
    romaji
    english
  }
  coverImage {
    extraLarge
    large
    color
  }
  format
  status
  episodes
  averageScore
  season
  seasonYear
  nextAiringEpisode {
    airingAt
    episode
  }
`;

async function query(q, variables = {}) {
  const res = await fetch(ANILIST_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query: q, variables }),
    next: { revalidate: 300 },
  });
  if (!res.ok) throw new Error(`AniList API error: ${res.status}`);
  const json = await res.json();
  if (json.errors) throw new Error(json.errors[0].message);
  return json.data;
}

export async function getTrending(page = 1, perPage = 20) {
  const q = `
    query ($page: Int, $perPage: Int) {
      Page(page: $page, perPage: $perPage) {
        pageInfo { total currentPage lastPage hasNextPage }
        media(type: ANIME, sort: TRENDING_DESC) {
          ${MEDIA_FIELDS_SMALL}
        }
      }
    }
  `;
  const data = await query(q, { page, perPage });
  return data.Page;
}

export async function getPopular(page = 1, perPage = 20) {
  const q = `
    query ($page: Int, $perPage: Int) {
      Page(page: $page, perPage: $perPage) {
        pageInfo { total currentPage lastPage hasNextPage }
        media(type: ANIME, sort: POPULARITY_DESC) {
          ${MEDIA_FIELDS_SMALL}
        }
      }
    }
  `;
  const data = await query(q, { page, perPage });
  return data.Page;
}

export async function getRecentlyUpdated(page = 1, perPage = 20) {
  const q = `
    query ($page: Int, $perPage: Int) {
      Page(page: $page, perPage: $perPage) {
        pageInfo { total currentPage lastPage hasNextPage }
        airingSchedules(sort: TIME_DESC, notYetAired: false) {
          episode
          airingAt
          media {
            ${MEDIA_FIELDS_SMALL}
          }
        }
      }
    }
  `;
  const data = await query(q, { page, perPage });
  const seen = new Set();
  const unique = [];
  for (const schedule of data.Page.airingSchedules) {
    if (schedule.media && !seen.has(schedule.media.id)) {
      seen.add(schedule.media.id);
      unique.push({ ...schedule.media, latestEpisode: schedule.episode });
    }
  }
  return { media: unique, pageInfo: data.Page.pageInfo };
}

export async function searchAnime(
  searchQuery,
  page = 1,
  perPage = 20,
  format = null,
  sort = "SEARCH_MATCH",
) {
  const q = `
    query ($page: Int, $perPage: Int, $search: String, $format: MediaFormat, $sort: [MediaSort]) {
      Page(page: $page, perPage: $perPage) {
        pageInfo { total currentPage lastPage hasNextPage }
        media(type: ANIME, search: $search, format: $format, sort: $sort) {
          ${MEDIA_FIELDS_SMALL}
        }
      }
    }
  `;
  const variables = { page, perPage, search: searchQuery, sort: [sort] };
  if (format) variables.format = format;
  const data = await query(q, variables);
  return data.Page;
}

export async function getAnimeById(id) {
  const q = `
    query ($id: Int) {
      Media(id: $id, type: ANIME) {
        ${MEDIA_FIELDS}
      }
    }
  `;
  const data = await query(q, { id: parseInt(id) });
  return data.Media;
}

export async function getAnimeByIds(ids) {
  if (!ids.length) return [];
  const q = `
    query ($ids: [Int]) {
      Page(page: 1, perPage: 50) {
        media(type: ANIME, id_in: $ids) {
          ${MEDIA_FIELDS_SMALL}
        }
      }
    }
  `;
  const data = await query(q, { ids: ids.map((i) => parseInt(i)) });
  return data.Page.media;
}
