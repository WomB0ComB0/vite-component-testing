import { type } from "arktype";
import { customsearch_v1 } from "googleapis";

const SearchRecommendation = type({
	info: {
		totalResults: "string",
		searchTime: "number",
		formattedTotalResults: "string",
		formattedSearchTime: "string",
	},
	items: [
		{
			link: "string",
			title: "string",
			snippet: "string",
			"thumbnail?": {
				src: "string",
				width: "string",
				height: "string",
			},
		},
		"[]",
	],
});

// Infer the TypeScript type from the ArkType schema.
type SearchRecommendation = typeof SearchRecommendation.infer;

const GOOGLE_SEARCH_API_KEY = Bun.env.GOOGLE_API_KEY;
const GOOGLE_SEARCH_ENGINE_ID = Bun.env.GOOGLE_SEARCH_ENGINE_ID;

const customSearch = new customsearch_v1.Customsearch({
	key: GOOGLE_SEARCH_API_KEY,
});

/**
 * Truncates a query string to a maximum length
 */
function truncateQuery(query: string, maxLength = 100): string {
	if (query.length <= maxLength) return query;
	return query.substring(0, maxLength - 3) + "...";
}

/**
 * Performs a Google Custom Search and validates the response with ArkType.
 */
export const search = async (query: string): Promise<SearchRecommendation> => {
	if (!GOOGLE_SEARCH_API_KEY || !GOOGLE_SEARCH_ENGINE_ID) {
		throw new Error("Google Search API key or Search Engine ID is missing");
	}

	try {
		const truncatedQuery = truncateQuery(query);
		const res = await customSearch.cse.list({
			key: GOOGLE_SEARCH_API_KEY,
			cx: GOOGLE_SEARCH_ENGINE_ID,
			q: truncatedQuery,
		});

		const rawData = res.data;

		// Transform the raw, unpredictable API response into a clean, structured object.
		const transformedData = {
			info: {
				totalResults: rawData.searchInformation?.totalResults ?? "0",
				searchTime: rawData.searchInformation?.searchTime ?? 0,
				formattedTotalResults: rawData.searchInformation?.formattedTotalResults ?? "0",
				formattedSearchTime: rawData.searchInformation?.formattedSearchTime ?? "0",
			},
			items: (rawData.items ?? []).map((item) => {
				const t = item.pagemap?.cse_thumbnail?.[0];
				return {
					link: item.link ?? "",
					title: item.title ?? "No title",
					snippet: item.snippet ?? "No snippet available",
					// 👉 Only add the key if we actually have a thumbnail
					...(t?.src
						? {
							thumbnail: {
								src: String(t.src),
								width: String(t.width ?? ""),
								height: String(t.height ?? ""),
							},
						}
						: {}),
				};
			}),
		};

		// Validate the transformed data against the ArkType schema at runtime.
		const data = SearchRecommendation.assert(transformedData);

		if (!data) {
			// If validation fails, throw an error with details.
			throw new Error(`Invalid search response structure`);
		}

		// Return the validated, typesafe data.
		return data;
	} catch (error) {
		throw new Error(
			`Error performing search: ${Error.isError(error) ? error.message : String(error)}`,
		);
	}
};

// Helper to log and exit gracefully
// async function runTest() {
// 	const query = "OpenAI GPT-4 capabilities";
// 	console.log(`\nRunning search for: "${query}"\n`);

// 	try {
// 		const result = await search(query);

// 		// If this runs, `result` is fully validated
// 		console.log("✅ Validation passed. Parsed output:");
// 		console.log("Info:", result.info);
// 		console.log("Number of items:", result.items.length);

// 		result.items.forEach((it, idx) => {
// 			console.log(`\nResult #${idx + 1}`);
// 			console.log("Title: ", it.title);
// 			console.log("Link:  ", it.link);
// 			console.log("Snippet:", it.snippet);
// 			if (it.thumbnail) {
// 				console.log("Thumbnail:", it.thumbnail.src);
// 			}
// 		});
// 	} catch (err) {
// 		console.error("⛔ Search request failed or validation error:");
// 		console.error(err);
// 		process.exit(1); // Non-zero exit code for CI/test runners
// 	}
// }

// runTest();