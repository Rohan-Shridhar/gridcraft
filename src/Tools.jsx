const Tools = ({ undo, redo, canUndo, canRedo, selectedColor, setSelectedColor, isEraser, setIsEraser, clearAll }) => {
    return (
        <div className="tools-cont">
            <button
                className={`tool-btn${!canUndo ? ' tool-btn--disabled' : ''}`}
                onClick={undo}
                disabled={!canUndo}
                title="Undo (last 5)"
            >
                <i className="fa-solid fa-rotate-left"></i>
            </button>
            <button
                className={`tool-btn${!canRedo ? ' tool-btn--disabled' : ''}`}
                onClick={redo}
                disabled={!canRedo}
                title="Redo (last 5)"
            >
                <i className="fa-solid fa-rotate-right"></i>
            </button>
            <button
                className={`tool-btn${isEraser ? ' tool-btn--active' : ''}`}
                onClick={() => setIsEraser(e => !e)}
                title="Eraser"
            >
                <i className="fa-solid fa-eraser"></i>
            </button>
            <label className="color-picker-label" title="Pick a color">
                <i className="fa-solid fa-palette"></i>
                <input
                    type="color"
                    className="color-input"
                    value={selectedColor}
                    onChange={e => { setSelectedColor(e.target.value); setIsEraser(false); }}
                />
            </label>
            <button
                className="tool-btn"
                onClick={clearAll}
                title="Clear All"
            >
                <i className="fa-solid fa-trash-can"></i>
            </button>
        </div>
    );
}