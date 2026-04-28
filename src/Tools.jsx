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
    showToast,
    isPreview = false
}) => {
    const previewTitle = isPreview ? "Disabled in preview mode" : null;
    return (
        <div className="tools-cont">
            {/* Undo */}
            <button
                className={`tool-btn${!canUndo || isPreview ? ' tool-btn--disabled' : ''}`}
                onClick={() => {
                    undo();
                    showToast("Undo", "success");
                }}
                disabled={!canUndo || isPreview}
                title={previewTitle ?? "Undo (Ctrl+Z)"}
            >
                <i className="fa-solid fa-rotate-left"></i>
            </button>

            {/* Redo */}
            <button
                className={`tool-btn${!canRedo || isPreview ? ' tool-btn--disabled' : ''}`}
                onClick={() => {
                    redo();
                    showToast("Redo", "success");
                }}
                disabled={!canRedo || isPreview}
                title={previewTitle ?? "Redo (Ctrl+Y)"}
            >
                <i className="fa-solid fa-rotate-right"></i>
            </button>

            {/* Eraser */}
            <button
                className={`tool-btn${isEraser ? ' tool-btn--active' : ''}${isPreview ? ' tool-btn--disabled' : ''}`}
                onClick={() => {
                    const next = !isEraser;
                    setIsEraser(next);
                    if (next) {
                        setIsFill(false);
                        showToast("🧽 Eraser selected", "success");
                    }
                }}
                disabled={isPreview}
                title={previewTitle ?? "Eraser"}
            >
                <i className="fa-solid fa-eraser"></i>
            </button>

            {/* Fill */}
            <button
                className={`tool-btn${isFill ? ' tool-btn--active' : ''}${isPreview ? ' tool-btn--disabled' : ''}`}
                onClick={() => {
                    const next = !isFill;
                    setIsFill(next);
                    if (next) {
                        setIsEraser(false);
                        showToast("🪣 Fill tool selected", "success");
                    }
                }}
                disabled={isPreview}
                title={previewTitle ?? "Fill"}
            >
                <i className="fa-solid fa-fill-drip"></i>
            </button>

            {/* Color Picker */}
            <label
                className={`color-picker-label${isPreview ? ' color-picker-label--disabled' : ''}`}
                title={previewTitle ?? "Pick a color"}
            >
                <i className="fa-solid fa-palette"></i>
                <input
                    type="color"
                    className="color-input"
                    value={selectedColor}
                    disabled={isPreview}
                    onChange={e => {
                        if (isPreview) return;
                        setSelectedColor(e.target.value);
                        setIsEraser(false);
                        setIsFill(false);
                        showToast(`🎨 Color selected`, "success");
                    }}
                />
            </label>

            {/* Clear All */}
            <button
                className={`tool-btn${isPreview ? ' tool-btn--disabled' : ''}`}
                onClick={() => {
                    if (!window.confirm("Clear the entire canvas?")) return;
                    clearAll();
                    showToast("Canvas cleared", "success");
                }}
                disabled={isPreview}
                title={previewTitle ?? "Clear All"}
            >
                <i className="fa-solid fa-trash-can"></i>
            </button>
        </div>
    );
};
