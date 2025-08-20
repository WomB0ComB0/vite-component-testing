/**
 * Copyright 2025 Mike Odnis
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { type Type, type } from "arktype";

const NewsAPI = require("newsapi");

// --- ArkType Schemas for News API responses ---

const Article = type({
	source: {
		id: "string | null",
		name: "string",
	},
	author: "string | null",
	title: "string",
	description: "string | null",
	url: "URL",
	urlToImage: "URL | null",
	publishedAt: "string",
	content: "string | null",
});

const Source = type({
	id: "string",
	name: "string",
	description: "string",
	url: "URL",
	category: "string",
	language: "string",
	country: "string",
});

const ArticleResponse = type({
	status: "'ok'",
	totalResults: "number",
	articles: [Article, "[]"],
});

const TopHeadlinesResponse = ArticleResponse;
const EverythingResponse = ArticleResponse;

const SourcesResponse = type({
	status: "'ok'",
	sources: [Source, "[]"],
});

const NewsAPIResponse = type(
	`${TopHeadlinesResponse} | ${EverythingResponse} | ${SourcesResponse}`,
);
type NewsAPIResponse = typeof NewsAPIResponse.infer;

// --- Test Configuration ---

interface TestConfig {
	delayBetweenRequests: number;
	maxArticlesToShow: number;
}

const TEST_CONFIG: TestConfig = {
	delayBetweenRequests: 1000,
	maxArticlesToShow: 3,
};

// --- API Initialization ---

const NEWS_API_KEY = Bun.env.NEWS_API_KEY;
const newsapi = new NewsAPI(NEWS_API_KEY);

// --- Utility Functions ---

const delay = (ms: number): Promise<void> =>
	new Promise((resolve) => setTimeout(resolve, ms));

const displayResults = (testName: string, response: NewsAPIResponse): void => {
	console.log(`\n=== ${testName} ===`);
	console.log(`Status: ${response.status}`);

	if ("sources" in response) {
		console.log(`Total sources: ${response.sources.length}`);
		console.log(
			"Sample sources:",
			response.sources.slice(0, 3).map((s) => s.name),
		);
	}

	if ("articles" in response) {
		console.log(
			`Total articles: ${response.totalResults || response.articles.length}`,
		);
		if (response.articles.length > 0) {
			console.log("\nSample articles:");
			response.articles
				.slice(0, TEST_CONFIG.maxArticlesToShow)
				.forEach((article, index) => {
					console.log(`${index + 1}. ${article.title}`);
					console.log(`   Source: ${article.source.name}`);
					console.log(`   Published: ${article.publishedAt}`);
					console.log(`   URL: ${article.url}\n`);
				});
		}
	}
};

// --- Refactored Test Runner with Runtime Validation ---

const runTest = async <T extends Type>(
	testName: string,
	testFunction: () => Promise<unknown>,
	validator: T,
): Promise<T["infer"] | null> => {
	try {
		console.log(`\n🧪 Running: ${testName}`);
		const response = await testFunction();

		const { data, problems } = validator(response);

		if (problems) {
			throw new Error(`API response validation failed: ${problems}`);
		}

		displayResults(testName, data);
		return data;
	} catch (error) {
		const err = error as Error & { code?: string };
		console.error(`\n❌ Error in ${testName}:`, err.message);
		if (err.code) console.error(`Error code: ${err.code}`);
		return null;
	}
};

// --- Test Parameters (interfaces remain useful for function params) ---
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

// --- Main Test Suite ---

export async function runAllTests(): Promise<void> {
	console.log("🚀 Starting News API Tests");
	console.log(`Using API Key: ${NEWS_API_KEY.substring(0, 8)}...`);

	// Test 1: Top Headlines - General
	await runTest(
		"Top Headlines - General",
		() => newsapi.v2.topHeadlines({ language: "en", pageSize: 10 }),
		TopHeadlinesResponse,
	);

	await delay(TEST_CONFIG.delayBetweenRequests);

	// Test 2: Top Headlines - Specific Sources
	await runTest(
		"Top Headlines - BBC & The Verge",
		() =>
			newsapi.v2.topHeadlines({ sources: "bbc-news,the-verge", pageSize: 10 }),
		TopHeadlinesResponse,
	);

	await delay(TEST_CONFIG.delayBetweenRequests);

	// Test 3: Top Headlines - Category
	await runTest(
		"Top Headlines - Technology Category",
		() =>
			newsapi.v2.topHeadlines({
				category: "technology",
				country: "us",
				pageSize: 10,
			}),
		TopHeadlinesResponse,
	);

	await delay(TEST_CONFIG.delayBetweenRequests);

	// Test 4: Top Headlines - Search Query
	await runTest(
		"Top Headlines - Bitcoin Query",
		() =>
			newsapi.v2.topHeadlines({ q: "bitcoin", language: "en", pageSize: 10 }),
		TopHeadlinesResponse,
	);

	await delay(TEST_CONFIG.delayBetweenRequests);

	// Test 5: Everything - General Search
	await runTest(
		"Everything - AI Search",
		() =>
			newsapi.v2.everything({
				q: "artificial intelligence",
				language: "en",
				sortBy: "popularity",
				pageSize: 10,
			}),
		EverythingResponse,
	);

	await delay(TEST_CONFIG.delayBetweenRequests);

	// Test 6: Everything - Date Range
	await runTest(
		"Everything - Last Week Tech News",
		() => {
			const lastWeek = new Date();
			lastWeek.setDate(lastWeek.getDate() - 7);
			return newsapi.v2.everything({
				q: "technology",
				from: lastWeek.toISOString().split("T")[0],
				language: "en",
				sortBy: "publishedAt",
				pageSize: 10,
			});
		},
		EverythingResponse,
	);

	await delay(TEST_CONFIG.delayBetweenRequests);

	// Test 7: Everything - Specific Domains
	await runTest(
		"Everything - TechCrunch & BBC",
		() =>
			newsapi.v2.everything({
				domains: "techcrunch.com,bbc.co.uk",
				q: "startup",
				language: "en",
				pageSize: 10,
			}),
		EverythingResponse,
	);

	await delay(TEST_CONFIG.delayBetweenRequests);

	// Test 8: Sources - All Available
	await runTest(
		"Sources - All Available",
		() => newsapi.v2.sources({}),
		SourcesResponse,
	);

	await delay(TEST_CONFIG.delayBetweenRequests);

	// Test 9: Sources - Technology Category
	await runTest(
		"Sources - Technology Category",
		() => newsapi.v2.sources({ category: "technology", language: "en" }),
		SourcesResponse,
	);

	await delay(TEST_CONFIG.delayBetweenRequests);

	// Test 10: Sources - By Country
	await runTest(
		"Sources - US Sources",
		() => newsapi.v2.sources({ country: "us", language: "en" }),
		SourcesResponse,
	);

	console.log("\n✅ All tests completed!");
}

// --- Performance Test Function (with validation) ---
export async function performanceTest(): Promise<void> {
	console.log("\n⚡ Running Performance Test");

	const startTime = Date.now();

	try {
		const promises: [Promise<unknown>, Promise<unknown>, Promise<unknown>] = [
			newsapi.v2.topHeadlines({ country: "us", pageSize: 5 }),
			newsapi.v2.everything({ q: "javascript", pageSize: 5 }),
			newsapi.v2.sources({ category: "technology" }),
		];

		const [headlinesRaw, everythingRaw, sourcesRaw] =
			await Promise.all(promises);

		const { data: headlines, problems: headlinesProblems } =
			TopHeadlinesResponse(headlinesRaw);
		const { data: everything, problems: everythingProblems } =
			EverythingResponse(everythingRaw);
		const { data: sources, problems: sourcesProblems } =
			SourcesResponse(sourcesRaw);

		if (headlinesProblems || everythingProblems || sourcesProblems) {
			throw new Error(
				`Validation failed:\n` +
					(headlinesProblems ? `TopHeadlines: ${headlinesProblems}\n` : "") +
					(everythingProblems ? `Everything: ${everythingProblems}\n` : "") +
					(sourcesProblems ? `Sources: ${sourcesProblems}\n` : ""),
			);
		}

		const endTime = Date.now();

		console.log(
			`✅ All 3 concurrent requests completed in ${endTime - startTime}ms`,
		);
		const testNames = ["Top Headlines", "Everything Search", "Sources"];
		[headlines, everything, sources].forEach((result, index) => {
			console.log(`${testNames[index]}: ${result.status}`);
		});
	} catch (error) {
		const err = error as Error;
		console.error("❌ Performance test failed:", err.message);
	}
}

// --- Individual Test Functions with Validation ---
export const individualTests = {
	testHeadlineSearch: async (query: string) => {
		return await runTest(
			`Headlines Search: "${query}"`,
			() => newsapi.v2.topHeadlines({ q: query, language: "en", pageSize: 5 }),
			TopHeadlinesResponse,
		);
	},

	testSource: async (sourceId: string) => {
		return await runTest(
			`Source: ${sourceId}`,
			() => newsapi.v2.topHeadlines({ sources: sourceId, pageSize: 5 }),
			TopHeadlinesResponse,
		);
	},

	testDateRange: async (query: string, daysBack: number = 7) => {
		const fromDate = new Date();
		fromDate.setDate(fromDate.getDate() - daysBack);

		return await runTest(
			`Date Range Search: "${query}" (${daysBack} days)`,
			() =>
				newsapi.v2.everything({
					q: query,
					from: fromDate.toISOString().split("T")[0],
					language: "en",
					sortBy: "publishedAt",
					pageSize: 5,
				}),
			EverythingResponse,
		);
	},
};

// --- Main Execution ---
async function main(): Promise<void> {
	if (NEWS_API_KEY === "your_api_key_here") {
		console.log("⚠️ Please set your NEWS_API_KEY environment variable.");
		return;
	}

	await runAllTests();
	await performanceTest();

	console.log("\n🎯 Running Individual Tests");
	await individualTests.testHeadlineSearch("climate change");
	await delay(TEST_CONFIG.delayBetweenRequests);
	await individualTests.testSource("techcrunch");
	await delay(TEST_CONFIG.delayBetweenRequests);
	await individualTests.testDateRange("cryptocurrency", 3);
}

export { newsapi };
