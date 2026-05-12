/**
 * 블로그 (제목 + 본문/요약) → YouTube 검색용 영문 키워드 5개 추출.
 *
 * 1) OpenAI 키가 있으면 GPT 가 영문 5개를 JSON 으로 반환 (정확도 ↑).
 * 2) 키가 없거나 GPT 가 실패하면 규칙 기반 fallback (티커/ETF/상수 키워드).
 *
 * 항상 중복 제거 + 최대 5개 보장.
 */

import { COMPANY_TICKERS, ETF_TICKERS, config } from "../lib/config.js";
import { extractJson } from "../lib/utils.js";
import { chatJson } from "./openaiService.js";

export interface KeywordContext {
	title: string;
	body?: string;
	targetEtf?: string;
	tickers?: string[];
}

const SYSTEM = `당신은 ETF 리서치용 YouTube 검색 키워드 큐레이터입니다.
입력으로 한국어/영어 혼합된 블로그 제목+본문이 들어오면, AI 반도체 ETF 투자자 관점에서
"YouTube 영어 검색어"로 가장 효과적인 영문 키워드 5개를 JSON 으로만 반환합니다.

규칙:
- 영어 키워드 (구문 OK, 1~4단어).
- 종목/ETF 티커는 풀네임 또는 티커 (예: "NVIDIA earnings", "SOXX ETF").
- "AI semiconductor", "AI chip demand", "data center GPU" 같은 일반 시장 키워드도 1~2개 포함.
- 중복/유사어 제거.
- 응답: { "keywords": ["...","...","...","...","..."] } 만. 5개 이하 가능.`;

function userPrompt(ctx: KeywordContext): string {
	const lines = [
		`제목: ${ctx.title}`,
		ctx.targetEtf ? `타깃 ETF: ${ctx.targetEtf}` : "",
		ctx.tickers?.length ? `관련 티커: ${ctx.tickers.join(", ")}` : "",
		ctx.body ? `본문 일부: ${ctx.body.slice(0, 1500)}` : "",
	].filter(Boolean);
	return lines.join("\n");
}

/** Rule-based fallback. GPT 호출 실패하거나 키 없을 때 사용. */
function ruleBased(ctx: KeywordContext): string[] {
	const out: string[] = [];
	const text = `${ctx.title} ${ctx.body ?? ""}`.toUpperCase();

	// ETF
	const etf = ctx.targetEtf ?? ETF_TICKERS.find((t) => text.includes(t));
	if (etf) out.push(`${etf} ETF`);

	// 회사 티커 → 풀네임 + earnings
	const companies = Object.entries(COMPANY_TICKERS) as Array<[string, string]>;
	for (const [name, ticker] of companies) {
		if (
			(ctx.tickers ?? []).map((t) => t.toUpperCase()).includes(ticker) ||
			text.includes(ticker) ||
			text.includes(name.toUpperCase())
		) {
			out.push(`${name} earnings analysis`);
		}
		if (out.length >= 4) break;
	}

	// 시장 일반
	out.push("AI semiconductor market");
	out.push("AI chip demand");

	return Array.from(new Set(out)).slice(0, 5);
}

export async function extractKeywords(ctx: KeywordContext): Promise<string[]> {
	if (config.openaiApiKey) {
		try {
			const result = await chatJson<{ keywords?: unknown }>(SYSTEM, userPrompt(ctx), {
				temperature: 0.2,
				maxTokens: 200,
			});
			const list = Array.isArray(result.keywords) ? (result.keywords as unknown[]) : [];
			const cleaned = Array.from(
				new Set(
					list
						.filter((k): k is string => typeof k === "string")
						.map((k) => k.trim())
						.filter((k) => k.length >= 2),
				),
			).slice(0, 5);
			if (cleaned.length > 0) return cleaned;
		} catch (e) {
			console.warn("[youtube-keyword] GPT 추출 실패 → rule-based 사용", e);
		}
	}
	return ruleBased(ctx);
}

/** GPT 가 반환한 JSON 이 keywords 가 아닌 다른 키일 때 보호용 helper. */
export function tryParseKeywordList(text: string): string[] {
	const parsed = extractJson<{ keywords?: unknown } | unknown[]>(text);
	if (!parsed) return [];
	const list = Array.isArray(parsed) ? parsed : Array.isArray(parsed.keywords) ? parsed.keywords : [];
	return list.filter((k): k is string => typeof k === "string");
}
