export const SNAP_STORAGE_KEY = "gridcraft.snaps";
export const SNAP_SCHEMA_VERSION = 2;
export const LEGACY_SNAP_SCHEMA_VERSION = 1;
export const MAX_SNAP_COUNT = 100;
export const DEFAULT_SLIDE_DURATION_MS = 1500;

const GRID_SIZES = [16, 32, 64, 128];
const HEX_COLOR = /^#[0-9a-f]{3}(?:[0-9a-f]{3})?$/i;

export function isValidSnap(snap) {
  return (
    snap &&
    typeof snap.id === "string" &&
    snap.id.length > 0 &&
    snap.id.length <= 128 &&
    Number.isInteger(snap.sequence) &&
    snap.sequence > 0 &&
    typeof snap.title === "string" &&
    snap.title.trim().length > 0 &&
    snap.title.length <= 80 &&
    typeof snap.createdAt === "string" &&
    Number.isFinite(Date.parse(snap.createdAt)) &&
    GRID_SIZES.includes(snap.gridSize) &&
    Array.isArray(snap.cells) &&
    snap.cells.length === snap.gridSize * snap.gridSize &&
    snap.cells.every(
      (color) => color === null || (typeof color === "string" && HEX_COLOR.test(color))
    ) &&
    (snap.caption === undefined ||
      (typeof snap.caption === "string" && snap.caption.length <= 120)) &&
    (snap.notes === undefined ||
      (typeof snap.notes === "string" && snap.notes.length <= 1000)) &&
    (snap.includedInPresentation === undefined ||
      typeof snap.includedInPresentation === "boolean") &&
    (snap.durationMs === undefined ||
      (Number.isFinite(snap.durationMs) &&
        snap.durationMs >= 500 &&
        snap.durationMs <= 10000)) &&
    (snap.backgroundColor === "transparent" ||
      (typeof snap.backgroundColor === "string" &&
        HEX_COLOR.test(snap.backgroundColor)))
  );
}

export function normalizeSnap(snap) {
  return {
    id: snap.id,
    createdAt: snap.createdAt,
    sequence: snap.sequence,
    title: snap.title,
    cells: [...snap.cells],
    gridSize: snap.gridSize,
    backgroundColor: snap.backgroundColor,
    caption: snap.caption ?? "",
    notes: snap.notes ?? "",
    includedInPresentation: snap.includedInPresentation ?? true,
    durationMs: snap.durationMs ?? DEFAULT_SLIDE_DURATION_MS,
  };
}

export function parseStoredSnaps(saved) {
  if (saved === null) return { snaps: [], notice: null, canPersist: true };

  const data = JSON.parse(saved);
  if (
    !data ||
    ![LEGACY_SNAP_SCHEMA_VERSION, SNAP_SCHEMA_VERSION].includes(data.version) ||
    !Array.isArray(data.snaps)
  ) {
    return {
      snaps: [],
      notice: "Saved snaps were invalid or from an unsupported version.",
      canPersist: false,
    };
  }

  const seenIds = new Set();
  const snaps = data.snaps
    .filter((snap) => {
      if (!isValidSnap(snap) || seenIds.has(snap.id)) return false;
      seenIds.add(snap.id);
      return true;
    })
    .map(normalizeSnap);

  return {
    snaps,
    notice:
      snaps.length !== data.snaps.length
        ? "Some invalid saved snaps were skipped."
        : null,
    canPersist:
      snaps.length === data.snaps.length &&
      data.snaps.length <= MAX_SNAP_COUNT,
  };
}

export function serializeStoredSnaps(snaps) {
  return JSON.stringify({ version: SNAP_SCHEMA_VERSION, snaps });
}
