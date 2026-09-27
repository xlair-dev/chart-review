import "server-only";
import type { CatalogItem } from "@/lib/catalog-model";
import { fetchXlairApi } from "@/lib/server/xlair-api";

type CatalogCache = {
	value?: CatalogItem[];
	expiresAt: number;
	pending?: Promise<CatalogItem[]>;
};

const globalCatalog = globalThis as typeof globalThis & {
	chartReviewCatalogCache?: CatalogCache;
};

export async function loadCatalog(): Promise<CatalogItem[]> {
	let cache = globalCatalog.chartReviewCatalogCache;
	if (!cache) {
		cache = { expiresAt: 0 };
		globalCatalog.chartReviewCatalogCache = cache;
	}
	if (cache.value && cache.expiresAt > Date.now()) return cache.value;
	if (cache.pending) return cache.pending;
	cache.pending = fetchCatalog();
	try {
		cache.value = await cache.pending;
		cache.expiresAt = Date.now() + 30_000;
		return cache.value;
	} finally {
		cache.pending = undefined;
	}
}

async function fetchCatalog(): Promise<CatalogItem[]> {
	const response = await fetchXlairApi("/sync");
	if (!response.ok) {
		throw new Error(
			`楽曲カタログを取得できませんでした（${response.status}）。`,
		);
	}
	return (await response.json()) as CatalogItem[];
}
