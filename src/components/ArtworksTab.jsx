import { useState, useEffect, useCallback } from "react";
import apiClient from "../services/apiClient.js";
import ArtworkThumbnail from "./ArtworkThumbnail.jsx";

/**
 * ArtworksTab — displays the list of artworks in an album and allows creation/deletion.
 * Props:
 *   owner, repoName — album identity
 *   onOpenEditor(artworkId) — called when user opens an artwork for editing
 *   showToast(msg, type)
 */
export default function ArtworksTab({ owner, repoName, onOpenEditor, showToast }) {
  const [artworks, setArtworks] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showNewModal, setShowNewModal] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const loadArtworks = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const res = await apiClient.listArtworks(owner, repoName);
      setArtworks(res.artworks || []);
    } catch (err) {
      setError(err.message || "Failed to load artworks.");
    } finally {
      setIsLoading(false);
    }
  }, [owner, repoName]);

  useEffect(() => {
    loadArtworks();
  }, [loadArtworks]);

  const handleDelete = useCallback(
    async (artwork) => {
      if (!window.confirm(`Delete artwork "${artwork.name}"? This cannot be undone.`)) return;
      setDeletingId(artwork.id);
      try {
        await apiClient.deleteArtwork(owner, repoName, artwork.id, artwork.sha);
        setArtworks((prev) => prev.filter((a) => a.id !== artwork.id));
        showToast(`Artwork "${artwork.name}" deleted`, "success");
      } catch (err) {
        showToast(err.message || "Failed to delete artwork", "error");
      } finally {
        setDeletingId(null);
      }
    },
    [owner, repoName, showToast]
  );

  const handleCreated = useCallback(
    (artwork) => {
      setShowNewModal(false);
      setArtworks((prev) => [artwork, ...prev]);
      onOpenEditor(artwork.id);
    },
    [onOpenEditor]
  );

  if (isLoading) {
    return (
      <div className="artworks-loading">
        <i className="fa-solid fa-spinner fa-spin"></i>
        <span>Loading artworks from GitHub...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="artworks-error">
        <i className="fa-solid fa-triangle-exclamation"></i>
        <p>{error}</p>
        <button className="btn-secondary" onClick={loadArtworks}>
          <i className="fa-solid fa-rotate-right"></i> Retry
        </button>
      </div>
    );
  }

  return (
    <div className="artworks-tab">
      <div className="artworks-header">
        <div className="artworks-header-left">
          <h3>
            <i className="fa-solid fa-palette"></i> Artworks
          </h3>
          <span className="artworks-count">{artworks.length} artwork{artworks.length !== 1 ? "s" : ""}</span>
        </div>
        <button
          className="btn-primary artwork-new-btn"
          onClick={() => setShowNewModal(true)}
        >
          <i className="fa-solid fa-plus"></i> New Artwork
        </button>
      </div>

      {artworks.length === 0 ? (
        <div className="artworks-empty">
          <i className="fa-regular fa-image"></i>
          <h4>No artworks yet</h4>
          <p>Create your first pixel art in this album.</p>
          <button className="btn-primary" onClick={() => setShowNewModal(true)}>
            <i className="fa-solid fa-plus"></i> Create Artwork
          </button>
        </div>
      ) : (
        <div className="artworks-grid">
          {artworks.map((artwork) => (
            <ArtworkCard
              key={artwork.id}
              artwork={artwork}
              onOpen={() => onOpenEditor(artwork.id)}
              onDelete={() => handleDelete(artwork)}
              isDeleting={deletingId === artwork.id}
            />
          ))}
        </div>
      )}

      {showNewModal && (
        <NewArtworkModal
          owner={owner}
          repoName={repoName}
          onCreated={handleCreated}
          onClose={() => setShowNewModal(false)}
          showToast={showToast}
        />
      )}
    </div>
  );
}

function ArtworkCard({ artwork, onOpen, onDelete, isDeleting }) {
  const { id, name, description, gridSize, updatedAt, cells, backgroundColor } = artwork;

  return (
    <div className="artwork-card">
      <button className="artwork-thumbnail-btn" onClick={onOpen} title={`Open ${name}`}>
        <ArtworkThumbnail cells={cells} gridSize={gridSize} backgroundColor={backgroundColor} />
      </button>

      <div className="artwork-card-info">
        <div className="artwork-card-name-row">
          <span className="artwork-card-name" title={id}>{name}</span>
          <span className="artwork-card-grid-badge">{gridSize}×{gridSize}</span>
        </div>
        {description && <p className="artwork-card-desc">{description}</p>}
        <span className="artwork-card-date">
          {updatedAt ? new Date(updatedAt).toLocaleDateString() : ""}
        </span>
      </div>

      <div className="artwork-card-actions">
        <button className="btn-artwork-open" onClick={onOpen} title="Open editor">
          <i className="fa-solid fa-pen-to-square"></i>
        </button>
        <button
          className="btn-artwork-delete"
          onClick={onDelete}
          disabled={isDeleting}
          title="Delete artwork"
        >
          {isDeleting
            ? <i className="fa-solid fa-spinner fa-spin"></i>
            : <i className="fa-solid fa-trash-can"></i>}
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────── New Artwork Modal ───────────────────────────────

const SUPPORTED_GRID_SIZES = [16, 32, 64, 128];

function slugify(str) {
  return str
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 100);
}

function NewArtworkModal({ owner, repoName, onCreated, onClose, showToast }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [gridSize, setGridSize] = useState(16);
  const [isSaving, setIsSaving] = useState(false);

  const slugPreview = slugify(name);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setIsSaving(true);
    try {
      const res = await apiClient.createArtwork(owner, repoName, {
        name: name.trim(),
        description: description.trim(),
        gridSize,
      });
      onCreated(res.artwork);
      showToast(`Artwork "${res.artwork.name}" created`, "success");
    } catch (err) {
      showToast(err.message || "Failed to create artwork", "error");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="New Artwork"
      onClick={() => !isSaving && onClose()}
    >
      <div className="modal-container" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3><i className="fa-solid fa-palette"></i> New Artwork</h3>
          <button className="modal-close-btn" onClick={onClose} disabled={isSaving}>
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-form">
          <div className="form-group">
            <label htmlFor="aw-name">Name <span className="required">*</span></label>
            <input
              id="aw-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Golden Apple"
              maxLength={100}
              required
              autoFocus
              disabled={isSaving}
            />
            {slugPreview && (
              <span className="slug-preview">
                <i className="fa-solid fa-link"></i> File: artworks/<code>{slugPreview}.json</code>
              </span>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="aw-desc">Description <span className="optional">(optional)</span></label>
            <textarea
              id="aw-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe this artwork…"
              maxLength={500}
              rows={2}
              disabled={isSaving}
            />
          </div>

          <div className="form-group">
            <label>Grid Size</label>
            <div className="grid-size-picker">
              {SUPPORTED_GRID_SIZES.map((sz) => (
                <button
                  type="button"
                  key={sz}
                  className={`grid-size-pick-btn${gridSize === sz ? " active" : ""}`}
                  onClick={() => setGridSize(sz)}
                  disabled={isSaving}
                >
                  {sz}×{sz}
                </button>
              ))}
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn-modal-secondary" onClick={onClose} disabled={isSaving}>
              Cancel
            </button>
            <button
              type="submit"
              className="btn-modal-primary"
              disabled={isSaving || !name.trim()}
            >
              {isSaving ? (
                <><i className="fa-solid fa-spinner fa-spin"></i> Creating…</>
              ) : (
                <><i className="fa-solid fa-plus"></i> Create Artwork</>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
