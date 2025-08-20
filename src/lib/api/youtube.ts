import { type } from "arktype";
import axios from "axios";

const YOUTUBE_API_KEY = Bun.env.GOOGLE_API_KEY;

// ArkType schema for the YouTube API Search response
const ThumbnailDetail = type({
	url: "URL",
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
	nextPageToken: "string|undefined",
	prevPageToken: "string|undefined",
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

	if (pageToken) {
		params.pageToken = pageToken;
	}

	try {
		const response = await axios.get(YOUTUBE_SEARCH_ENDPOINT, { params });

		// Validate the response data at runtime
		const { data: validatedData, problems } = YoutubeSearchResponse(
			response.data,
		);

		if (problems) {
			// If the data doesn't match the expected shape, throw an error
			throw new Error(`Invalid API response from YouTube: ${problems}`);
		}

		// Return the validated, typesafe data
		return validatedData;
	} catch (error) {
		// Provide more specific error details if available from axios
		if (axios.isAxiosError(error)) {
			const errorDetails =
				error.response?.data?.error?.message || error.message;
			throw new Error(`Error searching YouTube: ${errorDetails}`);
		}
		// Fallback for other types of errors
		throw new Error(
			`Error searching YouTube: ${error instanceof Error ? error.message : String(error)}`,
		);
	}
};
