import { unlink } from "node:fs/promises";
import path from "node:path";
import { chartDirectory, database } from "@/lib/server/database";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(
	request: Request,
	{ params }: { params: Promise<{ meetingId: string; chartId: string }> },
) {
	const { meetingId, chartId } = await params;
	const body = (await request.json().catch(() => null)) as {
		description?: unknown;
	} | null;
	if (typeof body?.description !== "string") {
		return Response.json(
			{ error: "説明を入力してください。" },
			{ status: 400 },
		);
	}
	const update = database
		.prepare(
			"UPDATE meeting_charts SET description = ? WHERE meeting_id = ? AND id = ?",
		)
		.run(body.description, meetingId, chartId);
	if (update.changes !== 1) {
		return Response.json({ error: "譜面が見つかりません。" }, { status: 404 });
	}
	return Response.json({ id: chartId, description: body.description });
}

export async function DELETE(
	_request: Request,
	{ params }: { params: Promise<{ meetingId: string; chartId: string }> },
) {
	const { meetingId, chartId } = await params;
	const removeChart = database.transaction(() => {
		const passed = database
			.prepare(`
				SELECT 1 FROM meeting_charts c
				JOIN passed_charts p ON p.music_id = c.music_id AND p.difficulty = c.difficulty
				WHERE c.meeting_id = ? AND c.id = ?
			`)
			.get(meetingId, chartId);
		if (passed) return { kind: "passed" as const };
		const chart = database
			.prepare(
				"SELECT file_name AS fileName FROM meeting_charts WHERE meeting_id = ? AND id = ?",
			)
			.get(meetingId, chartId) as { fileName: string } | undefined;
		if (!chart) return { kind: "missing" as const };
		database.prepare("DELETE FROM meeting_charts WHERE id = ?").run(chartId);
		return { kind: "deleted" as const, fileName: chart.fileName };
	});
	const result = removeChart();
	if (result.kind === "passed") {
		return Response.json(
			{ error: "合格済みの譜面を削除するには、先に合格を取り消してください。" },
			{ status: 409 },
		);
	}
	if (result.kind === "missing")
		return Response.json({ error: "譜面が見つかりません。" }, { status: 404 });
	await unlink(path.join(chartDirectory, result.fileName)).catch(() => {});
	return new Response(null, { status: 204 });
}
