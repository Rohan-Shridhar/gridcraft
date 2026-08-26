function Tools({
    undo,
    redo,
    canUndo,
    canRedo,
    selectedColor,
    setSelectedColor,
    backgroundColor,
    setBackgroundColor,
    isEraser,
    setIsEraser,
    isFill,
    setIsFill,
    fillBackground,
    clearAll,
    showToast,
    isPreview = false,
}){
    const previewTitle = isPreview ? "Disabled in preview mode" : null;
    const previewToastMsg = "Can't edit while preview";

    const blockIfPreview = () => {
        if (isPreview) {
            showToast(previewToastMsg);
            return true;
        }
        return false;
    };

    const getReadableTextColor = (hexColor) => {
        const normalized = hexColor.replace("#", "");
        const red = parseInt(normalized.slice(0, 2), 16);
        const green = parseInt(normalized.slice(2, 4), 16);
        const blue = parseInt(normalized.slice(4, 6), 16);
        const luminance = (0.299 * red + 0.587 * green + 0.114 * blue) / 255;

        return luminance > 0.6 ? "#111111" : "#ffffff";
    };

    const handleSelectColor = (value) => {
        if (blockIfPreview()) return;
        setSelectedColor(value);
        setIsEraser(false);
        setIsFill(false);
        showToast("🎨 Color selected", "success");
    };

    const handleBackgroundColor = (value) => {
        if (blockIfPreview()) return;
        setBackgroundColor(value);
        showToast("Background color updated", "success");
    };

    const handleToggleEraser = () => {
        if (blockIfPreview()) return;
        setIsEraser((prev) => {
            const next = !prev;
            if (next) {
                setIsFill(false);
                showToast("Eraser tool selected", "success");
            }
            return next;
        });
    };

    const handleToggleFill = () => {
        if (blockIfPreview()) return;
        setIsFill((prev) => {
            const next = !prev;
            if (next) {
                setIsEraser(false);
                showToast("Fill tool selected", "success");
            }
            return next;
        });
    };

    const handleBrush = () => {
        if (blockIfPreview()) return;
        setIsEraser(false);
        setIsFill(false);
        showToast("Paint brush tool selected", "success");
    };

    return (
        <div className="tools-cont">
            {/* Undo/redo navigate history rather than edit the canvas, so — unlike
                every other tool below — they stay enabled in preview mode and are
                gated only on canUndo/canRedo. */}
            <button
                className={`tool-btn${!canUndo ? " tool-btn--disabled" : ""}`}
                onClick={() => {
                    if (!canUndo) return;
                    undo();
                    showToast("Undo", "success");
                }}
                disabled={!canUndo}
                title={canUndo ? "Undo (Ctrl+Z)" : "Nothing to undo"}
            >
                <i className="fa-solid fa-rotate-left"></i>
            </button>

            <button
                className={`tool-btn${!canRedo ? " tool-btn--disabled" : ""}`}
                onClick={() => {
                    if (!canRedo) return;
                    redo();
                    showToast("Redo", "success");
                }}
                disabled={!canRedo}
                title={canRedo ? "Redo (Ctrl+Y)" : "Nothing to redo"}
            >
                <i className="fa-solid fa-rotate-right"></i>
            </button>

            <button
                className={`tool-btn${isEraser ? ' tool-btn--active' : ''}${isPreview ? ' tool-btn--disabled' : ''}`}
                onClick={handleToggleEraser}
                title={previewTitle ?? "Eraser (E)"}
            >
                <i className="fa-solid fa-eraser"></i>
            </button>

            <button
                className={`tool-btn${isFill ? ' tool-btn--active' : ''}${isPreview ? ' tool-btn--disabled' : ''}`}
                onClick={handleToggleFill}
                title={previewTitle ?? "Fill (B)"}
            >
                <i className="fa-solid fa-fill-drip"></i>
            </button>

            <button
                className={`tool-btn${!isEraser && !isFill && !isPreview ? " tool-btn--active" : ""}${isPreview ? " tool-btn--disabled" : ""}`}
                onClick={handleBrush}
                title={previewTitle ?? "Paint brush (A)"}
            >
                <i className="fa-solid fa-brush"></i>
            </button>

            <button
                className={`tool-btn tool-btn--fill-bg${isPreview ? " tool-btn--disabled" : ""}`}
                onClick={() => {
                    if (blockIfPreview()) return;
                    fillBackground();
                    showToast("Background filled", "success");
                }}
                title={previewTitle ?? "Fill transparent cells with selected color"}
            >
                <i className="fa-brands fa-flipboard"></i>

            </button>

            <button
                className={`tool-btn${isPreview ? " tool-btn--disabled" : ""}`}
                onClick={() => {
                    if (blockIfPreview()) return;
                    if (!window.confirm("Clear the entire canvas?")) return;
                    clearAll();
                    showToast("Canvas cleared", "success");
                }}
                title={previewTitle ?? "Clear All (C)"}
            >
                <i className="fa-solid fa-trash-can"></i>
            </button>

            <label
                className={`color-picker-label${isPreview ? " color-picker-label--disabled" : ""}`}
                title={previewTitle ?? "Pick a color"}
            >
                <span>Color:</span>
                <input
                    type="color"
                    className="color-input"
                    value={selectedColor}
                    onClick={(e) => {
                        if (blockIfPreview()) {
                            e.preventDefault();
                        }
                    }}
                    onChange={e => {
                        if (blockIfPreview()) return;
                        setSelectedColor(e.target.value);
                        setIsEraser(false);
                        setIsFill(false);
                        showToast("Color selected", "success");
                    }}
                />
            </label>
        </div>
    );
};

export default Tools;