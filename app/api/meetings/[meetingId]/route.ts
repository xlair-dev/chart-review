import { loadCatalog } from "@/lib/server/catalog";
import { database } from "@/lib/server/database";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
	_request: Request,
	{ params }: { params: Promise<{ meetingId: string }> },
) {
	const { meetingId } = await params;
	const meeting = database
		.prepare(`
		SELECT m.id, m.held_on AS heldOn, m.created_at AS createdAt,
		       s.passed_count AS snapshotPassedCount,
		       s.total_count AS snapshotTotalCount,
		       m.total_count AS totalCount
		FROM meetings m
	LEFT JOIN meeting_progress_snapshots s ON s.meeting_id = m.id
	WHERE m.id = ?
	`)
		.get(meetingId);
	if (!meeting)
		return Response.json({ error: "FB 会が見つかりません。" }, { status: 404 });
	const row = meeting as {
		id: string;
		heldOn: string;
		createdAt: string;
		snapshotPassedCount: number | null;
		snapshotTotalCount: number | null;
		totalCount: number;
	};
	const currentId = database
		.prepare(
			"SELECT id FROM meetings ORDER BY created_at DESC, rowid DESC LIMIT 1",
		)
		.get() as { id: string } | undefined;
	const isCurrent =
		currentId?.id === row.id && row.snapshotPassedCount === null;
	const totalCount = isCurrent
		? (await loadCatalog()).reduce(
				(total, item) => total + item.sheets.length,
				0,
			)
		: (row.snapshotTotalCount ?? row.totalCount);
	const passedCount =
		row.snapshotPassedCount ??
		(
			database.prepare("SELECT COUNT(*) AS count FROM passed_charts").get() as {
				count: number;
			}
		).count;
	return Response.json({
		id: row.id,
		heldOn: row.heldOn,
		createdAt: row.createdAt,
		passedCount,
		totalCount,
	});
}
