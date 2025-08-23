import { type } from "arktype";
// @ts-expect-error
import NewsAPI from "newsapi";

const Article = type({
	source: {
		id: "string|null",
		name: "string",
	},
	author: "string|null",
	title: "string",
	description: "string|null",
	url: "string.url",
	"urlToImage?": "string.url|null",
	publishedAt: "string",
	content: "string|null",
});

const Source = type({
	id: "string",
	name: "string",
	description: "string",
	url: "string.url",
	category: "string",
	language: "string",
	country: "string",
});

const ArticleResponse = type({
	status: "'ok'",
	totalResults: "number",
	articles: [Article, "[]"],
});

const SourcesResponse = type({
	status: "'ok'",
	sources: [Source, "[]"],
});

const NewsAPIResponse = ArticleResponse.or(SourcesResponse);

type TArticle = typeof Article.infer;
type TArticleResponse = typeof ArticleResponse.infer;
type TSourcesResponse = typeof SourcesResponse.infer;
type TNewsAPIResponse = typeof NewsAPIResponse.infer;

interface TestConfig {
	delayBetweenRequests: number;
	maxArticlesToShow: number;
}
const TEST_CONFIG: TestConfig = {
	delayBetweenRequests: 1000,
	maxArticlesToShow: 3,
};

const NEWS_API_KEY = import.meta.env.VITE_NEWS_API_KEY;
if (!NEWS_API_KEY) throw new Error("NEWS_API_KEY not set");
const newsapi = new NewsAPI(NEWS_API_KEY);

interface TopHeadlinesParams {
	sources?: string;
	q?: string;
	category?:
		| "business"
		| "entertainment"
		| "general"
		| "health"
		| "science"
		| "sports"
		| "technology";
	language?: string;
	country?: string;
	pageSize?: number;
}
interface EverythingParams {
	q?: string;
	sources?: string;
	domains?: string;
	excludeDomains?: string;
	from?: string;
	to?: string;
	language?: string;
	sortBy?: "relevancy" | "popularity" | "publishedAt";
	pageSize?: number;
	page?: number;
}
interface SourcesParams {
	category?:
		| "business"
		| "entertainment"
		| "general"
		| "health"
		| "science"
		| "sports"
		| "technology";
	language?: string;
	country?: string;
}

export { newsapi };
