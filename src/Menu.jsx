const Menu = ({ downloadImage, onImport }) => {
    const openLink = (url) => window.open(url, "_blank");

    return (
        <div className="menu-cont">
            <button className="menu-btn" onClick={downloadImage} title="Export">
                <i className="fa-solid fa-upload"></i>
            </button>

            <button className="menu-btn" onClick={onImport} title="Import">
                <i className="fa-solid fa-download"></i>
            </button>

            <button
                className="menu-btn"
                onClick={() => openLink("/Manual.md")}
                title="Check out manual"
            >
                <i className="fa-solid fa-book"></i>
            </button>

            <button
                className="menu-btn"
                onClick={() => openLink("https://github.com/Rohan-Shridhar/gridcraft")}
                title="Github"
            >
                <i className="fab fa-github"></i>
            </button>
        </div>
    );
};