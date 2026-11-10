import { useState } from "react";

function slugify(text) {
  if (!text) return "";
  return text
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 100);
}

export function CreateAlbumModal({ user, onClose, onAlbumCreated, showToast }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const slug = slugify(name);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!slug) {
      setError("Please enter a valid album name.");
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);

      await onAlbumCreated({
        name: name.trim(),
        description,
      });

      if (showToast) {
        showToast(`Album "${slug}" created in gridcraft-artworks.`, "success");
      }
      onClose();
    } catch (err) {
      console.error("Failed to create album:", err);
      setError(err.message || "Failed to create album in GridCraft.");
      if (showToast) {
        showToast(err.message || "Album creation failed", "error");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="modal-container" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Create New Album</h3>
          <button className="modal-close-btn" onClick={onClose} disabled={isSubmitting}>
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-form">
          <p className="modal-subtitle">
            An album is a folder in your <code>gridcraft-artworks</code> GitHub repository.
          </p>

          {error && <div className="form-error-banner">{error}</div>}

          <div className="form-group">
            <label htmlFor="album-name">Album Name *</label>
            <input
              id="album-name"
              type="text"
              placeholder="e.g. Minecraft Items or pixel-swords"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (error) setError(null);
              }}
              disabled={isSubmitting}
              autoFocus
              required
            />
            <span className="form-hint">
              Folder: <code>{slug || "your-album"}/</code>
            </span>
          </div>

          <div className="form-group">
            <label htmlFor="album-description">Description (optional)</label>
            <textarea
              id="album-description"
              rows={3}
              placeholder="What kind of pixel art will this album contain?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={isSubmitting}
            />
          </div>

          <div className="modal-footer">
            <button
              type="button"
              className="btn-modal-secondary"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-modal-primary"
              disabled={isSubmitting || !slug}
            >
              {isSubmitting ? (
                <>
                  <i className="fa-solid fa-spinner fa-spin"></i>
                  <span>Creating album...</span>
                </>
              ) : (
                <>
                  <i className="fa-solid fa-plus"></i>
                  <span>Create Album</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default CreateAlbumModal;
