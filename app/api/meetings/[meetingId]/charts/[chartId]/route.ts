import { unlink } from "node:fs/promises";
import path from "node:path";
import { chartDirectory, database } from "@/lib/server/database";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(
	_request: Request,
	{ params }: { params: Promise<{ meetingId: string; chartId: string }> },
) {
	const { meetingId, chartId } = await params;
	const passed = database
		.prepare(`
			SELECT 1 FROM meeting_charts c
			JOIN passed_charts p ON p.music_id = c.music_id AND p.difficulty = c.difficulty
			WHERE c.meeting_id = ? AND c.id = ?
		`)
		.get(meetingId, chartId);
	if (passed) {
		return Response.json(
			{ error: "合格済みの譜面を削除するには、先に合格を取り消してください。" },
			{ status: 409 },
		);
	}
	const chart = database
		.prepare(`
		SELECT id, file_name AS fileName FROM meeting_charts WHERE meeting_id = ? AND id = ?
	`)
		.get(meetingId, chartId) as { id: string; fileName: string } | undefined;
	if (!chart)
		return Response.json({ error: "譜面が見つかりません。" }, { status: 404 });
	const removeChart = database.transaction(() => {
		database.prepare("DELETE FROM meeting_charts WHERE id = ?").run(chart.id);
	});
	removeChart();
	await unlink(path.join(chartDirectory, chart.fileName)).catch(() => {});
	return new Response(null, { status: 204 });
}
