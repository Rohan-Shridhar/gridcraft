const Tools = ({
    undo,
    redo,
    canUndo,
    canRedo,
    selectedColor,
    setSelectedColor,
    isEraser,
    setIsEraser,
    isFill,
    setIsFill,
    clearAll,
    showToast
}) => {
    return (
        <div className="tools-cont">
            {/* Undo */}
            <button
                className={`tool-btn${!canUndo ? ' tool-btn--disabled' : ''}`}
                onClick={() => {
                    undo();
                    showToast("Undo", "success");
                }}
                disabled={!canUndo}
                title="Undo (Ctrl+Z)"
            >
                <i className="fa-solid fa-rotate-left"></i>
            </button>

            {/* Redo */}
            <button
                className={`tool-btn${!canRedo ? ' tool-btn--disabled' : ''}`}
                onClick={() => {
                    redo();
                    showToast("Redo", "success");
                }}
                disabled={!canRedo}
                title="Redo (Ctrl+Y)"
            >
                <i className="fa-solid fa-rotate-right"></i>
            </button>

            {/* Eraser */}
            <button
                className={`tool-btn${isEraser ? ' tool-btn--active' : ''}`}
                onClick={() => {
                    const next = !isEraser;
                    setIsEraser(next);
                    if (next) {
                        setIsFill(false);
                        showToast("🧽 Eraser selected", "success");
                    }
                }}
                title="Eraser"
            >
                <i className="fa-solid fa-eraser"></i>
            </button>

            {/* Fill */}
            <button
                className={`tool-btn${isFill ? ' tool-btn--active' : ''}`}
                onClick={() => {
                    const next = !isFill;
                    setIsFill(next);
                    if (next) {
                        setIsEraser(false);
                        showToast("🪣 Fill tool selected", "success");
                    }
                }}
                title="Fill"
            >
                <i className="fa-solid fa-fill-drip"></i>
            </button>

            {/* Color Picker */}
            <label className="color-picker-label" title="Pick a color">
                <i className="fa-solid fa-palette"></i>
                <input
                    type="color"
                    className="color-input"
                    value={selectedColor}
                    onChange={e => {
                        setSelectedColor(e.target.value);
                        setIsEraser(false);
                        setIsFill(false);
                        showToast(`🎨 Color selected`, "success");
                    }}
                />
            </label>

            {/* Clear All */}
            <button
                className="tool-btn"
                onClick={() => {
                    if (!window.confirm("Clear the entire canvas?")) return;
                    clearAll();
                    showToast("Canvas cleared", "success");
                }}
                title="Clear All"
            >
                <i className="fa-solid fa-trash-can"></i>
            </button>
        </div>
    );
};
