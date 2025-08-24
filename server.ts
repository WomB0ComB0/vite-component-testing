import { spawn } from "node:child_process";
import fs from "node:fs";
import { FetchHttpClient } from "@effect/platform";
import type { HttpClient } from "@effect/platform/HttpClient";
import { cors } from "@elysiajs/cors";
import { opentelemetry, record } from "@elysiajs/opentelemetry";
import { serverTiming } from "@elysiajs/server-timing";
import { swagger } from "@elysiajs/swagger";
import vision from "@google-cloud/vision";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-proto";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { BatchSpanProcessor } from "@opentelemetry/sdk-trace-node";
import { ATTR_SERVICE_NAME } from "@opentelemetry/semantic-conventions";
import type { SocketAddress } from "bun";
import { Effect, pipe } from "effect";
import { Elysia } from "elysia";
import { ip } from "elysia-ip";
import { DefaultContext, type Generator, rateLimit } from "elysia-rate-limit";
import { elysiaHelmet } from "elysiajs-helmet";
import { logger } from "./logger";
import { get } from "./src/effect-fetcher";
import { GNewsResponse as GNewsResponseSchema } from "./src/lib/api/gnews";
import { RawCse, SearchRecommendation } from "./src/lib/api/search";
import { YoutubeSearchResponse as YoutubeSearchResponseSchema } from "./src/lib/api/youtube";

// Environment variables
const GNEWS_API_KEY = process.env.VITE_GNEWS_API_KEY!;
const GOOGLE_API_KEY = process.env.VITE_GOOGLE_API_KEY!;
const GOOGLE_CSE_CX = process.env.VITE_GOOGLE_SEARCH_ENGINE_ID!;
const YT_API_KEY = GOOGLE_API_KEY;

if (!GNEWS_API_KEY) throw new Error("Missing GNEWS_API_KEY");
if (!GOOGLE_API_KEY) throw new Error("Missing GOOGLE_API_KEY");
if (!GOOGLE_CSE_CX) throw new Error("Missing GOOGLE_SEARCH_ENGINE_ID");

// API endpoints
const GNEWS_BASE = "https://gnews.io/api/v4";
const CSE_ENDPOINT = "https://customsearch.googleapis.com/customsearch/v1";
const YT_SEARCH_ENDPOINT = "https://www.googleapis.com/youtube/v3/search";

/**
 * Stringifies an object with 2-space indentation.
 * @param {object} o - The object to stringify.
 * @returns {string} The pretty-printed JSON string.
 */
const Stringify = (o: object): string => JSON.stringify(o, null, 2);

/**
 * Generates a unique identifier for rate limiting based on the request's IP address.
 * @param {*} _r - The request object (unused).
 * @param {*} _s - The response object (unused).
 * @param {{ ip: SocketAddress }} param2 - The context containing the IP address.
 * @returns {string} The IP address or 'unknown' if not available.
 */
const ipGenerator: Generator<{ ip: SocketAddress }> = (_r, _s, { ip }) =>
	ip?.address ?? "unknown";

/**
 * The current application version, loaded from package.json.
 * @type {string}
 */
const version: string =
	(await import("./package.json")
		.then((t) => t.version)
		.catch((err) => {
			logger.error("Failed to load version from package.json", err);
		})) || "N/A";

/**
 * Checks if Docker is running on the system.
 * @async
 * @returns {Promise<boolean>} True if Docker is active, false otherwise.
 */
const checkDocker = async (): Promise<boolean> => {
	try {
		const { stdout } = await Bun.$`systemctl is-active docker`;
		return stdout.toString().trim() === "active";
	} catch (error) {
		logger.error("Docker is not running or systemctl command failed", error);
		return false;
	}
};

/**
 * Starts a Jaeger tracing container using Docker.
 * Logs output to ./logs/jaeger.log.
 * @see http://localhost:16686/search
 */
const runJaeger = (): void => {
	const [out, err] = Array(2).fill(fs.openSync("./logs/jaeger.log", "a"));

	const jaeger = spawn(
		"docker",
		[
			"run",
			"--rm",
			"--name",
			"jaeger",
			"-p",
			"5778:5778",
			"-p",
			"16686:16686",
			"-p",
			"4317:4317",
			"-p",
			"4318:4318",
			"-p",
			"14250:14250",
			"-p",
			"14268:14268",
			"-p",
			"9411:9411",
			"jaegertracing/jaeger:2.1.0",
		],
		{
			detached: true,
			stdio: ["ignore", out, err],
		},
	);

	jaeger.unref();
};

