/**
 * OpenAI 래퍼.
 * - chat.completions.create 만 사용 (responses API 의존성 줄임)
 * - 키 없으면 디터미니스틱 stub 으로 graceful fallback (개발 환경)
 */

import OpenAI from "openai";

import { config } from "../lib/config.js";
import { extractJson } from "../lib/utils.js";

let _client: OpenAI | null = null;
function client(): OpenAI {
	if (_client) return _client;
	if (!config.openaiApiKey) {
		throw new Error("OPENAI_API_KEY가 설정되지 않았습니다. .env 파일을 확인하세요.");
	}
	_client = new OpenAI({ apiKey: config.openaiApiKey });
	return _client;
}

export async function chatJson<T = unknown>(
	system: string,
	user: string,
	options: { temperature?: number; maxTokens?: number } = {},
): Promise<T> {
	if (!config.openaiApiKey) {
		throw new Error("OPENAI_API_KEY가 설정되지 않아 GPT 호출을 진행할 수 없습니다.");
	}
	const completion = await client().chat.completions.create({
		model: config.openaiModel,
		response_format: { type: "json_object" },
		temperature: options.temperature ?? 0.4,
		max_tokens: options.maxTokens ?? 1200,
		messages: [
			{ role: "system", content: system },
			{ role: "user", content: user },
		],
	});
	const text = completion.choices[0]?.message?.content ?? "{}";
	const parsed = extractJson<T>(text);
	if (!parsed) {
		throw new Error(`GPT 응답이 JSON이 아닙니다: ${text.slice(0, 200)}`);
	}
	return parsed;
}

export async function chatText(
	system: string,
	user: string,
	options: { temperature?: number; maxTokens?: number } = {},
): Promise<string> {
	if (!config.openaiApiKey) {
		throw new Error("OPENAI_API_KEY가 설정되지 않아 GPT 호출을 진행할 수 없습니다.");
	}
	const completion = await client().chat.completions.create({
		model: config.openaiModel,
		temperature: options.temperature ?? 0.6,
		max_tokens: options.maxTokens ?? 1800,
		messages: [
			{ role: "system", content: system },
			{ role: "user", content: user },
		],
	});
	return completion.choices[0]?.message?.content ?? "";
}
