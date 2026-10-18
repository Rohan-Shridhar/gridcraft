import { useEffect, useRef, useState } from "react";
import SnapThumbnail from "./SnapThumbnail.jsx";

export default function SnapsPanel({
  snaps,
  selectedSnapId,
  isPlaying,
  storageError,
  createSnap,
  selectSnap,
  renameSnap,
  duplicateSnap,
  deleteSnap,
  clearSnaps,
  moveSnap,
  reorderSnap,
  startPresentation,
  stopPresentation,
}) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [dropTarget, setDropTarget] = useState(null);
  const listRef = useRef(null);
  const dragSourceRef = useRef(null);
  const dropTargetRef = useRef(null);
  const reorderSnapRef = useRef(reorderSnap);
  reorderSnapRef.current = reorderSnap;

  useEffect(() => {
    const list = listRef.current;
    if (!list) return undefined;

    const getCard = (event) => {
      if (!(event.target instanceof Element)) return null;
      const card = event.target.closest(".snap-card");
      return card && list.contains(card) ? card : null;
    };

    const handleDragStart = (event) => {
      const card = getCard(event);
      const id = card?.dataset.snapId;
      if (!id) return;
      dragSourceRef.current = id;
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", id);
    };

    const handleDragOver = (event) => {
      const card = getCard(event);
      const id = card?.dataset.snapId;
      if (!id) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
      const bounds = card.getBoundingClientRect();
      const position =
        event.clientY < bounds.top + bounds.height / 2 ? "before" : "after";
      const target = { id, position };
      dropTargetRef.current = target;
      setDropTarget(target);
    };

    const handleDrop = (event) => {
      const card = getCard(event);
      const targetId = card?.dataset.snapId;
      if (!targetId) return;
      event.preventDefault();
      const sourceId = event.dataTransfer.getData("text/plain");
      const bounds = card.getBoundingClientRect();
      const position =
        event.clientY < bounds.top + bounds.height / 2 ? "before" : "after";
      if (sourceId) reorderSnapRef.current(sourceId, targetId, position);
      dragSourceRef.current = null;
      dropTargetRef.current = null;
      setDropTarget(null);
    };

    const handleDragEnd = (event) => {
      const target = dropTargetRef.current;
      if (
        target &&
        dragSourceRef.current &&
        event.dataTransfer.dropEffect === "move"
      ) {
        reorderSnapRef.current(
          dragSourceRef.current,
          target.id,
          target.position
        );
      }
      dragSourceRef.current = null;
      dropTargetRef.current = null;
      setDropTarget(null);
    };

    list.addEventListener("dragstart", handleDragStart);
    list.addEventListener("dragover", handleDragOver);
    list.addEventListener("drop", handleDrop);
    list.addEventListener("dragend", handleDragEnd);

    return () => {
      list.removeEventListener("dragstart", handleDragStart);
      list.removeEventListener("dragover", handleDragOver);
      list.removeEventListener("drop", handleDrop);
      list.removeEventListener("dragend", handleDragEnd);
    };
  }, [snaps.length]);

  const handleCardKeyDown = (event, snap, index) => {
    if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
    event.preventDefault();
    const direction = event.key === "ArrowUp" ? -1 : 1;
    if (event.shiftKey) {
      moveSnap(snap.id, direction);
      return;
    }

    const nextIndex = Math.max(0, Math.min(snaps.length - 1, index + direction));
    const nextSnap = snaps[nextIndex];
    if (!nextSnap) return;
    selectSnap(nextSnap.id);
    listRef.current
      ?.querySelectorAll(".snap-select-button")
      [nextIndex]?.focus();
  };

  const handleClear = () => {
    if (snaps.length === 0) return;
    if (!window.confirm("Clear all saved snaps? This cannot be undone.")) return;
    clearSnaps();
  };

  return (
    <aside
      className={`snaps-panel${isCollapsed ? " snaps-panel--collapsed" : ""}`}
      aria-label="Snaps"
    >
      <div className="snaps-panel-header">
        <h2>SNAPS</h2>
        <button
          type="button"
          className="snaps-collapse-button"
          onClick={() => setIsCollapsed((collapsed) => !collapsed)}
          aria-expanded={!isCollapsed}
          aria-label={isCollapsed ? "Expand snaps panel" : "Collapse snaps panel"}
          title={isCollapsed ? "Expand snaps" : "Collapse snaps"}
        >
          <i
            className={`fa-solid ${isCollapsed ? "fa-chevron-right" : "fa-chevron-left"}`}
            aria-hidden="true"
          />
        </button>
      </div>

      {!isCollapsed && (
        <>
          <button
            type="button"
            className="snap-create-button"
            onClick={createSnap}
            title="Capture the current canvas"
          >
            + New Snap
          </button>

          {storageError && (
            <p className="snaps-storage-error" role="alert">
              {storageError}
            </p>
          )}

          {snaps.length === 0 ? (
            <div className="snaps-empty-state">
              <span className="snaps-empty-icon" aria-hidden="true">
                <i className="fa-regular fa-images" />
              </span>
              <p>Your story starts with a snap.</p>
              <span>Capture your canvas to begin a presentation.</span>
            </div>
          ) : (
            <div
              className="snaps-list"
              aria-label="Saved snaps. Use up and down arrows to navigate, shift plus arrows to reorder."
              ref={listRef}
            >
              {snaps.map((snap, index) => (
                <SnapThumbnail
                  key={snap.id}
                  snap={snap}
                  selected={snap.id === selectedSnapId}
                  presentationIncluded={snaps.length > 1}
                  onSelect={() => selectSnap(snap.id)}
                  onRename={renameSnap}
                  onDuplicate={() => duplicateSnap(snap.id)}
                  onDelete={() => deleteSnap(snap.id)}
                  onMove={(direction) => moveSnap(snap.id, direction)}
                  dropPosition={dropTarget?.id === snap.id ? dropTarget.position : null}
                  onKeyDown={(event) => handleCardKeyDown(event, snap, index)}
                />
              ))}
            </div>
          )}

          <div className="snaps-bottom-toolbar">
            <button
              type="button"
              onClick={isPlaying ? stopPresentation : startPresentation}
              disabled={!isPlaying && snaps.length < 2}
              aria-pressed={isPlaying}
              title={snaps.length < 2 ? "Add at least two snaps to present" : "Present snaps"}
              className="snap-present-button"
            >
              <i
                className={`fa-solid ${isPlaying ? "fa-stop" : "fa-play"}`}
                aria-hidden="true"
              />
              {isPlaying ? "Stop" : "Present"}
            </button>
            <button
              type="button"
              onClick={createSnap}
              title="Add a snap of the current canvas"
            >
              <i className="fa-solid fa-plus" aria-hidden="true" /> Add Snap
            </button>
            <button
              type="button"
              onClick={handleClear}
              disabled={snaps.length === 0}
              title="Clear all snaps"
              className="snap-clear-button"
            >
              <i className="fa-solid fa-trash-can" aria-hidden="true" /> Clear
            </button>
          </div>
          {isPlaying && (
            <p className="snap-presentation-status" aria-live="polite">
              Playing · 2 sec per snap
            </p>
          )}
        </>
      )}
    </aside>
  );
}
