import { gnewsSearch, gnewsTopHeadlines, googleSearch, youtubeSearch } from "@/core";
import { createFDCClient, newsapi } from "@/lib/api";

export type WebDetect = {
	webEntities: { description?: string; score?: number }[];
	fullMatchingImages: { url: string }[];
	partialMatchingImages: { url: string }[];
	pagesWithMatchingImages: { url: string; pageTitle?: string }[];
};

export type Category = "Food" | "Clothes" | "Drugs" | "Technology" | "Unknown";

export type PipelineMeta = {
	primaryQuery: string;
	labels: string[];
};

export type NewsHit = {
	title: string;
	url: string;
	source: string;
	publishedAt?: string;
};

export type CSEResult = {
	title: string;
	link: string;
	snippet: string;
	thumbnail?: { src: string; width: string; height: string };
};

export type YTHit = { title: string; videoId: string };

export type Nutrient = { id: number; name: string; unit: string; value: number };

export type FoodBlock = {
	fdcId?: number;
	description?: string;
	nutrients?: Nutrient[];
};

export type Insights = {
	meta: PipelineMeta;
	category: Category;
	news?: NewsHit[];
	cse?: CSEResult[];
	youtube?: YTHit[];
	food?: FoodBlock;
};

export type PipelineResult = {
	id: string;
	detect: WebDetect;
	insights: Insights;
	error?: string;
};

export class AIAnalysisPipeline {
	private api: {
		fdc: ReturnType<typeof createFDCClient>;
		news: typeof newsapi;
	};

	constructor(foodApiKey: string) {
		this.api = {
			fdc: createFDCClient(foodApiKey),
			news: newsapi,
		};
	}

	// DataLoader compatible methods for external API calls
	static async reverseImageSearch(file: File): Promise<WebDetect> {
		const fd = new FormData();
		fd.append("file", file, file.name);
		const res = await fetch("/api/reverse-image", { method: "POST", body: fd });
		if (!res.ok) {
			const err = await res.json().catch(() => ({}));
			throw new Error(`Vision error: ${JSON.stringify(err)}`);
		}
		const { data } = await res.json();
		return data as WebDetect;
	}

	static async fetchNews(query: string): Promise<NewsHit[]> {
		const hits: NewsHit[] = [];
		try {
			const g = await gnewsSearch(query, { lang: "en", max: 4 });
			hits.push(
				...(g.articles || []).map((a: any) => ({
					title: a.title,
					url: a.url,
					source: a.source?.name,
					publishedAt: a.publishedAt,
				})),
			);
		} catch (e) {
			console.warn("GNews error", e);
		}
		if (hits.length < 2) {
			try {
				const top = await gnewsTopHeadlines({ lang: "en", max: 2 });
				hits.push(
					...(top.articles || []).map((a: any) => ({
						title: a.title,
						url: a.url,
						source: a.source?.name,
						publishedAt: a.publishedAt,
					})),
				);
			} catch (topErr) {
				console.warn("GNews top error", topErr);
			}
		}
		const seen = new Set<string>();
		return hits.filter((h) => h.url && !seen.has(h.url) && seen.add(h.url));
	}

	static async fetchWebResults(query: string): Promise<CSEResult[]> {
		try {
			const results = await googleSearch(query);
			return results?.items?.slice(0, 5) || [];
		} catch (e) {
			console.warn("Google Search error", e);
			return [];
		}
	}

	static async fetchYouTubeVideos(query: string): Promise<YTHit[]> {
		try {
			const results = await youtubeSearch(query);
			return results?.items?.slice(0, 4).map((it: any) => ({
				title: it.snippet?.title || it.title,
				videoId: it.id?.videoId || it.videoId,
			})) || [];
		} catch (e) {
			console.warn("YouTube Search error", e);
			return [];
		}
	}

	// Instance methods for food data (requires API key)
	async reverseImage(file: File): Promise<WebDetect> {
		return AIAnalysisPipeline.reverseImageSearch(file);
	}

	extractMeta(d: WebDetect): PipelineMeta {
		const labels = (d.webEntities || [])
			.map((e) => (e.description ?? "").trim())
			.filter(Boolean)
			.slice(0, 6);

		const pageTerms = (d.pagesWithMatchingImages || [])
			.flatMap((p) => (p.pageTitle ?? "").split(/[|\-–—:]/))
			.map((s) => s.trim())
			.filter(Boolean)
			.slice(0, 6);

		const primary = (labels[0] ?? pageTerms[0] ?? "").trim();
		const extra = labels[1] ?? pageTerms[1] ?? "";
		const primaryQuery = [primary, extra].filter(Boolean).join(" ");

		return { primaryQuery: primaryQuery || "product", labels };
	}

