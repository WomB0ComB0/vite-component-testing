// src/lib/client/news.ts

import { FetchHttpClient } from "@effect/platform";
import { Effect, pipe } from "effect";
import { get } from "@/effect-fetcher";

// — import your schemas from the same files you showed — //
import { GNewsResponse as GNewsResponseSchema } from "@/lib/api/gnews";
import { SearchRecommendation as SearchRecommendationSchema } from "@/lib/api/search";
import { YoutubeSearchResponse as YoutubeSearchResponseSchema } from "@/lib/api/youtube";

// GNews: search
export async function gnewsSearch(
	q: string,
	opts?: { lang?: string; max?: number },
) {
	const effect = pipe(
		get(
			"/api/gnews/search",
			{ schema: GNewsResponseSchema },
			{ q, lang: opts?.lang ?? "en", max: opts?.max ?? 5 },
		),
		Effect.provide(FetchHttpClient.layer),
	);
	const res = await Effect.runPromise(effect);
	if (!res) throw new Error("Invalid GNews response");
	return res;
}

// GNews: top headlines
export async function gnewsTopHeadlines(opts?: {
	lang?: string;
	country?: string;
	category?:
		| "technology"
		| "general"
		| "world"
		| "nation"
		| "business"
		| "entertainment"
		| "sports"
		| "science"
		| "health";
	max?: number;
}) {
	const effect = pipe(
		get(
			"/api/gnews/top-headlines",
			{ schema: GNewsResponseSchema },
			opts ?? {},
		),
		Effect.provide(FetchHttpClient.layer),
	);
	return Effect.runPromise(effect);
}

// Google CSE: returns your trimmed DTO (SearchRecommendation)
export async function googleSearch(q: string) {
	const effect = pipe(
		get(
			"/api/google/cse",
			{ schema: SearchRecommendationSchema },
			{ q, num: 10 },
		),
		Effect.provide(FetchHttpClient.layer),
	);
	const res = await Effect.runPromise(effect);
	if (!res) throw new Error("Invalid CSE response");
	return res;
}

// YouTube search
export async function youtubeSearch(q: string, pageToken?: string) {
	const effect = pipe(
		get(
			"/api/youtube/search",
			{ schema: YoutubeSearchResponseSchema },
			{ q, pageToken, maxResults: 10 },
		),
		Effect.provide(FetchHttpClient.layer),
	);
	const res = await Effect.runPromise(effect);
	if (!res) throw new Error("Invalid YouTube response");
	return res;
}
