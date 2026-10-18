import { useEffect, useState } from "react";
import { createSnapSvgData } from "../utils/snapSvg.mjs";

export default function SnapThumbnail({
  snap,
  selected,
  presentationIncluded,
  onSelect,
  onRename,
  onDuplicate,
  onDelete,
  onMove,
  onUpdate,
  onStartFromSelected,
  onExportSvg,
  onExportPng,
  dropPosition,
  onKeyDown,
}) {
  const svgData = createSnapSvgData(snap);
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
          viewBox={svgData?.viewBox ?? "0 0 1 1"}
          preserveAspectRatio="xMidYMid meet"
          shapeRendering="crispEdges"
          role="img"
          aria-label={`${snap.title} canvas thumbnail`}
        >
          {svgData?.backgroundFill && (
            <rect
              x="0"
              y="0"
              width={svgData.gridSize}
              height={svgData.gridSize}
              fill={svgData.backgroundFill}
            />
          )}
          {svgData?.rectangles.map((rectangle) => (
            <rect
              key={`${rectangle.x}-${rectangle.y}-${rectangle.width}-${rectangle.height}-${rectangle.fill}`}
              x={rectangle.x}
              y={rectangle.y}
              width={rectangle.width}
              height={rectangle.height}
              fill={rectangle.fill}
            />
          ))}
        </svg>
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
        <label className="snap-include-field">
          <input
            type="checkbox"
            checked={snap.includedInPresentation !== false}
            onChange={(event) =>
              onUpdate(snap.id, {
                includedInPresentation: event.target.checked,
              })
            }
          />
          Include in presentation
        </label>
        {selected && (
          <>
            <div className="snap-storyboard-fields">
              <button
                type="button"
                className="snap-start-selected"
                onClick={onStartFromSelected}
                title="Start presentation from this slide"
              >
                <i className="fa-solid fa-play" aria-hidden="true" />
                Start from Selected
              </button>
              <label className="snap-duration-field">
                Slide duration
                <span>
                  <input
                    type="number"
                    min="0.5"
                    max="10"
                    step="0.5"
                    value={(snap.durationMs ?? 1500) / 1000}
                    onChange={(event) => {
                      const seconds = Number(event.target.value);
                      if (Number.isFinite(seconds)) {
                        onUpdate(snap.id, {
                          durationMs: Math.max(
                            500,
                            Math.min(10000, seconds * 1000)
                          ),
                        });
                      }
                    }}
                    aria-label={`Slide duration for ${snap.title} in seconds`}
                  />
                  sec
                </span>
              </label>
              <label className="snap-caption-field">
                Slide caption
                <input
                  type="text"
                  maxLength={120}
                  value={snap.caption ?? ""}
                  placeholder="Optional caption"
                  onChange={(event) =>
                    onUpdate(snap.id, { caption: event.target.value })
                  }
                />
              </label>
              <label className="snap-notes-field">
                Notes
                <textarea
                  rows="2"
                  maxLength={1000}
                  value={snap.notes ?? ""}
                  placeholder="Optional presenter notes"
                  onChange={(event) =>
                    onUpdate(snap.id, { notes: event.target.value })
                  }
                />
              </label>
              <span className="snap-card-canvas-meta">
                {snap.gridSize}×{snap.gridSize} · {snap.backgroundColor}
              </span>
            </div>
            <div className="snap-card-actions" aria-label={`Actions for ${snap.title}`}>
              <button type="button" onClick={onExportSvg} title="Export this snap as SVG">
                <i className="fa-regular fa-image" aria-hidden="true" />
                <span className="visually-hidden">Export SVG</span>
              </button>
              <button type="button" onClick={onExportPng} title="Export this snap as PNG">
                <i className="fa-regular fa-file-image" aria-hidden="true" />
                <span className="visually-hidden">Export PNG</span>
              </button>
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
