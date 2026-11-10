const GRID_SIZES = [16, 32, 64, 128];

export function sanitizeArtworkId(input) {
  if (!input || typeof input !== "string") return "";
  return input
    .trim()
    .toLowerCase()
    .replace(/[/\\.]+/g, "-")
    .replace(/[\s_]+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 100);
}

export function durationToStoryMs(durationMs) {
  if (!Number.isFinite(durationMs)) return 150;
  return Math.min(10000, Math.max(20, Math.round(durationMs)));
}

export function snapsToMigrationPlan(snaps, { storyName = "Migrated Snaps", albumId = "album" } = {}) {
  const valid = (snaps || []).filter(
    (snap) =>
      snap &&
      GRID_SIZES.includes(snap.gridSize) &&
      Array.isArray(snap.cells) &&
      snap.cells.length === snap.gridSize * snap.gridSize
  );

  const usedIds = new Set();
  const artworks = valid.map((snap, index) => {
    const base = sanitizeArtworkId(snap.title || `snap-${index + 1}`) || `snap-${index + 1}`;
    let id = base;
    let n = 2;
    while (usedIds.has(id)) {
      id = `${base}-${n}`;
      n += 1;
    }
    usedIds.add(id);
    const now = snap.createdAt || new Date().toISOString();
    return {
      format: "gridcraft-artwork",
      schemaVersion: 1,
      id,
      name: snap.title || `Snap ${index + 1}`,
      description: [snap.caption, snap.notes].filter(Boolean).join("\n"),
      gridSize: snap.gridSize,
      width: snap.gridSize,
      height: snap.gridSize,
      backgroundColor: snap.backgroundColor || "transparent",
      cells: [...snap.cells],
      createdAt: now,
      updatedAt: now,
      sourceSnapId: snap.id,
    };
  });

  const frames = artworks.map((artwork, index) => ({
    artworkId: artwork.id,
    artworkPath: `artworks/${artwork.id}.json`,
    durationMs: durationToStoryMs(valid[index].durationMs),
  }));

  const storyId = sanitizeArtworkId(storyName) || "migrated-snaps";
  const now = new Date().toISOString();
  const story = {
    format: "gridcraft-story",
    schemaVersion: 1,
    id: storyId,
    name: storyName,
    description: `Migrated from local GridCraft Snaps into album ${albumId}.`,
    loop: true,
    defaultFrameDurationMs: 150,
    frames,
    createdAt: now,
    updatedAt: now,
  };

  return { artworks, story };
}
