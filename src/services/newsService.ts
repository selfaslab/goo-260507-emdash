/**
 * 뉴스 수집기.
 * - NewsAPI 우선, 실패 시 Finnhub.
 * - 둘 다 키가 없으면 mockNews 로 fallback (UI/파이프라인 시연용).
 */

import { config, NEWS_KEYWORDS } from "../lib/config.js";

export interface FetchedNews {
	title: string;
	content: string;
	source: string;
	url: string;
	publishedAt: string;
}

export async function fetchNews(options: { max?: number } = {}): Promise<FetchedNews[]> {
	const max = options.max ?? 20;

	if (config.newsApiKey) {
		try {
			return await fetchFromNewsAPI(max);
		} catch (e) {
			console.error("[news] NewsAPI 실패", e);
		}
	}
	if (config.finnhubApiKey) {
		try {
			return await fetchFromFinnhub(max);
		} catch (e) {
			console.error("[news] Finnhub 실패", e);
		}
	}
	console.warn("[news] API 키 없음 또는 호출 실패 → mock 데이터 사용");
	return mockNews(max);
}

async function fetchFromNewsAPI(max: number): Promise<FetchedNews[]> {
	const q = NEWS_KEYWORDS.map((k) => `"${k}"`).join(" OR ");
	const url = new URL("https://newsapi.org/v2/everything");
	url.searchParams.set("q", q);
	url.searchParams.set("language", "en");
	url.searchParams.set("sortBy", "publishedAt");
	url.searchParams.set("pageSize", String(max));
	url.searchParams.set("apiKey", config.newsApiKey!);

	const res = await fetch(url);
	if (!res.ok) throw new Error(`NewsAPI ${res.status}`);
	const json = (await res.json()) as {
		articles: Array<{
			title: string;
			description?: string;
			content?: string;
			source?: { name?: string };
			url: string;
			publishedAt: string;
		}>;
	};
	return json.articles
		.filter((a) => a.title && a.url)
		.map((a) => ({
			title: a.title,
			content: a.content || a.description || "",
			source: a.source?.name ?? "NewsAPI",
			url: a.url,
			publishedAt: a.publishedAt,
		}));
}

async function fetchFromFinnhub(max: number): Promise<FetchedNews[]> {
	const url = new URL("https://finnhub.io/api/v1/news");
	url.searchParams.set("category", "technology");
	url.searchParams.set("token", config.finnhubApiKey!);

	const res = await fetch(url);
	if (!res.ok) throw new Error(`Finnhub ${res.status}`);
	const arr = (await res.json()) as Array<{
		headline: string;
		summary: string;
		source: string;
		url: string;
		datetime: number;
	}>;
	return arr.slice(0, max).map((n) => ({
		title: n.headline,
		content: n.summary,
		source: n.source,
		url: n.url,
		publishedAt: new Date(n.datetime * 1000).toISOString(),
	}));
}

/** API 키 없을 때 사용하는 데모 데이터 (UI 검증용). */
export function mockNews(n = 6): FetchedNews[] {
	const now = new Date();
	const samples: Omit<FetchedNews, "publishedAt">[] = [
		{
			title: "NVIDIA, 차세대 Blackwell GPU 출하 지연 우려 해소…AI 서버 수요 강세",
			content:
				"NVIDIA가 Blackwell 아키텍처 기반 차세대 데이터센터 GPU 의 양산 일정에 대한 시장 우려를 해소하며, 주요 하이퍼스케일러의 AI 서버 발주 잔고가 견조하다고 밝혔다.",
			source: "Mock Newswire",
			url: "https://example.com/news/nvda-blackwell",
		},
		{
			title: "TSMC, 2nm 공정 수율 개선…AVGO·NVDA 주문 확대 시사",
			content:
				"TSMC의 N2 공정 수율이 빠르게 개선되며 Broadcom과 NVIDIA의 위탁 생산 물량이 확대될 가능성이 제기됐다.",
			source: "Mock Newswire",
			url: "https://example.com/news/tsmc-2nm",
		},
		{
			title: "ASML, 하이뉴메리컬 EUV 출하 가이던스 상향",
			content:
				"ASML이 하이NA EUV 장비 출하 가이던스를 상향, 첨단 로직/메모리 설비 투자 사이클이 지속될 것으로 전망.",
			source: "Mock Newswire",
			url: "https://example.com/news/asml-highna",
		},
		{
			title: "Micron, HBM3E 풀가동…2026 캐파 완판 임박",
			content:
				"Micron이 HBM3E 12-Hi 양산 풀가동에 들어갔다고 밝혔다. AI 서버용 HBM 공급은 2026년까지 사실상 완판 상태다.",
			source: "Mock Newswire",
			url: "https://example.com/news/mu-hbm3e",
		},
		{
			title: "AMD, 인스팅트 MI400 로드맵 공개…NVDA 점유율 추격",
			content:
				"AMD가 차세대 데이터센터 가속기 MI400 시리즈 로드맵을 공개하며, NVIDIA가 독점한 AI 학습/추론 시장 점유율 회복에 박차.",
			source: "Mock Newswire",
			url: "https://example.com/news/amd-mi400",
		},
		{
			title: "Broadcom, 자체 ASIC 매출 가이던스 상향…커스텀 AI 칩 모멘텀",
			content:
				"Broadcom이 자체 AI ASIC 사업 매출 가이던스를 상향, 빅테크 커스텀 칩 수주 모멘텀이 강하게 유지되고 있음을 시사.",
			source: "Mock Newswire",
			url: "https://example.com/news/avgo-asic",
		},
	];
	return samples.slice(0, n).map((s, i) => ({
		...s,
		publishedAt: new Date(now.getTime() - i * 1000 * 60 * 60).toISOString(),
	}));
}
