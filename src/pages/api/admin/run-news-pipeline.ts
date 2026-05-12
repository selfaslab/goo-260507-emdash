/**
 * POST /api/admin/run-news-pipeline
 *
 * 뉴스 수집 → GPT 분석·시그널 → (옵션) 리서치 블로그 생성·발행 을 한 번에 실행합니다.
 *
 * 인증 (하나만 만족):
 * - EmDash 관리자 세션 + `X-EmDash-Request: 1` (브라우저 CSRF)
 * - `X-Cron-Secret` = CRON_SECRET
 * - `X-Admin-Pipeline-Secret` = ADMIN_PIPELINE_SECRET (환경 변수 설정 시)
 */
import type { APIRoute } from "astro";

import {
	assertNewsPipelineAccess,
	attachPipelineUserFromSession,
} from "../../../lib/pipelineAccess.js";
import {
	deleteMockDuplicateNews,
	executeAnalyzeNews,
	executeFetchNews,
	executeGenerateBlog,
} from "../../../services/newsPipelineJobs.js";

export const prerender = false;

interface Body {
	maxNews?: number;
	analyzeLimit?: number;
	publishBlog?: boolean;
	runBlog?: boolean;
	refreshMockDuplicates?: boolean;
}

export const POST: APIRoute = async (ctx) => {
	await attachPipelineUserFromSession(ctx);
	const denied = assertNewsPipelineAccess(ctx);
	if (denied) return denied;

	let body: Body = {};
	try {
		body = await ctx.request.json();
	} catch {
		/* empty body OK */
	}

	const maxNews = Math.min(Math.max(Number(body.maxNews ?? 30), 1), 100);
	const analyzeLimit = Math.min(Math.max(Number(body.analyzeLimit ?? 30), 1), 50);
	const publishBlog = body.publishBlog !== false;
	const runBlog = body.runBlog !== false;
	const refreshMockDuplicates = body.refreshMockDuplicates !== false;

	let mockDeleted = 0;
	if (refreshMockDuplicates) {
		try {
			mockDeleted = deleteMockDuplicateNews();
		} catch (e: unknown) {
			return jsonError(
				500,
				`mock 뉴스 정리 실패: ${e instanceof Error ? e.message : String(e)}`,
			);
		}
	}

	const fetchResult = await executeFetchNews(maxNews);
	const analyzeResult = await executeAnalyzeNews(analyzeLimit);

	let blogResult: Awaited<ReturnType<typeof executeGenerateBlog>> | null = null;
	if (runBlog) {
		blogResult = await executeGenerateBlog({ publish: publishBlog });
	}

	return new Response(
		JSON.stringify(
			{
				ok: true,
				mockDeleted,
				fetch: fetchResult,
				analyze: analyzeResult,
				blog: blogResult,
			},
			null,
			2,
		),
		{ headers: { "content-type": "application/json; charset=utf-8" } },
	);
};

function jsonError(status: number, message: string) {
	return new Response(JSON.stringify({ ok: false, error: message }), {
		status,
		headers: { "content-type": "application/json; charset=utf-8" },
	});
}
