import "server-only";
import { mkdirSync } from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";

const dataDirectory = path.resolve(
	/* turbopackIgnore: true */ process.env.CHART_REVIEW_DATA_DIR ??
		path.join(process.cwd(), "data"),
);
// Keep this directory on persistent local storage; SQLite and uploaded charts live here.
mkdirSync(dataDirectory, { recursive: true });

const globalDatabase = globalThis as typeof globalThis & {
	chartReviewDatabase?: Database.Database;
};

export const database =
	globalDatabase.chartReviewDatabase ??
	new Database(path.join(dataDirectory, "chart-review.sqlite"));

if (process.env.NODE_ENV !== "production") {
	globalDatabase.chartReviewDatabase = database;
}

database.pragma("journal_mode = WAL");
database.pragma("foreign_keys = ON");
database.exec(`
	CREATE TABLE IF NOT EXISTS meetings (
		id TEXT PRIMARY KEY,
		held_on TEXT NOT NULL,
		created_at TEXT NOT NULL,
		total_count INTEGER NOT NULL CHECK (total_count >= 0)
	);
	CREATE TABLE IF NOT EXISTS meeting_charts (
		id TEXT PRIMARY KEY,
		meeting_id TEXT NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
		music_id TEXT NOT NULL,
		difficulty TEXT NOT NULL CHECK (difficulty IN ('basic', 'advanced', 'master')),
		file_name TEXT NOT NULL,
		description TEXT NOT NULL DEFAULT '',
		uploaded_at TEXT NOT NULL,
		UNIQUE (meeting_id, music_id, difficulty)
	);
	CREATE TABLE IF NOT EXISTS comments (
		id TEXT PRIMARY KEY,
		meeting_chart_id TEXT NOT NULL REFERENCES meeting_charts(id) ON DELETE CASCADE,
		display_name TEXT NOT NULL,
		position_numerator TEXT NOT NULL,
		position_denominator TEXT NOT NULL,
		body TEXT NOT NULL,
		created_at TEXT NOT NULL
	);
	CREATE TABLE IF NOT EXISTS passed_charts (
		music_id TEXT NOT NULL,
		difficulty TEXT NOT NULL CHECK (difficulty IN ('basic', 'advanced', 'master')),
		passed_at TEXT NOT NULL,
		PRIMARY KEY (music_id, difficulty)
	);
	CREATE TABLE IF NOT EXISTS meeting_progress_snapshots (
		meeting_id TEXT PRIMARY KEY REFERENCES meetings(id) ON DELETE CASCADE,
		passed_count INTEGER NOT NULL CHECK (passed_count >= 0),
		total_count INTEGER NOT NULL CHECK (total_count >= 0)
	);
`);

export const chartDirectory = path.join(dataDirectory, "charts");
mkdirSync(chartDirectory, { recursive: true });
