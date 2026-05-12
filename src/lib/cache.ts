/**
 * 단순 in-memory TTL 캐시 + 동시 요청 dedup (single-flight).
 * - dev 서버는 단일 프로세스라 안전. 서버리스 배포 시에도 cold-start 단위로만 살아 있어 폭주 방지에는 충분.
 */

interface Entry<T> {
	value: T;
	expiresAt: number;
}

const store = new Map<string, Entry<unknown>>();
const inflight = new Map<string, Promise<unknown>>();

export function cacheGet<T>(key: string): T | undefined {
	const e = store.get(key) as Entry<T> | undefined;
	if (!e) return undefined;
	if (e.expiresAt < Date.now()) {
		store.delete(key);
		return undefined;
	}
	return e.value;
}

export function cacheSet<T>(key: string, value: T, ttlSec: number): void {
	store.set(key, { value, expiresAt: Date.now() + ttlSec * 1000 });
}

export async function cached<T>(key: string, ttlSec: number, loader: () => Promise<T>): Promise<T> {
	const existing = cacheGet<T>(key);
	if (existing !== undefined) return existing;
	const flight = inflight.get(key) as Promise<T> | undefined;
	if (flight) return flight;

	const p = loader()
		.then((v) => {
			cacheSet(key, v, ttlSec);
			return v;
		})
		.finally(() => {
			inflight.delete(key);
		});
	inflight.set(key, p);
	return p;
}
