/**
 * YouTube 영상 설명 → ETF 투자 관점 GPT 요약.
 *
 * 반환 타입:
 *   { summary, sentiment, relevance }
 *
 * - GPT 호출 실패하거나 키 없을 때는 description 앞부분 + 중립 sentiment + 0.5 relevance 로 fallback.
 */

import { config } from "../lib/config.js";
import { clamp } from "../lib/utils.js";
import { chatJson } from "./openaiService.js";
import type { YouTubeVideo } from "./youtubeService.js";

export interface VideoAnalysis {
	summary: string;
	sentiment: "bullish" | "bearish" | "neutral";
	relevance: number; // 0..1
}

const SYSTEM = `당신은 ETF 투자자를 위한 YouTube 영상 큐레이터입니다.
주어진 영상의 제목/채널/설명을 보고, AI 반도체 ETF (SOXX/SMH/QQQ) 투자자 관점에서
요약 + 감성 + 관련도를 JSON 으로만 반환합니다 (코드펜스 금지).

스키마:
{
  "summary": "한국어 1~2문장 요약. 영상이 다루는 핵심 메시지와 ETF 시사점.",
  "sentiment": "bullish | bearish | neutral",
  "relevance": 0~1 (소수, ETF 투자에 얼마나 유용한가)
}`;

function userPrompt(video: YouTubeVideo, keywords: string[]): string {
	return [
		`제목: ${video.title}`,
		`채널: ${video.channelTitle}`,
		`업로드: ${video.publishedAt}`,
		`조회수: ${video.viewCount}`,
		`검색 키워드: ${keywords.join(", ")}`,
		"",
		"설명:",
		(video.description ?? "").slice(0, 3000),
	].join("\n");
}

export async function analyzeVideo(
	video: YouTubeVideo,
	keywords: string[],
): Promise<VideoAnalysis> {
	if (!config.openaiApiKey) {
		return ruleBasedAnalysis(video);
	}
	try {
		const result = await chatJson<{ summary?: unknown; sentiment?: unknown; relevance?: unknown }>(
			SYSTEM,
			userPrompt(video, keywords),
			{ temperature: 0.3, maxTokens: 280 },
		);
		const summary =
			typeof result.summary === "string" && result.summary.trim().length > 0
				? result.summary.trim()
				: ruleBasedSummary(video);
		const sentiment = sanitizeSentiment(result.sentiment);
		const relevance =
			typeof result.relevance === "number" && Number.isFinite(result.relevance)
				? clamp(result.relevance, 0, 1)
				: 0.5;
		return { summary, sentiment, relevance: Number(relevance.toFixed(3)) };
	} catch (e) {
		console.warn("[youtube-analysis] GPT 실패 → fallback", e);
		return ruleBasedAnalysis(video);
	}
}

export async function analyzeVideos(
	videos: YouTubeVideo[],
	keywords: string[],
): Promise<VideoAnalysis[]> {
	// 직렬화: rate-limit 보호 (최대 5개라 부담 없음)
	const out: VideoAnalysis[] = [];
	for (const v of videos) {
		out.push(await analyzeVideo(v, keywords));
	}
	return out;
}

function sanitizeSentiment(value: unknown): VideoAnalysis["sentiment"] {
	if (value === "bullish" || value === "bearish" || value === "neutral") return value;
	return "neutral";
}

function ruleBasedSummary(video: YouTubeVideo): string {
	const text = (video.description ?? "").trim().replace(/\s+/g, " ");
	const head = text.slice(0, 160);
	return head.length > 0 ? head : `${video.channelTitle} 가 업로드한 영상.`;
}

function ruleBasedAnalysis(video: YouTubeVideo): VideoAnalysis {
	return { summary: ruleBasedSummary(video), sentiment: "neutral", relevance: 0.5 };
}
