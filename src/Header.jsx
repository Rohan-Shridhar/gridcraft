const Header = ({ isDarkTheme, toggleTheme }) => {
    return (
        <div className="header-cont">
            <h1>GRID CRAFT</h1>
            <button
                onClick={toggleTheme}
                className="menu-btn"
                title="Toggle theme"
                style={{ position: 'absolute', top: '1rem', right: '1rem' }}
            >
                {isDarkTheme ? <i class="fa-regular fa-sun"></i> : <i class="fa-regular fa-moon"></i>}
            </button>
            <div className="lines">
                <div className="line"></div>
                <div className="line"></div>
                <div className="line"></div>
                <div className="line"></div>
                <div className="line"></div>
            </div>
            <p><i>Draw your imagination</i></p>
        </div>
    );
}