/**
 * Middleware for timing and logging the duration of each request.
 */
const timingMiddleware = new Elysia()
	.state({ start: 0 })
	.onBeforeHandle(({ store }) => (store.start = Date.now()))
	.onAfterHandle(({ path, store: { start } }) => {
		const duration = Date.now() - start;
		logger.info(`[Elysia] ${path} took ${duration}ms to execute`, { path, duration });
	});

/**
 * Effect runtime utility
 */
function run<A, E>(eff: Effect.Effect<A, E, never>): Promise<A>;
function run<A, E>(eff: Effect.Effect<A, E, HttpClient>): Promise<A>;
function run<A, E, R>(eff: Effect.Effect<A, E, R>): Promise<A> {
	const provided = (eff as Effect.Effect<A, E, HttpClient | never>).pipe(
		Effect.provide(FetchHttpClient.layer),
	);
	return Effect.runPromise(provided as Effect.Effect<A, E, never>);
}

/**
 * Google Vision client
 */
const client = new vision.ImageAnnotatorClient({
	keyFilename: "./credentials.json",
});

/**
 * Normalize web detection response
 */
function normalizeWebDetection(res: any) {
	const web = res?.webDetection ?? {};
	return {
		webEntities: (web.webEntities ?? []).map((e: any) => ({
			description: e.description,
			score: e.score,
		})),
		fullMatchingImages: (web.fullMatchingImages ?? []).map((i: any) => ({
			url: i.url ?? "",
		})),
		partialMatchingImages: (web.partialMatchingImages ?? []).map((i: any) => ({
			url: i.url ?? "",
		})),
		pagesWithMatchingImages: (web.pagesWithMatchingImages ?? []).map(
			(p: any) => ({
				url: p.url ?? "",
				pageTitle: p.pageTitle,
			}),
		),
	};
}

/**
 * OpenTelemetry resource for Jaeger tracing.
 */
const otelResource = resourceFromAttributes({
	[ATTR_SERVICE_NAME]: "elysia-api",
});

/**
 * OTLP trace exporter for sending traces to Jaeger.
 */
const otlpExporter = new OTLPTraceExporter({
	url: "http://localhost:4318/v1/traces",
	keepAlive: true,
});

/**
 * Batch span processor for OpenTelemetry.
 */
const batchSpanProcessor = new BatchSpanProcessor(otlpExporter, {
	maxExportBatchSize: 512,
	scheduledDelayMillis: 5_000,
	exportTimeoutMillis: 30_000,
	maxQueueSize: 2_048,
});

/**
 * Content Security Policy permissions for Helmet.
 */
const permission = {
	SELF: "'self'",
	UNSAFE_INLINE: "'unsafe-inline'",
	HTTPS: "https:",
	DATA: "data:",
	NONE: "'none'",
	BLOB: "blob:",
} as const;

/**
 * Utility routes for status, version, info, and health endpoints.
 */
