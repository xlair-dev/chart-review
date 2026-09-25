import { randomUUID } from "node:crypto";
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
		const passedCount = database
			.prepare("SELECT COUNT(*) AS count FROM passed_charts")
			.get() as { count: number };
		const rows = database
			.prepare(`
			SELECT m.id, m.held_on AS heldOn, m.created_at AS createdAt,
			       COALESCE(s.passed_count, ?1) AS passedCount,
			       COALESCE(s.total_count, ?2) AS totalCount,
			       (SELECT COUNT(*) FROM meeting_charts c WHERE c.meeting_id = m.id) AS chartCount
			FROM meetings m
			LEFT JOIN meeting_progress_snapshots s ON s.meeting_id = m.id
			ORDER BY m.created_at DESC, m.rowid DESC
		`)
			.all(passedCount.count, totalCount);
		return Response.json(rows);
	} catch (error) {
		return Response.json(
			{
				error:
					error instanceof Error
						? error.message
						: "FB 会を取得できませんでした。",
			},
			{ status: 503 },
		);
	}
}

export async function POST(request: Request) {
	try {
		const body = (await request.json()) as { heldOn?: unknown };
		if (
			typeof body.heldOn !== "string" ||
			!/^\d{4}-\d{2}-\d{2}$/.test(body.heldOn)
		) {
			return Response.json(
				{ error: "開催日を入力してください。" },
				{ status: 400 },
			);
		}
		const heldOn = new Date(`${body.heldOn}T00:00:00.000Z`);
		if (
			Number.isNaN(heldOn.valueOf()) ||
			heldOn.toISOString().slice(0, 10) !== body.heldOn
		) {
			return Response.json(
				{ error: "開催日が正しくありません。" },
				{ status: 400 },
			);
		}
		const catalog = await loadCatalog();
		const totalCount = catalog.reduce(
			(total, item) => total + item.sheets.length,
			0,
		);
		const passedCount = (
			database.prepare("SELECT COUNT(*) AS count FROM passed_charts").get() as {
				count: number;
			}
		).count;
		const id = randomUUID();
		const createdAt = new Date().toISOString();
		const createMeeting = database.transaction(() => {
			const previous = database
				.prepare(
					"SELECT id FROM meetings ORDER BY created_at DESC, rowid DESC LIMIT 1",
				)
				.get() as { id: string } | undefined;
			if (previous) {
				database
					.prepare(`
					INSERT OR IGNORE INTO meeting_progress_snapshots (meeting_id, passed_count, total_count)
					VALUES (?, ?, (SELECT total_count FROM meetings WHERE id = ?))
				`)
					.run(previous.id, passedCount, previous.id);
			}
			database
				.prepare(
					"INSERT INTO meetings (id, held_on, created_at, total_count) VALUES (?, ?, ?, ?)",
				)
				.run(id, body.heldOn, createdAt, totalCount);
		});
		createMeeting();
		return Response.json(
			{
				id,
				heldOn: body.heldOn,
				createdAt,
				passedCount,
				totalCount,
				chartCount: 0,
			},
			{ status: 201 },
		);
	} catch (error) {
		return Response.json(
			{
				error:
					error instanceof Error
						? error.message
						: "FB 会を作成できませんでした。",
			},
			{ status: 503 },
		);
	}
}
