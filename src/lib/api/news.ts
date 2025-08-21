import { type, Type } from "arktype";
import NewsAPI  from "newsapi";

// --- ArkType Schemas ---
const Article = type({
  source: {
    id: "string|null",
    name: "string",
  },
  author: "string|null",
  title: "string",
  description: "string|null",
  url: "string.url",
  "urlToImage?": "string.url|null", // can be missing/null in API
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

// ✅ Build union via .or(...) (NOT string interpolation)
const NewsAPIResponse = ArticleResponse.or(SourcesResponse);

// TS types inferred from ArkType
type TArticle = typeof Article.infer;
type TArticleResponse = typeof ArticleResponse.infer;
type TSourcesResponse = typeof SourcesResponse.infer;
type TNewsAPIResponse = typeof NewsAPIResponse.infer;

// --- Test Configuration ---
interface TestConfig {
  delayBetweenRequests: number;
  maxArticlesToShow: number;
}
const TEST_CONFIG: TestConfig = { delayBetweenRequests: 1000, maxArticlesToShow: 3 };

// --- API Initialization ---
const NEWS_API_KEY = import.meta.env.VITE_NEWS_API_KEY;
if (!NEWS_API_KEY) throw new Error("NEWS_API_KEY not set");
const newsapi = new NewsAPI(NEWS_API_KEY);

// --- Utils ---
const delay = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

function displayResults(testName: string, response: TNewsAPIResponse): void {
  console.log(`\n=== ${testName} ===`);
  console.log(`Status: ${response.status}`);

  if ("sources" in response) {
    const sources = response.sources;
    console.log(`Total sources: ${sources.length}`);
    console.log("Sample sources:", sources.slice(0, 3).map((s: TSourcesResponse["sources"][number]) => s.name));
    return;
  }

  // Here it's ArticleResponse (by elimination)
  const total = response.totalResults ?? response.articles.length;
  console.log(`Total articles: ${total}`);

  if (response.articles.length > 0) {
    console.log("\nSample articles:");
    response.articles
      .slice(0, TEST_CONFIG.maxArticlesToShow)
      .forEach((article: TArticle, index: number) => {
        console.log(`${index + 1}. ${article.title}`);
        console.log(`   Source: ${article.source.name}`);
        console.log(`   Published: ${article.publishedAt}`);
        console.log(`   URL: ${article.url}\n`);
      });
  }
}

// --- Refactored Test Runner (use .assert for v2) ---
async function runTest<T extends Type<any>>(
  testName: string,
  testFunction: () => Promise<unknown>,
  validator: T
): Promise<T["infer"] | null> {
  try {
    console.log(`\n🧪 Running: ${testName}`);
    const raw = await testFunction();               // unknown
    const parsed = validator.assert(raw);           // throws on invalid
    displayResults(testName, parsed as TNewsAPIResponse);
    return parsed;
  } catch (error) {
    const err = error as Error & { code?: string };
    console.error(`\n❌ Error in ${testName}:`, err.message);
    if (err.code) console.error(`Error code: ${err.code}`);
    return null;
  }
}

// --- Test Params (unchanged) ---
interface TopHeadlinesParams {
  sources?: string;
  q?: string;
  category?: "business" | "entertainment" | "general" | "health" | "science" | "sports" | "technology";
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
  category?: "business" | "entertainment" | "general" | "health" | "science" | "sports" | "technology";
  language?: string;
  country?: string;
}

// --- Main Test Suite ---
export async function runAllTests(): Promise<void> {
  console.log("🚀 Starting News API Tests");
  console.log(`Using API Key: ${NEWS_API_KEY!.slice(0, 8)}...`);

  await runTest("Top Headlines - General",
    () => newsapi.v2.topHeadlines({ language: "en", pageSize: 10 }),
    ArticleResponse);

  await delay(TEST_CONFIG.delayBetweenRequests);

  await runTest("Top Headlines - BBC & The Verge",
    () => newsapi.v2.topHeadlines({ sources: "bbc-news,the-verge", pageSize: 10 }),
    ArticleResponse);

  await delay(TEST_CONFIG.delayBetweenRequests);

  await runTest("Top Headlines - Technology Category",
    () => newsapi.v2.topHeadlines({ category: "technology", country: "us", pageSize: 10 }),
    ArticleResponse);

  await delay(TEST_CONFIG.delayBetweenRequests);

  await runTest("Top Headlines - Bitcoin Query",
    () => newsapi.v2.topHeadlines({ q: "bitcoin", language: "en", pageSize: 10 }),
    ArticleResponse);

  await delay(TEST_CONFIG.delayBetweenRequests);

  await runTest("Everything - AI Search",
    () => newsapi.v2.everything({ q: "artificial intelligence", language: "en", sortBy: "popularity", pageSize: 10 }),
    ArticleResponse);

  await delay(TEST_CONFIG.delayBetweenRequests);

  await runTest("Everything - Last Week Tech News",
    () => {
      const lastWeek = new Date(); lastWeek.setDate(lastWeek.getDate() - 7);
      return newsapi.v2.everything({
        q: "technology",
        from: lastWeek.toISOString().split("T")[0],
        language: "en",
        sortBy: "publishedAt",
        pageSize: 10,
      });
    },
    ArticleResponse);

  await delay(TEST_CONFIG.delayBetweenRequests);

  await runTest("Everything - TechCrunch & BBC",
    () => newsapi.v2.everything({ domains: "techcrunch.com,bbc.co.uk", q: "startup", language: "en", pageSize: 10 }),
    ArticleResponse);

  await delay(TEST_CONFIG.delayBetweenRequests);

  await runTest("Sources - All Available",
    () => newsapi.v2.sources({}),
    SourcesResponse);

  await delay(TEST_CONFIG.delayBetweenRequests);

  await runTest("Sources - Technology Category",
    () => newsapi.v2.sources({ category: "technology", language: "en" }),
    SourcesResponse);

  await delay(TEST_CONFIG.delayBetweenRequests);

  await runTest("Sources - US Sources",
    () => newsapi.v2.sources({ country: "us", language: "en" }),
    SourcesResponse);

  console.log("\n✅ All tests completed!");
}

// --- Performance Test (v2 assert style) ---
export async function performanceTest(): Promise<void> {
  console.log("\n⚡ Running Performance Test");
  const startTime = Date.now();
  try {
    const [headlinesRaw, everythingRaw, sourcesRaw] = await Promise.all([
      newsapi.v2.topHeadlines({ country: "us", pageSize: 5 }),
      newsapi.v2.everything({ q: "javascript", pageSize: 5 }),
      newsapi.v2.sources({ category: "technology" }),
    ]);

    const headlines = ArticleResponse.assert(headlinesRaw);
    const everything = ArticleResponse.assert(everythingRaw);
    const sources = SourcesResponse.assert(sourcesRaw);

    const endTime = Date.now();
    console.log(`✅ All 3 concurrent requests completed in ${endTime - startTime}ms`);
    console.log(`Top Headlines: ${headlines.status}`);
    console.log(`Everything Search: ${everything.status}`);
    console.log(`Sources: ${sources.status}`);
  } catch (error) {
    console.error("❌ Performance test failed:", (error as Error).message);
  }
}

// --- Individual Tests ---
export const individualTests = {
  testHeadlineSearch: async (query: string) =>
    runTest(`Headlines Search: "${query}"`,
      () => newsapi.v2.topHeadlines({ q: query, language: "en", pageSize: 5 }),
      ArticleResponse),

  testSource: async (sourceId: string) =>
    runTest(`Source: ${sourceId}`,
      () => newsapi.v2.topHeadlines({ sources: sourceId, pageSize: 5 }),
      ArticleResponse),

  testDateRange: async (query: string, daysBack = 7) => {
    const fromDate = new Date(); fromDate.setDate(fromDate.getDate() - daysBack);
    return runTest(
      `Date Range Search: "${query}" (${daysBack} days)`,
      () => newsapi.v2.everything({
        q: query,
        from: fromDate.toISOString().split("T")[0],
        language: "en",
        sortBy: "publishedAt",
        pageSize: 5,
      }),
      ArticleResponse
    );
  },
};

// // --- Main (unchanged) ---
// async function main(): Promise<void> {
//   if (NEWS_API_KEY === "your_api_key_here") {
//     console.log("⚠️ Please set your NEWS_API_KEY environment variable.");
//     return;
//   }

//   await runAllTests();
//   await performanceTest();

//   console.log("\n🎯 Running Individual Tests");
//   await individualTests.testHeadlineSearch("climate change");
//   await delay(TEST_CONFIG.delayBetweenRequests);
//   await individualTests.testSource("techcrunch");
//   await delay(TEST_CONFIG.delayBetweenRequests);
//   await individualTests.testDateRange("cryptocurrency", 3);
// }

export { newsapi };

// (async () =>  console.log(await main().catch(console.error)))()