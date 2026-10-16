import { readFile } from "node:fs/promises";
import path from "node:path";
import { loadCatalog } from "@/lib/server/catalog";
import { chartDirectory, getDatabase } from "@/lib/server/database";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function safeFilenamePart(value: string): string {
	return value
		.replace(/[<>:"/\\|?*]/g, "_")
		.replace(/\p{Cc}/gu, "_")
		.trim()
		.replace(/[. ]+$/g, "");
}

/**
 * Provides an ASCII fallback and an RFC 5987 UTF-8 filename for the attachment.
 */
function attachmentDisposition(fileName: string): string {
	const fallback = fileName
		.replace(/[^\x20-\x7e]/g, "_")
		.replace(/["\\]/g, "_");
	const encoded = encodeURIComponent(fileName).replace(
		/['()*]/g,
		(character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
	);
	return `attachment; filename="${fallback}"; filename*=UTF-8''${encoded}`;
}

/** Builds a filename from the current catalog title and the uploaded file extension. */
function chartDownloadFileName(
	title: string,
	difficulty: string,
	storedFileName: string,
): string {
	const safeTitle = safeFilenamePart(title) || "chart";
	const safeDifficulty = safeFilenamePart(difficulty) || "chart";
	return `${safeTitle}-${safeDifficulty}${path.extname(storedFileName)}`;
}

export async function GET(
	_request: Request,
	{ params }: { params: Promise<{ meetingId: string; chartId: string }> },
) {
	const { meetingId, chartId } = await params;
	const database = getDatabase();
	const chart = database
		.prepare(`
		SELECT music_id AS musicId, difficulty, file_name AS fileName
		FROM meeting_charts WHERE meeting_id = ? AND id = ?
	`)
		.get(meetingId, chartId) as
		| { musicId: string; difficulty: string; fileName: string }
		| undefined;
	if (!chart) return new Response("譜面が見つかりません。", { status: 404 });
	const catalog = await loadCatalog();
	const music = catalog.find((item) => item.music.id === chart.musicId)?.music;
	if (!music) return new Response("楽曲が見つかりません。", { status: 404 });
	const downloadFileName = chartDownloadFileName(
		music.title,
		chart.difficulty,
		chart.fileName,
	);
	try {
		const contents = await readFile(path.join(chartDirectory, chart.fileName));
		return new Response(contents, {
			headers: {
				"Content-Type": "application/octet-stream",
				"Content-Disposition": attachmentDisposition(downloadFileName),
			},
		});
	} catch {
		return new Response("保存された譜面ファイルがありません。", {
			status: 404,
		});
	}
}
