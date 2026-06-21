import { getTorrent } from "@/lib/torrent-client";
import { Readable } from "stream";

function getMimeType(filename) {
  const ext = filename.split(".").pop().toLowerCase();
  const types = {
    mp4: "video/mp4",
    mkv: "video/x-matroska",
    webm: "video/webm",
    avi: "video/x-msvideo",
    m4v: "video/mp4",
    ogv: "video/ogg",
  };
  return types[ext] || "application/octet-stream";
}

// Opt out of static generation — this route is fully dynamic
export const dynamic = "force-dynamic";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const hash = searchParams.get("hash");
  const fileIndex = parseInt(searchParams.get("file") || "0");

  if (!hash) {
    return new Response("Missing hash parameter", { status: 400 });
  }

  const torrent = await getTorrent(hash);
  if (!torrent) {
    return new Response("Torrent not found. It may have been evicted.", {
      status: 404,
    });
  }

  const file = torrent.files[fileIndex];
  if (!file) {
    return new Response("File not found at that index", { status: 404 });
  }

  // Prioritize this file for download
  file.select();

  const fileSize = file.length;
  const mimeType = getMimeType(file.name);
  const range = request.headers.get("range");

  if (range) {
    const parts = range.replace(/bytes=/, "").split("-");
    const start = parseInt(parts[0]);
    // Limit chunk size to 2MB to prevent memory issues
    const requestedEnd = parts[1] ? parseInt(parts[1]) : start + 2 * 1024 * 1024 - 1;
    const end = Math.min(requestedEnd, fileSize - 1);
    const chunkSize = end - start + 1;

    try {
      const nodeStream = file.createReadStream({ start, end });
      const webStream = Readable.toWeb(nodeStream);

      return new Response(webStream, {
        status: 206,
        headers: {
          "Content-Range": `bytes ${start}-${end}/${fileSize}`,
          "Accept-Ranges": "bytes",
          "Content-Length": String(chunkSize),
          "Content-Type": mimeType,
          "Cache-Control": "no-cache",
        },
      });
    } catch (err) {
      return new Response(`Stream error: ${err.message}`, { status: 500 });
    }
  }

  // Full file response (no Range header)
  try {
    const nodeStream = file.createReadStream();
    const webStream = Readable.toWeb(nodeStream);

    return new Response(webStream, {
      headers: {
        "Content-Length": String(fileSize),
        "Content-Type": mimeType,
        "Accept-Ranges": "bytes",
        "Cache-Control": "no-cache",
      },
    });
  } catch (err) {
    return new Response(`Stream error: ${err.message}`, { status: 500 });
  }
}
