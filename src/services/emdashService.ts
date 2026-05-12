/**
 * EmDash REST API 래퍼.
 *
 * - 로컬: EMDASH_DEV_BYPASS=true → 토큰 없이 동작 (localhost 한정)
 * - 운영: EMDASH_API_TOKEN 에 PAT (Admin → API Tokens 에서 발급)
 *
 * 호출 가능한 컬렉션:
 *   - news_items
 *   - signals
 *   - blog_posts
 */

import { EmDashClient } from "emdash/client";

import { config } from "../lib/config.js";

let _client: EmDashClient | null = null;

export function emdash(): EmDashClient {
	if (_client) return _client;
	_client = new EmDashClient({
		baseUrl: config.emdashBaseUrl,
		token: config.emdashApiToken,
		devBypass: !config.emdashApiToken && config.emdashDevBypass,
	});
	return _client;
}

// -------- News items --------

export interface NewsItemInput {
	title: string;
	source?: string;
	source_url: string;
	raw_content: string;
	published_external_at?: string;
	target_etf?: string;
	tickers?: string;
	sentiment?: "bullish" | "bearish" | "neutral";
	score?: number;
	importance?: "low" | "medium" | "high";
	reason?: string;
	analyzed?: boolean;
}

export async function findNewsByUrl(url: string) {
	const seen: Array<{ id: string; data: Record<string, unknown> }> = [];
	for (const status of ["published", "draft"]) {
		const { items } = await emdash().list("news_items", { limit: 100, status });
		for (const i of items) seen.push({ id: i.id, data: i.data as Record<string, unknown> });
	}
	return seen.find((i) => i.data.source_url === url) ?? null;
}

export async function createNewsItem(input: NewsItemInput): Promise<{ id: string }> {
	const item = await emdash().create("news_items", {
		// EmDash 는 create 시 무조건 status="draft". 이후 publish() 로 발행.
		data: {
			title: input.title,
			source: input.source ?? "",
			source_url: input.source_url,
			raw_content: input.raw_content,
			published_external_at: input.published_external_at ?? new Date().toISOString(),
			target_etf: input.target_etf ?? "",
			tickers: input.tickers ?? "",
			sentiment: input.sentiment ?? "",
			score: input.score ?? 0,
			importance: input.importance ?? "",
			reason: input.reason ?? "",
			analyzed: input.analyzed ?? false,
		},
	});
	try {
		await emdash().publish("news_items", item.id);
	} catch (e) {
		console.warn("[emdash] publish news_items failed", item.id, e);
	}
	return { id: item.id };
}

export async function updateNewsAnalysis(
	id: string,
	patch: Partial<Pick<NewsItemInput, "target_etf" | "tickers" | "sentiment" | "score" | "importance" | "reason">> & {
		analyzed?: boolean;
	},
) {
	const current = await emdash().get("news_items", id);
	const merged = { ...current.data, ...patch, analyzed: patch.analyzed ?? true };
	await emdash().update("news_items", id, { data: merged });
}

async function listAllNews(perStatus = 100) {
	const cap = Math.min(perStatus, 100);
	const out: Array<{ id: string; data: Record<string, unknown> }> = [];
	for (const status of ["published", "draft"]) {
		const { items } = await emdash().list("news_items", { limit: cap, status });
		for (const i of items) out.push({ id: i.id, data: i.data as Record<string, unknown> });
	}
	return out;
}

export async function listUnanalyzedNews(limit = 25) {
	const all = await listAllNews();
	return all.filter((i) => !i.data.analyzed).slice(0, limit);
}

export async function listAnalyzedNews(limit = 50) {
	const all = await listAllNews();
	return all.filter((i) => i.data.analyzed).slice(0, limit);
}

// -------- Signals --------

export interface SignalInput {
	ticker: string;
	signal_label: string;
	score: number;
	sentiment_score: number;
	frequency_score: number;
	momentum_score: number;
	volatility_score: number;
	summary: string;
}

