/**
 * 환경 변수 단일 진입점.
 * - 절대 클라이언트 번들로 흘러가면 안 됩니다 (Astro endpoints / scripts에서만 import).
 * - import.meta.env (Astro / Vite SSR), process.env (tsx 스크립트) 둘 다 지원.
 */

const env: Record<string, string | undefined> =
	typeof process !== "undefined" && process.env ? { ...process.env } : {};

if (typeof import.meta !== "undefined" && (import.meta as any).env) {
	for (const [key, value] of Object.entries((import.meta as any).env)) {
		if (typeof value === "string") env[key] ??= value;
	}
}

function get(key: string, fallback?: string): string | undefined {
	const v = env[key];
	return v && v.length > 0 ? v : fallback;
}

export const config = {
	openaiApiKey: get("OPENAI_API_KEY"),
	openaiModel: get("OPENAI_MODEL", "gpt-4o-mini")!,

	newsApiKey: get("NEWS_API_KEY"),
	finnhubApiKey: get("FINNHUB_API_KEY"),
	alphaVantageKey: get("ALPHA_VANTAGE_KEY"),

	emdashBaseUrl: get("EMDASH_BASE_URL", "http://localhost:4321")!,
	emdashDevBypass: (get("EMDASH_DEV_BYPASS", "true") ?? "true").toLowerCase() === "true",
	emdashApiToken: get("EMDASH_API_TOKEN"),

	youtubeApiKey: get("YOUTUBE_API_KEY"),
	youtubeCacheTtlSec: Number(get("YOUTUBE_CACHE_TTL_SEC", "900") ?? "900"),

	cronSecret: get("CRON_SECRET"),
	/** 설정 시 `X-Admin-Pipeline-Secret` 헤더로 파이프라인 API 호출 가능 */
	adminPipelineSecret: get("ADMIN_PIPELINE_SECRET"),
};

export const ETF_TICKERS = ["SOXX", "SMH", "QQQ"] as const;
export type EtfTicker = (typeof ETF_TICKERS)[number];

export const COMPANY_TICKERS = {
	NVIDIA: "NVDA",
	AMD: "AMD",
	TSMC: "TSM",
	Broadcom: "AVGO",
	Micron: "MU",
	ASML: "ASML",
} as const;

export const NEWS_KEYWORDS = [
	"AI chip",
	"GPU",
	"Semiconductor",
	"NVIDIA",
	"TSMC",
	"AI server",
	"HBM",
	"Data center",
] as const;
