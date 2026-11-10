import { useState, useEffect, useCallback } from "react";
import apiClient from "../services/apiClient.js";
import ArtworksTab from "./ArtworksTab.jsx";
import StoriesTab from "./StoriesTab.jsx";
import BranchesTab from "./BranchesTab.jsx";
import IssuesTab from "./IssuesTab.jsx";
import BranchSelector from "./BranchSelector.jsx";
import PullRequestsTab from "./PullRequestsTab.jsx";

export function AlbumDetail({ owner, repoName, branch = "master", localSnaps = [], currentUserLogin, onStoryDirtyChange, onBranchChange, onBackToDashboard, onOpenEditor, onSelectAlbum, showToast }) {
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
  const [isForking, setIsForking] = useState(false);
  const [forkError, setForkError] = useState("");

  const forkAlbum = async () => {
    setIsForking(true);
    setForkError("");
    try {
      const { repo: createdFork } = await apiClient.forkAlbum(owner, repoName);
      if (!createdFork?.owner || !createdFork?.name) {
        throw new Error("GitHub accepted the fork request but did not return its repository location.");
      }

      for (let attempt = 0; attempt < 20; attempt += 1) {
        try {
          const forkData = await apiClient.getAlbum(createdFork.owner, createdFork.name);
          if (forkData.repo?.fork && forkData.repo.parent?.fullName?.toLowerCase() === `${owner}/${repoName}`.toLowerCase()) {
            showToast?.(`Fork ready: ${createdFork.owner}/${createdFork.name}`, "success");
            onSelectAlbum?.(createdFork.owner, createdFork.name);
            return;
          }
        } catch (pollError) {
          if (pollError.status !== 404) throw pollError;
        }
        await new Promise((resolve) => window.setTimeout(resolve, 1500));
      }
      throw new Error(`GitHub is still creating ${createdFork.owner}/${createdFork.name}. Refresh the dashboard and open it shortly.`);
    } catch (forkRequestError) {
      setForkError(forkRequestError.message || "GitHub could not create this fork.");
      showToast?.(forkRequestError.message || "GitHub could not create this fork.", "error");
    } finally {
      setIsForking(false);
    }
  };

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
        {currentUserLogin && repo.owner?.toLowerCase() !== currentUserLogin.toLowerCase() && !repo.fork && (
          <button className="btn-secondary album-fork-button" onClick={forkAlbum} disabled={isForking}>
            <i className={`fa-solid ${isForking ? "fa-spinner fa-spin" : "fa-code-fork"}`}></i>
            <span>{isForking ? "Creating GitHub fork…" : "Fork album"}</span>
          </button>
        )}
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
        {repo.parent && (
          <p className="upstream-notice">
            <i className="fa-solid fa-code-fork"></i>
            Fork of <a href={repo.parent.htmlUrl || `https://github.com/${repo.parent.fullName}`} target="_blank" rel="noreferrer">{repo.parent.fullName}</a>.
            The fork belongs to your GitHub account and follows GitHub's access and organization policies.
          </p>
        )}
        {forkError && <div className="form-error-banner">{forkError}</div>}

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
                    <code>{manifest?.createdWith?.name || "GridCraft"} v{manifest?.createdWith?.version || "3.11.0"}</code>
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

        {/* TAB 6: PULL REQUESTS */}
        {activeTab === "pulls" && (
          <PullRequestsTab
            owner={owner}
            repoName={repoName}
            repo={repo}
            currentUserLogin={currentUserLogin}
            showToast={showToast}
          />
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
