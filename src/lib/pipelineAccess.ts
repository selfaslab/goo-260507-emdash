/**
 * 관리자 자동화 API 접근 제어.
 * - EmDash에 로그인한 관리자(role ≥ 50) + CSRF 헤더 X-EmDash-Request: 1
 * - 또는 CRON_SECRET / ADMIN_PIPELINE_SECRET 헤더 (자동화·CLI용)
 */
import type { APIContext } from "astro";

import { config } from "./config.js";

function jsonError(status: number, message: string) {
	return new Response(JSON.stringify({ ok: false, error: message }), {
		status,
		headers: { "content-type": "application/json; charset=utf-8" },
	});
}

function isAdminRole(role: unknown): boolean {
	if (role === "admin" || role === "Administrators") return true;
	const n = typeof role === "bigint" ? Number(role) : Number(role);
	return Number.isFinite(n) && n >= 50;
}

/** EmDash `locals.user` 기준 관리자(role ≥ 50 등) 여부 — 페이지·링크 노출용 */
export function isEmdashAdminUser(user: { role?: unknown } | null | undefined): boolean {
	if (!user) return false;
	return isAdminRole(user.role);
}

/**
 * 일부 요청(특히 /api/*)에서는 미들웨어가 `locals.user`를 채우기 전에 `emdash.db`가 없어
 * 세션 해석이 건너뛰어질 수 있습니다. EmDash snapshot API 와 동일하게 여기서 한 번 더 붙입니다.
 */
export async function attachPipelineUserFromSession(ctx: APIContext): Promise<void> {
	if ((ctx.locals as { user?: unknown }).user) return;
	const emdash = ctx.locals.emdash as { db?: unknown } | undefined;
	const db = emdash?.db;
	if (!db || !ctx.session) return;
	try {
		const sessionUser = await ctx.session.get("user");
		if (!sessionUser?.id) return;
		// EmDash runtime Kysely — 프로젝트에 auth 패키지 타입이 없어 any 로 조회합니다.
		const row = await (db as { selectFrom: (t: string) => any })
			.selectFrom("users")
			.select(["id", "role", "disabled"])
			.where("id", "=", sessionUser.id)
			.executeTakeFirst();
		if (row && !Number(row.disabled)) {
			(ctx.locals as { user?: { role?: unknown } }).user = { role: row.role };
		}
	} catch {
		// ignore
	}
}

/**
 * @returns null 이면 통과, Response 이면 그대로 반환
 */
export function assertNewsPipelineAccess(ctx: APIContext): Response | null {
	const cron = ctx.request.headers.get("x-cron-secret");
	if (config.cronSecret && cron === config.cronSecret) return null;

	const adminPipe = ctx.request.headers.get("x-admin-pipeline-secret");
	if (config.adminPipelineSecret && adminPipe === config.adminPipelineSecret) return null;

	const user = ctx.locals.user as { role?: unknown } | undefined;
	if (isEmdashAdminUser(user)) {
		if (ctx.request.headers.get("X-EmDash-Request") !== "1") {
			return jsonError(403, "브라우저 요청에는 X-EmDash-Request: 1 헤더가 필요합니다 (CSRF 방지).");
		}
		return null;
	}

	return jsonError(
		401,
		"관리자 로그인 세션이 필요하거나, X-Cron-Secret / X-Admin-Pipeline-Secret(환경 변수 설정 시)을 사용하세요. " +
			"브라우저에서는 EmDash에 로그인한 뒤 **주소가 동일한 호스트**에서 열어야 합니다(예: admin을 localhost로 열었다면 자동화도 localhost, 127.0.0.1 과는 쿠키가 다릅니다).",
	);
}
