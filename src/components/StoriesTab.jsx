import { useCallback, useEffect, useState } from "react";
import apiClient from "../services/apiClient.js";

export default function StoriesTab({ owner, repoName, branch = "master", onOpenStory, showToast }) {
  const [stories, setStories] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const res = await apiClient.listStories(owner, repoName, branch);
      setStories(res.stories || []);
    } catch (err) {
      setError(err.message || "Failed to load stories.");
    } finally {
      setIsLoading(false);
    }
  }, [owner, repoName, branch]);

  useEffect(() => {
    load();
  }, [load]);

  const createStory = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setCreating(true);
    try {
      const res = await apiClient.createStory(owner, repoName, { name: name.trim(), description }, branch);
      showToast(`Story "${res.story.name}" created`, "success");
      setName("");
      setDescription("");
      onOpenStory(res.story.id);
    } catch (err) {
      showToast(err.message || "Failed to create story", "error");
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (story) => {
    if (!window.confirm(`Delete story "${story.name}"?`)) return;
    try {
      await apiClient.deleteStory(owner, repoName, story.id, story.sha, branch);
      setStories((prev) => prev.filter((item) => item.id !== story.id));
      showToast("Story deleted", "success");
    } catch (err) {
      showToast(err.message, "error");
    }
  };

  if (isLoading) {
    return (
      <div className="artworks-loading">
        <i className="fa-solid fa-spinner fa-spin"></i>
        <span>Loading stories from GitHub...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="artworks-error">
        <p>{error}</p>
        <button className="btn-secondary" onClick={load}>Retry</button>
      </div>
    );
  }

  return (
    <div className="stories-tab">
      <form className="inline-create-form" onSubmit={createStory}>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="New story name"
          maxLength={100}
          required
        />
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Description (optional)"
          maxLength={500}
        />
        <button className="btn-primary" disabled={creating} type="submit">
          {creating ? "Creating…" : "New Story"}
        </button>
      </form>

      {stories.length === 0 ? (
        <div className="artworks-empty">
          <i className="fa-solid fa-film"></i>
          <h4>No stories yet</h4>
          <p>A Story is an ordered sequence of artworks in this album.</p>
        </div>
      ) : (
        <div className="artworks-grid">
          {stories.map((story) => (
            <div key={story.id} className="artwork-card">
              <div className="artwork-card-info">
                <div className="artwork-card-name-row">
                  <span className="artwork-card-name">{story.name}</span>
                  <span className="artwork-card-grid-badge">{story.frames?.length || 0} frames</span>
                </div>
                {story.description && <p className="artwork-card-desc">{story.description}</p>}
                <span className="artwork-card-date">
                  {story.updatedAt ? new Date(story.updatedAt).toLocaleDateString() : ""}
                </span>
              </div>
              <div className="artwork-card-actions">
                <button className="btn-artwork-open" onClick={() => onOpenStory(story.id)}>
                  <i className="fa-solid fa-play"></i>
                </button>
                <button className="btn-artwork-delete" onClick={() => handleDelete(story)}>
                  <i className="fa-solid fa-trash-can"></i>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
