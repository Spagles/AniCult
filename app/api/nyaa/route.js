import { NextResponse } from "next/server";

const TRACKERS = [
  "http://nyaa.tracker.wf:7777/announce",
  "udp://open.stealth.si:80/announce",
  "udp://tracker.opentrackr.org:1337/announce",
  "udp://exodus.desync.com:6969/announce",
  "udp://tracker.torrent.eu.org:451/announce",
];

function buildMagnet(infoHash, title) {
  const parts = [`magnet:?xt=urn:btih:${infoHash}`];
  parts.push(`&dn=${encodeURIComponent(title)}`);
  TRACKERS.forEach((tr) => parts.push(`&tr=${encodeURIComponent(tr)}`));
  return parts.join("");
}

function parseRSS(xml) {
  const items = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match;

  while ((match = itemRegex.exec(xml)) !== null) {
    const content = match[1];

    // Extract tag content, supporting both CDATA and plain text
    const get = (tag) => {
      const escaped = tag.replace(":", "\\:");
      const re = new RegExp(
        `<${escaped}>(?:<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>|([\\s\\S]*?))<\\/${escaped}>`,
      );
      const m = content.match(re);
      return m ? (m[1] || m[2] || "").trim() : "";
    };

    const infoHash = get("nyaa:infoHash");
    const title = get("title");

    if (!infoHash) continue;

    items.push({
      title,
      link: get("link"),
      pubDate: get("pubDate"),
      seeders: parseInt(get("nyaa:seeders")) || 0,
      leechers: parseInt(get("nyaa:leechers")) || 0,
      downloads: parseInt(get("nyaa:downloads")) || 0,
      infoHash,
      size: get("nyaa:size"),
      category: get("nyaa:category"),
      trusted: get("nyaa:trusted") === "Yes",
      remake: get("nyaa:remake") === "Yes",
      magnet: buildMagnet(infoHash, title),
    });
  }

  return items;
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q");
  const category = searchParams.get("c") || "1_2"; // Default: Anime English-translated
  const filter = searchParams.get("f") || "0"; // Default: No filter

  if (!q) {
    return NextResponse.json(
      { error: "Missing q parameter" },
      { status: 400 },
    );
  }

  try {
    const url = `https://nyaa.si/?page=rss&c=${category}&f=${filter}&q=${encodeURIComponent(q)}`;
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
      next: { revalidate: 60 }, // Cache for 1 minute
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: `Nyaa.si returned status ${res.status}` },
        { status: 502 },
      );
    }

    const xml = await res.text();
    const results = parseRSS(xml);

    // Sort by seeders descending
    results.sort((a, b) => b.seeders - a.seeders);

    return NextResponse.json({ results });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
