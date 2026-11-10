import AccountMenu from "./components/AccountMenu.jsx";

function Header({
  isDarkTheme,
  toggleTheme,
  user,
  isAuthenticated,
  isLoading,
  onLogin,
  onLogout,
  activeView,
  setActiveView,
}) {
  return (
    <header className="site-header">
      <nav className="site-nav" aria-label="Main navigation">
        <a
          className="site-brand"
          href="/"
          onClick={(e) => {
            if (activeView === "dashboard") {
              e.preventDefault();
              setActiveView("editor");
            }
          }}
          aria-label="Gridcraft home"
        >
          <span className="brand-mark" aria-hidden="true">
            <img src={isDarkTheme ? "/cat-white.svg" : "/cat-black.svg"} alt="" />
          </span>
          <span>gridcraft</span>
        </a>

        <div className="site-nav-links">
          <button
            className={`nav-text-btn ${activeView === "editor" ? "active" : ""}`}
            onClick={() => setActiveView("editor")}
          >
            Pixel editor
          </button>

          {isAuthenticated && (
            <button
              className={`nav-text-btn ${activeView === "dashboard" ? "active" : ""}`}
              onClick={() => setActiveView("dashboard")}
            >
              Dashboard
            </button>
          )}

          <a href="#community">Contributors</a>
          <a
            href="https://github.com/Rohan-Shridhar/gridcraft"
            target="_blank"
            rel="noreferrer"
          >
            GitHub
          </a>
        </div>

        <div className="site-nav-actions">
          {isLoading ? (
            <div className="auth-loading-pill" title="Checking session...">
              <i className="fa-solid fa-spinner fa-spin"></i>
            </div>
          ) : isAuthenticated ? (
            <AccountMenu
              user={user}
              onLogout={onLogout}
              activeView={activeView}
              setActiveView={setActiveView}
            />
          ) : (
            <button
              className="btn-github-login"
              onClick={onLogin}
              title="Sign in with GitHub (GitHub App)"
            >
              <i className="fa-brands fa-github"></i>
              <span>Continue with GitHub</span>
            </button>
          )}

          <button
            onClick={toggleTheme}
            className="theme-toggle"
            title={`Switch to ${isDarkTheme ? "light" : "dark"} theme`}
            aria-label={`Switch to ${isDarkTheme ? "light" : "dark"} theme`}
          >
            <i className={`fa-regular ${isDarkTheme ? "fa-sun" : "fa-moon"}`}></i>
          </button>
        </div>
      </nav>

      {activeView === "editor" && (
        <div className="hero-content">
          <span className="hero-eyebrow">PIXEL ART PLATFORM</span>
          <h1>
            Gridcraft<span>.</span>
          </h1>
          <p>Draw on a grid. Version your art on GitHub.</p>
          <div className="hero-actions">
            <a className="hero-cta" href="#editor">
              Open editor <i className="fa-solid fa-arrow-down"></i>
            </a>
            {!isAuthenticated && !isLoading && (
              <button className="hero-cta hero-cta-secondary" onClick={onLogin}>
                <i className="fa-brands fa-github"></i> Continue with GitHub
              </button>
            )}
            {isAuthenticated && (
              <button
                className="hero-cta hero-cta-secondary"
                onClick={() => setActiveView("dashboard")}
              >
                <i className="fa-solid fa-layer-group"></i> Open Dashboard
              </button>
            )}
          </div>
          <div className="hero-art" aria-hidden="true">
            <img src={isDarkTheme ? "/cat-white.svg" : "/cat-black.svg"} alt="" />
          </div>
        </div>
      )}
    </header>
  );
}

export default Header;
