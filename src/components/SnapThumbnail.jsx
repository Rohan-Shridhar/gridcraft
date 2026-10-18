import { snapPixelsToSvgMarkup } from "../utils/snapSvg.js";

export default function SnapThumbnail({ snap, selected, onClick }) {
  const svgContents = snapPixelsToSvgMarkup(snap);

  return (
    <button
      type="button"
      className={`snap-thumbnail${selected ? " snap-thumbnail--selected" : ""}`}
      onClick={onClick}
      aria-label={`Select ${snap.title}, ${snap.gridSize} by ${snap.gridSize}`}
      aria-pressed={selected}
      title={`Select ${snap.title}`}
    >
      <svg
        className="snap-thumbnail-image"
        viewBox="0 0 128 128"
        role="img"
        aria-label={`${snap.title} canvas thumbnail`}
        dangerouslySetInnerHTML={{ __html: svgContents }}
      />
      <span className="snap-thumbnail-title">{snap.title}</span>
    </button>
  );
}
