/**
 * POST /api/generate-blog
 *
 * 분석된 뉴스(news_items.analyzed=true) 를 ETF 별로 묶어 GPT 에 넘기고,
 * SEO 최적화된 한국어 리서치 글을 생성해 blog_posts 에 저장합니다.
 *
 * Body (옵션):
 *   { "etf": "SOXX", "publish": false }
 *   etf 미지정 시 SOXX/SMH/QQQ 모두 1편씩 생성.
 */
import type { APIRoute } from "astro";

import { config } from "../../lib/config.js";
import { executeGenerateBlog } from "../../services/newsPipelineJobs.js";

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
	if (config.cronSecret) {
		const got = request.headers.get("x-cron-secret");
		if (got !== config.cronSecret) return jsonError(401, "invalid cron secret");
	}

	let body: { etf?: string; publish?: boolean } = {};
	try {
		body = await request.json();
	} catch {}

	const result = await executeGenerateBlog({
		etf: body.etf,
		publish: !!body.publish,
	});

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
