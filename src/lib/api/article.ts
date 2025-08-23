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

import { type } from "arktype";

const PaginationInfo = type({
	limit: "number",
	offset: "number",
	count: "number",
	total: "number",
});

const NewsArticle = type({
	author: "string | null",
	title: "string",
	description: "string | null",
	url: "string",
	source: "string",
	image: "string | null",
	category: "string",
	language: "string",
	country: "string",
	published_at: "string",
});

const NewsSource = type({
	id: "string",
	name: "string",
	category: "string",
	country: "string",
	language: "string",
	url: "string",
});

const NewsResponse = type({
	pagination: PaginationInfo,
	data: NewsArticle.array(),
});

const SourcesResponse = type({
	pagination: PaginationInfo,
	data: NewsSource.array(),
});

const APIError = type({
	error: {
		code: "string",
		message: "string",
		"context?": "Record<string, string[]>",
	},
});

const NewsCategory = type(
	"'general' | 'business' | 'entertainment' | 'health' | 'science' | 'sports' | 'technology'",
);

const SortOption = type("'published_desc' | 'popularity'");

const NewsRequestParams = type({
	"sources?": "string",
	"categories?": "string",
	"countries?": "string",
	"languages?": "string",
	"keywords?": "string",
	"date?": "string",
	"sort?": SortOption,
	"limit?": "number",
	"offset?": "number",
});

const SourcesRequestParams = type({
	"search?": "string",
	"countries?": "string",
	"languages?": "string",
	"categories?": "string",
	"limit?": "number",
	"offset?": "number",
});

const ConstructorOptions = type({
	"minRequestInterval?": "number",
	"maxRequestsPerMinute?": "number",
	"isFreePlan?": "boolean",
});

type PaginationInfo = typeof PaginationInfo.infer;
type NewsArticle = typeof NewsArticle.infer;
type NewsSource = typeof NewsSource.infer;
type NewsResponse = typeof NewsResponse.infer;
type SourcesResponse = typeof SourcesResponse.infer;
type APIError = typeof APIError.infer;
type NewsCategory = typeof NewsCategory.infer;
type SortOption = typeof SortOption.infer;
type NewsRequestParams = typeof NewsRequestParams.infer;
type SourcesRequestParams = typeof SourcesRequestParams.infer;
type ConstructorOptions = typeof ConstructorOptions.infer;

class MediastackAPI {
	private readonly apiKey: string;
	private readonly baseUrl: string = "https://api.mediastack.com/v1";
	private lastRequestTime: number = 0;
	private readonly minRequestInterval: number;
	private requestCount: number = 0;
	private readonly maxRequestsPerMinute: number;

	constructor(apiKey?: string, options?: ConstructorOptions) {
		if (options !== undefined) {
			const validationResult = ConstructorOptions(options);
			if (validationResult instanceof type.errors) {
				throw new Error(
					`Invalid constructor options: ${validationResult.summary}`,
				);
			}
		}

		this.apiKey = apiKey || import.meta.env.VITE_ARTICLE_API_KEY || "";
		if (!this.apiKey) {
			throw new Error(
				"API key is required. Set ARTICLE_API_KEY environment variable or pass it to constructor.",
			);
		}

		const isFreePlan = options?.isFreePlan ?? true;

		// Free plan: be more conservative with rate limits
		// Paid plans: allow more frequent requests
		this.minRequestInterval =
			options?.minRequestInterval ?? (isFreePlan ? 2000 : 500);
		this.maxRequestsPerMinute =
			options?.maxRequestsPerMinute ?? (isFreePlan ? 25 : 100);
	}

	private buildUrl(endpoint: string, params: Record<string, any>): string {
		const url = new URL(`${this.baseUrl}/${endpoint}`);
		url.searchParams.append("access_key", this.apiKey);

		Object.entries(params).forEach(([key, value]) => {
			if (value !== undefined && value !== null) {
				url.searchParams.append(key, value.toString());
			}
		});

		return url.toString();
	}

