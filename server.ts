// server.ts
import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import { Effect, pipe } from "effect";
import { FetchHttpClient } from "@effect/platform";
import { get } from "./src/effect-fetcher";

// ── IMPORT YOUR SCHEMAS (as requested) ───────────────────────────
// GNews
import {
  GNewsResponse as GNewsResponseSchema,
} from "./src/lib/api/gnews"; // adjust path if needed

import { RawCse, SearchRecommendation } from "./src/lib/api/search";

// YouTube
import {
  YoutubeSearchResponse as YoutubeSearchResponseSchema,
} from "./src/lib/api/youtube";

// ── ENV (server-side only) ───────────────────────────────────────
const GNEWS_API_KEY = process.env.VITE_GNEWS_API_KEY!;
const GOOGLE_API_KEY = process.env.VITE_GOOGLE_API_KEY!;
const GOOGLE_CSE_CX = process.env.VITE_GOOGLE_SEARCH_ENGINE_ID!;
const YT_API_KEY = GOOGLE_API_KEY;

if (!GNEWS_API_KEY) throw new Error("Missing GNEWS_API_KEY");
if (!GOOGLE_API_KEY) throw new Error("Missing GOOGLE_API_KEY");
if (!GOOGLE_CSE_CX) throw new Error("Missing GOOGLE_SEARCH_ENGINE_ID");

// ── CONSTANTS ────────────────────────────────────────────────────
const GNEWS_BASE = "https://gnews.io/api/v4";
const CSE_ENDPOINT = "https://customsearch.googleapis.com/customsearch/v1";
const YT_SEARCH_ENDPOINT = "https://www.googleapis.com/youtube/v3/search";

// ── HELPERS: run Effect get() with Fetch layer ───────────────────
function run<A, E>(eff: Effect.Effect<A, E, never>): Promise<A>;
function run<A, E>(eff: Effect.Effect<A, E, HttpClient>): Promise<A>;
function run<A, E, R>(eff: Effect.Effect<A, E, R>): Promise<A> {
  const provided = (eff as Effect.Effect<A, E, HttpClient | never>)
    .pipe(Effect.provide(FetchHttpClient.layer));
  return Effect.runPromise(provided as Effect.Effect<A, E, never>);
}

// ── GOOGLE CLOUD VISION (reverse image) ──────────────────────────
import vision from "@google-cloud/vision";
import { HttpClient } from "@effect/platform/HttpClient";
const client = new vision.ImageAnnotatorClient({
  keyFilename: "./credentials.json",
});
function normalizeWebDetection(res: any) {
  const web = res?.webDetection ?? {};
  return {
    webEntities: (web.webEntities ?? []).map((e: any) => ({
      description: e.description,
      score: e.score,
    })),
    fullMatchingImages: (web.fullMatchingImages ?? []).map((i: any) => ({
      url: i.url ?? "",
    })),
    partialMatchingImages: (web.partialMatchingImages ?? []).map((i: any) => ({
      url: i.url ?? "",
    })),
    pagesWithMatchingImages: (web.pagesWithMatchingImages ?? []).map((p: any) => ({
      url: p.url ?? "",
      pageTitle: p.pageTitle,
    })),
  };
}

