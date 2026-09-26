//! WebAssembly bindings for parsing XLAIR charts into a JavaScript-readable model.

use chart::{
    AirColor, AirCrushColor, AirCrushInterval, AirDirection, AirPoint, AirProperties, Chart,
    ChartMode, ExDirection, Lane, NoteAttributes, NoteId, NoteKind, Position, ScrollScope,
    ScrollSpeedChange, SideButton, SlidePoint, SlidePointKind, TapKind, TempoChange,
};
use serde::Serialize;
use wasm_bindgen::prelude::*;

/// Parses a chart using XLAIR interpretation rules and returns its shared chart model as JSON.
///
/// `format` must be one of the supported file extensions: `c2s`, `sus`, or `ugc`.
/// `source` follows the encodings accepted by `chart_converter::parse_bytes_with_mode`.
#[wasm_bindgen]
pub fn parse_chart_json(format: &str, source: &[u8]) -> Result<String, JsValue> {
    let format = chart_converter::Format::from_extension(format)
        .ok_or_else(|| JsValue::from_str("unsupported chart format"))?;
    let chart = chart_converter::parse_bytes_with_mode(format, ChartMode::Xlair, source)
        .map_err(|error| JsValue::from_str(&error.to_string()))?;
    serde_json::to_string(&ChartData::from_chart(format.extension(), &chart))
        .map_err(|error| JsValue::from_str(&error.to_string()))
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ChartData<'a> {
    format: &'a str,
    base_bpm: Option<f64>,
    audio_offset_seconds: Option<f64>,
    priority_enabled: Option<bool>,
    measure_lengths: Vec<MeasureLengthData>,
    tempo_changes: Vec<TempoChangeData>,
    scroll_speed_changes: Vec<ScrollSpeedChangeData>,
    notes: Vec<NoteData>,
}