export async function upsertSignal(input: SignalInput): Promise<{ id: string }> {
	const generatedAt = new Date().toISOString();
	const item = await emdash().create("signals", {
		data: {
			title: `${input.ticker} · ${input.signal_label} (${input.score.toFixed(1)})`,
			ticker: input.ticker,
			signal_label: input.signal_label,
			score: input.score,
			sentiment_score: input.sentiment_score,
			frequency_score: input.frequency_score,
			momentum_score: input.momentum_score,
			volatility_score: input.volatility_score,
			summary: input.summary,
			generated_at: generatedAt,
		},
	});
	try {
		await emdash().publish("signals", item.id);
	} catch (e) {
		console.warn("[emdash] publish signals failed", item.id, e);
	}
	return { id: item.id };
}

export async function listSignals(limit = 50) {
	const cap = Math.min(limit, 100);
	const { items } = await emdash().list("signals", { limit: cap, status: "published" });
	return items;
}

// -------- Blog posts --------

export interface BlogPostInput {
	slug: string;
	title: string;
	summary: string;
	content: unknown[]; // PortableText
	seo_description: string;
	target_etf: string;
	tickers: string;
	sentiment: string;
	signal_score: number;
	signal_label: string;
	source_news_url?: string;
	auto_generated?: boolean;
	publish?: boolean;
}

export async function createBlogPost(input: BlogPostInput): Promise<{ id: string; slug: string }> {
	const item = await emdash().create("blog_posts", {
		slug: input.slug,
		data: {
			title: input.title,
			summary: input.summary,
			content: input.content,
			seo_description: input.seo_description,
			target_etf: input.target_etf,
			tickers: input.tickers,
			sentiment: input.sentiment,
			signal_score: input.signal_score,
			signal_label: input.signal_label,
			source_news_url: input.source_news_url ?? "",
			auto_generated: input.auto_generated ?? true,
		},
	});
	if (input.publish) {
		try {
			await emdash().publish("blog_posts", item.id);
		} catch (e) {
			console.warn("[emdash] publish blog_posts failed", item.id, e);
		}
	}
	return { id: item.id, slug: item.slug ?? input.slug };
}

export async function publishBlogPost(id: string) {
	await emdash().publish("blog_posts", id);
}

export async function unpublishBlogPost(id: string) {
	await emdash().unpublish("blog_posts", id);
}

// -------- YouTube videos --------

export interface YoutubeVideoInput {
	video_id: string;
	title: string;
	channel: string;
	thumbnail: string;
	description: string;
	view_count: number;
	published_external_at: string;
	summary: string;
	sentiment: "bullish" | "bearish" | "neutral";
	relevance: number;
	score: number;
	related_ticker: string;
	keywords: string;
}

export async function findYoutubeVideoByVideoId(videoId: string) {
	const seen: Array<{ id: string; data: Record<string, unknown> }> = [];
	for (const status of ["published", "draft"]) {
		const { items } = await emdash().list("youtube_videos", { limit: 100, status });
		for (const i of items) seen.push({ id: i.id, data: i.data as Record<string, unknown> });
	}
	return seen.find((i) => i.data.video_id === videoId) ?? null;
}

export async function upsertYoutubeVideo(input: YoutubeVideoInput): Promise<{ id: string }> {
	const existing = await findYoutubeVideoByVideoId(input.video_id);
	if (existing) {
		await emdash().update("youtube_videos", existing.id, {
			data: { ...existing.data, ...input },
		});
		return { id: existing.id };
	}
	const item = await emdash().create("youtube_videos", {
		data: {
			title: input.title,
			video_id: input.video_id,
			channel: input.channel,
			thumbnail: input.thumbnail,
			description: input.description,
			view_count: input.view_count,
			published_external_at: input.published_external_at,
			summary: input.summary,
			sentiment: input.sentiment,
			relevance: input.relevance,
			score: input.score,
			related_ticker: input.related_ticker,
			keywords: input.keywords,
		},
	});
	try {
		await emdash().publish("youtube_videos", item.id);
	} catch (e) {
		console.warn("[emdash] publish youtube_videos failed", item.id, e);
	}
	return { id: item.id };
}

export async function listYoutubeVideosForTicker(ticker: string, limit = 6) {
	const cap = Math.min(limit, 100);
	const { items } = await emdash().list("youtube_videos", { limit: cap, status: "published" });
	return items
		.filter((i) => {
			const t = (i.data as Record<string, unknown>).related_ticker;
			return typeof t === "string" && t.toUpperCase().includes(ticker.toUpperCase());
		})
		.slice(0, limit);
}
