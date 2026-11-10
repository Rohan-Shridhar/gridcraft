export default function EditorSaveBar({
  albumLabel,
  artworkName,
  branch,
  saveState,
  isDirty,
  onSave,
  onReload,
  onBack,
  onRename,
  onDelete,
  onInspectRemote,
  onSaveAsNew,
  isBusy = false,
  commits = [],
}) {
  const isSaving = saveState === "saving";
  const controlsDisabled = isSaving || isBusy;
  const labels = {
    unsaved: "Unsaved",
    saving: "Saving…",
    saved: "Saved",
    conflict: "Conflict",
    error: "Save failed",
  };

  return (
    <div className="editor-save-bar">
      <div className="editor-save-bar-left">
        {onBack && (
          <button className="btn-back-breadcrumb" onClick={onBack}>
            <i className="fa-solid fa-arrow-left"></i>
            <span>Album</span>
          </button>
        )}
        <div>
          <strong>{artworkName || "Artwork"}</strong>
          <div className="editor-save-meta">
            {albumLabel} · <i className="fa-solid fa-code-branch"></i> {branch}
          </div>
        </div>
      </div>
      <div className="editor-save-bar-right">
        <span className={`save-state-pill save-state-${saveState}`}>
          {isDirty && saveState === "saved" ? "Unsaved" : labels[saveState] || saveState}
        </span>
        {onRename && (
          <button className="btn-secondary" onClick={onRename} disabled={controlsDisabled} type="button">
            Rename
          </button>
        )}
        {onDelete && (
          <button className="btn-secondary" onClick={onDelete} disabled={controlsDisabled} type="button">
            Delete
          </button>
        )}
        {saveState === "conflict" && (
          <>
            <button className="btn-secondary" onClick={onInspectRemote} disabled={controlsDisabled} type="button">
              Compare remote
            </button>
            <button className="btn-secondary" onClick={onSaveAsNew} disabled={controlsDisabled} type="button">
              Save as new
            </button>
            <button className="btn-secondary" onClick={onReload} disabled={controlsDisabled} type="button">
              Reload remote
            </button>
          </>
        )}
        <button className="btn-primary" onClick={onSave} disabled={controlsDisabled || saveState === "conflict" || (!isDirty && saveState === "saved")} type="button">
          {saveState === "saving" ? "Saving…" : "Save to GitHub"}
        </button>
      </div>
      {commits.length > 0 && (
        <div className="editor-commit-strip">
          {commits.slice(0, 5).map((commit) => (
            <a key={commit.sha} href={commit.htmlUrl} target="_blank" rel="noreferrer">
              {commit.shortSha} {commit.message}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
