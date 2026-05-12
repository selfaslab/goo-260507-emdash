/**
 * POST /api/analyze-youtube
 *
 * youtube_videos 컬렉션에 GPT 요약(summary) 이 비어 있는 항목을 골라
 * 다시 GPT 분석을 돌려 채워 넣습니다 (배치 재분석).
 *
 * Body (옵션): { "limit": 10 }
 */
import type { APIRoute } from "astro";

import { config } from "../../lib/config.js";
import { emdash } from "../../services/emdashService.js";
import { analyzeVideo } from "../../services/youtubeAnalysisService.js";
import type { YouTubeVideo } from "../../services/youtubeService.js";

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
	if (config.cronSecret) {
		const got = request.headers.get("x-cron-secret");
		if (got !== config.cronSecret) return jsonError(401, "invalid cron secret");
	}

	let body: { limit?: number } = {};
	try {
		body = (await request.json()) as { limit?: number };
	} catch {}
	const limit = Math.min(Math.max(Number(body.limit ?? 10), 1), 50);

	const collected: Array<{ id: string; data: Record<string, unknown> }> = [];
	for (const status of ["published", "draft"]) {
		const { items } = await emdash().list("youtube_videos", { limit: 100, status });
		for (const it of items) collected.push({ id: it.id, data: it.data as Record<string, unknown> });
	}

	const pending = collected.filter(
		(c) => typeof c.data.summary !== "string" || (c.data.summary as string).trim().length === 0,
	);
	const target = pending.slice(0, limit);

	let analyzed = 0;
	const errors: string[] = [];
	for (const c of target) {
		try {
			const v: YouTubeVideo = {
				videoId: String(c.data.video_id ?? ""),
				title: String(c.data.title ?? ""),
				channelTitle: String(c.data.channel ?? ""),
				description: String(c.data.description ?? ""),
				thumbnail: String(c.data.thumbnail ?? ""),
				publishedAt: String(c.data.published_external_at ?? new Date().toISOString()),
				viewCount: Number(c.data.view_count ?? 0),
			};
			const keywords = String(c.data.keywords ?? "")
				.split(",")
				.map((k) => k.trim())
				.filter(Boolean);
			const a = await analyzeVideo(v, keywords);
			await emdash().update("youtube_videos", c.id, {
				data: { ...c.data, summary: a.summary, sentiment: a.sentiment, relevance: a.relevance },
			});
			analyzed++;
		} catch (e) {
			errors.push(`${c.id}: ${e instanceof Error ? e.message : String(e)}`);
		}
	}

	return new Response(
		JSON.stringify({ ok: true, pending: pending.length, analyzed, errors }, null, 2),
		{ headers: { "content-type": "application/json; charset=utf-8" } },
	);
};

function jsonError(status: number, message: string) {
	return new Response(JSON.stringify({ ok: false, error: message }), {
		status,
		headers: { "content-type": "application/json; charset=utf-8" },
	});
}
