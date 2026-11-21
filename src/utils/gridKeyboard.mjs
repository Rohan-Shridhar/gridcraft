export function getGridNavigationIndex(index, key, gridSize, control = false) {
  if (!Number.isInteger(gridSize) || gridSize <= 0) return null;
  const totalCells = gridSize * gridSize;
  if (!Number.isInteger(index) || index < 0 || index >= totalCells) {
    return null;
  }
  const rowStart = Math.floor(index / gridSize) * gridSize;
  const rowEnd = rowStart + gridSize - 1;
  if (control) {
    if (key === "Home") return 0;
    if (key === "End") return totalCells - 1;
    return null;
  }
  switch (key) {
    case "ArrowLeft":
      return Math.max(rowStart, index - 1);
    case "ArrowRight":
      return Math.min(rowEnd, index + 1);
    case "ArrowUp":
      return Math.max(index % gridSize, index - gridSize);
    case "ArrowDown":
      return Math.min(
        (gridSize - 1) * gridSize + (index % gridSize),
        index + gridSize
      );
    case "Home":
      return rowStart;
    case "End":
      return rowEnd;
    default:
      return null;
  }
}
