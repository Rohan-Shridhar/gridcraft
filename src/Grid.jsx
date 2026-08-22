import {useState} from 'react';
function Grid({ cells, gridSize, gridGap, showGrid, isFill, isEraser, paintCell, backgroundColor }) {
    const [isMouseDown, setIsMouseDown] = useState(false);
    return (
        <div
            className="grid-cont"
            onMouseUp={() => setIsMouseDown(false)}
            id="pixel-grid"
            style={{
                '--grid-box-count': gridSize,
                '--grid-gap': `${gridGap}px`,
                backgroundColor,
            }}
        >
            {cells.map((color, i) => (
                <div
                    key={i}
                    className="grid-cell"
                    style={{
                        backgroundColor: color || 'transparent',
                        border: showGrid ? undefined : 'none',
                        borderRadius: showGrid ? undefined : '0',
                        cursor: !showGrid ? 'not-allowed' : (isEraser ? 'url(/cursors/eraser.png), auto' : (isFill ? 'url(/cursors/bucket.png), auto' : 'url(/cursors/paintbrush.png), auto')),
                    }}
                    onMouseDown={() => { if (showGrid) { paintCell(i); setIsMouseDown(true); } }}
                    onMouseEnter={() => showGrid && isMouseDown && !isFill && paintCell(i)}
                    onMouseUp={() => setIsMouseDown(false)}
                />
            ))}
        </div>
    );
}

export default Grid;