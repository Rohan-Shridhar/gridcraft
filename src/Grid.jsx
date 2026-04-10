const Grid = ({ cells, gridSize, gridGap, showGrid, isFill, paintCell }) => {
    const [isMouseDown, setIsMouseDown] = React.useState(false);
    return (
        <div
            className="grid-cont"
            onMouseUp={() => setIsMouseDown(false)}
            id="pixel-grid"
            style={{ '--grid-box-count': gridSize, '--grid-gap': `${gridGap}px` }}
        >
            {cells.map((color, i) => (
                <div
                    key={i}
                    className="grid-cell"
                    style={{
                        backgroundColor: color || '#2a2a2a',
                        border: showGrid ? undefined : 'none',
                        borderRadius: showGrid ? undefined : '0',
                        cursor: isFill ? 'cell' : 'crosshair',
                    }}
                    onMouseDown={() => { paintCell(i); setIsMouseDown(true); }}
                    onMouseEnter={() => isMouseDown && !isFill && paintCell(i)}
                    onMouseUp={() => setIsMouseDown(false)}
                />
            ))}
        </div>
    );
}
