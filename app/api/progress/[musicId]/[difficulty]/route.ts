import { loadCatalog } from "@/lib/server/catalog";
import { database } from "@/lib/server/database";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function updatePass(
	params: Promise<{ musicId: string; difficulty: string }>,
	passed: boolean,
) {
	const { musicId, difficulty } = await params;
	if (!["basic", "advanced", "master"].includes(difficulty)) {
		return Response.json(
			{ error: "難易度が正しくありません。" },
			{ status: 400 },
		);
	}
	try {
		if (passed) {
			const sheetExists = (await loadCatalog())
				.flatMap((item) => item.sheets)
				.some(
					(sheet) =>
						sheet.musicId === musicId && sheet.difficulty === difficulty,
				);
			if (!sheetExists)
				return Response.json(
					{ error: "譜面がカタログにありません。" },
					{ status: 404 },
				);
			database
				.prepare(`
				INSERT INTO passed_charts (music_id, difficulty, passed_at) VALUES (?, ?, ?)
				ON CONFLICT(music_id, difficulty) DO UPDATE SET passed_at = excluded.passed_at
			`)
				.run(musicId, difficulty, new Date().toISOString());
		} else {
			database
				.prepare(
					"DELETE FROM passed_charts WHERE music_id = ? AND difficulty = ?",
				)
				.run(musicId, difficulty);
		}
		return new Response(null, { status: 204 });
	} catch (error) {
		return Response.json(
			{
				error:
					error instanceof Error
						? error.message
						: "進捗を更新できませんでした。",
			},
			{ status: 503 },
		);
	}
}

export async function PUT(
	_request: Request,
	{ params }: { params: Promise<{ musicId: string; difficulty: string }> },
) {
	return updatePass(params, true);
}

export async function DELETE(
	_request: Request,
	{ params }: { params: Promise<{ musicId: string; difficulty: string }> },
) {
	return updatePass(params, false);
}
