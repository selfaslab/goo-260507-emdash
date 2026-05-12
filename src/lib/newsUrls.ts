/** mock 뉴스 등 문서용 example.com 링크 — 클릭 시 의미 없는 페이지로 이동함 */
export function isDemoNewsUrl(url: string | undefined | null): boolean {
	if (!url) return false;
	try {
		const host = new URL(url).hostname;
		return host === "example.com" || host === "www.example.com";
	} catch {
		return false;
	}
}