const utilityRoutes = new Elysia()
	.use(timingMiddleware)
	.get(
		"/",
		() =>
			record("root.get", () => {
				return Stringify({
					message: `Welcome to the API. Don't be naughty >:(`,
					status: 200,
				});
			}),
		{
			detail: {
				summary: "Root endpoint",
				description: "Welcome message for the API",
				tags: ["Utility"],
			},
		},
	)
	.get(
		"/status",
		async () =>
			record("status.get", async () => {
				const uptime = process.uptime();
				const memoryUsage = process.memoryUsage();
				const appVersion = version;
				return Stringify({
					message: "Application status",
					status: 200,
					data: {
						uptime: `${uptime.toFixed(2)} seconds`,
						memory: {
							rss: `${(memoryUsage.rss / 1_024 / 1_024).toFixed(2)} MB`,
							heapTotal: `${(memoryUsage.heapTotal / 1_024 / 1_024).toFixed(2)} MB`,
							heapUsed: `${(memoryUsage.heapUsed / 1_024 / 1_024).toFixed(2)} MB`,
							external: `${(memoryUsage.external / 1_024 / 1_024).toFixed(2)} MB`,
						},
						version: appVersion,
						environment: process.env.NODE_ENV || "development",
					},
				});
			}),
		{
			detail: {
				summary: "Get application status",
				description: "Returns uptime, memory usage, version, and environment",
				tags: ["Utility"],
			},
		},
	)
	.get(
		"/version",
		async () =>
			record("version.get", async () => {
				const appVersion = version;
				return Stringify({
					version: appVersion,
					status: 200,
				});
			}),
		{
			detail: {
				summary: "Get API version",
				description: "Returns the current API version",
				tags: ["Info"],
			},
		},
	)
	.get(
		"/info",
		() =>
			record("info.get", () => {
				return Stringify({
					message: `Information about the API`,
					status: 200,
					data: {
						contact: `example@example.com`,
						documentationUrl: "https://docs.your-api.com",
					},
				});
			}),
		{
			detail: {
				summary: "Get API info",
				description: "Returns information about the API",
				tags: ["Info"],
			},
		},
	)
	.get(
		"/health",
		async () =>
			record("health.get", () => {
				return Stringify({ message: "ok", status: 200 });
			}),
		{
			detail: {
				summary: "Health check",
				description: "Returns ok if the API is healthy",
				tags: ["Health"],
			},
		},
	);

/**
 * API routes for your existing functionality
 */
