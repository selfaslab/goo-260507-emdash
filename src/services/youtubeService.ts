/**
 * YouTube Data API v3 검색 + videos.list 메타데이터 수집.
 *
 * - 최근 30일 / 영어 / 조회수 정렬 / 최대 5개 (스펙).
 * - YOUTUBE_API_KEY 가 없거나 quota/네트워크 실패 시 mock 데이터로 graceful fallback.
 * - cached() 로 동일 키워드 묶음에 대한 호출은 TTL 동안 한 번만.
 */

import { cached } from "../lib/cache.js";
import { config } from "../lib/config.js";

export interface YouTubeVideo {
	videoId: string;
	title: string;
	channelTitle: string;
	description: string;
	thumbnail: string;
	publishedAt: string;
	viewCount: number;
}

export interface SearchOptions {
	maxResults?: number;
	publishedAfter?: string; // ISO string
	regionCode?: string;
	relevanceLanguage?: string;
}

const SEARCH_URL = "https://www.googleapis.com/youtube/v3/search";
const VIDEOS_URL = "https://www.googleapis.com/youtube/v3/videos";
const DEFAULT_REGION = "US";
const DEFAULT_LANG = "en";

function thirtyDaysAgo(): string {
	return new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
}

interface YTSearchResponse {
	items: Array<{
		id?: { videoId?: string };
		snippet?: {
			title?: string;
			channelTitle?: string;
			description?: string;
			publishedAt?: string;
			thumbnails?: { medium?: { url?: string }; high?: { url?: string }; default?: { url?: string } };
		};
	}>;
}

interface YTVideosResponse {
	items: Array<{
		id?: string;
		snippet?: {
			title?: string;
			channelTitle?: string;
			description?: string;
			publishedAt?: string;
			thumbnails?: { medium?: { url?: string }; high?: { url?: string }; default?: { url?: string } };
		};
		statistics?: { viewCount?: string };
	}>;
}

export async function searchVideos(
	keywords: string[],
	options: SearchOptions = {},
): Promise<YouTubeVideo[]> {
	const cleaned = Array.from(new Set(keywords.map((k) => k.trim()).filter(Boolean))).slice(0, 5);
	if (cleaned.length === 0) return [];
	const max = Math.min(Math.max(options.maxResults ?? 5, 1), 10);
	const cacheKey = `yt:${cleaned.join("|")}:${max}`;

	return cached<YouTubeVideo[]>(cacheKey, config.youtubeCacheTtlSec, async () => {
		if (!config.youtubeApiKey) {
			console.warn("[youtube] YOUTUBE_API_KEY 없음 → mock 데이터 사용");
			return mockVideos(cleaned, max);
		}
		try {
			return await searchOnYouTube(cleaned, {
				...options,
				maxResults: max,
				publishedAfter: options.publishedAfter ?? thirtyDaysAgo(),
				regionCode: options.regionCode ?? DEFAULT_REGION,
				relevanceLanguage: options.relevanceLanguage ?? DEFAULT_LANG,
			});
		} catch (e) {
			console.warn("[youtube] API 호출 실패 → mock 데이터 사용", e);
			return mockVideos(cleaned, max);
		}
	});
}

