const { useState } = React;

const TOTAL_CELLS = 14;
const MAX_HISTORY = 5;
const DEFAULT_COLOR = '#2a2a2a';

const App = () => {
    const [cells, setCells] = useState(Array(TOTAL_CELLS * TOTAL_CELLS).fill(DEFAULT_COLOR));
    const [history, setHistory] = useState([]);
    const [future, setFuture] = useState([]);
    const [selectedColor, setSelectedColor] = useState('#e63946');
    const [isEraser, setIsEraser] = useState(false);

    const paintCell = (index) => {
        const newCells = [...cells];
        newCells[index] = isEraser ? DEFAULT_COLOR : selectedColor;
        setHistory(prev => [...prev.slice(-MAX_HISTORY + 1), cells]);
        setFuture([]);
        setCells(newCells);
    };

    const undo = () => {
        if (history.length === 0) return;
        const prev = history[history.length - 1];
        setFuture(f => [cells, ...f.slice(0, MAX_HISTORY - 1)]);
        setHistory(h => h.slice(0, -1));
        setCells(prev);
    };

    const redo = () => {
        if (future.length === 0) return;
        const next = future[0];
        setHistory(h => [...h.slice(-MAX_HISTORY + 1), cells]);
        setFuture(f => f.slice(1));
        setCells(next);
    };

    const clearAll = () => {
        setHistory(prev => [...prev.slice(-MAX_HISTORY + 1), cells]);
        setFuture([]);
        setCells(Array(TOTAL_CELLS * TOTAL_CELLS).fill(DEFAULT_COLOR));
    };

    const downloadImage = async () => {
        const grid = document.getElementById("pixel-grid");

        // Remove borders + gap
        grid.classList.add("no-border");
        grid.classList.add("no-gap");

        const canvas = await html2canvas(grid, {
            backgroundColor: null,
            scale: 8
        });

        grid.classList.remove("no-border");
        grid.classList.remove("no-gap");

        const link = document.createElement("a");
        link.download = "gridcraft.png";
        link.href = canvas.toDataURL("image/png");
        link.click();
    };
    return (
        <>
            <Header />
            <Menu downloadImage={downloadImage} />
            <Grid cells={cells} paintCell={paintCell} />
            <Tools
                undo={undo}
                redo={redo}
                canUndo={history.length > 0}
                canRedo={future.length > 0}
                selectedColor={selectedColor}
                setSelectedColor={setSelectedColor}
                isEraser={isEraser}
                setIsEraser={setIsEraser}
                clearAll={clearAll}
            />
        </>
    );
}