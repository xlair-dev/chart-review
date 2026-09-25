import { readFile } from "node:fs/promises";
import path from "node:path";
import { chartDirectory, database } from "@/lib/server/database";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
	_request: Request,
	{ params }: { params: Promise<{ meetingId: string; chartId: string }> },
) {
	const { meetingId, chartId } = await params;
	const chart = database
		.prepare(`
		SELECT file_name AS fileName FROM meeting_charts WHERE meeting_id = ? AND id = ?
	`)
		.get(meetingId, chartId) as { fileName: string } | undefined;
	if (!chart) return new Response("譜面が見つかりません。", { status: 404 });
	try {
		const contents = await readFile(path.join(chartDirectory, chart.fileName));
		return new Response(contents, {
			headers: {
				"Content-Type": "application/octet-stream",
				"Content-Disposition": `attachment; filename="${chart.fileName}"`,
			},
		});
	} catch {
		return new Response("保存された譜面ファイルがありません。", {
			status: 404,
		});
	}
}
