function Header({ isDarkTheme, toggleTheme }) {
    return (
        <header className="site-header">
            <nav className="site-nav" aria-label="Main navigation">
                <a className="site-brand" href="/" aria-label="Gridcraft home">
                    <span className="brand-mark" aria-hidden="true">
                        <img src={isDarkTheme ? "/cat-white.svg" : "/cat-black.svg"} alt="" />
                    </span>
                    <span>gridcraft</span>
                </a>
                <div className="site-nav-links">
                    <a href="#editor">Pixel editor</a>
                    <a href="#community">Contributors</a>
                    <a href="https://github.com/Rohan-Shridhar/gridcraft" target="_blank" rel="noreferrer">GitHub</a>
                </div>
                <button
                    onClick={toggleTheme}
                    className="theme-toggle"
                    title={`Switch to ${isDarkTheme ? "light" : "dark"} theme`}
                    aria-label={`Switch to ${isDarkTheme ? "light" : "dark"} theme`}
                >
                    <i className={`fa-regular ${isDarkTheme ? "fa-sun" : "fa-moon"}`}></i>
                </button>
            </nav>
            <div className="hero-content">
                <span className="hero-eyebrow">PIXEL ART EDITOR</span>
                <h1>Gridcraft<span>.</span></h1>
                <p>Draw on a grid. Save or export your art.</p>
                <div className="hero-actions">
                    <a className="hero-cta" href="#editor">Open editor <i className="fa-solid fa-arrow-down"></i></a>
                </div>
                <div className="hero-art" aria-hidden="true">
                    <img src={isDarkTheme ? "/cat-white.svg" : "/cat-black.svg"} alt="" />
                </div>
            </div>
        </header>
    );
}

export default Header;
