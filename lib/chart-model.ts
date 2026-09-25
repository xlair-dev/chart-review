export type ChartFormat = "c2s" | "sus" | "ugc";

export interface Position {
	numerator: string;
	denominator: string;
}

export type Lane =
	| { type: "slider"; start: number; width: number }
	| { type: "side"; button: SideButton };

export type SideButton =
	| "leftUpper"
	| "leftLower"
	| "rightLower"
	| "rightUpper";

export interface ChartData {
	format: ChartFormat;
	baseBpm: number | null;
	priorityEnabled: boolean | null;
	measureLengths: { measure: number; length: Position }[];
	tempoChanges: { position: Position; bpm: number }[];
	scrollSpeedChanges: ScrollSpeedChange[];
	notes: Note[];
}

export interface ScrollSpeedChange {
	position: Position;
	speed: number;
	scope: ScrollScope;
	duration: Position | null;
}

export type ScrollScope =
	| { type: "global" }
	| { type: "lane"; lane: Lane }
	| { type: "note"; noteId: number }
	| { type: "group"; groupId: number };

export interface Note {
	id: number;
	position: Position;
	lane: Lane;
	speedGroup: number | null;
	attributes: {
		rollSpeed: number | null;
		height: number | null;
		priority: number | null;
	};
	kind: NoteKind;
}

export type NoteKind =
	| { type: "tap"; tap: TapKind }
	| { type: "exTap"; direction: ExDirection }
	| { type: "mine" }
	| { type: "hold"; end: Position }
	| { type: "exHold"; end: Position; direction: ExDirection }
	| { type: "slide"; points: SlidePoint[] }
	| { type: "exSlide"; points: SlidePoint[]; direction: ExDirection }
	| { type: "air"; properties: AirProperties; parent: number }
	| {
			type: "airHold";
			end: Position;
			properties: AirProperties;
			parent: number;
	  }
	| { type: "airSlide"; points: AirPoint[]; color: AirColor; parent: number }
	| {
			type: "airCrush";
			points: AirPoint[];
			color: AirCrushColor;
			interval: AirCrushInterval;
			parent: number;
	  };

export type TapKind =
	| { type: "tap" }
	| { type: "xTap" }
	| { type: "flick"; direction: ExDirection | null }
	| { type: "tap4" }
	| { type: "tap5" }
	| { type: "tap6" };

export type ExDirection =
	| "up"
	| "down"
	| "center"
	| "all"
	| "wide"
	| "left"
	| "right"
	| "inward"
	| "upperLeft"
	| "upperRight"
	| "lowerLeft"
	| "lowerRight";

export interface SlidePoint {
	position: Position;
	lane: Lane;
	kind: SlidePointKind;
}

export interface AirPoint extends SlidePoint {
	height: number;
}

export type SlidePointKind = "visible" | "control" | "invisible";

export interface AirProperties {
	direction: AirDirection | null;
	height: number | null;
	color: AirColor;
}

export type AirDirection =
	| "up"
	| "upperLeft"
	| "upperRight"
	| "down"
	| "lowerLeft"
	| "lowerRight";

export type AirColor = "normal" | "inverted";

export type AirCrushColor =
	| "normal"
	| "transparent"
	| "red"
	| "orange"
	| "yellow"
	| "lime"
	| "green"
	| "aqua"
	| "cyan"
	| "darkBlue"
	| "blue"
	| "violet"
	| "purple"
	| "pink"
	| "gray"
	| "black";

export type AirCrushInterval =
	| { type: "trace" }
	| { type: "start" }
	| { type: "every"; interval: Position };
