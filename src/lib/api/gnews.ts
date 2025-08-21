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

import { get } from "@/effect-fetcher";
import { FetchHttpClient } from "@effect/platform";
import { type } from "arktype";
import { Effect, pipe } from "effect";

// ArkType definitions for GNews API
const Article = type({
	title: "string",
	description: "string",
	content: "string",
	url: "string",
	image: "string",
	publishedAt: "string",
	source: {
		name: "string",
		url: "string",
	},
});

const GNewsResponse = type({
	totalArticles: "number",
	articles: [Article, "[]"],
});

const GNewsError = type({
	errors: "string[]",
});

// Infer TypeScript types from ArkType definitions
type Article = typeof Article.infer;
type GNewsResponse = typeof GNewsResponse.infer;

class GNewsAPI {
	private apiKey: string;
	private baseUrl: string = "https://gnews.io/api/v4";

	constructor() {
		const apiKey = import.meta.env.VITE_GNEWS_API_KEY;
		if (!apiKey) {
			throw new Error("GNEWS_API_KEY environment variable is required");
		}
		this.apiKey = apiKey;
	}

	/**
	 * Search for articles
	 */
	async search(params: {
		q: string;
		lang?: string;
		country?: string;
		max?: number;
		in?: string;
		nullable?: string;
		from?: string;
		to?: string;
		sortby?: "relevance" | "publishedAt";
	}): Promise<GNewsResponse> {
		try {
			const effect = pipe(
				get(
					`${this.baseUrl}/search`,
					{ schema: GNewsResponse, retries: 1, retryDelay: 500 },
					{
						apikey: this.apiKey,
						q: params.q,
						lang: params.lang,
						country: params.country,
						max: params.max,
						in: params.in,
						nullable: params.nullable,
						from: params.from,
						to: params.to,
						sortby: params.sortby
					}
				),
				Effect.provide(FetchHttpClient.layer)
			);

			return await Effect.runPromise(effect); // already validated to GNewsResponse
		} catch (err) {
			// Optional: nicer logs for your custom errors
			console.error("Search request failed:", err);
			throw err;
		}
	}

	/**
	 * Get top headlines
	 */
  async getTopHeadlines(params?: {
    lang?: string;
    country?: string;
    max?: number;
    nullable?: string;
    category?:
      | "general"
      | "world"
      | "nation"
      | "business"
      | "technology"
      | "entertainment"
      | "sports"
      | "science"
      | "health";
  }): Promise<GNewsResponse> {
    const effect = pipe(
      get(
        `${this.baseUrl}/top-headlines`,
        {
          schema: GNewsResponse,
          retries: 1,
          retryDelay: 500,
          timeout: 10_000,
        },
        {
          apikey: this.apiKey,
          lang: params?.lang,
          country: params?.country,
          max: params?.max,
          nullable: params?.nullable,
          category: params?.category,
        }
      ),
      // provide the HTTP client once at the edge
      Effect.provide(FetchHttpClient.layer)
    );

    return Effect.runPromise(effect);
  }


	/**
	 * Helper method to display articles in a formatted way
	 */
	displayArticles(articles: Article[], maxArticles: number = 5): void {
		console.log(
			`\n📰 Displaying ${Math.min(articles.length, maxArticles)} articles:\n`,
		);

		articles.slice(0, maxArticles).forEach((article, index) => {
			console.log(`${index + 1}. ${article.title}`);
			console.log(`   Source: ${article.source.name}`);
			console.log(
				`   Published: ${new Date(article.publishedAt).toLocaleDateString()}`,
			);
			console.log(`   URL: ${article.url}`);
			if (article.description) {
				console.log(
					`   Description: ${article.description.substring(0, 150)}...`,
				);
			}
			console.log("   " + "─".repeat(80));
		});
	}
}

// // Test function
// async function testGNewsAPI() {
//   try {
//     const gnews = new GNewsAPI();

//     console.log('🔍 Testing GNews API...\n');

//     // Test 1: Search for specific topic
//     console.log('1️⃣ Testing search endpoint...');
//     const searchResults = await gnews.search({
//       q: 'artificial intelligence',
//       lang: 'en',
//       max: 5,
//       sortby: 'publishedAt',
//     });

//     console.log(`Found ${searchResults.totalArticles} articles about AI`);
//     gnews.displayArticles(searchResults.articles, 3);

//     // Test 2: Get top headlines
//     console.log('\n2️⃣ Testing top headlines endpoint...');
//     const headlines = await gnews.getTopHeadlines({
//       category: 'technology',
//       lang: 'en',
//       max: 5,
//     });

//     console.log(`Found ${headlines.totalArticles} top technology headlines`);
//     gnews.displayArticles(headlines.articles, 3);

//     // Test 3: Search with date range (last 7 days)
//     console.log('\n3️⃣ Testing search with date range...');
//     const sevenDaysAgo = new Date();
//     sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

//     const recentNews = await gnews.search({
//       q: 'climate change',
//       lang: 'en',
//       from: sevenDaysAgo.toISOString().split('T')[0],
//       max: 3,
//       sortby: 'publishedAt',
//     });

//     console.log(
//       `Found ${recentNews.totalArticles} recent articles about climate change`
//     );
//     gnews.displayArticles(recentNews.articles, 2);

//     console.log('\n✅ All tests completed successfully!');
//   } catch (error) {
//     console.error('❌ Test failed:', error);

//     if (error instanceof Error) {
//       if (error.message.includes('GNEWS_API_KEY')) {
//         console.log(
//           '\n💡 Make sure to set your GNEWS_API_KEY environment variable'
//         );
//         console.log(
//           '   You can create a .env file with: GNEWS_API_KEY=your_api_key_here'
//         );
//       }
//     }
//   }
// }

export { Article, GNewsAPI, GNewsResponse };
// (async () => console.log(await testGNewsAPI().catch(console.error)))()