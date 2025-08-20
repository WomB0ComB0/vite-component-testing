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
				// The '?' makes this property optional
				src: "string",
				width: "string",
				height: "string",
			},
		},
		"[]", // Specifies that 'items' is an array of the preceding object type
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
				totalResults: rawData.searchInformation?.totalResults || "0",
				searchTime: rawData.searchInformation?.searchTime || 0,
				formattedTotalResults:
					rawData.searchInformation?.formattedTotalResults || "0",
				formattedSearchTime:
					rawData.searchInformation?.formattedSearchTime || "0",
			},
			items:
				rawData.items?.map((item) => ({
					link: item.link || "",
					title: item.title || "No title",
					snippet: item.snippet || "No snippet available",
					thumbnail:
						item.pagemap?.cse_thumbnail?.[0] &&
						item.pagemap.cse_thumbnail[0].src
							? {
									src: item.pagemap.cse_thumbnail[0].src,
									width: item.pagemap.cse_thumbnail[0].width || "",
									height: item.pagemap.cse_thumbnail[0].height || "",
								}
							: undefined,
				})) || [],
		};

		// Validate the transformed data against the ArkType schema at runtime.
		const { data, problems } = SearchRecommendation(transformedData);

		if (problems) {
			// If validation fails, throw an error with details.
			throw new Error(`Invalid search response structure: ${problems}`);
		}

		// Return the validated, typesafe data.
		return data;
	} catch (error) {
		throw new Error(
			`Error performing search: ${Error.isError(error) ? error.message : String(error)}`,
		);
	}
};
