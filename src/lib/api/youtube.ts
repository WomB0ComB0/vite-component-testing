import { get } from "@/effect-fetcher";
import { FetchHttpClient } from "@effect/platform";
import { type } from "arktype";
import { Effect, pipe } from "effect";

const YOUTUBE_API_KEY = import.meta.env.VITE_GOOGLE_API_KEY;

// ArkType schema for the YouTube API Search response
const ThumbnailDetail = type({
	url: "string.url",
	width: "number",
	height: "number",
});

const Thumbnails = type({
	default: ThumbnailDetail,
	medium: ThumbnailDetail,
	high: ThumbnailDetail,
});

const Snippet = type({
	publishedAt: "string",
	channelId: "string",
	title: "string",
	description: "string",
	thumbnails: Thumbnails,
	channelTitle: "string",
	liveBroadcastContent: "string",
});

const SearchResultId = type({
	kind: "string",
	videoId: "string",
});

const SearchResultItem = type({
	kind: "'youtube#searchResult'",
	etag: "string",
	id: SearchResultId,
	snippet: Snippet,
});

const PageInfo = type({
	totalResults: "number",
	resultsPerPage: "number",
});

export const YoutubeSearchResponse = type({
	kind: "'youtube#searchListResponse'",
	etag: "string",
	"nextPageToken?": "string",
	"prevPageToken?": "string",
	regionCode: "string",
	pageInfo: PageInfo,
	items: [SearchResultItem, "[]"],
});

// Infer the TypeScript type from the schema for static type checking
export type YoutubeSearchResponse = typeof YoutubeSearchResponse.infer;

/**
 * Searches YouTube videos by calling the YouTube Data API v3 endpoint directly.
 * The response is validated against the ArkType schema at runtime.
 */
export const searchYouTube = async (
	query: string,
	pageToken?: string,
): Promise<YoutubeSearchResponse> => {
	if (!YOUTUBE_API_KEY) {
		throw new Error("YouTube API key is missing");
	}

	const YOUTUBE_SEARCH_ENDPOINT =
		"https://www.googleapis.com/youtube/v3/search";

	const params: {
		part: string;
		q: string;
		type: string;
		maxResults: number;
		key: string;
		pageToken?: string;
	} = {
		part: "snippet",
		q: query,
		type: "video",
		maxResults: 10,
		key: YOUTUBE_API_KEY,
	};

	if (pageToken) params.pageToken = pageToken;

	try {
		const effect =
			pipe(
				get(
					YOUTUBE_SEARCH_ENDPOINT,
					{ schema: YoutubeSearchResponse },
					params
				),
				Effect.provide(FetchHttpClient.layer)
			)

		const res = await Effect.runPromise(effect)

		if (!res) {
			throw new Error(`Invalid API response from YouTube`);
		}

		return res;
	} catch (error) {
		if (Error.isError(error)) {
			throw new Error(`Error searching YouTube: ${error.message}`);
		}
		throw new Error(
			`Error searching YouTube: ${String(error)}`,
		);
	}
};

// // simple “main” using Effect to provide the fetch layer once
// const program = Effect.gen(function* () {
// 	const query = "TypeScript Effect tutorial";

// 	const firstPage = yield* Effect.tryPromise({
// 		try: () => searchYouTube(query),
// 		catch: (e) => new Error(`search failed: ${String(e)}`),
// 	});

// 	// Print the top results
// 	for (const item of firstPage.items) {
// 		// item.snippet, item.id.videoId, etc. come fully typed via ArkType inference
// 		console.log(
// 			`${item.snippet.title} — https://www.youtube.com/watch?v=${item.id.videoId}`
// 		);
// 	}

// 	return firstPage.nextPageToken;
// }).pipe(
// 	// Provide the platform HTTP client once at the edge
// 	Effect.provide(FetchHttpClient.layer)
// );

// // Run as a Promise (handy in Bun/Node scripts)
// Effect.runPromise(program).catch((err) => {
// 	console.error(err);
// 	process.exit(1);
// });
