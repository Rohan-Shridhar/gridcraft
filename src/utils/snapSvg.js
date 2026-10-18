const SVG_SIZE = 128;
const HEX_COLOR = /^#[0-9a-f]{3}(?:[0-9a-f]{3})?$/i;
const GRID_SIZES = [16, 32, 64, 128];

export function snapPixelsToSvgMarkup(snap) {
  if (
    !snap ||
    !GRID_SIZES.includes(snap.gridSize) ||
    !Array.isArray(snap.cells) ||
    snap.cells.length !== snap.gridSize * snap.gridSize
  ) {
    return "";
  }

  const cellSize = SVG_SIZE / snap.gridSize;
  const rectangles = [];

  if (
    typeof snap.backgroundColor === "string" &&
    HEX_COLOR.test(snap.backgroundColor)
  ) {
    rectangles.push(
      `<rect width="${SVG_SIZE}" height="${SVG_SIZE}" fill="${snap.backgroundColor}"/>`
    );
  }

  snap.cells.forEach((color, index) => {
    if (typeof color !== "string" || !HEX_COLOR.test(color)) return;
    const x = (index % snap.gridSize) * cellSize;
    const y = Math.floor(index / snap.gridSize) * cellSize;
    rectangles.push(
      `<rect x="${x}" y="${y}" width="${cellSize}" height="${cellSize}" fill="${color}"/>`
    );
  });

  return rectangles.join("");
}
