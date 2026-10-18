import { useEffect, useState } from "react";
import SnapThumbnail from "./SnapThumbnail.jsx";

function formatDate(date) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(date));
}

export default function SnapsPanel({
  snaps,
  selectedSnap,
  selectedSnapId,
  isPlaying,
  storageError,
  createSnap,
  selectSnap,
  renameSnap,
  duplicateSnap,
  deleteSnap,
  moveSnap,
  restoreSnap,
  startPresentation,
  stopPresentation,
  showToast,
}) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");

  useEffect(() => {
    setTitleDraft(selectedSnap?.title ?? "");
  }, [selectedSnapId, selectedSnap?.title]);

  const handleRename = (event) => {
    event.preventDefault();
    if (!selectedSnap) return;
    const title = titleDraft.trim();
    if (!title) {
      setTitleDraft(selectedSnap.title);
      showToast("Snap title cannot be empty");
      return;
    }
    renameSnap(selectedSnap.id, title);
    setTitleDraft(title.slice(0, 80));
    showToast("Snap renamed", "success");
  };

  const handleSelect = (snap) => {
    selectSnap(snap.id);
    setTitleDraft(snap.title);
  };

  return (
    <aside
      className={`snaps-panel${isCollapsed ? " snaps-panel--collapsed" : ""}`}
      aria-label="Snaps"
    >
      <div className="snaps-panel-header">
        {!isCollapsed && <h2>SNAPS</h2>}
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
            title="Capture the current canvas as a new snap"
          >
            <span aria-hidden="true">+</span> Snap
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
              <p>No snaps yet</p>
              <span>Capture your canvas to save a moment.</span>
            </div>
          ) : (
            <div className="snaps-list" aria-label="Saved snaps">
              {snaps.map((snap) => (
                <SnapThumbnail
                  key={snap.id}
                  snap={snap}
                  selected={snap.id === selectedSnapId}
                  onClick={() => handleSelect(snap)}
                />
              ))}
            </div>
          )}

          {selectedSnap && (
            <section className="snap-details" aria-label={`${selectedSnap.title} details`}>
              <form className="snap-rename-form" onSubmit={handleRename}>
                <label htmlFor="snap-title">Snap title</label>
                <div>
                  <input
                    id="snap-title"
                    type="text"
                    value={titleDraft}
                    maxLength={80}
                    onChange={(event) => setTitleDraft(event.target.value)}
                    aria-label="Selected snap title"
                  />
                  <button type="submit" title="Save snap title" aria-label="Save snap title">
                    <i className="fa-solid fa-check" aria-hidden="true" />
                  </button>
                </div>
              </form>
              <p className="snap-metadata">
                {selectedSnap.gridSize}×{selectedSnap.gridSize} ·{" "}
                {formatDate(selectedSnap.createdAt)}
              </p>
              <p className="snap-background">
                Background
                <span
                  aria-label={`Background color ${selectedSnap.backgroundColor}`}
                  title={selectedSnap.backgroundColor}
                  style={{
                    backgroundColor:
                      selectedSnap.backgroundColor === "transparent"
                        ? "transparent"
                        : selectedSnap.backgroundColor,
                  }}
                />
              </p>
              <div className="snap-actions">
                <button
                  type="button"
                  onClick={() => restoreSnap(selectedSnap)}
                  title="Load this snap onto the canvas"
                >
                  <i className="fa-solid fa-arrow-rotate-left" aria-hidden="true" /> Load
                </button>
                <button
                  type="button"
                  onClick={() => duplicateSnap(selectedSnap.id)}
                  title="Duplicate this snap"
                >
                  <i className="fa-regular fa-copy" aria-hidden="true" /> Duplicate
                </button>
                <button
                  type="button"
                  onClick={() => deleteSnap(selectedSnap.id)}
                  title="Delete this snap"
                  className="snap-delete-button"
                >
                  <i className="fa-solid fa-trash-can" aria-hidden="true" /> Delete
                </button>
              </div>
              <div className="snap-order-actions" aria-label="Reorder selected snap">
                <button
                  type="button"
                  onClick={() => moveSnap(selectedSnap.id, -1)}
                  disabled={snaps.findIndex((snap) => snap.id === selectedSnap.id) === 0}
                  title="Move snap earlier"
                >
                  <i className="fa-solid fa-arrow-up" aria-hidden="true" /> Move earlier
                </button>
                <button
                  type="button"
                  onClick={() => moveSnap(selectedSnap.id, 1)}
                  disabled={
                    snaps.findIndex((snap) => snap.id === selectedSnap.id) ===
                    snaps.length - 1
                  }
                  title="Move snap later"
                >
                  <i className="fa-solid fa-arrow-down" aria-hidden="true" /> Move later
                </button>
              </div>
            </section>
          )}

          {snaps.length > 0 && (
            <div className="snap-presentation">
              <button
                type="button"
                onClick={isPlaying ? stopPresentation : startPresentation}
                disabled={!isPlaying && snaps.length < 2}
                title={
                  snaps.length < 2
                    ? "Save at least two snaps to present"
                    : isPlaying
                      ? "Stop presentation"
                      : "Play snaps as a presentation"
                }
                aria-pressed={isPlaying}
              >
                <i
                  className={`fa-solid ${isPlaying ? "fa-stop" : "fa-play"}`}
                  aria-hidden="true"
                />
                {isPlaying ? " Stop presentation" : " Play presentation"}
              </button>
              {isPlaying && (
                <p aria-live="polite">
                  Playing {selectedSnap?.title ?? "snap"} · 2 sec per snap
                </p>
              )}
            </div>
          )}
        </>
      )}
    </aside>
  );
}