impl<'a> ChartData<'a> {
    fn from_chart(format: &'a str, chart: &Chart) -> Self {
        Self {
            format,
            base_bpm: chart.base_bpm(),
            audio_offset_seconds: chart.audio_offset_seconds(),
            priority_enabled: chart.priority_enabled(),
            measure_lengths: chart
                .measure_lengths()
                .iter()
                .map(|(measure, length)| MeasureLengthData {
                    measure: *measure,
                    length: (*length).into(),
                })
                .collect(),
            tempo_changes: chart
                .tempo_changes()
                .iter()
                .map(TempoChangeData::from)
                .collect(),
            scroll_speed_changes: chart
                .scroll_speed_changes()
                .iter()
                .map(ScrollSpeedChangeData::from)
                .collect(),
            notes: chart
                .notes()
                .iter()
                .enumerate()
                .map(|(index, note)| {
                    let id = NoteId::new(index as u32);
                    let speed_group = chart
                        .note_speed_group(id)
                        .expect("note IDs match their insertion-order indexes");
                    NoteData {
                        id: id.value(),
                        position: note.position().into(),
                        lane: note.lane().into(),
                        speed_group,
                        attributes: note.attributes().into(),
                        kind: note.kind().into(),
                    }
                })
                .collect(),
        }
    }
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct PositionData {
    numerator: String,
    denominator: String,
}

impl From<Position> for PositionData {
    fn from(position: Position) -> Self {
        Self {
            numerator: position.numerator().to_string(),
            denominator: position.denominator().to_string(),
        }
    }
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct MeasureLengthData {
    measure: u32,
    length: PositionData,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct TempoChangeData {
    position: PositionData,
    bpm: f64,
}

impl From<&TempoChange> for TempoChangeData {
    fn from(change: &TempoChange) -> Self {
        Self {
            position: change.position().into(),
            bpm: change.bpm(),
        }
    }
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ScrollSpeedChangeData {
    position: PositionData,
    speed: f64,
    scope: ScrollScopeData,
    duration: Option<PositionData>,
}

impl From<&ScrollSpeedChange> for ScrollSpeedChangeData {
    fn from(change: &ScrollSpeedChange) -> Self {
        Self {
            position: change.position().into(),
            speed: change.speed(),
            scope: change.scope().into(),
            duration: change.duration().map(Into::into),
        }
    }
}

#[derive(Serialize)]
#[serde(tag = "type", rename_all = "camelCase")]
enum ScrollScopeData {
    Global,
    Lane { lane: LaneData },
    Note { note_id: u32 },
    Group { group_id: u32 },
}

impl From<ScrollScope> for ScrollScopeData {
    fn from(scope: ScrollScope) -> Self {
        match scope {
            ScrollScope::Global => Self::Global,
            ScrollScope::Lane(lane) => Self::Lane { lane: lane.into() },
            ScrollScope::Note(note_id) => Self::Note {
                note_id: note_id.value(),
            },
            ScrollScope::Group(group_id) => Self::Group { group_id },
        }
    }
}

#[derive(Serialize)]
#[serde(tag = "type", rename_all = "camelCase")]
enum LaneData {
    Slider { start: u8, width: u8 },
    Side { button: String },
}

impl From<Lane> for LaneData {
    fn from(lane: Lane) -> Self {
        match lane {
            Lane::Slider { start, width } => Self::Slider { start, width },
            Lane::Side(button) => Self::Side {
                button: side_button_name(button).to_owned(),
            },
        }
    }
}

fn side_button_name(button: SideButton) -> &'static str {
    match button {
        SideButton::LeftUpper => "leftUpper",
        SideButton::LeftLower => "leftLower",
        SideButton::RightLower => "rightLower",
        SideButton::RightUpper => "rightUpper",
    }
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct NoteData {
    id: u32,
    position: PositionData,
    lane: LaneData,
    speed_group: Option<u32>,
    attributes: NoteAttributesData,
    kind: NoteKindData,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct NoteAttributesData {
    roll_speed: Option<f64>,
    height: Option<f64>,
    priority: Option<i32>,
}

impl From<NoteAttributes> for NoteAttributesData {
    fn from(attributes: NoteAttributes) -> Self {
        Self {
            roll_speed: attributes.roll_speed(),
            height: attributes.height(),
            priority: attributes.priority(),
        }
    }
}

#[derive(Serialize)]
#[serde(tag = "type", rename_all = "camelCase")]
enum NoteKindData {
    Tap {
        tap: TapData,
    },
    ExTap {
        direction: String,
    },
    Mine,
    Hold {
        end: PositionData,
    },
    ExHold {
        end: PositionData,
        direction: String,
    },
    Slide {
        points: Vec<SlidePointData>,
    },
    ExSlide {
        points: Vec<SlidePointData>,
        direction: String,
    },
    Air {
        properties: AirPropertiesData,
        parent: u32,
    },
    AirHold {
        end: PositionData,
        properties: AirPropertiesData,
        parent: u32,
    },
    AirSlide {
        points: Vec<AirPointData>,
        color: String,
        parent: u32,
    },
    AirCrush {
        points: Vec<AirPointData>,
        color: String,
        interval: AirCrushIntervalData,
        parent: u32,
    },
}

impl From<&NoteKind> for NoteKindData {
    fn from(kind: &NoteKind) -> Self {
        match kind {
            NoteKind::Tap(tap) => Self::Tap { tap: (*tap).into() },
            NoteKind::ExTap { direction } => Self::ExTap {
                direction: ex_direction_name(*direction).to_owned(),
            },
            NoteKind::Mine => Self::Mine,
            NoteKind::Hold { end } => Self::Hold { end: (*end).into() },
            NoteKind::ExHold { end, direction } => Self::ExHold {
                end: (*end).into(),
                direction: ex_direction_name(*direction).to_owned(),
            },
            NoteKind::Slide { points } => Self::Slide {
                points: points.iter().map(Into::into).collect(),
            },
            NoteKind::ExSlide { points, direction } => Self::ExSlide {
                points: points.iter().map(Into::into).collect(),
                direction: ex_direction_name(*direction).to_owned(),
            },
            NoteKind::Air { properties, parent } => Self::Air {
                properties: (*properties).into(),
                parent: parent.value(),
            },
            NoteKind::AirHold {
                end,
                properties,
                parent,
            } => Self::AirHold {
                end: (*end).into(),
                properties: (*properties).into(),
                parent: parent.value(),
            },
            NoteKind::AirSlide {
                points,
                color,
                parent,
            } => Self::AirSlide {
                points: points.iter().map(Into::into).collect(),
                color: air_color_name(*color).to_owned(),
                parent: parent.value(),
            },
            NoteKind::AirCrush {
                points,
                color,
                interval,
                parent,
            } => Self::AirCrush {
                points: points.iter().map(Into::into).collect(),
                color: air_crush_color_name(*color).to_owned(),
                interval: (*interval).into(),
                parent: parent.value(),
            },
        }
    }
}

#[derive(Serialize)]
#[serde(tag = "type", rename_all = "camelCase")]
enum TapData {
    Tap,
    XTap,
    Flick { direction: Option<String> },
    Tap4,
    Tap5,
    Tap6,
}

impl From<TapKind> for TapData {
    fn from(tap: TapKind) -> Self {
        match tap {
            TapKind::Tap => Self::Tap,
            TapKind::XTap => Self::XTap,
            TapKind::Flick { direction } => Self::Flick {
                direction: direction.map(ex_direction_name).map(str::to_owned),
            },
            TapKind::Tap4 => Self::Tap4,
            TapKind::Tap5 => Self::Tap5,
            TapKind::Tap6 => Self::Tap6,
        }
    }
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct SlidePointData {
    position: PositionData,
    lane: LaneData,
    kind: String,
}

impl From<&SlidePoint> for SlidePointData {
    fn from(point: &SlidePoint) -> Self {
        Self {
            position: point.position().into(),
            lane: point.lane().into(),
            kind: slide_point_kind_name(point.kind()).to_owned(),
        }
    }
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct AirPointData {
    position: PositionData,
    lane: LaneData,
    height: f64,
    kind: String,
}

impl From<&AirPoint> for AirPointData {
    fn from(point: &AirPoint) -> Self {
        Self {
            position: point.position().into(),
            lane: point.lane().into(),
            height: point.height(),
            kind: slide_point_kind_name(point.kind()).to_owned(),
        }
    }
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct AirPropertiesData {
    direction: Option<String>,
    height: Option<f64>,
    color: String,
}

impl From<AirProperties> for AirPropertiesData {
    fn from(properties: AirProperties) -> Self {
        Self {
            direction: properties
                .direction()
                .map(air_direction_name)
                .map(str::to_owned),
            height: properties.height(),
            color: air_color_name(properties.color()).to_owned(),
        }
    }
}

#[derive(Serialize)]
#[serde(tag = "type", rename_all = "camelCase")]
enum AirCrushIntervalData {
    Trace,
    Start,
    Every { interval: PositionData },
}

impl From<AirCrushInterval> for AirCrushIntervalData {
    fn from(interval: AirCrushInterval) -> Self {
        match interval {
            AirCrushInterval::Trace => Self::Trace,
            AirCrushInterval::Start => Self::Start,
            AirCrushInterval::Every(position) => Self::Every {
                interval: position.into(),
            },
        }
    }
}

fn ex_direction_name(direction: ExDirection) -> &'static str {
    match direction {
        ExDirection::Up => "up",
        ExDirection::Down => "down",
        ExDirection::Center => "center",
        ExDirection::All => "all",
        ExDirection::Wide => "wide",
        ExDirection::Left => "left",
        ExDirection::Right => "right",
        ExDirection::Inward => "inward",
        ExDirection::UpperLeft => "upperLeft",
        ExDirection::UpperRight => "upperRight",
        ExDirection::LowerLeft => "lowerLeft",
        ExDirection::LowerRight => "lowerRight",
    }
}

fn air_direction_name(direction: AirDirection) -> &'static str {
    match direction {
        AirDirection::Up => "up",
        AirDirection::UpperLeft => "upperLeft",
        AirDirection::UpperRight => "upperRight",
        AirDirection::Down => "down",
        AirDirection::LowerLeft => "lowerLeft",
        AirDirection::LowerRight => "lowerRight",
    }
}

fn air_color_name(color: AirColor) -> &'static str {
    match color {
        AirColor::Normal => "normal",
        AirColor::Inverted => "inverted",
    }
}

fn air_crush_color_name(color: AirCrushColor) -> &'static str {
    match color {
        AirCrushColor::Normal => "normal",
        AirCrushColor::Transparent => "transparent",
        AirCrushColor::Red => "red",
        AirCrushColor::Orange => "orange",
        AirCrushColor::Yellow => "yellow",
        AirCrushColor::Lime => "lime",
        AirCrushColor::Green => "green",
        AirCrushColor::Aqua => "aqua",
        AirCrushColor::Cyan => "cyan",
        AirCrushColor::DarkBlue => "darkBlue",
        AirCrushColor::Blue => "blue",
        AirCrushColor::Violet => "violet",
        AirCrushColor::Purple => "purple",
        AirCrushColor::Pink => "pink",
        AirCrushColor::Gray => "gray",
        AirCrushColor::Black => "black",
    }
}

fn slide_point_kind_name(kind: &SlidePointKind) -> &'static str {
    match kind {
        SlidePointKind::Visible => "visible",
        SlidePointKind::Control => "control",
        SlidePointKind::Invisible => "invisible",
    }
}
