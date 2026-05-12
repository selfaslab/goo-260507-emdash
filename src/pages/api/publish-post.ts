/**
 * POST /api/publish-post
 * Body: { "id": "<blog_posts entry id>", "publish": true | false }
 */
import type { APIRoute } from "astro";

import { config } from "../../lib/config.js";
import { publishBlogPost, unpublishBlogPost } from "../../services/emdashService.js";

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
	if (config.cronSecret) {
		const got = request.headers.get("x-cron-secret");
		if (got !== config.cronSecret) return jsonError(401, "invalid cron secret");
	}

	let body: { id?: string; publish?: boolean } = {};
	try {
		body = await request.json();
	} catch {}
	if (!body.id) return jsonError(400, "id is required");

	if (body.publish === false) await unpublishBlogPost(body.id);
	else await publishBlogPost(body.id);

	return new Response(JSON.stringify({ ok: true, id: body.id, published: body.publish !== false }), {
		headers: { "content-type": "application/json; charset=utf-8" },
	});
};

function jsonError(status: number, message: string) {
	return new Response(JSON.stringify({ ok: false, error: message }), {
		status,
		headers: { "content-type": "application/json; charset=utf-8" },
	});
}
