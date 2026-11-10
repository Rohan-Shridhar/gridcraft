import { useState, useEffect, useCallback } from "react";
import apiClient from "../services/apiClient.js";
import ArtworksTab from "./ArtworksTab.jsx";
import StoriesTab from "./StoriesTab.jsx";
import BranchesTab from "./BranchesTab.jsx";
import IssuesTab from "./IssuesTab.jsx";
import BranchSelector from "./BranchSelector.jsx";

export function AlbumDetail({ owner, repoName, branch = "master", localSnaps = [], onStoryDirtyChange, onBranchChange, onBackToDashboard, onOpenEditor, showToast }) {
  const [activeTab, setActiveTab] = useState("overview");
  const [storyDirty, setStoryDirty] = useState(false);
  const [albumData, setAlbumData] = useState(null);
  const [commits, setCommits] = useState([]);
  const [tree, setTree] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Deletion modal state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteInputName, setDeleteInputName] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  const selectTab = (nextTab) => {
    if (nextTab === activeTab) return;
    if (storyDirty && !window.confirm("Leave Stories and discard your unsaved changes?")) return;
    setActiveTab(nextTab);
  };
  const backToDashboard = () => {
    if (storyDirty && !window.confirm("Leave Stories and discard your unsaved changes?")) return;
    onBackToDashboard();
  };
  const reportStoryDirty = useCallback((dirty) => {
    setStoryDirty(dirty);
    onStoryDirtyChange?.(dirty);
  }, [onStoryDirtyChange]);

  useEffect(() => {
    let isMounted = true;

    async function loadAlbum() {
      try {
        setIsLoading(true);
        setError(null);
        const data = await apiClient.getAlbum(owner, repoName);
        if (!isMounted) return;
        setAlbumData(data);

        // Fetch commits and tree in background
        apiClient.getAlbumCommits(owner, repoName, branch).then((res) => {
          if (isMounted) setCommits(res.commits || []);
        }).catch(() => {});

        apiClient.getAlbumTree(owner, repoName, branch).then((res) => {
          if (isMounted) setTree(res.tree || []);
        }).catch(() => {});
      } catch (err) {
        if (!isMounted) return;
        console.error("Failed to load album:", err);
        setError(err.message || "Could not load album repository from GitHub.");
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    loadAlbum();
    return () => {
      isMounted = false;
    };
  }, [owner, repoName, branch]);

  const handleDeleteAlbum = async (e) => {
    e.preventDefault();
    if (deleteInputName !== repoName) {
      if (showToast) showToast("Name does not match repository name", "error");
      return;
    }

    try {
      setIsDeleting(true);
      await apiClient.deleteAlbum(owner, repoName, deleteInputName);
      if (showToast) showToast(`Album ${repoName} deleted from GitHub`, "success");
      onBackToDashboard();
    } catch (err) {
      console.error("Failed to delete album:", err);
      if (showToast) showToast(err.message || "Failed to delete album", "error");
    } finally {
      setIsDeleting(false);
      setShowDeleteModal(false);
    }
  };

  if (isLoading) {
    return (
      <div className="album-detail-loading">
        <i className="fa-solid fa-spinner fa-spin"></i>
        <span>Loading album repository from GitHub...</span>
      </div>
    );
  }

  if (error || !albumData) {
    return (
      <div className="album-detail-error">
        <h3>Unable to Load Album</h3>
        <p>{error || "Album not found or access denied."}</p>
        <button className="btn-secondary" onClick={onBackToDashboard}>
          <i className="fa-solid fa-arrow-left"></i> Back to Dashboard
        </button>
      </div>
    );
  }

  const { repo, manifest, isGridCraftAlbum } = albumData;

  return (
    <div className="album-detail-container">
      {/* Top Breadcrumb & Controls */}
      <div className="album-breadcrumb-bar">
        <button className="btn-back-breadcrumb" onClick={backToDashboard}>
          <i className="fa-solid fa-arrow-left"></i>
          <span>Dashboard</span>
        </button>
        <span className="breadcrumb-separator">/</span>
        <span className="breadcrumb-current">{repo.name}</span>

        <a
          href={repo.htmlUrl}
          target="_blank"
          rel="noreferrer"
          className="btn-github-external"
          title="Open repository in GitHub"
        >
          <i className="fa-brands fa-github"></i>
          <span>Open on GitHub</span>
          <i className="fa-solid fa-arrow-up-right-from-square external-small"></i>
        </a>
      </div>

      {/* Album Hero Header */}
      <div className="album-hero-card">
        <div className="album-title-row">
          <div className="album-title-group">
            <h2>{manifest?.name || repo.name}</h2>
            <div className="album-badges">
              <span className={`badge-visibility ${repo.isPrivate ? "private" : "public"}`}>
                <i className={`fa-solid ${repo.isPrivate ? "fa-lock" : "fa-globe"}`}></i>
                {repo.isPrivate ? "Private" : "Public"}
              </span>

              <span className="badge-branch">
                <i className="fa-solid fa-code-branch"></i>
                {branch}
              </span>
              <BranchSelector owner={owner} repoName={repoName} branch={branch} onChange={onBranchChange} showToast={showToast} />

              {isGridCraftAlbum && (
                <span className="badge-verified" title="Verified GridCraft Album structure">
                  <i className="fa-solid fa-check"></i> GridCraft Album
                </span>
              )}
            </div>
          </div>
        </div>

        <p className="album-hero-description">
          {manifest?.description || repo.description || "No description provided."}
        </p>

        <div className="album-repo-meta">
          <span>
            <i className="fa-regular fa-user"></i> {repo.owner}
          </span>
          <span>
            <i className="fa-regular fa-clock"></i> Updated {new Date(repo.updatedAt).toLocaleDateString()}
          </span>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="album-tabs-nav" role="tablist">
        <button
          className={`tab-btn ${activeTab === "overview" ? "active" : ""}`}
          onClick={() => selectTab("overview")}
          role="tab"
          aria-selected={activeTab === "overview"}
        >
          <i className="fa-solid fa-book-open"></i>
          <span>Overview</span>
        </button>

        <button
          className={`tab-btn ${activeTab === "artworks" ? "active" : ""}`}
          onClick={() => selectTab("artworks")}
          role="tab"
          aria-selected={activeTab === "artworks"}
        >
          <i className="fa-solid fa-palette"></i>
          <span>Artworks</span>
        </button>

        <button
          className={`tab-btn ${activeTab === "stories" ? "active" : ""}`}
          onClick={() => selectTab("stories")}
          role="tab"
          aria-selected={activeTab === "stories"}
        >
          <i className="fa-solid fa-film"></i>
          <span>Stories</span>
        </button>

        <button
          className={`tab-btn ${activeTab === "branches" ? "active" : ""}`}
          onClick={() => selectTab("branches")}
          role="tab"
          aria-selected={activeTab === "branches"}
        >
          <i className="fa-solid fa-code-branch"></i>
          <span>Branches</span>
        </button>

        <button
          className={`tab-btn ${activeTab === "issues" ? "active" : ""}`}
          onClick={() => selectTab("issues")}
          role="tab"
          aria-selected={activeTab === "issues"}
        >
          <i className="fa-regular fa-circle-dot"></i>
          <span>Issues</span>
        </button>

        <button
          className={`tab-btn ${activeTab === "pulls" ? "active" : ""}`}
          onClick={() => selectTab("pulls")}
          role="tab"
          aria-selected={activeTab === "pulls"}
        >
          <i className="fa-solid fa-code-pull-request"></i>
          <span>Pull Requests</span>
          <span className="tab-pill-roadmap">v3.10.0</span>
        </button>

        <button
          className={`tab-btn ${activeTab === "settings" ? "active" : ""}`}
          onClick={() => selectTab("settings")}
          role="tab"
          aria-selected={activeTab === "settings"}
        >
          <i className="fa-solid fa-gear"></i>
          <span>Settings</span>
        </button>
      </div>

      {/* Tab Contents */}
      <div className="album-tab-content">
        {/* TAB 1: OVERVIEW */}
        {activeTab === "overview" && (
          <div className="tab-pane-overview">
            <div className="overview-grid">
              {/* Manifest Card */}
              <div className="overview-card">
                <h4><i className="fa-solid fa-cube"></i> Album Manifest</h4>
                <div className="manifest-details">
                  <div className="manifest-row">
                    <span>Format</span>
                    <code>{manifest?.format || "gridcraft-album"}</code>
                  </div>
                  <div className="manifest-row">
                    <span>Schema Version</span>
                    <code>v{manifest?.schemaVersion || 1}</code>
                  </div>
                  <div className="manifest-row">
                    <span>Created With</span>
                    <code>{manifest?.createdWith?.name || "GridCraft"} v{manifest?.createdWith?.version || "3.9.0"}</code>
                  </div>
                  <div className="manifest-row">
                    <span>Default Branch</span>
                    <code>master</code>
                  </div>
                </div>
              </div>

              {/* Repository Structure */}
              <div className="overview-card">
                <h4><i className="fa-regular fa-folder-tree"></i> Repository Structure</h4>
                <ul className="folder-tree-list">
                  <li>
                    <i className="fa-regular fa-folder"></i> <code>.gridcraft/</code>
                    <ul>
                      <li><i className="fa-regular fa-file-code"></i> <code>album.json</code> (Manifest)</li>
                    </ul>
                  </li>
                  <li>
                    <i className="fa-regular fa-folder"></i> <code>artworks/</code> (Pixel art canvas files)
                  </li>
                  <li>
                    <i className="fa-regular fa-folder"></i> <code>stories/</code> (Animation sequence folders)
                  </li>
                  <li>
                    <i className="fa-regular fa-file-lines"></i> <code>README.md</code>
                  </li>
                </ul>
              </div>
            </div>

            {/* Recent Commits */}
            <div className="overview-section">
              <h4><i className="fa-solid fa-clock-rotate-left"></i> Recent Commits on <code>{branch}</code></h4>
              {commits.length === 0 ? (
                <p className="empty-subtext">No commits found yet.</p>
              ) : (
                <div className="commits-list">
                  {commits.map((c) => (
                    <div key={c.sha} className="commit-item">
                      <div className="commit-info">
                        <span className="commit-msg">{c.message}</span>
                        <span className="commit-author">by @{c.authorLogin} on {new Date(c.date).toLocaleString()}</span>
                      </div>
                      <a href={c.htmlUrl} target="_blank" rel="noreferrer" className="commit-sha-badge">
                        <code>{c.shortSha}</code>
                      </a>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: ARTWORKS */}
        {activeTab === "artworks" && (
          <ArtworksTab
            owner={owner}
            repoName={repoName}
            branch={branch}
            onOpenEditor={(artworkId) => onOpenEditor(artworkId, branch)}
            showToast={showToast}
          />
        )}

        {/* TAB 3: STORIES */}
        {activeTab === "stories" && (
          <StoriesTab owner={owner} repoName={repoName} branch={branch} localSnaps={localSnaps} onDirtyChange={reportStoryDirty} showToast={showToast} />
        )}

        {/* TAB 4: BRANCHES */}
        {activeTab === "branches" && (
          <BranchesTab owner={owner} repoName={repoName} branch={branch} onSelectBranch={onBranchChange} showToast={showToast} />
        )}

        {/* TAB 5: ISSUES */}
        {activeTab === "issues" && (
          <IssuesTab owner={owner} repoName={repoName} showToast={showToast} />
        )}

        {/* TAB 6: PULL REQUESTS (Coming in v3.10.0) */}
        {activeTab === "pulls" && (
          <div className="tab-pane-placeholder">
            <div className="placeholder-icon">
              <i className="fa-solid fa-code-pull-request"></i>
            </div>
            <h3>Pull Requests Arriving in v3.10.0</h3>
            <p>
              In <strong>v3.10.0</strong>, propose and review changes to pixel art albums through real GitHub Pull Requests.
            </p>
          </div>
        )}

        {/* TAB 7: SETTINGS */}
        {activeTab === "settings" && (
          <div className="tab-pane-settings">
            <div className="settings-danger-card">
              <h4><i className="fa-solid fa-triangle-exclamation"></i> Danger Zone</h4>
              <p>
                Deleting this album will permanently delete the GitHub repository <strong>{owner}/{repoName}</strong>,
                all its branches, artworks, stories, and commit history. This action cannot be undone.
              </p>
              <button
                className="btn-danger"
                onClick={() => {
                  setDeleteInputName("");
                  setShowDeleteModal(true);
                }}
              >
                <i className="fa-solid fa-trash-can"></i> Delete this Album Repository
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="modal-backdrop" onClick={() => !isDeleting && setShowDeleteModal(false)} role="dialog" aria-modal="true">
          <div className="modal-container modal-danger" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Delete Album Repository</h3>
              <button className="modal-close-btn" onClick={() => setShowDeleteModal(false)} disabled={isDeleting}>
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>

            <form onSubmit={handleDeleteAlbum} className="modal-form">
              <p className="danger-warning-text">
                This will delete the repository <strong>{owner}/{repoName}</strong> from GitHub.
              </p>

              <div className="form-group">
                <label htmlFor="confirm-repo-name">
                  Please type <code>{repoName}</code> to confirm:
                </label>
                <input
                  id="confirm-repo-name"
                  type="text"
                  value={deleteInputName}
                  onChange={(e) => setDeleteInputName(e.target.value)}
                  placeholder={repoName}
                  disabled={isDeleting}
                  autoFocus
                  required
                />
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn-modal-secondary"
                  onClick={() => setShowDeleteModal(false)}
                  disabled={isDeleting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-modal-danger"
                  disabled={isDeleting || deleteInputName !== repoName}
                >
                  {isDeleting ? (
                    <>
                      <i className="fa-solid fa-spinner fa-spin"></i>
                      <span>Deleting on GitHub...</span>
                    </>
                  ) : (
                    "I understand the consequences, delete this album"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default AlbumDetail;
