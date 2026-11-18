export function getGridNavigationIndex(index, key, gridSize, control = false) {
  const rowStart = Math.floor(index / gridSize) * gridSize;
  const rowEnd = rowStart + gridSize - 1;
  if (control) {
    if (key === "Home") return 0;
    if (key === "End") return gridSize * gridSize - 1;
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
