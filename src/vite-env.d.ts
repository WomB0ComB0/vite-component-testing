/// <reference types="vite/client" />

interface ImportMetaEnv {
	VITE_JWT_SECRETS: string;
	VITE_NEWS_API_KEY: string;
	VITE_GNEWS_API_KEY: string;
	VITE_ARTICLE_API_KEY: string;
	VITE_FOOD_API_KEY: string;
	VITE_GOOGLE_API_KEY: string;
	VITE_GOOGLE_SEARCH_ENGINE_ID: string;
	VITE_GEMINI_API_KEY: string;
}

interface ImportMeta {
	readonly env: ImportMetaEnv;
}

export {};
