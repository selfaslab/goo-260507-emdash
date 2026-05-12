/** Slugify a Korean/English title to a URL-safe slug (a-z0-9-) with timestamp suffix. */
export function slugify(input: string, max = 80): string {
	const base = input
		.toLowerCase()
		.normalize("NFKD")
		.replace(/[^\p{Letter}\p{Number}\s-]/gu, "")
		.replace(/\s+/g, "-")
		.replace(/-+/g, "-")
		.replace(/^-|-$/g, "")
		.slice(0, max);
	const ts = Date.now().toString(36).slice(-5);
	return base ? `${base}-${ts}` : `post-${ts}`;
}

export function safeJsonParse<T>(input: string, fallback: T): T {
	try {
		return JSON.parse(input) as T;
	} catch {
		return fallback;
	}
}

/** First JSON object/array embedded in a string (handles ```json fences). */
export function extractJson<T = unknown>(text: string): T | null {
	const fenced = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
	const candidate = fenced ? fenced[1] : text;
	const start = candidate.search(/[\[{]/);
	if (start < 0) return null;
	const end = candidate.lastIndexOf(candidate[start] === "{" ? "}" : "]");
	if (end < 0) return null;
	try {
		return JSON.parse(candidate.slice(start, end + 1)) as T;
	} catch {
		return null;
	}
}

/** Plain text → very simple Portable Text blocks (paragraphs, h2 from "## ..."). */
export function textToPortableText(text: string): unknown[] {
	const lines = text.split(/\r?\n/);
	const blocks: unknown[] = [];
	let key = 0;
	for (const line of lines) {
		const trimmed = line.trim();
		if (!trimmed) continue;
		const heading = trimmed.match(/^(#{1,3})\s+(.*)$/);
		if (heading) {
			const level = heading[1].length;
			blocks.push({
				_type: "block",
				_key: `k${key++}`,
				style: level === 1 ? "h1" : level === 2 ? "h2" : "h3",
				children: [{ _type: "span", _key: `s${key++}`, text: heading[2] }],
			});
			continue;
		}
		blocks.push({
			_type: "block",
			_key: `k${key++}`,
			style: "normal",
			children: [{ _type: "span", _key: `s${key++}`, text: trimmed }],
		});
	}
	return blocks;
}

export function clamp(value: number, min: number, max: number): number {
	return Math.max(min, Math.min(max, value));
}
