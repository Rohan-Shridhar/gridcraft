import { useState, useEffect, useCallback } from "react";
import apiClient from "../services/apiClient.js";
import useAuth from "../hooks/useAuth.jsx";
import CreateAlbumModal from "./CreateAlbumModal.jsx";

const SETUP_ERROR_CODES = new Set([
  "LIBRARY_SETUP_REQUIRED",
  "APP_NOT_INSTALLED",
  "APP_PERMISSION_DENIED",
]);
const DEFAULT_INSTALL_URL = "https://github.com/apps/gridcraft-auth/installations/new";

export function DashboardShell({ user, onOpenEditor, onSelectAlbum, showToast }) {
  const { setupRequired, setupCode, clearSetupNotice } = useAuth();
  const [albums, setAlbums] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [apiSetupNotice, setApiSetupNotice] = useState(null);
  const [setupDismissed, setSetupDismissed] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [page, setPage] = useState(1);
  const perPage = 30;

  const loadAlbums = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const res = await apiClient.listAlbums(page, perPage);
      setAlbums(res.albums || []);
      setApiSetupNotice(null);
    } catch (err) {
      console.error("Failed to load albums:", err);
      const apiError = err.data?.error;
      if (SETUP_ERROR_CODES.has(apiError?.code)) {
        setApiSetupNotice({
          code: apiError.code,
          installUrl: apiError.installUrl,
        });
        setSetupDismissed(false);
        setError(null);
      } else {
        setError(err.message || "Could not retrieve albums from GitHub.");
      }
    } finally {
      setIsLoading(false);
    }
  }, [page]);

  useEffect(() => {
    loadAlbums();
  }, [loadAlbums]);

  const handleAlbumCreated = async (payload) => {
    const res = await apiClient.createAlbum(payload);
    await loadAlbums();
    if (res?.repo?.slug) {
      onSelectAlbum(res.repo.owner, res.repo.slug);
    }
  };

  const filteredAlbums = albums.filter((a) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return (
      a.name.toLowerCase().includes(term) ||
      (a.description && a.description.toLowerCase().includes(term))
    );
  });
  const setupNotice = apiSetupNotice || (setupRequired ? { code: setupCode } : null);
  const showSetupNotice = setupNotice && !setupDismissed;

  const dismissSetupNotice = () => {
    clearSetupNotice();
    setApiSetupNotice(null);
    setSetupDismissed(true);
  };

  if (!user) return null;

  return (
    <section className="dashboard-shell" aria-label="Creator Dashboard">
      {/* Dashboard Top Header */}
      <div className="dashboard-header">
        <div className="dashboard-welcome">
          <img
            src={user.avatarUrl || "/cat-white.svg"}
            alt=""
            className="dashboard-welcome-avatar"
          />
          <div>
            <h2 className="dashboard-title">Welcome, {user.name || user.login}!</h2>
            <p className="dashboard-subtitle">
              Connected via GitHub App <code>gridcraft-auth</code> as{" "}
              <a href={user.htmlUrl} target="_blank" rel="noreferrer" className="dashboard-user-link">
                @{user.login}
              </a>
            </p>
          </div>
        </div>

        <div className="dashboard-header-actions">
          <button className="dashboard-cta-btn" onClick={() => setShowCreateModal(true)}>
            <i className="fa-solid fa-plus"></i>
            <span>Create Album</span>
          </button>
          <button className="btn-secondary" onClick={onOpenEditor} title="Open standalone pixel editor">
            <i className="fa-solid fa-paint-brush"></i>
            <span>Pixel Editor</span>
          </button>
        </div>
      </div>

      {showSetupNotice && (
        <section className="form-error-banner" role="alert" aria-label="GitHub library setup required">
          <div className="dashboard-setup-banner-header">
            <strong>Finish setting up your GitHub artwork library</strong>
            <button className="btn-secondary" type="button" onClick={dismissSetupNotice}>
              Dismiss
            </button>
          </div>
          {setupNotice.code === "APP_PERMISSION_DENIED" ? (
            <p>
              gridcraft-auth needs Contents: Read and write on gridcraft-artworks. Accept any pending
              permission update.
            </p>
          ) : (
            <ol>
              <li>Create a public repository named <code>gridcraft-artworks</code> with a README.</li>
              <li>Install the gridcraft-auth GitHub App on that repository.</li>
            </ol>
          )}
          <div className="dashboard-setup-banner-actions">
            <a href={setupNotice.installUrl || DEFAULT_INSTALL_URL} target="_blank" rel="noreferrer">
              Install GitHub App
            </a>
            <button className="btn-secondary" type="button" onClick={loadAlbums} disabled={isLoading}>
              Retry
            </button>
          </div>
        </section>
      )}

      {/* Albums Section Heading & Filter Bar */}
      <div className="dashboard-section-bar">
        <div className="section-title-wrap">
          <h3>Your Albums</h3>
          <span className="badge-count">{albums.length}</span>
        </div>

        <div className="dashboard-filter-wrap">
          <div className="search-input-wrap">
            <i className="fa-solid fa-magnifying-glass search-icon"></i>
            <input
              type="text"
              placeholder="Filter albums..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="dashboard-search-input"
            />
            {searchTerm && (
              <button className="clear-search-btn" onClick={() => setSearchTerm("")}>
                <i className="fa-solid fa-xmark"></i>
              </button>
            )}
          </div>

          <button
            className="btn-refresh"
            onClick={loadAlbums}
            disabled={isLoading}
            title="Refresh from GitHub"
          >
            <i className={`fa-solid fa-arrows-rotate ${isLoading ? "fa-spin" : ""}`}></i>
          </button>
        </div>
      </div>

      {/* Albums Content */}
      {isLoading ? (
        <div className="dashboard-loading-card">
          <i className="fa-solid fa-spinner fa-spin"></i>
          <p>Fetching your albums from GitHub...</p>
        </div>
      ) : error ? (
        <div className="dashboard-error-card">
          <i className="fa-solid fa-circle-exclamation error-icon"></i>
          <h4>Failed to Load Albums</h4>
          <p>{error}</p>
          <button className="btn-secondary" onClick={loadAlbums}>
            <i className="fa-solid fa-arrows-rotate"></i> Try Again
          </button>
        </div>
      ) : filteredAlbums.length === 0 ? (
        <div className="dashboard-empty-card">
          <div className="empty-card-icon">
            <i className="fa-regular fa-folder-open"></i>
          </div>
          <h4>{searchTerm ? "No Matching Albums" : "No Albums Yet"}</h4>
          <p>
            {searchTerm
              ? `No albums match "${searchTerm}".`
              : "Albums are folders in your public gridcraft-artworks repository. Create your first album to begin!"}
          </p>
          <button className="dashboard-cta-btn" onClick={() => setShowCreateModal(true)}>
            <i className="fa-solid fa-plus"></i> Create First Album
          </button>
        </div>
      ) : (
        <div className="albums-grid">
          {filteredAlbums.map((album) => (
            <div key={album.id} className="album-card">
              <div className="album-card-header">
                <div className="album-card-title-wrap">
                  <h4 className="album-card-name" onClick={() => onSelectAlbum(album.owner, album.slug)}>
                    {album.name}
                  </h4>
                  <div className="album-badges-row">
                    <span className="badge-visibility-small public">
                      <i className="fa-solid fa-globe"></i> Public
                    </span>
                  </div>
                </div>

                <a
                  href={album.htmlUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="album-github-icon"
                  title="View on GitHub"
                >
                  <i className="fa-brands fa-github"></i>
                </a>
              </div>

              <p className="album-card-desc">
                {album.description || "No description provided."}
              </p>

              <div className="album-card-footer">
                <span className="album-updated-time">
                  Updated {new Date(album.updatedAt).toLocaleDateString()}
                </span>

                <button
                  className="btn-open-album"
                  onClick={() => onSelectAlbum(album.owner, album.slug)}
                >
                  <span>Open Album</span>
                  <i className="fa-solid fa-arrow-right"></i>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Roadmapped Meta Information */}
      <div className="dashboard-meta-grid">
        <div className="meta-card">
          <h5><i className="fa-solid fa-shield-halved"></i> Stored in your GitHub repository</h5>
          <p>
            Albums, stories, and artwork files are folders and JSON files in <code>gridcraft-artworks</code>.
          </p>
        </div>
        <div className="meta-card">
          <h5><i className="fa-solid fa-folder-tree"></i> Albums → Stories → Artworks</h5>
          <p>
            Create stories inside albums and edit each artwork JSON file as a visual canvas.
          </p>
        </div>
      </div>

      {/* Create Album Modal */}
      {showCreateModal && (
        <CreateAlbumModal
          user={user}
          onClose={() => setShowCreateModal(false)}
          onAlbumCreated={handleAlbumCreated}
          showToast={showToast}
        />
      )}
    </section>
  );
}

export default DashboardShell;
