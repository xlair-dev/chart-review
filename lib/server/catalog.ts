import "server-only";
import type { CatalogItem } from "@/lib/catalog-model";

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
	const serverUrl = process.env.CHART_REVIEW_SERVER_URL;
	const deviceToken = process.env.CHART_REVIEW_DEVICE_TOKEN;
	if (!serverUrl || !deviceToken) {
		throw new Error(
			"CHART_REVIEW_SERVER_URL と CHART_REVIEW_DEVICE_TOKEN を設定してください。",
		);
	}

	const response = await fetch(new URL("/sync", serverUrl), {
		cache: "no-store",
		headers: { Authorization: `Bearer ${deviceToken}` },
	});
	if (!response.ok) {
		throw new Error(
			`楽曲カタログを取得できませんでした（${response.status}）。`,
		);
	}
	return (await response.json()) as CatalogItem[];
}