	determineCategory(meta: PipelineMeta): Category {
		const q = `${meta.primaryQuery} ${meta.labels.join(" ")}`.toLowerCase();
		const has = (...k: string[]) => k.some((s) => q.includes(s));
		
		if (has("calorie", "nutrition", "kcal", "ingredients", "fdc", "food"))
			return "Food";
		if (has("shirt", "t-shirt", "hoodie", "sneaker", "shoe", "jeans", "dress", "jacket"))
			return "Clothes";
		if (has("tablet", "capsule", "mg", "rx", "prescription", "drug", "otc"))
			return "Drugs";
		if (has("laptop", "phone", "cpu", "gpu", "camera", "tech", "headphones", "keyboard", "ssd", "router"))
			return "Technology";
		return "Unknown";
	}

	async getNews(meta: PipelineMeta): Promise<NewsHit[]> {
		return AIAnalysisPipeline.fetchNews(meta.primaryQuery);
	}

	async runFoodPipeline(meta: PipelineMeta): Promise<FoodBlock> {
		try {
			const found =
				(await this.api.fdc.findFood(meta.primaryQuery, ["Branded"])) ||
				(await this.api.fdc.findFood(meta.primaryQuery, ["Foundation"]));
			if (!found) return {};
			
			const wanted = [208, 203, 204, 205, 269, 307, 601]; // kcals, protein, fat, carbs, sugars, sodium, cholesterol
			const nutrs = await this.api.fdc.getFoodNutrients(found.fdcId, wanted);
			const nutrients: Nutrient[] = (nutrs || []).map((n: any) => ({
				id: n.nutrient.id,
				name: n.nutrient.name,
				unit: n.nutrient.unitName,
				value: n.amount,
			}));
			return { fdcId: found.fdcId, description: found.description, nutrients };
		} catch (e) {
			console.warn("FDC error", e);
			return {};
		}
	}

	async runClothesPipeline(meta: PipelineMeta) {
		const [cse, yt] = await Promise.allSettled([
			AIAnalysisPipeline.fetchWebResults(`${meta.primaryQuery} reviews`),
			AIAnalysisPipeline.fetchYouTubeVideos(`${meta.primaryQuery} review`),
		]);

		return {
			cse: cse.status === "fulfilled" ? cse.value : [],
			youtube: yt.status === "fulfilled" ? yt.value : [],
		};
	}

	async runDrugsPipeline(meta: PipelineMeta) {
		const [cse, yt] = await Promise.allSettled([
			AIAnalysisPipeline.fetchWebResults(
				`${meta.primaryQuery} dosage side effects site:drugs.com OR site:rxlist.com OR site:mayoclinic.org`,
			),
			AIAnalysisPipeline.fetchYouTubeVideos(`${meta.primaryQuery} overview`),
		]);

		return {
			cse: cse.status === "fulfilled" ? cse.value : [],
			youtube: yt.status === "fulfilled" ? yt.value : [],
		};
	}

	async runTechPipeline(meta: PipelineMeta) {
		const [cse, yt] = await Promise.allSettled([
			AIAnalysisPipeline.fetchWebResults(`${meta.primaryQuery} specs review`),
			AIAnalysisPipeline.fetchYouTubeVideos(`${meta.primaryQuery} review`),
		]);

		return {
			cse: cse.status === "fulfilled" ? cse.value : [],
			youtube: yt.status === "fulfilled" ? yt.value : [],
		};
	}

	async runPipelineForImage(imageFile: { id: string; file: File }): Promise<PipelineResult> {
		const detect = await this.reverseImage(imageFile.file);
		const meta = this.extractMeta(detect);
		const category = this.determineCategory(meta);
		const news = await this.getNews(meta);

		let cat: Partial<Insights> = {};
		if (category === "Food") {
			const food = await this.runFoodPipeline(meta);
			cat = { food };
		} else if (category === "Clothes") {
			const { cse, youtube } = await this.runClothesPipeline(meta);
			cat = { cse, youtube };
		} else if (category === "Drugs") {
			const { cse, youtube } = await this.runDrugsPipeline(meta);
			cat = { cse, youtube };
		} else {
			const { cse, youtube } = await this.runTechPipeline(meta);
			cat = { cse, youtube };
		}

		const insights: Insights = {
			meta,
			category,
			news,
			...cat,
		};

		return { id: imageFile.id, detect, insights };
	}
}