const apiRoutes = new Elysia({ prefix: "/api" })
	.post(
		"/reverse-image",
		async ({ request }) => {
			return record("reverse-image.post", async () => {
				const form = await request.formData();
				const file = form.get("file");
				if (!(file instanceof File)) {
					return new Response(JSON.stringify({ error: "No file provided" }), {
						status: 400,
					});
				}
				if (!/^image\//.test(file.type)) {
					return new Response(
						JSON.stringify({ error: "Unsupported media type" }),
						{
							status: 415,
						},
					);
				}
				const ab = await file.arrayBuffer();
				const content = Buffer.from(ab);

				const [res] = await client.webDetection({ image: { content } });
				const data = normalizeWebDetection(res);

				return new Response(JSON.stringify({ ok: true, data }), {
					headers: { "content-type": "application/json" },
				});
			});
		},
		{
			detail: {
				summary: "Reverse image search",
				description:
					"Upload an image for reverse search using Google Vision API",
				tags: ["Vision"],
			},
		},
	)
	.get(
		"/gnews/search",
		async ({ query }) => {
			return record("gnews.search.get", async () => {
				const p = query as Record<string, string>;
				const params = {
					apikey: GNEWS_API_KEY,
					q: p.q ?? "",
					lang: p.lang,
					country: p.country,
					max: p.max,
					in: p.in,
					nullable: p.nullable,
					from: p.from,
					to: p.to,
					sortby: p.sortby as "relevance" | "publishedAt" | undefined,
				};

				const eff = pipe(
					get(`${GNEWS_BASE}/search`, { schema: GNewsResponseSchema }, params),
				);

				const res = await run(eff);
				return new Response(JSON.stringify(res), {
					headers: { "content-type": "application/json" },
				});
			});
		},
		{
			detail: {
				summary: "Search news articles",
				description: "Search for news articles using GNews API",
				tags: ["News"],
			},
		},
	)
	.get(
		"/gnews/top-headlines",
		async ({ query }) => {
			return record("gnews.headlines.get", async () => {
				const p = query as Record<string, string>;
				const params = {
					apikey: GNEWS_API_KEY,
					lang: p.lang,
					country: p.country,
					max: p.max,
					nullable: p.nullable,
					category: p.category as
						| "general"
						| "world"
						| "nation"
						| "business"
						| "technology"
						| "entertainment"
						| "sports"
						| "science"
						| "health"
						| undefined,
				};

				const eff = pipe(
					get(
						`${GNEWS_BASE}/top-headlines`,
						{ schema: GNewsResponseSchema },
						params,
					),
				);

				const res = await run(eff);
				return new Response(JSON.stringify(res), {
					headers: { "content-type": "application/json" },
				});
			});
		},
		{
			detail: {
				summary: "Get top headlines",
				description: "Get top news headlines using GNews API",
				tags: ["News"],
			},
		},
	)
	.get(
		"/google/cse",
		async ({ query }) => {
			return record("google.cse.get", async () => {
				try {
					const p = query as Record<string, string>;
					const fields =
						p.fields ??
						"searchInformation(totalResults,searchTime,formattedTotalResults,formattedSearchTime),items(link,title,snippet,pagemap/cse_thumbnail)";

					const params = {
						key: GOOGLE_API_KEY,
						cx: GOOGLE_CSE_CX,
						q: p.q ?? "",
						num: p.num ?? "10",
						start: p.start,
						safe: p.safe,
						lr: p.lr,
						siteSearch: p.siteSearch,
						fields,
					};

					const raw = await run(
						pipe(get(CSE_ENDPOINT, { schema: RawCse }, params)),
					);

					const transformed = {
						info: {
							totalResults: raw.searchInformation?.totalResults ?? "0",
							searchTime: raw.searchInformation?.searchTime ?? 0,
							formattedTotalResults:
								raw.searchInformation?.formattedTotalResults ?? "0",
							formattedSearchTime:
								raw.searchInformation?.formattedSearchTime ?? "0",
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

					const ok = SearchRecommendation.assert(transformed);
					return new Response(JSON.stringify(ok), {
						headers: { "content-type": "application/json" },
					});
				} catch (e) {
					logger.error("CSE error", e);
					return new Response(
						JSON.stringify({
							error: "Google CSE failed",
							details: e?.message ?? String(e),
						}),
						{ status: 502, headers: { "content-type": "application/json" } },
					);
				}
			});
		},
		{
			detail: {
				summary: "Google Custom Search",
				description: "Search using Google Custom Search Engine",
				tags: ["Search"],
			},
		},
	)
	.get(
		"/youtube/search",
		async ({ query }) => {
			return record("youtube.search.get", async () => {
				const p = query as Record<string, string>;
				const params = {
					key: YT_API_KEY,
					part: "snippet",
					q: p.q ?? "",
					type: "video",
					maxResults: p.maxResults ?? "10",
					pageToken: p.pageToken,
				};

				const eff = pipe(
					get(
						YT_SEARCH_ENDPOINT,
						{ schema: YoutubeSearchResponseSchema },
						params,
					),
				);

				const res = await run(eff);
				return new Response(JSON.stringify(res), {
					headers: { "content-type": "application/json" },
				});
			});
		},
		{
			detail: {
				summary: "Search YouTube videos",
				description: "Search for YouTube videos using YouTube Data API",
				tags: ["YouTube"],
			},
		},
	);

/**
 * Main application instance with all middleware and routes.
 */
const app = new Elysia({ name: "Server API" })
	.use(
		swagger({
			path: "/swagger",
			documentation: {
				info: {
					title: "🦊 Enhanced API Server",
					version: version || "1.0.0",
					description: `
**Enhanced API Server with Advanced Features**

This API provides:
- 🔍 **Search & Vision**: Google Custom Search, YouTube search, and reverse image search
- 📰 **News**: GNews integration for articles and headlines
- 🚀 **Performance**: OpenTelemetry tracing, rate limiting, and caching
- 🔒 **Security**: Helmet security headers and CORS protection
- 📊 **Monitoring**: Health checks, status endpoints, and observability

> **Contact:** [API Support](mailto:support@your-api.com)
          `,
					contact: {
						name: "API Support",
						email: "support@your-api.com",
					},
				},
				tags: [
					{
						name: "Utility",
						description: "Status, version, and health check endpoints",
					},
					{
						name: "Info",
						description: "API information endpoints",
					},
					{
						name: "Vision",
						description: "Google Vision API integration",
					},
					{
						name: "News",
						description: "GNews API integration",
					},
					{
						name: "Search",
						description: "Google Custom Search integration",
					},
					{
						name: "YouTube",
						description: "YouTube Data API integration",
					},
				],
			},
		}),
	)
	.trace(async ({ onBeforeHandle, onAfterHandle, onError }) => {
		onBeforeHandle(({ begin, onStop }) => {
			onStop(({ end }) => {
				logger.debug("BeforeHandle took", { duration: end - begin });
			});
		});
		onAfterHandle(({ begin, onStop }) => {
			onStop(({ end }) => {
				logger.debug("AfterHandle took", { duration: end - begin });
			});
		});
		onError(({ begin, onStop }) => {
			onStop(({ end, error }) => {
				logger.error("Error occurred after trace", error, { duration: end - begin });
			});
		});
	})
	// .use(
	// 	logixlysia({
	//     config: {
	//       showStartupMessage: true,
	//       startupMessageFormat: 'simple',
	//       timestamp: {
	//         translateTime: 'yyyy-mm-dd HH:MM:ss.SSS'
	//       },
	//       logFilePath: './logs/server.log',
	//       ip: true,
	//       customLogFormat:
	//         '🦊 {now} {level} {duration} {method} {pathname} {status} {message} {ip}'
	//     }
	//   })
	// )
	.use(
		elysiaHelmet({
			csp: {
				defaultSrc: [permission.SELF],
				scriptSrc: [permission.SELF, permission.UNSAFE_INLINE],
				styleSrc: [permission.SELF, permission.UNSAFE_INLINE],
				imgSrc: [permission.SELF, permission.DATA, permission.HTTPS],
				useNonce: true,
			},
			hsts: {
				maxAge: 31_536_000,
				includeSubDomains: true,
				preload: true,
			},
			frameOptions: "DENY",
			referrerPolicy: "strict-origin-when-cross-origin",
			permissionsPolicy: {
				camera: [permission.NONE],
				microphone: [permission.NONE],
			},
		}),
	)
	.use(ip())
	.use(
		opentelemetry({
			resource: otelResource,
			spanProcessors: [batchSpanProcessor],
		}),
	)
	.use(
		serverTiming({
			trace: {
				request: true,
				parse: true,
				transform: true,
				beforeHandle: true,
				handle: true,
				afterHandle: true,
				error: true,
				mapResponse: true,
				total: true,
			},
		}),
	)
	// --- CORS configuration for cross-origin requests from http://localhost:5173 ---
	.use(
		cors({
			origin: "http://localhost:5173", // Allow requests from this origin
			methods: ["GET", "POST", "OPTIONS"], // Specify allowed HTTP methods
			allowedHeaders: ["Content-Type", "Authorization"], // Specify allowed headers
			credentials: true, // Allow credentials (e.g., cookies, authorization headers)
			maxAge: 86400, // Cache the preflight response for 24 hours
		}),
	)
	.use(
		rateLimit({
			duration: 60_000,
			max: 100,
			headers: true,
			scoping: "scoped",
			countFailedRequest: true,
			errorResponse: new Response(
				Stringify({
					error: `Too many requests`,
				}),
				{ status: 429 },
			),
			generator: ipGenerator,
			context: new DefaultContext(10_000),
		}),
	)
	.use(utilityRoutes)
	.use(apiRoutes)
	.onError(({ code, error, set }) => {
		logger.error("API error handler", error, { code });
		set.status = code === "NOT_FOUND" ? 404 : 500;
		return Stringify({
			error: Error.isError(error) ? Stringify({ error }) : Stringify({ error }),
			status: set.status,
		});
	})
	.listen(3_000);

/**
 * Gracefully shuts down the application and flushes telemetry.
 */
const shutdown = async (): Promise<void> => {
	logger.info("Shutting down 🦊 Elysia");
	await batchSpanProcessor.forceFlush();
	await app.stop();
	process.exit(0);
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

/**
 * Initializes Jaeger tracing if Docker is available.
 */
const initializeJaeger = async (): Promise<void> => {
	if (await checkDocker()) {
		logger.info("Docker is running. Checking for Jaeger container...");
		try {
			await Bun.$`docker inspect -f {{.State.Running}} jaeger`.text();
			logger.info("Jaeger container is already running.");
		} catch {
			logger.info(
				"Jaeger container not found or not running. Starting Jaeger...",
			);
			runJaeger();
		}
	} else {
		logger.warn("Docker is not running. Skipping Jaeger initialization.");
	}

	logger.success("→ http://localhost:3000");
	logger.success("→ Swagger docs: http://localhost:3000/swagger");
	logger.success("→ Jaeger UI: http://localhost:16686/search");
};

process.env.NODE_ENV === "development" && initializeJaeger();

export type App = typeof app;