	private async rateLimitDelay(): Promise<void> {
		const now = Date.now();
		const timeSinceLastRequest = now - this.lastRequestTime;

		if (timeSinceLastRequest < this.minRequestInterval) {
			const delayTime = this.minRequestInterval - timeSinceLastRequest;
			console.log(
				`Rate limiting: waiting ${delayTime}ms before next request...`,
			);
			await new Promise((resolve) => setTimeout(resolve, delayTime));
		}

		this.lastRequestTime = Date.now();
		this.requestCount++;
	}

	private async makeRequest<T>(
		endpoint: string,
		params: Record<string, any> = {},
		responseSchema: any,
	): Promise<T> {
		await this.rateLimitDelay();

		const url = this.buildUrl(endpoint, params);

		try {
			const response = await fetch(url);
			const data = await response.json();

			if (!response.ok) {
				const errorValidation = APIError(data);
				if (errorValidation instanceof type.errors) {
					throw new Error(
						`Invalid API error response format: ${errorValidation.summary}`,
					);
				}

				const error = errorValidation as APIError;

				if (error.error.code === "rate_limit_reached") {
					console.error("❌ Rate limit exceeded. Consider:");
					console.error("   - Reducing request frequency");
					console.error("   - Upgrading to a paid plan");
					console.error("   - Implementing longer delays between requests");
					throw new Error(
						`Rate limit exceeded. Try again later or upgrade your plan.`,
					);
				}

				if (error.error.code === "validation_error") {
					console.error("❌ Validation error. This might be due to:");
					console.error("   - Invalid parameters for your plan level");
					console.error("   - Endpoint not available on free plan");
					console.error("   - Parameter formatting issue");
					throw new Error(`Validation error: ${error.error.message}`);
				}

				if (error.error.code === "function_access_restricted") {
					console.error("❌ Feature not available on your current plan");
					throw new Error(`Feature not available: ${error.error.message}`);
				}

				throw new Error(
					`API Error (${error.error.code}): ${error.error.message}`,
				);
			}

			const validationResult = responseSchema(data);
			if (validationResult instanceof type.errors) {
				console.warn(
					"⚠️ API response validation failed:",
					validationResult.summary,
				);
				console.warn("Raw response:", JSON.stringify(data, null, 2));

				return data as T;
			}

			console.log(`✅ Request successful (${this.requestCount} requests made)`);
			return validationResult as T;
		} catch (error) {
			if (Error.isError(error)) {
				throw error;
			}
			throw new Error("Unknown error occurred while making API request");
		}
	}
	//

	/**
	 * Get live news articles
	 */
	async getNews(params: NewsRequestParams = {}): Promise<NewsResponse> {
		const validationResult = NewsRequestParams(params);
		if (validationResult instanceof type.errors) {
			throw new Error(
				`Invalid news request parameters: ${validationResult.summary}`,
			);
		}

		return this.makeRequest<NewsResponse>("news", params, NewsResponse);
	}

	/**
	 * Get historical news articles (requires Standard plan or higher)
	 */
	async getHistoricalNews(
		date: string,
		params: Omit<NewsRequestParams, "date"> = {},
	): Promise<NewsResponse> {
		const fullParams = { ...params, date };
		const validationResult = NewsRequestParams(fullParams);
		if (validationResult instanceof type.errors) {
			throw new Error(
				`Invalid historical news parameters: ${validationResult.summary}`,
			);
		}

		return this.makeRequest<NewsResponse>("news", fullParams, NewsResponse);
	}

	/**
	 * Get news sources
	 */
	async getSources(
		params: SourcesRequestParams = {},
	): Promise<SourcesResponse> {
		const validationResult = SourcesRequestParams(params);
		if (validationResult instanceof type.errors) {
			throw new Error(
				`Invalid sources request parameters: ${validationResult.summary}`,
			);
		}

		return this.makeRequest<SourcesResponse>(
			"sources",
			params,
			SourcesResponse,
		);
	}

	/**
	 * Search news with keywords
	 */
	async searchNews(
		keywords: string,
		params: Omit<NewsRequestParams, "keywords"> = {},
	): Promise<NewsResponse> {
		if (typeof keywords !== "string" || keywords.trim() === "") {
			throw new Error("Keywords must be a non-empty string");
		}

		const fullParams = { ...params, keywords };
		const validationResult = NewsRequestParams(fullParams);
		if (validationResult instanceof type.errors) {
			throw new Error(`Invalid search parameters: ${validationResult.summary}`);
		}

		return this.makeRequest<NewsResponse>("news", fullParams, NewsResponse);
	}

