import { loadCatalog } from "@/lib/server/catalog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
	try {
		const catalog = await loadCatalog();
		return Response.json(
			catalog.map((item) => ({
				...item,
				music: {
					...item.music,
					audio: item.music.audio
						? { url: `/api/audio/${item.music.id}` }
						: null,
				},
			})),
		);
	} catch (error) {
		return Response.json(
			{
				error:
					error instanceof Error
						? error.message
						: "カタログを取得できませんでした。",
			},
			{ status: 503 },
		);
	}
}
