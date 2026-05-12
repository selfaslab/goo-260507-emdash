/**
 * GPT 프롬프트 정의 (한국어 리서치 톤).
 * 모든 응답은 JSON 또는 마크다운 본문 형태로 강제.
 */

export interface NewsContext {
	title: string;
	source?: string;
	url?: string;
	content: string;
}

export const ANALYZE_NEWS_SYSTEM = `당신은 AI 반도체 ETF 전문 퀀트 리서처입니다.
주어진 뉴스가 SOXX / SMH / QQQ ETF 와 관련 핵심 기업(NVIDIA, AMD, TSMC, Broadcom, Micron, ASML) 에 미치는
단기 영향(1~5거래일)을 평가하고, 반드시 아래 JSON 스키마만 반환합니다 (코드펜스/주석 금지).
{
  "targetETF": "SOXX | SMH | QQQ",
  "tickers": ["NVDA", "AMD", "TSM", "AVGO", "MU", "ASML"],
  "sentiment": "bullish | bearish | neutral",
  "score": 0-10 (소수점 1자리),
  "importance": "low | medium | high",
  "reason": "한국어 1~3문장 핵심 근거"
}`;

export function analyzeNewsUserPrompt(news: NewsContext): string {
	return [
		"다음 뉴스를 분석하라:",
		`- 제목: ${news.title}`,
		news.source ? `- 출처: ${news.source}` : "",
		news.url ? `- URL: ${news.url}` : "",
		"- 본문:",
		news.content.slice(0, 4000),
	]
		.filter(Boolean)
		.join("\n");
}

export const BLOG_SYSTEM = `당신은 한국어 ETF 리서치 미디어의 전속 작가입니다.
독자: 미국 AI 반도체 ETF 에 관심 있는 한국 개인 투자자.
스타일:
- 객관적, 차분한 톤. 과장/가벼운 클릭베이트 금지.
- 2,500~3,500자, 마크다운 사용. ## 소제목 3~5개.
- 첫 문단(요약)에 결론과 시그널/스코어를 1문장으로 명시.
- 마지막 문단은 "리스크 / 모니터링 포인트" 로 마무리.
- 투자 권유로 해석되지 않도록 "참고용"이라는 디스클레이머를 본문 말미에 1문장 포함.

반환 형식 (반드시 이 JSON 만, 코드펜스 금지):
{
  "title": "SEO에 최적화된 한국어 제목 (60자 이내)",
  "summary": "기사 요약 1~2문장",
  "seoDescription": "150자 이내 메타 설명",
  "tags": ["SOXX", "NVIDIA", ...],
  "markdown": "본문 마크다운"
}`;

export interface BlogContext {
	targetETF: string;
	tickers: string[];
	sentiment: string;
	score: number;
	signalLabel: string;
	reason?: string;
	news: { title: string; source?: string; url?: string; excerpt?: string }[];
}

export function blogUserPrompt(ctx: BlogContext): string {
	const newsLines = ctx.news
		.slice(0, 5)
		.map(
			(n, i) =>
				`  ${i + 1}. ${n.title}${n.source ? ` (${n.source})` : ""}${n.url ? ` — ${n.url}` : ""}${
					n.excerpt ? `\n     요약: ${n.excerpt.slice(0, 240)}` : ""
				}`,
		)
		.join("\n");

	return [
		"다음 ETF 시그널과 뉴스 묶음을 바탕으로 한국어 리서치 글을 작성하라.",
		"",
		`- 타깃 ETF: ${ctx.targetETF}`,
		`- 관련 티커: ${ctx.tickers.join(", ") || "-"}`,
		`- 감성: ${ctx.sentiment}`,
		`- 점수: ${ctx.score.toFixed(1)} / 10  → 시그널: ${ctx.signalLabel}`,
		ctx.reason ? `- 핵심 근거 (요지): ${ctx.reason}` : "",
		"",
		"참고 뉴스:",
		newsLines || "  (없음)",
	]
		.filter(Boolean)
		.join("\n");
}
