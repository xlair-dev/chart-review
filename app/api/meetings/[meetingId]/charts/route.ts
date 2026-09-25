import { randomUUID } from "node:crypto";
import { unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { loadCatalog } from "@/lib/server/catalog";
import { chartDirectory, database } from "@/lib/server/database";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
	_request: Request,
	{ params }: { params: Promise<{ meetingId: string }> },
) {
	const { meetingId } = await params;
	const meeting = database
		.prepare("SELECT id FROM meetings WHERE id = ?")
		.get(meetingId);
	if (!meeting)
		return Response.json({ error: "FB 会が見つかりません。" }, { status: 404 });
	const rows = database
		.prepare(`
		SELECT c.id, c.music_id AS musicId, c.difficulty, c.description,
		       c.uploaded_at AS uploadedAt, c.file_name AS fileName
		FROM meeting_charts c
	WHERE c.meeting_id = ?
	ORDER BY c.uploaded_at DESC
	`)
		.all(meetingId);
	return Response.json(rows);
}

export async function POST(
	request: Request,
	{ params }: { params: Promise<{ meetingId: string }> },
) {
	const { meetingId } = await params;
	const meeting = database
		.prepare("SELECT id FROM meetings WHERE id = ?")
		.get(meetingId);
	if (!meeting)
		return Response.json({ error: "FB 会が見つかりません。" }, { status: 404 });

	const form = await request.formData();
	const musicId = form.get("musicId");
	const difficulty = form.get("difficulty");
	const description = form.get("description");
	const file = form.get("file");
	const extension =
		file instanceof File ? file.name.split(".").pop()?.toLowerCase() : "";
	if (
		typeof musicId !== "string" ||
		!(["basic", "advanced", "master"] as const).includes(
			difficulty as "basic" | "advanced" | "master",
		) ||
		typeof description !== "string" ||
		!(file instanceof File) ||
		!(["c2s", "sus", "ugc"] as const).includes(
			extension as "c2s" | "sus" | "ugc",
		) ||
		file.size === 0 ||
		file.size > 16 * 1024 * 1024
	) {
		return Response.json(
			{
				error:
					"有効な C2S、SUS、UGC 譜面と難易度を選んでください（16 MB 以下）。",
			},
			{ status: 400 },
		);
	}

	try {
		const catalog = await loadCatalog();
		const sheet = catalog
			.flatMap((item) => item.sheets)
			.find(
				(item) => item.musicId === musicId && item.difficulty === difficulty,
			);
		if (!sheet)
			return Response.json(
				{ error: "曲と難易度がカタログにありません。" },
				{ status: 400 },
			);
		const id = randomUUID();
		const fileName = `${id}.${extension}`;
		const targetPath = path.join(
			/* turbopackIgnore: true */ chartDirectory,
			fileName,
		);
		await writeFile(targetPath, Buffer.from(await file.arrayBuffer()), {
			flag: "wx",
		});
		const uploadedAt = new Date().toISOString();
		let result:
			| { kind: "passed" }
			| {
					kind: "saved";
					chartId: string;
					previousFileName?: string;
			  };
		try {
			const saveChart = database.transaction(() => {
				if (
					database
						.prepare(
							"SELECT 1 FROM passed_charts WHERE music_id = ? AND difficulty = ?",
						)
						.get(musicId, difficulty)
				) {
					return { kind: "passed" as const };
				}
				const previous = database
					.prepare(`
						SELECT id, file_name AS fileName FROM meeting_charts
						WHERE meeting_id = ? AND music_id = ? AND difficulty = ?
					`)
					.get(meetingId, musicId, difficulty) as
					| { id: string; fileName: string }
					| undefined;
				const chartId = previous?.id ?? randomUUID();
				if (previous) {
					const update = database
						.prepare(`
						UPDATE meeting_charts
						SET file_name = ?, description = ?, uploaded_at = ? WHERE id = ?
					`)
						.run(fileName, description, uploadedAt, chartId);
					if (update.changes !== 1)
						throw new Error("差し替え対象の譜面が見つかりません。");
					database
						.prepare("DELETE FROM comments WHERE meeting_chart_id = ?")
						.run(chartId);
				} else {
					database
						.prepare(`
						INSERT INTO meeting_charts (id, meeting_id, music_id, difficulty, file_name, description, uploaded_at)
						VALUES (?, ?, ?, ?, ?, ?, ?)
					`)
						.run(
							chartId,
							meetingId,
							musicId,
							difficulty,
							fileName,
							description,
							uploadedAt,
						);
				}
				return {
					kind: "saved" as const,
					chartId,
					previousFileName: previous?.fileName,
				};
			});
			result = saveChart();
		} catch (error) {
			await unlink(targetPath).catch(() => {});
			throw error;
		}
		if (result.kind === "passed") {
			await unlink(targetPath).catch(() => {});
			return Response.json(
				{ error: "合格済みの譜面は再アップロードできません。" },
				{ status: 409 },
			);
		}
		if (result.previousFileName)
			await unlink(path.join(chartDirectory, result.previousFileName)).catch(
				() => {},
			);
		return Response.json(
			{ id: result.chartId, musicId, difficulty, description, uploadedAt },
			{ status: result.previousFileName ? 200 : 201 },
		);
	} catch (error) {
		return Response.json(
			{
				error:
					error instanceof Error
						? error.message
						: "譜面を保存できませんでした。",
			},
			{ status: 503 },
		);
	}
}
