// Vercel serverless function — generate Open Graph preview untuk setiap lagu.
// URL format: /track/{videoId}-{slug-judul-artis}
// Link crawler (WhatsApp/Twitter/Discord/dll) tidak menjalankan JS, jadi
// meta tag OG harus dikirim dari server di HTML awal, baru redirect ke SPA.

function extractVideoId(slugParam) {
  const value = Array.isArray(slugParam) ? slugParam[0] : slugParam || "";
  const match = value.match(/^([a-zA-Z0-9_-]{11})/);
  return match ? match[1] : "";
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

async function fetchTrackMeta(videoId) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch(`https://satriamusic.vercel.app/api/search?q=${encodeURIComponent(videoId)}`, {
      signal: controller.signal,
      headers: { accept: "application/json" },
    });

    if (response.ok) {
      const results = await response.json();
      const match = Array.isArray(results) ? results.find((item) => item?.videoId === videoId) : null;
      if (match) {
        const title = match.title || match.name || "Lagu di CodersMusic";
        const artist =
          (Array.isArray(match.artists) ? match.artists.map((entry) => entry?.name).filter(Boolean).join(", ") : "") ||
          match.artist ||
          "Unknown Artist";
        return { title, artist };
      }
    }
  } catch {
    // fall through to thumbnail-only fallback below
  } finally {
    clearTimeout(timeout);
  }

  return null;
}

export default async function handler(req, res) {
  const videoId = extractVideoId(req.query.slug);

  if (!videoId) {
    res.statusCode = 404;
    res.end("Lagu tidak ditemukan.");
    return;
  }

  const meta = await fetchTrackMeta(videoId);
  const title = meta ? `${meta.title} — ${meta.artist}` : "Dengarkan lagu ini di CodersMusic";
  const coverImage = `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`;
  const pageUrl = `https://${req.headers.host}/track/${encodeURIComponent(Array.isArray(req.query.slug) ? req.query.slug[0] : req.query.slug)}`;
  const appUrl = `/?play=${videoId}`;

  const safeTitle = escapeHtml(title);
  const safeImage = escapeHtml(coverImage);
  const safeUrl = escapeHtml(pageUrl);

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=600, s-maxage=3600");

  res.end(`<!doctype html>
<html lang="id">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${safeTitle} · CodersMusic</title>

  <meta property="og:type" content="music.song" />
  <meta property="og:title" content="${safeTitle}" />
  <meta property="og:description" content="Dengarkan dan putar langsung di CodersMusic." />
  <meta property="og:image" content="${safeImage}" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="1200" />
  <meta property="og:url" content="${safeUrl}" />
  <meta property="og:site_name" content="CodersMusic" />

  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${safeTitle}" />
  <meta name="twitter:description" content="Dengarkan dan putar langsung di CodersMusic." />
  <meta name="twitter:image" content="${safeImage}" />

  <meta http-equiv="refresh" content="0; url=${appUrl}" />
  <script>window.location.replace(${JSON.stringify(appUrl)});</script>
</head>
<body>
  <p>Membuka <a href="${appUrl}">${safeTitle}</a> di CodersMusic...</p>
</body>
</html>`);
}