const app = new Elysia()
  // Allow your SPA origin; add prod origin(s) too
  .use(
    cors({
      origin: ["http://localhost:5173"],
      methods: ["GET", "POST", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization"],
      credentials: true,
    })
  )

  // ───────────────────────────────────────────────────────────────
  // GOOGLE CLOUD VISION: /api/reverse-image
  // ───────────────────────────────────────────────────────────────
  .post("/api/reverse-image", async ({ request }) => {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return new Response(JSON.stringify({ error: "No file provided" }), { status: 400 });
    }
    if (!/^image\//.test(file.type)) {
      return new Response(JSON.stringify({ error: "Unsupported media type" }), { status: 415 });
    }
    const ab = await file.arrayBuffer();
    const content = Buffer.from(ab);

    const [res] = await client.webDetection({ image: { content } });
    const data = normalizeWebDetection(res);

    return new Response(JSON.stringify({ ok: true, data }), {
      headers: { "content-type": "application/json" },
    });
  })

  // ───────────────────────────────────────────────────────────────
  // GNEWS: /api/gnews/search
  // Docs: https://docs.gnews.io/endpoints/search-endpoint
  // q, lang, country, max, from, to, sortby=publishedAt|relevance, in, nullable
  // ───────────────────────────────────────────────────────────────
  .get("/api/gnews/search", async ({ query }) => {
    const p = query as Record<string, string>;
    const params = {
      apikey: GNEWS_API_KEY,
      q: p.q ?? "",
      lang: p.lang,
      country: p.country,
      max: p.max,
      in: p.in,
      nullable: p.nullable,
      from: p.from,
      to: p.to,
      sortby: p.sortby as "relevance" | "publishedAt" | undefined,
    };

    const eff = pipe(
      get(`${GNEWS_BASE}/search`, { schema: GNewsResponseSchema }, params)
    );

    const res = await run(eff);
    return new Response(JSON.stringify(res), {
      headers: { "content-type": "application/json" },
    });
  })

  // ───────────────────────────────────────────────────────────────
  // GNEWS: /api/gnews/top-headlines
  // Docs overview: https://docs.gnews.io/
  // lang, country, max, nullable, category
  // ───────────────────────────────────────────────────────────────
  .get("/api/gnews/top-headlines", async ({ query }) => {
    const p = query as Record<string, string>;
    const params = {
      apikey: GNEWS_API_KEY,
      lang: p.lang,
      country: p.country,
      max: p.max,
      nullable: p.nullable,
      category: p.category as
        | "general"
        | "world"
        | "nation"
        | "business"
        | "technology"
        | "entertainment"
        | "sports"
        | "science"
        | "health"
        | undefined,
    };

    const eff = pipe(
      get(`${GNEWS_BASE}/top-headlines`, { schema: GNewsResponseSchema }, params)
    );

    const res = await run(eff);
    return new Response(JSON.stringify(res), {
      headers: { "content-type": "application/json" },
    });
  })

  // ───────────────────────────────────────────────────────────────
  // GOOGLE CSE: /api/google/cse
  // Docs: https://developers.google.com/custom-search/v1/overview
  // key, cx, q, num, start, fields, etc.
  // ───────────────────────────────────────────────────────────────
.get("/api/google/cse", async ({ query }) => {
  try {
    const p = query as Record<string, string>;
    const fields =
      p.fields ??
      "searchInformation(totalResults,searchTime,formattedTotalResults,formattedSearchTime),items(link,title,snippet,pagemap/cse_thumbnail)";

    const params = {
      key: GOOGLE_API_KEY,
      cx: GOOGLE_CSE_CX,
      q: p.q ?? "",
      num: p.num ?? "10",
      start: p.start,
      safe: p.safe,
      lr: p.lr,
      siteSearch: p.siteSearch,
      fields,
    };

    // validate RAW response first
    const raw = await run(
      pipe(get(CSE_ENDPOINT, { schema: RawCse }, params))
    );

    // map RAW -> trimmed
    const transformed = {
      info: {
        totalResults: raw.searchInformation?.totalResults ?? "0",
        searchTime: raw.searchInformation?.searchTime ?? 0,
        formattedTotalResults: raw.searchInformation?.formattedTotalResults ?? "0",
        formattedSearchTime: raw.searchInformation?.formattedSearchTime ?? "0",
      },
      items: (raw.items ?? []).map((it) => {
        const t = it?.pagemap?.cse_thumbnail?.[0];
        return {
          link: it?.link ?? "",
          title: it?.title ?? "No title",
          snippet: it?.snippet ?? "No snippet available",
          ...(t?.src ? { thumbnail: {
            src: String(t.src),
            width: String(t.width ?? ""),
            height: String(t.height ?? "")
          }} : {})
        };
      })
    };

    // assert final shape, return that to the client
    const ok = SearchRecommendation.assert(transformed);
    return new Response(JSON.stringify(ok), {
      headers: { "content-type": "application/json" },
    });
  } catch (e: any) {
    console.error("CSE error:", e);
    return new Response(JSON.stringify({
      error: "Google CSE failed",
      details: e?.message ?? String(e)
    }), { status: 502, headers: { "content-type": "application/json" } });
  }
})

  // ───────────────────────────────────────────────────────────────
  // YOUTUBE: /api/youtube/search
  // Docs: https://developers.google.com/youtube/v3/docs/search/list
  // part=snippet, q, type=video, maxResults, pageToken
  // ───────────────────────────────────────────────────────────────
  .get("/api/youtube/search", async ({ query }) => {
    const p = query as Record<string, string>;
    const params = {
      key: YT_API_KEY,
      part: "snippet",
      q: p.q ?? "",
      type: "video", // restrict to videos only
      maxResults: p.maxResults ?? "10",
      pageToken: p.pageToken,
    };

    const eff = pipe(
      get(YT_SEARCH_ENDPOINT, { schema: YoutubeSearchResponseSchema }, params)
    );

    const res = await run(eff);
    return new Response(JSON.stringify(res), {
      headers: { "content-type": "application/json" },
    });
  });

app.listen(3_000);
console.log("→ http://localhost:3000");
