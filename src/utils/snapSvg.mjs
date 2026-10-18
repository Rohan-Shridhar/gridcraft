export const SUPPORTED_GRID_SIZES = Object.freeze([16, 32, 64, 128]);

const HEX_COLOR = /^#[0-9a-f]{3}(?:[0-9a-f]{3})?$/i;

function isAcceptedColor(color) {
  return typeof color === "string" && HEX_COLOR.test(color);
}

export function createSnapSvgData(snap) {
  if (
    !snap ||
    typeof snap !== "object" ||
    Array.isArray(snap) ||
    !SUPPORTED_GRID_SIZES.includes(snap.gridSize) ||
    !Array.isArray(snap.cells) ||
    snap.cells.length !== snap.gridSize * snap.gridSize ||
    !snap.cells.every((color) => color === null || isAcceptedColor(color)) ||
    !(
      snap.backgroundColor === "transparent" ||
      isAcceptedColor(snap.backgroundColor)
    )
  ) {
    return null;
  }

  const { gridSize, backgroundColor } = snap;
  const rectangles = [];
  let previousRow = new Map();

  for (let y = 0; y < gridSize; y += 1) {
    const currentRow = new Map();
    let x = 0;

    while (x < gridSize) {
      const color = snap.cells[y * gridSize + x];
      if (color === null) {
        x += 1;
        continue;
      }

      const startX = x;
      x += 1;
      while (x < gridSize && snap.cells[y * gridSize + x] === color) {
        x += 1;
      }

      const width = x - startX;
      const runKey = `${startX}:${width}:${color}`;
      const existingRectangle = previousRow.get(runKey);

      if (existingRectangle) {
        existingRectangle.height += 1;
        currentRow.set(runKey, existingRectangle);
      } else {
        const rectangle = {
          x: startX,
          y,
          width,
          height: 1,
          fill: color,
        };
        rectangles.push(rectangle);
        currentRow.set(runKey, rectangle);
      }
    }

    previousRow = currentRow;
  }

  return {
    viewBox: `0 0 ${gridSize} ${gridSize}`,
    gridSize,
    backgroundColor,
    backgroundFill: isAcceptedColor(backgroundColor) ? backgroundColor : null,
    rectangles,
  };
}