async function searchOnYouTube(keywords: string[], opts: Required<SearchOptions>): Promise<YouTubeVideo[]> {
	const q = keywords.join(" | ");
	const searchUrl = new URL(SEARCH_URL);
	searchUrl.searchParams.set("part", "snippet");
	searchUrl.searchParams.set("q", q);
	searchUrl.searchParams.set("type", "video");
	searchUrl.searchParams.set("order", "viewCount");
	searchUrl.searchParams.set("maxResults", String(opts.maxResults));
	searchUrl.searchParams.set("publishedAfter", opts.publishedAfter);
	searchUrl.searchParams.set("regionCode", opts.regionCode);
	searchUrl.searchParams.set("relevanceLanguage", opts.relevanceLanguage);
	searchUrl.searchParams.set("safeSearch", "moderate");
	searchUrl.searchParams.set("key", config.youtubeApiKey!);

	const sRes = await fetch(searchUrl);
	if (!sRes.ok) {
		const body = await safeText(sRes);
		throw new Error(`YouTube search ${sRes.status}: ${body.slice(0, 200)}`);
	}
	const sJson = (await sRes.json()) as YTSearchResponse;
	const ids = sJson.items
		.map((i) => i.id?.videoId)
		.filter((id): id is string => typeof id === "string" && id.length > 0);
	if (ids.length === 0) return [];

	const videosUrl = new URL(VIDEOS_URL);
	videosUrl.searchParams.set("part", "snippet,statistics");
	videosUrl.searchParams.set("id", ids.join(","));
	videosUrl.searchParams.set("key", config.youtubeApiKey!);

	const vRes = await fetch(videosUrl);
	if (!vRes.ok) {
		const body = await safeText(vRes);
		throw new Error(`YouTube videos ${vRes.status}: ${body.slice(0, 200)}`);
	}
	const vJson = (await vRes.json()) as YTVideosResponse;

	return vJson.items
		.filter((v): v is NonNullable<YTVideosResponse["items"][number]> & { id: string } =>
			typeof v.id === "string" && v.id.length > 0,
		)
		.map((v) => {
			const thumbs = v.snippet?.thumbnails;
			const thumbnail =
				thumbs?.high?.url ?? thumbs?.medium?.url ?? thumbs?.default?.url ?? "";
			return {
				videoId: v.id,
				title: v.snippet?.title ?? "",
				channelTitle: v.snippet?.channelTitle ?? "",
				description: v.snippet?.description ?? "",
				thumbnail,
				publishedAt: v.snippet?.publishedAt ?? new Date().toISOString(),
				viewCount: Number(v.statistics?.viewCount ?? 0),
			};
		});
}

async function safeText(res: Response): Promise<string> {
	try {
		return await res.text();
	} catch {
		return "";
	}
}

/** API 키 없을 때 / 실패 시 사용하는 데모 데이터. UI 검증/프리뷰 용도. */
function mockVideos(keywords: string[], n: number): YouTubeVideo[] {
	const now = Date.now();
	const samples: Omit<YouTubeVideo, "publishedAt" | "viewCount">[] = [
		{
			videoId: "mock-nvda-earnings",
			title: "NVIDIA Earnings: AI Server Demand Update (mock)",
			channelTitle: "Mock Investor Channel",
			description:
				"NVIDIA reports another strong quarter on AI data center demand. Discussion on Blackwell ramp, hyperscaler capex and SOXX/SMH ETF implications.",
			thumbnail: "https://i.ytimg.com/vi/mock-nvda-earnings/hqdefault.jpg",
		},
		{
			videoId: "mock-soxx-etf",
			title: "Why SOXX ETF Is the Cleanest AI Chip Bet (mock)",
			channelTitle: "Mock ETF Lab",
			description:
				"Breaking down SOXX vs SMH vs SOXL. AI semiconductor concentration, top holdings, expense ratios, and risk profile for long-term investors.",
			thumbnail: "https://i.ytimg.com/vi/mock-soxx-etf/hqdefault.jpg",
		},
		{
			videoId: "mock-tsmc-2nm",
			title: "TSMC 2nm Production Ramp & ASML EUV (mock)",
			channelTitle: "Mock Semis Weekly",
			description:
				"TSMC's N2 yield improvement and how it benefits Apple, NVIDIA, AMD orders. ASML high-NA EUV update.",
			thumbnail: "https://i.ytimg.com/vi/mock-tsmc-2nm/hqdefault.jpg",
		},
		{
			videoId: "mock-amd-mi400",
			title: "AMD MI400 vs NVIDIA Blackwell — Who Wins AI Training? (mock)",
			channelTitle: "Mock Hardware Desk",
			description:
				"Roadmap comparison between AMD's Instinct MI400 and NVIDIA's Blackwell. Implications for SMH and QQQ holdings.",
			thumbnail: "https://i.ytimg.com/vi/mock-amd-mi400/hqdefault.jpg",
		},
		{
			videoId: "mock-hbm-cycle",
			title: "HBM Memory Supercycle: Micron, SK Hynix, Samsung (mock)",
			channelTitle: "Mock Memory Macro",
			description:
				"AI servers are draining HBM3E supply through 2026. What it means for MU and the broader semiconductor ETF basket.",
			thumbnail: "https://i.ytimg.com/vi/mock-hbm-cycle/hqdefault.jpg",
		},
	];

	const tag = keywords.slice(0, 2).join(" / ");
	return samples.slice(0, n).map((s, i) => ({
		...s,
		title: tag ? `${s.title} · ${tag}` : s.title,
		publishedAt: new Date(now - i * 1000 * 60 * 60 * 24 * 2).toISOString(),
		viewCount: 500_000 - i * 80_000,
	}));
}
