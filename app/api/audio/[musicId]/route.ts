import { loadCatalog } from "@/lib/server/catalog";
import {
	fetchXlairApi,
	XlairApiConfigurationError,
} from "@/lib/server/xlair-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
	request: Request,
	{ params }: { params: Promise<{ musicId: string }> },
) {
	try {
		const { musicId } = await params;
		const music = (await loadCatalog()).find(
			(item) => item.music.id === musicId,
		)?.music;
		if (!music?.audio)
			return new Response("音源がありません。", { status: 404 });

		const headers = new Headers();
		const range = request.headers.get("range");
		if (range) headers.set("Range", range);
		const upstream = await fetchXlairApi(music.audio.url, { headers });
		const responseHeaders = new Headers();
		for (const name of [
			"accept-ranges",
			"content-length",
			"content-range",
			"content-type",
		]) {
			const value = upstream.headers.get(name);
			if (value) responseHeaders.set(name, value);
		}
		return new Response(upstream.body, {
			status: upstream.status,
			headers: responseHeaders,
		});
	} catch (error) {
		if (error instanceof XlairApiConfigurationError)
			return new Response("音源を取得できません。", { status: 503 });
		return new Response("音源を取得できませんでした。", { status: 502 });
	}
}
