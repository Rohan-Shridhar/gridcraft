const { useState, useRef, useCallback } = React;

const GRID_SIZES = [16, 32, 64, 128];
const DEFAULT_GRID_SIZE = 15;
const MAX_HISTORY = 15;
const DEFAULT_BACKGROUND_COLOR = "#2a2a2a";
const EMPTY_CELL = null;

const rgbToHex = (r, g, b) =>
  "#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("");

const getGridGap = (gridSize, showGrid) => {
  if (!showGrid) return 0;
  if (gridSize >= 32) return 0;
  return 2;
};

const App = () => {
  const [gridSize, setGridSize] = useState(DEFAULT_GRID_SIZE);
  const [cells, setCells] = useState(
    Array(DEFAULT_GRID_SIZE * DEFAULT_GRID_SIZE).fill(EMPTY_CELL)
  );
  const [history, setHistory] = useState([]);
  const [future, setFuture] = useState([]);
  const [selectedColor, setSelectedColor] = useState("#e63946");
  const [backgroundColor, setBackgroundColor] = useState(DEFAULT_BACKGROUND_COLOR);
  const [isEraser, setIsEraser] = useState(false);
  const [isFill, setIsFill] = useState(false);
  const [showGrid, setShowGrid] = useState(true);
  const [toast, setToast] = useState(null);
  const [isSmallScreen, setIsSmallScreen] = useState(window.innerWidth < 768 || window.innerHeight < 768);

  //dual theme; light and dark
  const [isDarkTheme, setIsDarkTheme] = useState(true);

  const toggleTheme = () => {
    setIsDarkTheme(prev => {
      document.body.classList.toggle('light-theme', prev);
      return !prev;
    });
  };

  const fileInputRef = useRef(null);

  const handleKeyPress = useCallback((event) => {
    if (!showGrid) return;
    const eventKey=event.key.toLowerCase();
    
    if (eventKey === "z" && event.ctrlKey && history.length) {
      undo()
      showToast("Undo", "success")
    }
    else if (eventKey === "y" && event.ctrlKey && future.length){
      redo()
      showToast("Redo", "success")
    }
    else if(eventKey==="e"){
      setIsEraser((prev)=>{
        const newValue=!prev;
        if(newValue){
          showToast("Eraser tool selected","success");
        }
        return newValue;
      })
      setIsFill(false);
    }
    else if(eventKey==="b"){
      setIsFill((prev)=>{
        const newValue=!prev;
        if(newValue){
          showToast("Fill tool selected","success");
        }
        return newValue;
      })
      setIsEraser(false);
    }
    else if(eventKey==="a"){
      setIsEraser(false);
      setIsFill(false);
      showToast("Paint brush tool selected","success");
    }else if(eventKey==="c"){
      if (!window.confirm("Clear the entire canvas?")) return;
      clearAll();
      showToast("Canvas cleared", "success");
    }
  }, [history, future, showGrid]);

  React.useEffect(() => {
    document.addEventListener('keydown', handleKeyPress);

    return () => {
      document.removeEventListener('keydown', handleKeyPress);
    };
  }, [handleKeyPress]);

  React.useEffect(() => {
    const handleBeforeUnload = (e) => {
      e.preventDefault();
      e.returnValue = "";
    };

    const isMobile = () => {
      if (navigator.userAgentData) {
        return navigator.userAgentData.mobile;
      }

      // Fallback for browsers that don't support userAgentData.mobile
      return /Mobi|Android/i.test(navigator.userAgent);
      };

    if (isMobile()) {
      showToast("Switch to desktop");
    }

    const handleResize = () => {
      setIsSmallScreen(window.innerWidth < 768 || window.innerHeight < 768);
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      window.removeEventListener("resize", handleResize);
    };
  }, []);


  const toastTimeoutRef = useRef(null);

  const showToast = (msg, type = "error") => {
    setToast({ msg, type });

    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }

    toastTimeoutRef.current = setTimeout(() => {
      setToast(null);
    }, 3000);
  };

  const changeGridSize = (newSize) => {
    if (newSize === gridSize) return;

    if (
      !window.confirm(
        "Changing grid size will clear your current drawing. Continue?"
      )
    ) return;

    setGridSize(newSize);
    setShowGrid(newSize < 32);
    setHistory([]);
    setFuture([]);
    setCells(Array(newSize * newSize).fill(EMPTY_CELL));

    showToast(`Grid set to ${newSize}×${newSize}`, "success");
  };

  const triggerImport = () => fileInputRef.current?.click();

  const floodFill = (cells, index, targetColor, fillColor) => {
    if (targetColor === fillColor) return cells;
    const newCells = [...cells];
    const stack = [index];
    const visited = new Set();

    while (stack.length > 0) {
      const idx = stack.pop();
      if (visited.has(idx)) continue;

      const row = Math.floor(idx / gridSize);
      const col = idx % gridSize;

      if (row < 0 || row >= gridSize || col < 0 || col >= gridSize) continue;
      if (newCells[idx] !== targetColor) continue;

      newCells[idx] = fillColor;
      visited.add(idx);

      // Left (only if not on left edge)
      if (col > 0) stack.push(idx - 1);
      // Right (only if not on right edge)
      if (col < gridSize - 1) stack.push(idx + 1);
      // Up
      if (row > 0) stack.push(idx - gridSize);
      // Down
      if (row < gridSize - 1) stack.push(idx + gridSize);
    }

    return newCells;
  };

  const paintCell = useCallback(
    (index) => {
      if (!showGrid) return;

      if (isFill) {
        const targetColor = cells[index];
        const fillColor = selectedColor;
        const newCells = floodFill(cells, index, targetColor, fillColor);
        if (newCells === cells) return;

        setHistory((prev) => [...prev.slice(-MAX_HISTORY + 1), cells]);
        setFuture([]);
        setCells(newCells);
        return;
      }

      const newCells = [...cells];
  newCells[index] = isEraser ? EMPTY_CELL : selectedColor;

      setHistory((prev) => [...prev.slice(-MAX_HISTORY + 1), cells]);
      setFuture([]);
      setCells(newCells);
    },
    [cells, isEraser, isFill, selectedColor, gridSize, showGrid]
  );

  const undo = () => {
    if (!history.length) return;
    const prev = history.at(-1);

    setFuture((f) => [cells, ...f.slice(0, MAX_HISTORY - 1)]);
    setHistory((h) => h.slice(0, -1));
    setCells(prev);
  };

  const redo = () => {
    if (!future.length) return;
    const next = future[0];

    setHistory((h) => [...h.slice(-MAX_HISTORY + 1), cells]);
    setFuture((f) => f.slice(1));
    setCells(next);
  };

  const clearAll = () => {
    setHistory((prev) => [...prev.slice(-MAX_HISTORY + 1), cells]);
    setFuture([]);
    setCells(Array(gridSize * gridSize).fill(EMPTY_CELL));
  };

  const downloadImage = async () => {
    const grid = document.getElementById("pixel-grid");

    grid.classList.add("no-border", "no-gap");

    const canvas = await html2canvas(grid, {
      backgroundColor: null,
      scale: 8,
    });

    grid.classList.remove("no-border", "no-gap");

    const link = document.createElement("a");
    link.download = "gridcraft.png";
    link.href = canvas.toDataURL("image/png");
    link.click();
  };

  const importImage = (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      showToast("Invalid image file");
      return;
    }

    const reader = new FileReader();

    reader.onload = (ev) => {
      const img = new Image();

      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = gridSize;
        canvas.height = gridSize;

        const ctx = canvas.getContext("2d");
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

          newCells.push(a < 30 ? EMPTY_CELL : rgbToHex(r, g, b));
        }

        if (uniqueColors.size > 80) {
          if (!window.confirm("Image too detailed. Continue?")) return;
        }

        setHistory((prev) => [...prev.slice(-MAX_HISTORY + 1), cells]);
        setFuture([]);
        setCells(newCells);

        showToast("Image imported!", "success");
      };

      img.src = ev.target.result;
    };

    reader.readAsDataURL(file);
  };

  const isPreview = !showGrid;
  const getGridSizeTitle = (size) => {
    if (isPreview) return "Disabled in preview mode";
    if (gridSize === size) return `Already on ${size}×${size}`;
    return `Switch to ${size}×${size}`;
  };

  return (
    <>
      <Header isDarkTheme={isDarkTheme} toggleTheme={toggleTheme} />

      <Menu downloadImage={downloadImage} onImport={triggerImport} />
      <input
        type="file"
        accept="image/*"
        ref={fileInputRef}
        style={{ display: "none" }}
        onChange={importImage}
      />

      {toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}

      <Grid
        cells={cells}
        gridSize={gridSize}
        showGrid={showGrid}
        isFill={isFill}
        paintCell={paintCell}
        gridGap={getGridGap(gridSize, showGrid)}
        backgroundColor={backgroundColor}
      />

      <div className="grid-size-selector">
        <span className="grid-size-label">Grid:</span>
        {GRID_SIZES.filter(size => isSmallScreen ? size <= 32 : true).map((size) => (
          <button
            key={size}
            className={`grid-size-btn${gridSize === size ? " grid-size-btn--active" : ""
              }${isPreview ? " grid-size-btn--disabled" : ""}`}
            onClick={() => changeGridSize(size)}
            disabled={isPreview || gridSize === size}
            aria-pressed={gridSize === size}
            title={getGridSizeTitle(size)}
          >
            {size}×{size}
          </button>
        ))}
        <button
          className={`grid-size-btn${!showGrid ? " grid-size-btn--active" : ""}`}
          onClick={() => setShowGrid((s) => !s)}
          title="Toggle grid lines"
        >
          <i class="fa-solid fa-eye"></i>
        </button>
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
        isFill={isFill}
        setIsFill={setIsFill}
        backgroundColor={backgroundColor}
        setBackgroundColor={setBackgroundColor}
        clearAll={clearAll}
        showToast={showToast}
        isPreview={isPreview}
      />

      <Footer />
    </>
  );
};
