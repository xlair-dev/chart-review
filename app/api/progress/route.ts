import { loadCatalog } from "@/lib/server/catalog";
import { database } from "@/lib/server/database";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
	try {
		const catalog = await loadCatalog();
		const totalCount = catalog.reduce(
			(total, item) => total + item.sheets.length,
			0,
		);
		const passed = database
			.prepare(`
			SELECT p.music_id AS musicId, p.difficulty, p.passed_at AS passedAt,
			       (SELECT c.meeting_id FROM meeting_charts c
			        WHERE c.music_id = p.music_id AND c.difficulty = p.difficulty
			        ORDER BY c.uploaded_at DESC LIMIT 1) AS meetingId,
			       (SELECT c.id FROM meeting_charts c
			        WHERE c.music_id = p.music_id AND c.difficulty = p.difficulty
			        ORDER BY c.uploaded_at DESC LIMIT 1) AS chartId
			FROM passed_charts p ORDER BY p.passed_at DESC
		`)
			.all();
		return Response.json({ passed, passedCount: passed.length, totalCount });
	} catch (error) {
		return Response.json(
			{
				error:
					error instanceof Error
						? error.message
						: "進捗を取得できませんでした。",
			},
			{ status: 503 },
		);
	}
}
