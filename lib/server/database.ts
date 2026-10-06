import "server-only";
import { mkdirSync } from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";

const dataDirectory = path.resolve(
	/* turbopackIgnore: true */ process.env.CHART_REVIEW_DATA_DIR ??
		path.join(process.cwd(), "data"),
);
// Keep this directory on persistent local storage; SQLite and uploaded charts live here.
export const chartDirectory = path.join(dataDirectory, "charts");

const globalDatabase = globalThis as typeof globalThis & {
	chartReviewDatabase?: Database.Database;
	chartReviewDatabaseSchemaVersion?: number;
};

// Bump this when adding migrations so a cached connection is migrated after Next.js hot reloads.
const databaseSchemaVersion = 1;

function migrateDatabase(database: Database.Database) {
	database.exec(`
		CREATE TABLE IF NOT EXISTS chart_votes (
			meeting_chart_id TEXT NOT NULL REFERENCES meeting_charts(id) ON DELETE CASCADE,
			voter_key TEXT NOT NULL,
			display_name TEXT NOT NULL,
			vote TEXT NOT NULL CHECK (vote IN ('passed', 'failed')),
			voted_at TEXT NOT NULL,
			PRIMARY KEY (meeting_chart_id, voter_key)
		);
	`);

	const migrateCommentLanePosition = database.transaction(() => {
		const commentColumns = database.pragma("table_info(comments)") as {
			name: string;
		}[];
		if (!commentColumns.some((column) => column.name === "lane_position")) {
			database.exec("ALTER TABLE comments ADD COLUMN lane_position REAL");
		}
		database.exec(
			"UPDATE comments SET lane_position = 10 WHERE lane_position IS NULL",
		);
	});
	migrateCommentLanePosition.immediate();

	const migrateMeetingChartUploader = database.transaction(() => {
		const chartColumns = database.pragma("table_info(meeting_charts)") as {
			name: string;
		}[];
		if (!chartColumns.some((column) => column.name === "uploaded_by")) {
			database.exec(
				"ALTER TABLE meeting_charts ADD COLUMN uploaded_by TEXT NOT NULL DEFAULT ''",
			);
		}
	});
	migrateMeetingChartUploader.immediate();
}

/**
 * Opens and initializes the database on demand so Next.js build workers do not
 * race while importing API route modules.
 */
export function getDatabase(): Database.Database {
	if (globalDatabase.chartReviewDatabase) {
		if (
			globalDatabase.chartReviewDatabaseSchemaVersion !== databaseSchemaVersion
		) {
			migrateDatabase(globalDatabase.chartReviewDatabase);
			globalDatabase.chartReviewDatabaseSchemaVersion = databaseSchemaVersion;
		}
		return globalDatabase.chartReviewDatabase;
	}

	mkdirSync(dataDirectory, { recursive: true });
	mkdirSync(chartDirectory, { recursive: true });
	const database = new Database(
		path.join(dataDirectory, "chart-review.sqlite"),
	);
	try {
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
		uploaded_by TEXT NOT NULL DEFAULT '',
		uploaded_at TEXT NOT NULL,
		UNIQUE (meeting_id, music_id, difficulty)
	);
	CREATE TABLE IF NOT EXISTS comments (
		id TEXT PRIMARY KEY,
		meeting_chart_id TEXT NOT NULL REFERENCES meeting_charts(id) ON DELETE CASCADE,
		display_name TEXT NOT NULL,
		position_numerator TEXT NOT NULL,
		position_denominator TEXT NOT NULL,
		lane_position REAL NOT NULL,
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

		migrateDatabase(database);
	} catch (error) {
		database.close();
		throw error;
	}

	globalDatabase.chartReviewDatabase = database;
	globalDatabase.chartReviewDatabaseSchemaVersion = databaseSchemaVersion;
	return database;
}
