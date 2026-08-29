import { useState } from "react";

function Menu({ downloadImage, onImport, isExporting = false }){
    const [showShortcuts, setShowShortcuts] = useState(false);
    const openLink = (url) => window.open(url, "_blank");

    return (
        <>
            <div className="menu-cont">
                <button
                    className={`menu-btn${isExporting ? " menu-btn--disabled" : ""}`}
                    onClick={downloadImage}
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
                    onClick={() => setShowShortcuts(true)}
                    title="Keyboard shortcuts"
                    aria-label="Show keyboard shortcuts"
                >
                    <i className="fa-solid fa-keyboard"></i>
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

            {showShortcuts && (
                <div
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="shortcut-help-title"
                    style={{
                        position: "fixed",
                        inset: 0,
                        zIndex: 2000,
                        display: "grid",
                        placeItems: "center",
                        background: "rgba(0, 0, 0, 0.65)",
                        padding: "1rem",
                    }}
                    onClick={() => setShowShortcuts(false)}
                >
                    <div
                        style={{
                            width: "min(420px, 100%)",
                            background: "var(--menu-bg-color)",
                            color: "var(--menu-text-color)",
                            border: "1px solid var(--menu-text-color)",
                            borderRadius: "8px",
                            padding: "1.25rem",
                        }}
                        onClick={(event) => event.stopPropagation()}
                    >
                        <h2 id="shortcut-help-title" style={{ marginTop: 0 }}>Keyboard shortcuts</h2>
                        <ul style={{ lineHeight: 1.9, paddingLeft: "1.25rem" }}>
                            <li><strong>Ctrl + Z</strong> — Undo</li>
                            <li><strong>Ctrl + Y</strong> — Redo</li>
                            <li><strong>A</strong> — Paint brush</li>
                            <li><strong>E</strong> — Eraser</li>
                            <li><strong>B</strong> — Fill tool</li>
                            <li><strong>C</strong> — Clear canvas</li>
                        </ul>
                        <button className="menu-btn" onClick={() => setShowShortcuts(false)}>Close</button>
                    </div>
                </div>
            )}
        </>
    );
};

export default Menu;