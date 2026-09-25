export type SyncAsset = { url: string; updatedAt: string } | null;

export interface CatalogSheet {
	id: string;
	musicId: string;
	difficulty: "basic" | "advanced" | "master";
	level: number;
	notesDesigner: string;
	chart: SyncAsset;
}

export interface CatalogMusic {
	id: string;
	title: string;
	artist: string;
	bpm: number;
	genre: string;
	jacket: SyncAsset;
	audio: SyncAsset;
	registrationDate: string;
	isTest: boolean;
}

export interface CatalogItem {
	music: CatalogMusic;
	sheets: CatalogSheet[];
}
