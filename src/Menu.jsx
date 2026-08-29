function Menu({ downloadImage, onImport, isExporting = false }){
    const openLink = (url) => window.open(url, "_blank");

    const exportWithFilename = async () => {
        const requestedName = window.prompt("PNG filename", "gridcraft");
        if (requestedName === null) return;

        const safeName = requestedName
            .trim()
            .replace(/\.png$/i, "")
            .replace(/[^a-z0-9-_ ]/gi, "")
            .trim()
            .replace(/\s+/g, "-") || "gridcraft";
        const filename = `${safeName}.png`;

        const nativeClick = HTMLAnchorElement.prototype.click;
        HTMLAnchorElement.prototype.click = function patchedClick() {
            if (this.download === "gridcraft.png") this.download = filename;
            return nativeClick.call(this);
        };

        try {
            await downloadImage();
        } finally {
            HTMLAnchorElement.prototype.click = nativeClick;
        }
    };

    return (
        <div className="menu-cont">
            <button
                className={`menu-btn${isExporting ? " menu-btn--disabled" : ""}`}
                onClick={exportWithFilename}
                disabled={isExporting}
                aria-busy={isExporting}
                title={isExporting ? "Exporting…" : "Export"}
            >
                <i className={`fa-solid ${isExporting ? "fa-spinner fa-spin" : "fa-upload"}`}></i>
            </button>

            <button className="menu-btn" onClick={onImport} title="Import">
                <i className="fa-solid fa-download"></i>
            </button>

            <button
                className="menu-btn"
                onClick={() => openLink("https://github.com/Rohan-Shridhar/gridcraft/blob/main/Manual.md")}
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

export default Menu;