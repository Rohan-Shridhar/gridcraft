import { useId, useRef, useState } from "react";
import { getGridNavigationIndex } from "./utils/gridKeyboard.mjs";
import { createGridPointerHandlers } from "./utils/gridPointer.mjs";

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
  const instructionsId = useId();
  const [focusedCell, setFocusedCell] = useState(0);
  const activeCell = Math.min(focusedCell, cells.length - 1);
  const handleKeyDown = (event) => {
    if (!showGrid || event.altKey || event.metaKey) return;
    const index = Number(event.target.dataset.cellIndex);
    if (!Number.isInteger(index)) return;
    if (!event.ctrlKey && (event.key === "Enter" || event.key === " ")) {
      event.preventDefault();
      event.stopPropagation();
      paintCell(index);
      return;
    }
    const next = getGridNavigationIndex(
      index,
      event.key,
      gridSize,
      event.ctrlKey
    );
    if (next === null) return;
    event.preventDefault();
    event.stopPropagation();
    setFocusedCell(next);
    event.currentTarget.querySelector(`[data-cell-index="${next}"]`)?.focus();
  };
  const stroke = useRef({ pointerId: null, lastCell: null });
  const [hoveredCell, setHoveredCell] = useState(null);

  const pointerHandlers = createGridPointerHandlers(stroke.current, {
    showGrid,
    isFill,
    paintCell,
    onHover: setHoveredCell,
  });

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
        position: "relative",
      }}
    >
      <span
        aria-label={`Canvas dimensions: ${gridSize} by ${gridSize}`}
        style={{
          position: "absolute",
          right: "2rem",
          bottom: "0.35rem",
          zIndex: 2,
          padding: "0.15rem 0.45rem",
          borderRadius: "4px",
          background: "var(--grid-bg-color)",
          color: "var(--grid-text-color)",
          fontSize: "0.75rem",
          opacity: 0.85,
          pointerEvents: "none",
        }}
      >
        Canvas: {gridSize}×{gridSize}
      </span>

      {showGrid && (
        <span id={instructionsId} className="canvas-instructions">
          Use arrow keys to move between cells, Home and End to move within a
          row, Control+Home and Control+End to move to the first or last cell,
          and Enter or Space to paint with the selected tool.
        </span>
      )}
      <div className="column-coordinates" aria-hidden="true">
        {coordinates.map((coordinate) => (
          <span
            key={coordinate}
            className={`coordinate-label${
              isCoordinateVisible(coordinate)
                ? " coordinate-label--visible"
                : ""
            }${
              hoveredColumn === coordinate ? " coordinate-label--active" : ""
            }`}
          >
            {coordinate}
          </span>
        ))}
      </div>

      <div
        className="grid-cont"
        {...pointerHandlers}
        id="pixel-grid"
        role={showGrid ? "grid" : "img"}
        aria-label={`${
          showGrid ? "Pixel art canvas" : "Pixel art preview"
        }, ${gridSize} by ${gridSize}`}
        aria-describedby={showGrid ? instructionsId : undefined}
        aria-rowcount={showGrid ? gridSize : undefined}
        aria-colcount={showGrid ? gridSize : undefined}
        onKeyDown={handleKeyDown}
        style={{ backgroundColor, touchAction: showGrid ? "none" : "auto" }}
      >
        {coordinates.map((row) => (
          <div
            key={row}
            className="grid-row"
            role={showGrid ? "row" : undefined}
            aria-hidden={!showGrid || undefined}
          >
            {cells
              .slice((row - 1) * gridSize, row * gridSize)
              .map((color, column) => {
                const index = (row - 1) * gridSize + column;
                return (
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
                    data-cell-index={index}
                    role={showGrid ? "gridcell" : undefined}
                    aria-label={
                      showGrid
                        ? `Row ${row}, column ${column + 1}: ${
                            color || "transparent"
                          }`
                        : undefined
                    }
                    tabIndex={
                      showGrid ? (activeCell === index ? 0 : -1) : undefined
                    }
                    onFocus={() => {
                      setFocusedCell(index);
                      setHoveredCell(index);
                    }}
                    onPointerDown={(event) => {
                      if (showGrid) event.currentTarget.focus();
                    }}
                  />
                );
              })}
          </div>
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
            }${hoveredRow === coordinate ? " coordinate-label--active" : ""}`}
          >
            {coordinate}
          </span>
        ))}
      </div>
    </div>
  );
}

export default Grid;
