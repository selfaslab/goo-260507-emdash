/**
 * 뉴스 수집 → 분석 → 블로그 생성 파이프라인 (API 라우트와 관리자 버튼에서 공용).
 */
import { join } from "node:path";

import Database from "better-sqlite3";

import { ETF_TICKERS, type EtfTicker } from "../lib/config.js";
import {
	ANALYZE_NEWS_SYSTEM,
	analyzeNewsUserPrompt,
	BLOG_SYSTEM,
	blogUserPrompt,
} from "../lib/prompts.js";
import { scoreToLabel } from "../lib/scoring.js";
import { slugify, textToPortableText } from "../lib/utils.js";
import {
	createBlogPost,
	createNewsItem,
	findNewsByUrl,
	listAnalyzedNews,
	listSignals,
	listUnanalyzedNews,
	updateNewsAnalysis,
} from "./emdashService.js";
import { fetchNews } from "./newsService.js";
import { chatJson } from "./openaiService.js";
import { recomputeSignals } from "./signalService.js";

export interface FetchNewsResult {
	ok: true;
	fetched: number;
	inserted: number;
	skipped: number;
	errors: string[];
}

export async function executeFetchNews(max: number): Promise<FetchNewsResult> {
	const articles = await fetchNews({ max });
	let inserted = 0;
	let skipped = 0;
	const errors: string[] = [];

	for (const a of articles) {
		try {
			const dup = await findNewsByUrl(a.url);
			if (dup) {
				skipped++;
				continue;
			}
			await createNewsItem({
				title: a.title,
				source: a.source,
				source_url: a.url,
				raw_content: a.content,
				published_external_at: a.publishedAt,
				analyzed: false,
			});
			inserted++;
		} catch (e: unknown) {
			errors.push(`${a.url}: ${e instanceof Error ? e.message : String(e)}`);
		}
	}

	return { ok: true, fetched: articles.length, inserted, skipped, errors };
}

interface GptAnalysis {
	targetETF?: string;
	tickers?: string[];
	sentiment?: "bullish" | "bearish" | "neutral";
	score?: number;
	importance?: "low" | "medium" | "high";
	reason?: string;
}

export interface AnalyzeNewsResult {
	ok: true;
	pending: number;
	analyzed: number;
	errors: string[];
	signals: Awaited<ReturnType<typeof recomputeSignals>>;
}

export async function executeAnalyzeNews(limit: number): Promise<AnalyzeNewsResult> {
	const capped = Math.min(Math.max(limit, 1), 50);
	const pending = await listUnanalyzedNews(capped);
	let analyzed = 0;
	const errors: string[] = [];

	for (const n of pending) {
		const data = n.data as Record<string, unknown>;
		try {
			const result = await chatJson<GptAnalysis>(
				ANALYZE_NEWS_SYSTEM,
				analyzeNewsUserPrompt({
					title: String(data.title ?? ""),
					source: data.source as string,
					url: data.source_url as string,
					content: String(data.raw_content ?? ""),
				}),
				{ temperature: 0.2, maxTokens: 400 },
			);

			await updateNewsAnalysis(n.id, {
				target_etf: result.targetETF,
				tickers: (result.tickers ?? []).join(","),
				sentiment: result.sentiment,
				score: typeof result.score === "number" ? result.score : 5,
				importance: result.importance,
				reason: result.reason,
				analyzed: true,
			});
			analyzed++;
		} catch (e: unknown) {
			errors.push(`${n.id}: ${e instanceof Error ? e.message : String(e)}`);
		}
	}

	const signals = await recomputeSignals();
	return { ok: true, pending: pending.length, analyzed, errors, signals };
}

interface GptBlog {
	title?: string;
	summary?: string;
	seoDescription?: string;
	tags?: string[];
	markdown?: string;
}

export interface GenerateBlogResult {
	ok: true;
	created: { etf: string; slug: string; id: string; title: string }[];
	skipped: string[];
	errors: string[];
}

export async function executeGenerateBlog(options: {
	etf?: string;
	publish: boolean;
}): Promise<GenerateBlogResult> {
	const etfList: EtfTicker[] = options.etf
		? [options.etf.toUpperCase() as EtfTicker]
		: ([...ETF_TICKERS] as EtfTicker[]);
	const publish = options.publish;

	const analyzed = await listAnalyzedNews(200);
	const signals = await listSignals(50);
	const created: { etf: string; slug: string; id: string; title: string }[] = [];
	const skipped: string[] = [];
	const errors: string[] = [];

	for (const etf of etfList) {
		const items = analyzed
			.filter((n) => (n.data as { target_etf?: string }).target_etf === etf)
			.slice(0, 8);
		if (items.length === 0) {
			skipped.push(`${etf} (분석된 뉴스 없음)`);
			continue;
		}
		const latestSignal = signals.find((s) => (s.data as { ticker?: string }).ticker === etf);
		const score = Number((latestSignal?.data as { score?: number })?.score ?? 5);
		const sentiment =
			items.filter((i) => (i.data as { sentiment?: string }).sentiment === "bullish").length >=
			items.filter((i) => (i.data as { sentiment?: string }).sentiment === "bearish").length
				? "bullish"
				: "bearish";

		const tickers = Array.from(
			new Set(
				items
					.flatMap((i) => String((i.data as { tickers?: string }).tickers ?? "").split(","))
					.map((t) => t.trim())
					.filter(Boolean),
			),
		);

		try {
			const result = await chatJson<GptBlog>(
				BLOG_SYSTEM,
				blogUserPrompt({
					targetETF: etf,
					tickers,
					sentiment,
					score,
					signalLabel: scoreToLabel(score),
					reason: (items[0]?.data as { reason?: string })?.reason,
					news: items.map((i) => ({
						title: String((i.data as { title?: string }).title ?? ""),
						source: (i.data as { source?: string }).source as string,
						url: (i.data as { source_url?: string }).source_url as string,
						excerpt: String((i.data as { raw_content?: string }).raw_content ?? "").slice(0, 240),
					})),
				}),
				{ temperature: 0.6, maxTokens: 1800 },
			);

			const title = result.title?.trim() || `${etf} 시그널 리서치`;
			const slug = slugify(title);

			const created_ = await createBlogPost({
				slug,
				title,
				summary: result.summary?.trim() ?? "",
				content: textToPortableText(result.markdown ?? ""),
				seo_description: result.seoDescription?.trim() ?? "",
				target_etf: etf,
				tickers: tickers.join(","),
				sentiment,
				signal_score: score,
				signal_label: scoreToLabel(score),
				source_news_url: (items[0]?.data as { source_url?: string })?.source_url ?? "",
				auto_generated: true,
				publish,
			});

			created.push({ etf, slug: created_.slug, id: created_.id, title });
		} catch (e: unknown) {
			errors.push(`${etf}: ${e instanceof Error ? e.message : String(e)}`);
		}
	}

	return { ok: true, created, skipped, errors };
}

/** Mock 전용 URL 중복 시에도 날짜를 새로 받기 위해 기존 mock 행을 제거합니다. */
export function deleteMockDuplicateNews(): number {
	const dbPath = join(process.cwd(), "data.db");
	const db = new Database(dbPath);
	const r = db
		.prepare(
			`DELETE FROM ec_news_items
       WHERE source_url LIKE '%example.com/news/%' OR source = 'Mock Newswire'`,
		)
		.run();
	db.close();
	return r.changes;
}
