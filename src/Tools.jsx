const Tools = ({
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
    clearAll,
    showToast,
    isPreview = false,
}) => {
    const previewTitle = isPreview ? "Disabled in preview mode" : null;

    const handleSelectColor = (value) => {
        if (isPreview) return;
        setSelectedColor(value);
        setIsEraser(false);
        setIsFill(false);
        showToast("🎨 Color selected", "success");
    };

    const handleBackgroundColor = (value) => {
        if (isPreview) return;
        setBackgroundColor(value);
        showToast("Background color updated", "success");
    };

    const handleToggleEraser = () => {
        if (isPreview) return;
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
        if (isPreview) return;
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
        if (isPreview) return;
        setIsEraser(false);
        setIsFill(false);
        showToast("Paint brush tool selected", "success");
    };

    return (
        <div className="tools-cont">
            <button
                className={`tool-btn${!canUndo || isPreview ? " tool-btn--disabled" : ""}`}
                onClick={() => {
                    if (!canUndo || isPreview) return;
                    undo();
                    showToast("Undo", "success");
                }}
                disabled={!canUndo || isPreview}
                title={previewTitle ?? "Undo (Ctrl+Z)"}
            >
                <i className="fa-solid fa-rotate-left"></i>
            </button>

            <button
                className={`tool-btn${!canRedo || isPreview ? " tool-btn--disabled" : ""}`}
                onClick={() => {
                    if (!canRedo || isPreview) return;
                    redo();
                    showToast("Redo", "success");
                }}
                disabled={!canRedo || isPreview}
                title={previewTitle ?? "Redo (Ctrl+Y)"}
            >
                <i className="fa-solid fa-rotate-right"></i>
            </button>

            <button
                className={`tool-btn${isEraser && !isPreview ? " tool-btn--active" : ""}${isPreview ? " tool-btn--disabled" : ""}`}
                onClick={handleToggleEraser}
                disabled={isPreview}
                title={previewTitle ?? "Eraser (E)"}
            >
                <i className="fa-solid fa-eraser"></i>
            </button>

            <button
                className={`tool-btn${isFill && !isPreview ? " tool-btn--active" : ""}${isPreview ? " tool-btn--disabled" : ""}`}
                onClick={handleToggleFill}
                disabled={isPreview}
                title={previewTitle ?? "Fill (B)"}
            >
                <i className="fa-solid fa-fill-drip"></i>
            </button>

            <button
                className={`tool-btn${!isEraser && !isFill && !isPreview ? " tool-btn--active" : ""}${isPreview ? " tool-btn--disabled" : ""}`}
                onClick={handleBrush}
                disabled={isPreview}
                title={previewTitle ?? "Paint brush (A)"}
            >
                <i className="fa-solid fa-paintbrush"></i>
            </button>

            <label
                className={`color-picker-label${isPreview ? " color-picker-label--disabled" : ""}`}
                title={previewTitle ?? "Pick a color"}
            >
                <i className="fa-solid fa-palette"></i>
                <span
                    aria-hidden="true"
                    style={{
                        width: "1rem",
                        height: "1rem",
                        borderRadius: "50%",
                        border: "1px solid currentColor",
                        backgroundColor: selectedColor,
                        display: "inline-block",
                    }}
                />
                <input
                    type="color"
                    className="color-input"
                    value={selectedColor}
                    disabled={isPreview}
                    onInput={(e) => handleSelectColor(e.target.value)}
                    onChange={(e) => handleSelectColor(e.target.value)}
                />
            </label>

            <label
                className={`color-picker-label${isPreview ? " color-picker-label--disabled" : ""}`}
                title={previewTitle ?? "Set background color for blank cells"}
            >
                <i className="fa-solid fa-layer-group"></i>
                <span>Background</span>
                <span
                    aria-hidden="true"
                    style={{
                        width: "1rem",
                        height: "1rem",
                        borderRadius: "50%",
                        border: "1px solid currentColor",
                        backgroundColor,
                        display: "inline-block",
                    }}
                />
                <input
                    type="color"
                    className="color-input"
                    value={backgroundColor}
                    disabled={isPreview}
                    onInput={(e) => handleBackgroundColor(e.target.value)}
                    onChange={(e) => handleBackgroundColor(e.target.value)}
                />
            </label>

            <button
                className={`tool-btn${isPreview ? " tool-btn--disabled" : ""}`}
                onClick={() => {
                    if (isPreview) return;
                    if (!window.confirm("Clear the entire canvas?")) return;
                    clearAll();
                    showToast("Canvas cleared", "success");
                }}
                disabled={isPreview}
                title={previewTitle ?? "Clear All (C)"}
            >
                <i className="fa-solid fa-trash-can"></i>
            </button>
        </div>
    );
};
