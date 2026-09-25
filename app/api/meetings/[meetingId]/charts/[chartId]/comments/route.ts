import { randomUUID } from "node:crypto";
import { database } from "@/lib/server/database";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
	_request: Request,
	{ params }: { params: Promise<{ meetingId: string; chartId: string }> },
) {
	const { meetingId, chartId } = await params;
	const chart = database
		.prepare("SELECT 1 FROM meeting_charts WHERE meeting_id = ? AND id = ?")
		.get(meetingId, chartId);
	if (!chart)
		return Response.json({ error: "譜面が見つかりません。" }, { status: 404 });
	const comments = database
		.prepare(`
		SELECT id, display_name AS displayName, position_numerator AS numerator,
		       position_denominator AS denominator, body, created_at AS createdAt
		FROM comments WHERE meeting_chart_id = ? ORDER BY created_at
	`)
		.all(chartId);
	return Response.json(comments);
}

export async function POST(
	request: Request,
	{ params }: { params: Promise<{ meetingId: string; chartId: string }> },
) {
	const { meetingId, chartId } = await params;
	const chart = database
		.prepare("SELECT 1 FROM meeting_charts WHERE meeting_id = ? AND id = ?")
		.get(meetingId, chartId);
	if (!chart)
		return Response.json({ error: "譜面が見つかりません。" }, { status: 404 });
	const input = (await request.json()) as {
		displayName?: unknown;
		position?: { numerator?: unknown; denominator?: unknown };
		body?: unknown;
	};
	const numerator = input.position?.numerator;
	const denominator = input.position?.denominator;
	if (
		typeof input.displayName !== "string" ||
		input.displayName.trim().length === 0 ||
		input.displayName.length > 32 ||
		typeof input.body !== "string" ||
		input.body.trim().length === 0 ||
		input.body.length > 2000 ||
		typeof numerator !== "string" ||
		typeof denominator !== "string" ||
		!/^\d+$/.test(numerator) ||
		!/^\d+$/.test(denominator) ||
		BigInt(denominator) === BigInt(0)
	) {
		return Response.json(
			{ error: "表示名・コメント・譜面位置を確認してください。" },
			{ status: 400 },
		);
	}
	const id = randomUUID();
	const createdAt = new Date().toISOString();
	database
		.prepare(`
		INSERT INTO comments (id, meeting_chart_id, display_name, position_numerator, position_denominator, body, created_at)
		VALUES (?, ?, ?, ?, ?, ?, ?)
	`)
		.run(
			id,
			chartId,
			input.displayName.trim(),
			numerator,
			denominator,
			input.body.trim(),
			createdAt,
		);
	return Response.json(
		{
			id,
			displayName: input.displayName.trim(),
			numerator,
			denominator,
			body: input.body.trim(),
			createdAt,
		},
		{ status: 201 },
	);
}
