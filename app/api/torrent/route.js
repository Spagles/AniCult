import { NextResponse } from "next/server";
import { addTorrent, getTorrent, removeTorrent } from "@/lib/torrent-client";

export async function POST(request) {
  try {
    const { magnet } = await request.json();
    if (!magnet) {
      return NextResponse.json(
        { error: "Missing magnet URI" },
        { status: 400 },
      );
    }

    console.log("[API /torrent] Adding torrent...");
    const torrent = await addTorrent(magnet);

    const files = torrent.files.map((f, i) => ({
      name: f.name,
      size: f.length,
      index: i,
      path: f.path,
    }));

    return NextResponse.json({
      infoHash: torrent.infoHash,
      name: torrent.name,
      files,
      totalSize: torrent.length,
    });
  } catch (error) {
    console.error("[API /torrent] Error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const hash = searchParams.get("hash");

  if (!hash) {
    return NextResponse.json(
      { error: "Missing hash parameter" },
      { status: 400 },
    );
  }

  const torrent = await getTorrent(hash);
  if (!torrent) {
    return NextResponse.json({ error: "Torrent not found" }, { status: 404 });
  }

  return NextResponse.json({
    infoHash: torrent.infoHash,
    name: torrent.name,
    progress: Math.round(torrent.progress * 100),
    downloadSpeed: torrent.downloadSpeed,
    uploadSpeed: torrent.uploadSpeed,
    numPeers: torrent.numPeers,
    downloaded: torrent.downloaded,
    total: torrent.length,
    ready: torrent.ready,
  });
}

export async function DELETE(request) {
  const { searchParams } = new URL(request.url);
  const hash = searchParams.get("hash");

  if (!hash) {
    return NextResponse.json(
      { error: "Missing hash parameter" },
      { status: 400 },
    );
  }

  await removeTorrent(hash);
  return NextResponse.json({ ok: true });
}
