/**
 * Demo blog_posts 한 건 작성 + 발행. (`tsx scripts/seed-demo-post.ts`)
 * /blog/[slug] 에 RelatedVideosSection 이 어떻게 보이는지 즉시 확인하기 위한 보조 스크립트.
 */
import { createBlogPost } from "../src/services/emdashService.js";
import { textToPortableText } from "../src/lib/utils.js";

const md = `## 요약

NVIDIA 가 직전 분기 대비 견조한 AI 서버 수요를 바탕으로 가이던스를 상향했고, SOXX ETF 의 단기 모멘텀이 회복되는 모습이다.

## ETF 영향 분석

- SOXX 와 SMH 는 NVDA 비중이 높아 NVIDIA 실적 노이즈에 직접 노출.
- 데이터센터 GPU 수요 강세는 AVGO/AMD/MU 같은 동반 종목까지 견인.
- 단기 변동성은 가이던스 컨센서스 대비 상승률에 좌우.

## 결론

분석 시점 시그널은 Buy(7.0) 수준이며, 실적 발표 직후 hyperscaler capex 가이던스를 모니터링.

## 리스크 / 모니터링 포인트

- 환율, 미·중 수출통제 변수.
- HBM 공급 부족 → 출하량 변수.
`;

const slug = `nvda-soxx-demo-${Date.now().toString(36).slice(-5)}`;

const created = await createBlogPost({
	slug,
	title: "NVIDIA 실적 호조가 SOXX ETF에 미치는 영향 (데모)",
	summary: "NVIDIA 의 AI 서버 수요 강세 → SOXX/SMH 의 단기 시그널 점검.",
	content: textToPortableText(md),
	seo_description: "NVIDIA 실적 호조와 SOXX ETF 의 단기 시그널, 그리고 모니터링 포인트.",
	target_etf: "SOXX",
	tickers: "NVDA,TSM,AVGO",
	sentiment: "bullish",
	signal_score: 7.0,
	signal_label: "Buy",
	source_news_url: "https://example.com/news/nvda-blackwell",
	auto_generated: false,
	publish: true,
});

console.log("created:", created);
