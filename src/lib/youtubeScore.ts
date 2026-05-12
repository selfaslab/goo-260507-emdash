/**
 * YouTube Video Score = 0.5·KeywordMatch + 0.3·Views + 0.2·Recency
 *
 * - 모든 sub-score 는 0~1 정규화. 최종 score 는 0~10 으로 환산해 반환.
 * - Recency: 30일 윈도우 기준 선형 감쇠 (0일=1, 30일=0).
 * - Views: log10(views+1) / 7 로 정규화 (1천만뷰 ≈ 1.0).
 */

import { clamp } from "./utils.js";

export interface VideoScoreInputs {
	titleAndDescription: string;
	keywords: string[];
	viewCount: number;
	publishedAt: string | Date;
	now?: Date;
}

export interface VideoScoreResult {
	score: number; // 0..10
	keywordMatch: number; // 0..1
	views: number; // 0..1
	recency: number; // 0..1
}

const RECENCY_WINDOW_DAYS = 30;
const VIEW_LOG_DIVISOR = 7;
const STOPWORDS = new Set([
	"the",
	"a",
	"an",
	"and",
	"or",
	"of",
	"in",
	"on",
	"to",
	"for",
	"with",
	"by",
	"is",
	"are",
	"this",
	"that",
	"how",
	"why",
	"about",
]);

export function computeVideoScore(input: VideoScoreInputs): VideoScoreResult {
	const text = input.titleAndDescription.toLowerCase();
	const tokens = new Set(
		text
			.replace(/[^\p{Letter}\p{Number}\s]/gu, " ")
			.split(/\s+/)
			.filter((t) => t.length >= 2 && !STOPWORDS.has(t)),
	);

	let matched = 0;
	let total = 0;
	for (const raw of input.keywords) {
		const kw = raw.toLowerCase().trim();
		if (!kw) continue;
		total++;
		const subTokens = kw.split(/\s+/).filter((t) => t.length >= 2 && !STOPWORDS.has(t));
		const allHit = subTokens.length > 0 && subTokens.every((t) => tokens.has(t) || text.includes(t));
		if (allHit || text.includes(kw)) matched++;
	}
	const keywordMatch = total === 0 ? 0 : clamp(matched / total, 0, 1);

	const views = clamp(Math.log10(Math.max(0, input.viewCount) + 1) / VIEW_LOG_DIVISOR, 0, 1);

	const now = input.now ?? new Date();
	const published = input.publishedAt instanceof Date ? input.publishedAt : new Date(input.publishedAt);
	const days = Number.isFinite(published.getTime())
		? Math.max(0, (now.getTime() - published.getTime()) / (1000 * 60 * 60 * 24))
		: RECENCY_WINDOW_DAYS;
	const recency = clamp(1 - days / RECENCY_WINDOW_DAYS, 0, 1);

	const raw = 0.5 * keywordMatch + 0.3 * views + 0.2 * recency;
	const score = Math.round(raw * 10 * 10) / 10;

	return {
		score,
		keywordMatch: Number(keywordMatch.toFixed(3)),
		views: Number(views.toFixed(3)),
		recency: Number(recency.toFixed(3)),
	};
}
