/**
 * Signal Score = 0.4*Sentiment + 0.2*Frequency + 0.3*Momentum + 0.1*Volatility
 * 모든 입력은 0~10 으로 정규화된 값을 가정.
 */

import { clamp } from "./utils.js";

export interface ScoringInputs {
	sentiment: number; // 0..10  (강세 우호 ↑)
	frequency: number; // 0..10  (관련 뉴스 빈도)
	momentum: number; // 0..10  (가격/거래량 모멘텀)
	volatility: number; // 0..10  (변동성. 높을수록 점수 ↑ 가정 — 스펙에 명시된 가중치만 적용)
}

export interface SignalResult extends ScoringInputs {
	score: number; // 0..10
	label: SignalLabel;
}

export type SignalLabel = "Strong Buy" | "Buy" | "Neutral" | "Sell" | "Strong Sell";

export function computeSignalScore(inputs: ScoringInputs): SignalResult {
	const sentiment = clamp(inputs.sentiment, 0, 10);
	const frequency = clamp(inputs.frequency, 0, 10);
	const momentum = clamp(inputs.momentum, 0, 10);
	const volatility = clamp(inputs.volatility, 0, 10);

	const raw = 0.4 * sentiment + 0.2 * frequency + 0.3 * momentum + 0.1 * volatility;
	const score = Math.round(raw * 10) / 10;

	return {
		sentiment,
		frequency,
		momentum,
		volatility,
		score,
		label: scoreToLabel(score),
	};
}

export function scoreToLabel(score: number): SignalLabel {
	if (score >= 8) return "Strong Buy";
	if (score >= 6) return "Buy";
	if (score >= 4) return "Neutral";
	if (score >= 2) return "Sell";
	return "Strong Sell";
}

/**
 * GPT 분석 결과 묶음으로부터 Signal 점수를 산출.
 * - sentiment: bullish/neutral/bearish 별 평균 score 가중 평균
 * - frequency: 분석된 뉴스 개수 (10건 ≈ 10점 상한)
 * - momentum: 평균 GPT score → 0~10 그대로 사용 (대용)
 * - volatility: importance high 비율 * 10
 */
export interface AnalyzedNews {
	sentiment: "bullish" | "bearish" | "neutral";
	score: number; // 0..10
	importance?: "low" | "medium" | "high";
}

export function aggregateForTicker(items: AnalyzedNews[]): SignalResult {
	if (items.length === 0) {
		return computeSignalScore({ sentiment: 5, frequency: 0, momentum: 5, volatility: 0 });
	}
	const bullish = items.filter((i) => i.sentiment === "bullish");
	const bearish = items.filter((i) => i.sentiment === "bearish");
	const neutral = items.filter((i) => i.sentiment === "neutral");

	const wAvg =
		(bullish.reduce((s, i) => s + i.score, 0) +
			neutral.reduce((s, i) => s + i.score * 0.6, 0) -
			bearish.reduce((s, i) => s + i.score, 0)) /
		Math.max(1, items.length);
	const sentiment = clamp(5 + wAvg / 2, 0, 10);

	const frequency = clamp(items.length, 0, 10);

	const momentum = clamp(items.reduce((s, i) => s + i.score, 0) / items.length, 0, 10);

	const highShare = items.filter((i) => i.importance === "high").length / items.length;
	const volatility = clamp(highShare * 10, 0, 10);

	return computeSignalScore({ sentiment, frequency, momentum, volatility });
}
