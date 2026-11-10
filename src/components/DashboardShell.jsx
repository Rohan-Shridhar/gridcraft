export function DashboardShell({ user, onOpenEditor }) {
  if (!user) return null;

  return (
    <section className="dashboard-shell" aria-label="Creator Dashboard">
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

        <button className="dashboard-cta-btn" onClick={onOpenEditor}>
          <i className="fa-solid fa-paint-brush"></i>
          <span>Open Pixel Editor</span>
        </button>
      </div>

      <div className="dashboard-section-heading">
        <h3>Albums (Repositories)</h3>
        <span className="badge-roadmap">Coming in v3.5.0</span>
      </div>

      <div className="dashboard-empty-card">
        <div className="empty-card-icon">
          <i className="fa-regular fa-folder-open"></i>
        </div>
        <h4>No Albums Yet</h4>
        <p>
          In GridCraft <strong>v3.5.0</strong>, every album you create will be a real GitHub repository
          under your GitHub account, storing pixel artworks and stories with full version control.
        </p>
        <div className="empty-card-actions">
          <button className="btn-secondary" onClick={onOpenEditor}>
            <i className="fa-solid fa-palette"></i> Create Art in Editor
          </button>
        </div>
      </div>

      <div className="dashboard-meta-grid">
        <div className="meta-card">
          <h5><i className="fa-solid fa-shield-halved"></i> GitHub Authentication</h5>
          <p>
            Your session is verified directly with GitHub. No personal access tokens or keys are stored in your browser.
          </p>
        </div>
        <div className="meta-card">
          <h5><i className="fa-solid fa-code-branch"></i> Git-Native Roadmap</h5>
          <p>
            Next milestone (v3.5.0) introduces album repository creation, followed by Git-backed artwork files (v3.6.0) and animated Stories (v3.7.0).
          </p>
        </div>
      </div>
    </section>
  );
}

export default DashboardShell;
