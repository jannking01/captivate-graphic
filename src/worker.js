// Serves the Create Your Graphic page and keeps the total number of graphics made.
//   GET  /create-your-graphic/api/count -> { total }
//   POST /create-your-graphic/api/count -> adds one, returns { total }
// Everything else is the static files in /public.

const COUNTER = "captivate";
let tableReady = false;

async function ensureTable(env) {
  if (tableReady) return;
  await env.DB.batch([
    env.DB.prepare("CREATE TABLE IF NOT EXISTS graphic_counter (id TEXT PRIMARY KEY, total INTEGER NOT NULL DEFAULT 0)"),
    env.DB.prepare("INSERT OR IGNORE INTO graphic_counter (id, total) VALUES (?, 0)").bind(COUNTER),
  ]);
  tableReady = true;
}

const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status, headers: { "content-type": "application/json", "cache-control": "no-store" },
});

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // The plural address sends people to the real one
    if (url.pathname === "/create-your-graphics" || url.pathname.startsWith("/create-your-graphics/")) {
      url.pathname = url.pathname.replace("/create-your-graphics", "/create-your-graphic");
      if (url.pathname === "/create-your-graphic") url.pathname += "/";
      return Response.redirect(url.toString(), 301);
    }

    if (url.pathname === "/create-your-graphic/api/count") {
      await ensureTable(env);

      if (request.method === "GET") {
        const row = await env.DB.prepare("SELECT total FROM graphic_counter WHERE id = ?").bind(COUNTER).first();
        return json({ total: row ? row.total : 0 });
      }

      if (request.method === "POST") {
        // Only count downloads made from this page
        // Some phone and in-app browsers send no Origin or "null"; only block clearly foreign sites
        const origin = request.headers.get("Origin");
        if (origin && origin !== "null") {
          let host = null;
          try { host = new URL(origin).host; } catch (e) {}
          if (host && host !== url.host) return json({ error: "forbidden" }, 403);
        }
        const row = await env.DB.prepare("UPDATE graphic_counter SET total = total + 1 WHERE id = ? RETURNING total")
          .bind(COUNTER).first();
        return json({ total: row ? row.total : 0 });
      }

      return json({ error: "method not allowed" }, 405);
    }

    return env.ASSETS.fetch(request);
  },
};
