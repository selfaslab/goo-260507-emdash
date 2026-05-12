/**
 * GET /api/fetch-news
 *
 * NewsAPI / Finnhub 에서 AI 반도체 관련 뉴스를 수집해 EmDash news_items 컬렉션에 저장.
 * 중복 URL 은 건너뜀.
 *
 * 보호: CRON_SECRET 가 설정되어 있으면 X-Cron-Secret 헤더가 일치해야 합니다.
 */
import type { APIRoute } from "astro";

import { config } from "../../lib/config.js";
import { executeFetchNews } from "../../services/newsPipelineJobs.js";

export const prerender = false;

export const GET: APIRoute = async ({ request, url }) => {
	if (config.cronSecret) {
		const got = request.headers.get("x-cron-secret");
		if (got !== config.cronSecret) {
			return jsonError(401, "invalid cron secret");
		}
	}
	const max = Number(url.searchParams.get("max") ?? "20");

	const result = await executeFetchNews(max);
	return json(result);
};

function json(data: unknown) {
	return new Response(JSON.stringify(data, null, 2), {
		headers: { "content-type": "application/json; charset=utf-8" },
	});
}
function jsonError(status: number, message: string) {
	return new Response(JSON.stringify({ ok: false, error: message }), {
		status,
		headers: { "content-type": "application/json; charset=utf-8" },
	});
}
