import { useState } from "react";

function Grid({
  cells,
  gridSize,
  gridGap,
  showGrid,
  isFill,
  isEraser,
  paintCell,
  backgroundColor,
}) {
  const [isMouseDown, setIsMouseDown] = useState(false);
  const [hoveredCell, setHoveredCell] = useState(null);

  const coordinates = Array.from({ length: gridSize }, (_, index) => index + 1);
  const coordinateStep =
    gridSize <= 16 ? 1 : gridSize <= 32 ? 2 : gridSize <= 64 ? 4 : 8;

  const hoveredColumn =
    hoveredCell === null ? null : (hoveredCell % gridSize) + 1;
  const hoveredRow =
    hoveredCell === null ? null : Math.floor(hoveredCell / gridSize) + 1;

  const isCoordinateVisible = (coordinate) =>
    coordinate === 1 ||
    coordinate === gridSize ||
    coordinate % coordinateStep === 0;

  return (
    <div
      className={`grid-coordinate-layout${
        showGrid ? "" : " grid-coordinate-layout--preview"
      }`}
      style={{
        "--grid-box-count": gridSize,
        "--grid-gap": `${gridGap}px`,
      }}
      onMouseLeave={() => {
        setIsMouseDown(false);
        setHoveredCell(null);
      }}
    >
      <div className="column-coordinates" aria-hidden="true">
        {coordinates.map((coordinate) => (
          <span
            key={coordinate}
            className={`coordinate-label${
              isCoordinateVisible(coordinate)
                ? " coordinate-label--visible"
                : ""
            }${
              hoveredColumn === coordinate
                ? " coordinate-label--active"
                : ""
            }`}
          >
            {coordinate}
          </span>
        ))}
      </div>

      <div
        className="grid-cont"
        onMouseUp={() => setIsMouseDown(false)}
        id="pixel-grid"
        style={{ backgroundColor }}
      >
        {cells.map((color, index) => (
          <div
            key={index}
            className="grid-cell"
            style={{
              backgroundColor: color || "transparent",
              border: showGrid ? undefined : "none",
              borderRadius: showGrid ? undefined : "0",
              cursor: !showGrid
                ? "not-allowed"
                : isEraser
                  ? "url(/cursors/eraser.png), auto"
                  : isFill
                    ? "url(/cursors/bucket.png), auto"
                    : "url(/cursors/paintbrush.png), auto",
            }}
            onMouseDown={() => {
              if (showGrid) {
                paintCell(index);
                setIsMouseDown(true);
              }
            }}
            onMouseEnter={() => {
              setHoveredCell(index);
              if (showGrid && isMouseDown && !isFill) {
                paintCell(index);
              }
            }}
            onMouseUp={() => setIsMouseDown(false)}
          />
        ))}
      </div>

      <div className="row-coordinates" aria-hidden="true">
        {coordinates.map((coordinate) => (
          <span
            key={coordinate}
            className={`coordinate-label${
              isCoordinateVisible(coordinate)
                ? " coordinate-label--visible"
                : ""
            }${
              hoveredRow === coordinate ? " coordinate-label--active" : ""
            }`}
          >
            {coordinate}
          </span>
        ))}
      </div>
    </div>
  );
}

export default Grid;
