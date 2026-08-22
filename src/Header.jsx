function Header({ isDarkTheme, toggleTheme }){
    return (
        <div className="header-cont">
            <div className="header-title-wrap">
                <h1>GRID CRAFT</h1>
                <span className="header-byline">by rohan</span>
            </div>
            <button
                onClick={toggleTheme}
                className="menu-btn"
                title="Toggle theme"
                style={{ position: 'fixed', top: '1rem', right: '1rem', zIndex: 1000 }}
            >
                {isDarkTheme ? <i className="fa-regular fa-sun"></i> : <i className="fa-regular fa-moon"></i>}
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

export default Header;