	/**
	 * Get news by category
	 */
	async getNewsByCategory(
		categories: NewsCategory[],
		params: Omit<NewsRequestParams, "categories"> = {},
	): Promise<NewsResponse> {
		for (const category of categories) {
			const categoryValidation = NewsCategory(category);
			if (categoryValidation instanceof type.errors) {
				throw new Error(
					`Invalid category "${category}": ${categoryValidation.summary}`,
				);
			}
		}

		const fullParams = { ...params, categories: categories.join(",") };
		const validationResult = NewsRequestParams(fullParams);
		if (validationResult instanceof type.errors) {
			throw new Error(
				`Invalid category request parameters: ${validationResult.summary}`,
			);
		}

		return this.makeRequest<NewsResponse>("news", fullParams, NewsResponse);
	}

	/**
	 * Get news by country
	 */
	async getNewsByCountry(
		countries: string[],
		params: Omit<NewsRequestParams, "countries"> = {},
	): Promise<NewsResponse> {
		if (!Array.isArray(countries) || countries.length === 0) {
			throw new Error("Countries must be a non-empty array of strings");
		}

		for (const country of countries) {
			if (typeof country !== "string" || country.trim() === "") {
				throw new Error("Each country must be a non-empty string");
			}
		}

		const fullParams = { ...params, countries: countries.join(",") };
		const validationResult = NewsRequestParams(fullParams);
		if (validationResult instanceof type.errors) {
			throw new Error(
				`Invalid country request parameters: ${validationResult.summary}`,
			);
		}

		return this.makeRequest<NewsResponse>("news", fullParams, NewsResponse);
	}

	/**
	 * Get news by language
	 */
	async getNewsByLanguage(
		languages: string[],
		params: Omit<NewsRequestParams, "languages"> = {},
	): Promise<NewsResponse> {
		if (!Array.isArray(languages) || languages.length === 0) {
			throw new Error("Languages must be a non-empty array of strings");
		}

		for (const language of languages) {
			if (typeof language !== "string" || language.trim() === "") {
				throw new Error("Each language must be a non-empty string");
			}
		}

		const fullParams = { ...params, languages: languages.join(",") };
		const validationResult = NewsRequestParams(fullParams);
		if (validationResult instanceof type.errors) {
			throw new Error(
				`Invalid language request parameters: ${validationResult.summary}`,
			);
		}

		return this.makeRequest<NewsResponse>("news", fullParams, NewsResponse);
	}

	/**
	 * Get request statistics
	 */
	getStats(): { requestCount: number; lastRequestTime: number } {
		return {
			requestCount: this.requestCount,
			lastRequestTime: this.lastRequestTime,
		};
	}

	/**
	 * Reset request counter (useful for testing or monthly resets)
	 */
	resetStats(): void {
		this.requestCount = 0;
		this.lastRequestTime = 0;
	}

	/**
	 * Check if we're approaching rate limits
	 */
	isApproachingRateLimit(): boolean {
		return this.requestCount > this.maxRequestsPerMinute * 0.8; // 80% of limit
	}
}

// Helper functions with validation
export function formatDate(date: Date): string {
	if (!(date instanceof Date) || isNaN(date.getTime())) {
		throw new Error("Invalid date provided to formatDate");
	}
	return date.toISOString().split("T")[0];
}

export function getDateRange(startDate: Date, endDate: Date): string {
	if (!(startDate instanceof Date) || isNaN(startDate.getTime())) {
		throw new Error("Invalid start date provided to getDateRange");
	}
	if (!(endDate instanceof Date) || isNaN(endDate.getTime())) {
		throw new Error("Invalid end date provided to getDateRange");
	}
	if (startDate > endDate) {
		throw new Error("Start date must be before end date");
	}

	return `${formatDate(startDate)},${formatDate(endDate)}`;
}

