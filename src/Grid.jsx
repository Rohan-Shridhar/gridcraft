const Grid = ({ cells, gridSize, paintCell }) => {
    const [isMouseDown, setIsMouseDown] = React.useState(false);
    return (
        <div className="grid-cont" onMouseUp={() => setIsMouseDown(false)} id="pixel-grid" style={{ '--grid-box-count': gridSize }}>
            {cells.map((color, i) => (
                <div
                    key={i}
                    className="grid-cell"
                    style={{ backgroundColor: color || '#2a2a2a' }}
                    onMouseDown={() => { paintCell(i); setIsMouseDown(true); }}
                    onMouseEnter={() => isMouseDown && paintCell(i)}
                    onMouseUp={() => setIsMouseDown(false)}
                />
            ))}
        </div>
    );
}