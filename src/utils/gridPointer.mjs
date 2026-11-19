function cellIndex(grid, target) {
  const cell = target?.closest?.("[data-cell-index]");
  if (!cell || !grid.contains(cell)) return null;
  return Number(cell.dataset.cellIndex);
}

export function createGridPointerHandlers(
  stroke,
  { showGrid, isFill, paintCell, onHover }
) {
  function finish(event) {
    if (stroke.pointerId !== event.pointerId) return;
    stroke.pointerId = null;
    stroke.lastCell = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  return {
    onPointerDown(event) {
      if (
        !showGrid ||
        !event.isPrimary ||
        event.button !== 0 ||
        stroke.pointerId !== null
      )
        return;
      const index = cellIndex(event.currentTarget, event.target);
      if (index === null) return;
      stroke.pointerId = event.pointerId;
      stroke.lastCell = index;
      event.currentTarget.setPointerCapture(event.pointerId);
      onHover(index);
      paintCell(index);
    },
    onPointerMove(event) {
      if (stroke.pointerId !== null && stroke.pointerId !== event.pointerId)
        return;
      const grid = event.currentTarget;
      const target = grid.ownerDocument.elementFromPoint(
        event.clientX,
        event.clientY
      );
      const index = cellIndex(grid, target);
      onHover(index);
      if (!showGrid || isFill || stroke.pointerId !== event.pointerId) return;
      if (index === null) return;
      if (index !== stroke.lastCell) paintCell(index);
      stroke.lastCell = index;
    },
    onPointerUp: finish,
    onPointerCancel: finish,
    onLostPointerCapture: finish,
    onPointerLeave() {
      onHover(null);
    },
  };
}
