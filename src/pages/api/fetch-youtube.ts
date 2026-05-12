/**
 * GET  /api/fetch-youtube?keywords=a,b,c[&etf=SOXX][&persist=true]
 * POST /api/fetch-youtube  Body: { keywords?, etf?, title?, body?, tickers?, persist? }
 *
 * 처리:
 *   1) keywords 가 비어 있으면 title/body/etf/tickers 로부터 GPT(or rule-based) 추출.
 *   2) YouTube Data API v3 검색 (최근 30일, 영어, 조회수 정렬, 최대 5개).
 *   3) GPT 영상 요약 (실패 시 fallback).
 *   4) 0.5·KeywordMatch + 0.3·Views + 0.2·Recency 로 점수 계산.
 *   5) persist=true 면 youtube_videos 컬렉션에 upsert.
 *   6) 정렬된 JSON 반환.
 *
 * 캐시: 동일 키워드 묶음에 대해 cache.ts 가 TTL 동안 single-flight 보장.
 */

import type { APIRoute } from "astro";

import { config } from "../../lib/config.js";
import { computeVideoScore } from "../../lib/youtubeScore.js";
import { upsertYoutubeVideo } from "../../services/emdashService.js";
import { analyzeVideos } from "../../services/youtubeAnalysisService.js";
import { extractKeywords } from "../../services/youtubeKeywordService.js";
import { searchVideos } from "../../services/youtubeService.js";

export const prerender = false;

interface RequestPayload {
	keywords?: string[] | string;
	etf?: string;
	title?: string;
	body?: string;
	tickers?: string[] | string;
	persist?: boolean;
}

export interface RecommendedVideo {
	videoId: string;
	title: string;
	channelTitle: string;
	thumbnail: string;
	description: string;
	publishedAt: string;
	viewCount: number;
	summary: string;
	sentiment: "bullish" | "bearish" | "neutral";
	relevance: number;
	score: number;
	scoreParts: { keywordMatch: number; views: number; recency: number };
	url: string;
}

export const GET: APIRoute = async ({ request, url }) => {
	if (config.cronSecret) {
		const got = request.headers.get("x-cron-secret");
		if (got !== config.cronSecret) return jsonError(401, "invalid cron secret");
	}
	const payload: RequestPayload = {
		keywords: url.searchParams.get("keywords") ?? undefined,
		etf: url.searchParams.get("etf") ?? undefined,
		title: url.searchParams.get("title") ?? undefined,
		body: url.searchParams.get("body") ?? undefined,
		tickers: url.searchParams.get("tickers") ?? undefined,
		persist: url.searchParams.get("persist") === "true",
	};
	return handle(payload);
};

export const POST: APIRoute = async ({ request }) => {
	if (config.cronSecret) {
		const got = request.headers.get("x-cron-secret");
		if (got !== config.cronSecret) return jsonError(401, "invalid cron secret");
	}
	let body: RequestPayload = {};
	try {
		body = (await request.json()) as RequestPayload;
	} catch {}
	return handle(body);
};

async function handle(payload: RequestPayload): Promise<Response> {
	try {
		const keywords = await resolveKeywords(payload);
		if (keywords.length === 0) {
			return ok({ keywords: [], videos: [], note: "no keywords" });
		}

		const videos = await searchVideos(keywords, { maxResults: 5 });
		if (videos.length === 0) {
			return ok({ keywords, videos: [], note: "no videos found" });
		}

		const analyses = await analyzeVideos(videos, keywords);

		const recommended: RecommendedVideo[] = videos.map((v, i) => {
			const scoreResult = computeVideoScore({
				titleAndDescription: `${v.title}\n${v.description}`,
				keywords,
				viewCount: v.viewCount,
				publishedAt: v.publishedAt,
			});
			const a = analyses[i] ?? { summary: "", sentiment: "neutral", relevance: 0.5 };
			return {
				videoId: v.videoId,
				title: v.title,
				channelTitle: v.channelTitle,
				thumbnail: v.thumbnail,
				description: v.description,
				publishedAt: v.publishedAt,
				viewCount: v.viewCount,
				summary: a.summary,
				sentiment: a.sentiment,
				relevance: a.relevance,
				score: scoreResult.score,
				scoreParts: {
					keywordMatch: scoreResult.keywordMatch,
					views: scoreResult.views,
					recency: scoreResult.recency,
				},
				url: `https://www.youtube.com/watch?v=${v.videoId}`,
			};
		});

		recommended.sort((a, b) => b.score - a.score);

		if (payload.persist) {
			const ticker = (payload.etf ?? "").toUpperCase();
			const keywordsCsv = keywords.join(",");
			for (const r of recommended) {
				try {
					await upsertYoutubeVideo({
						video_id: r.videoId,
						title: r.title,
						channel: r.channelTitle,
						thumbnail: r.thumbnail,
						description: r.description,
						view_count: r.viewCount,
						published_external_at: r.publishedAt,
						summary: r.summary,
						sentiment: r.sentiment,
						relevance: r.relevance,
						score: r.score,
						related_ticker: ticker,
						keywords: keywordsCsv,
					});
				} catch (e) {
					console.warn("[fetch-youtube] persist failed", r.videoId, e);
				}
			}
		}

		return ok({ keywords, videos: recommended });
	} catch (e) {
		const msg = e instanceof Error ? e.message : String(e);
		console.error("[fetch-youtube] unhandled", e);
		return new Response(JSON.stringify({ ok: false, error: msg }), {
			status: 500,
			headers: { "content-type": "application/json; charset=utf-8" },
		});
	}
}

async function resolveKeywords(payload: RequestPayload): Promise<string[]> {
	const fromInput = toArray(payload.keywords);
	if (fromInput.length > 0) {
		return Array.from(new Set(fromInput.map((k) => k.trim()).filter(Boolean))).slice(0, 5);
	}
	if (!payload.title && !payload.etf) return [];
	return extractKeywords({
		title: payload.title ?? "",
		body: payload.body,
		targetEtf: payload.etf,
		tickers: toArray(payload.tickers),
	});
}

function toArray(value: string[] | string | undefined): string[] {
	if (!value) return [];
	if (Array.isArray(value)) return value;
	return value
		.split(/[,;|]/)
		.map((s) => s.trim())
		.filter(Boolean);
}

function ok(body: unknown): Response {
	return new Response(JSON.stringify({ ok: true, ...(body as object) }, null, 2), {
		headers: {
			"content-type": "application/json; charset=utf-8",
			"cache-control": "private, max-age=60",
		},
	});
}

function jsonError(status: number, message: string) {
	return new Response(JSON.stringify({ ok: false, error: message }), {
		status,
		headers: { "content-type": "application/json; charset=utf-8" },
	});
}
