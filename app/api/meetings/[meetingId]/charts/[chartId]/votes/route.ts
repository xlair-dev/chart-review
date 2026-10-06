import { getDatabase } from "@/lib/server/database";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parseVoter(input: unknown) {
	if (typeof input !== "string") return undefined;
	const displayName = input.trim();
	if (!displayName || displayName.length > 32) return undefined;
	return {
		displayName,
		key: displayName.normalize("NFKC").toLocaleLowerCase("ja-JP"),
	};
}

export async function PUT(
	request: Request,
	{ params }: { params: Promise<{ meetingId: string; chartId: string }> },
) {
	const { meetingId, chartId } = await params;
	const database = getDatabase();
	const chart = database
		.prepare("SELECT 1 FROM meeting_charts WHERE meeting_id = ? AND id = ?")
		.get(meetingId, chartId);
	if (!chart)
		return Response.json({ error: "譜面が見つかりません。" }, { status: 404 });
	const input = (await request.json().catch(() => null)) as {
		displayName?: unknown;
		vote?: unknown;
	} | null;
	const voter = parseVoter(input?.displayName);
	if (!voter || (input?.vote !== "passed" && input?.vote !== "failed")) {
		return Response.json(
			{ error: "表示名と投票内容を確認してください。" },
			{ status: 400 },
		);
	}
	database
		.prepare(`
		INSERT INTO chart_votes (meeting_chart_id, voter_key, display_name, vote, voted_at)
		VALUES (?, ?, ?, ?, ?)
		ON CONFLICT(meeting_chart_id, voter_key) DO UPDATE SET
			display_name = excluded.display_name,
			vote = excluded.vote,
			voted_at = excluded.voted_at
	`)
		.run(
			chartId,
			voter.key,
			voter.displayName,
			input.vote,
			new Date().toISOString(),
		);
	return Response.json({
		id: chartId,
		displayName: voter.displayName,
		vote: input.vote,
	});
}

export async function DELETE(
	request: Request,
	{ params }: { params: Promise<{ meetingId: string; chartId: string }> },
) {
	const { meetingId, chartId } = await params;
	const database = getDatabase();
	const chart = database
		.prepare("SELECT 1 FROM meeting_charts WHERE meeting_id = ? AND id = ?")
		.get(meetingId, chartId);
	if (!chart)
		return Response.json({ error: "譜面が見つかりません。" }, { status: 404 });
	const input = (await request.json().catch(() => null)) as {
		displayName?: unknown;
	} | null;
	const voter = parseVoter(input?.displayName);
	if (!voter)
		return Response.json(
			{ error: "表示名を確認してください。" },
			{ status: 400 },
		);
	database
		.prepare(
			"DELETE FROM chart_votes WHERE meeting_chart_id = ? AND voter_key = ?",
		)
		.run(chartId, voter.key);
	return new Response(null, { status: 204 });
}
