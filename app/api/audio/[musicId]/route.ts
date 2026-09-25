import { loadCatalog } from "@/lib/server/catalog";

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

		const serverUrl = process.env.CHART_REVIEW_SERVER_URL;
		const deviceToken = process.env.CHART_REVIEW_DEVICE_TOKEN;
		if (!serverUrl || !deviceToken)
			return new Response("音源を取得できません。", { status: 503 });

		const headers = new Headers({ Authorization: `Bearer ${deviceToken}` });
		const range = request.headers.get("range");
		if (range) headers.set("Range", range);
		const upstream = await fetch(new URL(music.audio.url, serverUrl), {
			cache: "no-store",
			headers,
		});
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
	} catch {
		return new Response("音源を取得できませんでした。", { status: 502 });
	}
}
