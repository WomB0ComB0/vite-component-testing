/// <reference types="vite/client" />

interface ImportMetaEnv {
	VITE_JWT_SECRETS: string;
	NEWS_API_KEY: string;
	GNEWS_API_KEY: string;
	ARTICLE_API_KEY: string;
	FOOD_API_KEY: string;
	GOOGLE_API_KEY: string;
	GOOGLE_SEARCH_ENGINE_ID: string;
	GEMINI_API_KEY: string;
}

interface ImportMeta {
	readonly env: ImportMetaEnv;
}

export {};
