/**
 * POST /api/analyze-news
 *
 * 분석되지 않은 news_items 를 GPT-4o 로 분석해 ETF 영향(sentiment/score/...) 을 채우고,
 * 그 다음 ETF 별 시그널을 재계산해 signals 컬렉션에 저장합니다.
 *
 * Body (옵션): { "limit": 25 }
 */
import type { APIRoute } from "astro";

import { config } from "../../lib/config.js";
import { executeAnalyzeNews } from "../../services/newsPipelineJobs.js";

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
	if (config.cronSecret) {
		const got = request.headers.get("x-cron-secret");
		if (got !== config.cronSecret) return jsonError(401, "invalid cron secret");
	}

	let body: { limit?: number } = {};
	try {
		body = await request.json();
	} catch {}
	const limit = Math.min(Math.max(Number(body.limit ?? 15), 1), 50);

	const result = await executeAnalyzeNews(limit);
	return new Response(JSON.stringify(result, null, 2), {
		headers: { "content-type": "application/json; charset=utf-8" },
	});
};

function jsonError(status: number, message: string) {
	return new Response(JSON.stringify({ ok: false, error: message }), {
		status,
		headers: { "content-type": "application/json; charset=utf-8" },
	});
}
