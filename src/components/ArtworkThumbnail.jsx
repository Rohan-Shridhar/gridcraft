export default function ArtworkThumbnail({ cells, gridSize, backgroundColor, className = "" }) {
  if (!cells || !gridSize) return <div className="artwork-thumb-placeholder" />;

  const cellSize = 2;
  const totalPx = gridSize * cellSize;
  const rects = [];
  for (let i = 0; i < cells.length && i < gridSize * gridSize; i += 1) {
    if (!cells[i]) continue;
    const col = i % gridSize;
    const row = Math.floor(i / gridSize);
    rects.push(
      <rect
        key={i}
        x={col * cellSize}
        y={row * cellSize}
        width={cellSize}
        height={cellSize}
        fill={cells[i]}
      />
    );
  }

  const bg = backgroundColor && backgroundColor !== "transparent" ? backgroundColor : "transparent";

  return (
    <svg
      width={totalPx}
      height={totalPx}
      viewBox={`0 0 ${totalPx} ${totalPx}`}
      xmlns="http://www.w3.org/2000/svg"
      className={`artwork-thumb-svg ${className}`}
      style={{ imageRendering: "pixelated" }}
    >
      {bg !== "transparent" && <rect x={0} y={0} width={totalPx} height={totalPx} fill={bg} />}
      {rects}
    </svg>
  );
}
