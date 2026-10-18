import { useEffect, useState } from "react";
import { snapPixelsToSvgMarkup } from "../utils/snapSvg.js";

export default function SnapThumbnail({
  snap,
  selected,
  presentationIncluded,
  onSelect,
  onRename,
  onDuplicate,
  onDelete,
  onMove,
  dropPosition,
  onKeyDown,
}) {
  const svgContents = snapPixelsToSvgMarkup(snap);
  const [titleDraft, setTitleDraft] = useState(snap.title);

  useEffect(() => {
    setTitleDraft(snap.title);
  }, [snap.title]);

  return (
    <article
      className={`snap-card${selected ? " snap-card--selected" : ""}${
        dropPosition ? ` snap-card--drop-${dropPosition}` : ""
      }`}
      draggable
      data-snap-id={snap.id}
    >
      <button
        type="button"
        className="snap-select-button"
        onClick={onSelect}
        onKeyDown={onKeyDown}
        aria-label={`Select ${snap.title}, snap ${snap.sequence}`}
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
      </button>
      <div className="snap-card-content">
        <div className="snap-card-meta">
          <span>SNAP {snap.sequence}</span>
          <span className="snap-card-meta-icons">
            <i className="fa-solid fa-grip-vertical snap-drag-handle" aria-hidden="true" />
            {presentationIncluded && (
              <span className="snap-play-indicator" title="Included in presentation">
                <i className="fa-solid fa-play" aria-hidden="true" />
                <span className="visually-hidden">Included in presentation</span>
              </span>
            )}
          </span>
        </div>
        <label className="visually-hidden" htmlFor={`snap-title-${snap.id}`}>
          Rename {snap.title}
        </label>
        <input
          id={`snap-title-${snap.id}`}
          className="snap-card-title"
          type="text"
          value={titleDraft}
          maxLength={80}
          onChange={(event) => {
            const { value } = event.target;
            setTitleDraft(value);
            if (value.trim()) onRename(snap.id, value);
          }}
          onBlur={() => {
            if (!titleDraft.trim()) setTitleDraft(snap.title);
          }}
          onKeyDown={(event) => {
            event.stopPropagation();
            if (event.key === "Escape") setTitleDraft(snap.title);
          }}
          aria-label={`Rename ${snap.title}`}
          title="Edit snap title"
        />
        {selected && (
          <>
            <span className="snap-card-canvas-meta">
              {snap.gridSize}×{snap.gridSize} · {snap.backgroundColor}
            </span>
            <div className="snap-card-actions" aria-label={`Actions for ${snap.title}`}>
              <button type="button" onClick={onDuplicate} title="Duplicate snap">
                <i className="fa-regular fa-copy" aria-hidden="true" />
                <span className="visually-hidden">Duplicate</span>
              </button>
              <button
                type="button"
                onClick={() => onMove(-1)}
                title="Move earlier"
                aria-label="Move snap earlier"
              >
                <i className="fa-solid fa-arrow-up" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => onMove(1)}
                title="Move later"
                aria-label="Move snap later"
              >
                <i className="fa-solid fa-arrow-down" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={onDelete}
                title="Delete snap"
                aria-label="Delete snap"
                className="snap-delete-button"
              >
                <i className="fa-solid fa-trash-can" aria-hidden="true" />
              </button>
            </div>
          </>
        )}
      </div>
    </article>
  );
}
