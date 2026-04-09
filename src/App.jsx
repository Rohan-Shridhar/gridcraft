const { useState, useRef, useCallback } = React;

const GRID_SIZES = [15, 32];
const DEFAULT_GRID_SIZE = 15;
const MAX_HISTORY = 15;
const DEFAULT_COLOR = '#2a2a2a';

const rgbToHex = (r, g, b) =>
  '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');

const App = () => {
  const [gridSize, setGridSize] = useState(DEFAULT_GRID_SIZE);
  const [cells, setCells] = useState(Array(DEFAULT_GRID_SIZE * DEFAULT_GRID_SIZE).fill(DEFAULT_COLOR));
  const [history, setHistory] = useState([]);
  const [future, setFuture] = useState([]);
  const [selectedColor, setSelectedColor] = useState('#e63946');
  const [isEraser, setIsEraser] = useState(false);
  const [toast, setToast] = useState(null);

  const fileInputRef = useRef(null);

  const showToast = (msg, type = 'error') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const changeGridSize = (newSize) => {
    if(!window.confirm('Changing grid size will clear your current drawing. Continue?')) return;
    setGridSize(newSize);
    setHistory([]);
    setFuture([]);
    setCells(Array(newSize * newSize).fill(DEFAULT_COLOR));
  };

  const triggerImport = () => fileInputRef.current?.click();

  const paintCell = useCallback((index) => {
    const newCells = [...cells];
    newCells[index] = isEraser ? DEFAULT_COLOR : selectedColor;

    setHistory(prev => [...prev.slice(-MAX_HISTORY + 1), cells]);
    setFuture([]);
    setCells(newCells);
  }, [cells, isEraser, selectedColor]);

  const undo = () => {
    if (!history.length) return;
    const prev = history.at(-1);

    setFuture(f => [cells, ...f.slice(0, MAX_HISTORY - 1)]);
    setHistory(h => h.slice(0, -1));
    setCells(prev);
  };

  const redo = () => {
    if (!future.length) return;
    const next = future[0];

    setHistory(h => [...h.slice(-MAX_HISTORY + 1), cells]);
    setFuture(f => f.slice(1));
    setCells(next);
  };

  const clearAll = () => {
    setHistory(prev => [...prev.slice(-MAX_HISTORY + 1), cells]);
    setFuture([]);
    setCells(Array(gridSize * gridSize).fill(DEFAULT_COLOR));
  };

  const downloadImage = async () => {
    const grid = document.getElementById("pixel-grid");

    grid.classList.add("no-border", "no-gap");

    const canvas = await html2canvas(grid, {
      backgroundColor: null,
      scale: 8
    });

    grid.classList.remove("no-border", "no-gap");

    const link = document.createElement("a");
    link.download = "gridcraft.png";
    link.href = canvas.toDataURL("image/png");
    link.click();
  };

  const importImage = (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      showToast('Invalid image file');
      return;
    }

    const reader = new FileReader();

    reader.onload = (ev) => {
      const img = new Image();

      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = gridSize;
        canvas.height = gridSize;

        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, gridSize, gridSize);

        const pixels = ctx.getImageData(0, 0, gridSize, gridSize).data;

        const newCells = [];
        const uniqueColors = new Set();

        for (let i = 0; i < gridSize * gridSize; i++) {
          const r = pixels[i * 4];
          const g = pixels[i * 4 + 1];
          const b = pixels[i * 4 + 2];
          const a = pixels[i * 4 + 3];

          uniqueColors.add(`${r}-${g}-${b}`);

          newCells.push(a < 30 ? DEFAULT_COLOR : rgbToHex(r, g, b));
        }

        if (uniqueColors.size > 80) {
          if (!window.confirm("Image too detailed. Continue?")) return;
        }

        setHistory(prev => [...prev.slice(-MAX_HISTORY + 1), cells]);
        setFuture([]);
        setCells(newCells);

        showToast('Image imported!', 'success');
      };

      img.src = ev.target.result;
    };

    reader.readAsDataURL(file);
  };

  return (
    <>
      <Header />

      <Menu downloadImage={downloadImage} onImport={triggerImport} />
      <input
        type="file"
        accept="image/*"
        ref={fileInputRef}
        style={{ display: 'none' }}
        onChange={importImage}
      />

      {toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}

      <Grid cells={cells} gridSize={gridSize} paintCell={paintCell} />

      <div className="grid-size-selector">
        <span className="grid-size-label">Grid:</span>
        {GRID_SIZES.map(size => (
          <button
            key={size}
            className={`grid-size-btn${gridSize === size ? ' grid-size-btn--active' : ''}`}
            onClick={() => changeGridSize(size)}
          >
            {size}×{size}
          </button>
        ))}
      </div>

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

      <Footer />
    </>
  );
};