import { get } from "@/effect-schema-fetcher";
import { FetchHttpClient } from "@effect/platform";
import { type } from "arktype";
import { Effect, pipe } from "effect";

export const RawCse = type({
	"searchInformation?": {
		"totalResults?": "string",
		"searchTime?": "number",
		"formattedTotalResults?": "string",
		"formattedSearchTime?": "string",
	},
	"items?": [
		{
			"link?": "string",
			"title?": "string",
			"snippet?": "string",
			"pagemap?": {
				"cse_thumbnail?": [
					{
						"src?": "string",
						"width?": "string | number",
						"height?": "string | number",
					},
					"[]",
				],
			},
		},
		"[]",
	],
});
export type TRawCse = typeof RawCse.infer;

export const SearchRecommendation = type({
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
			"thumbnail?": { src: "string", width: "string", height: "string" },
		},
		"[]",
	],
});
export type TSearchRecommendation = typeof SearchRecommendation.infer;

const CSE_ENDPOINT = "https://customsearch.googleapis.com/customsearch/v1";
const API_KEY = import.meta.env.VITE_GOOGLE_API_KEY!;
const CX = import.meta.env.VITE_GOOGLE_SEARCH_ENGINE_ID!;

const truncate = (q: string, max = 100) =>
	q.length <= max ? q : q.slice(0, max - 3) + "...";

type SearchParams = {
	q: string;
	num?: number;
	start?: number;
	safe?: "off" | "active";
	lr?: string;
	siteSearch?: string;
	fields?: string;
};

async function search(
	query: string,
	opts: Omit<SearchParams, "q"> = {},
): Promise<TSearchRecommendation> {
	if (!API_KEY || !CX) throw new Error("Google API key or CX missing");

	const params: Record<string, string | number | undefined> = {
		key: API_KEY,
		cx: CX,
		q: truncate(query),
		num: opts.num ?? 10,
		start: opts.start,
		safe: opts.safe,
		lr: opts.lr,
		siteSearch: opts.siteSearch,
		fields:
			opts.fields ??
			"searchInformation(totalResults,searchTime,formattedTotalResults,formattedSearchTime),items(link,title,snippet,pagemap/cse_thumbnail)",
	};

	const effect = pipe(
		get(CSE_ENDPOINT, { schema: RawCse }, params),
		Effect.provide(FetchHttpClient.layer),
	);

	const raw: TRawCse = await Effect.runPromise(effect);

	const transformed = {
		info: {
			totalResults: raw.searchInformation?.totalResults ?? "0",
			searchTime: raw.searchInformation?.searchTime ?? 0,
			formattedTotalResults:
				raw.searchInformation?.formattedTotalResults ?? "0",
			formattedSearchTime: raw.searchInformation?.formattedSearchTime ?? "0",
		},
		items: (raw.items ?? []).map((it) => {
			const t = it?.pagemap?.cse_thumbnail?.[0];
			return {
				link: it?.link ?? "",
				title: it?.title ?? "No title",
				snippet: it?.snippet ?? "No snippet available",
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

	return SearchRecommendation.assert(transformed);
}
