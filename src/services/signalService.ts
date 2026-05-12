/**
 * 분석된 뉴스 → ETF 별 시그널 점수 산출 → signals 컬렉션 저장.
 */

import { ETF_TICKERS, type EtfTicker } from "../lib/config.js";
import { aggregateForTicker, type AnalyzedNews } from "../lib/scoring.js";
import {
	listAnalyzedNews,
	upsertSignal,
} from "./emdashService.js";

export interface SignalSummary {
	ticker: EtfTicker;
	score: number;
	label: string;
	count: number;
}

export async function recomputeSignals(): Promise<SignalSummary[]> {
	const analyzed = await listAnalyzedNews(200);
	const summaries: SignalSummary[] = [];

	for (const etf of ETF_TICKERS) {
		const items: AnalyzedNews[] = analyzed
			.filter((n) => (n.data as any).target_etf === etf)
			.map((n) => ({
				sentiment: ((n.data as any).sentiment ?? "neutral") as AnalyzedNews["sentiment"],
				score: Number((n.data as any).score ?? 0),
				importance: ((n.data as any).importance ?? "medium") as AnalyzedNews["importance"],
			}));

		const signal = aggregateForTicker(items);
		const summary = `${etf} · 분석된 뉴스 ${items.length}건 · ${signal.label} (${signal.score.toFixed(
			1,
		)}/10) · 감성 ${signal.sentiment.toFixed(1)} · 빈도 ${signal.frequency.toFixed(1)} · 모멘텀 ${signal.momentum.toFixed(1)} · 변동성 ${signal.volatility.toFixed(1)}`;

		await upsertSignal({
			ticker: etf,
			signal_label: signal.label,
			score: signal.score,
			sentiment_score: Number(signal.sentiment.toFixed(2)),
			frequency_score: Number(signal.frequency.toFixed(2)),
			momentum_score: Number(signal.momentum.toFixed(2)),
			volatility_score: Number(signal.volatility.toFixed(2)),
			summary,
		});

		summaries.push({ ticker: etf, score: signal.score, label: signal.label, count: items.length });
	}

	return summaries;
}
