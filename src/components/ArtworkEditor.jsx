import { useCallback, useEffect, useRef, useState } from "react";
import html2canvas from "html2canvas";
import Grid from "../Grid.jsx";
import Menu from "../Menu.jsx";
import Tools from "../Tools.jsx";
import useArtworkEditor from "../hooks/useArtworkEditor.js";
import apiClient from "../services/apiClient.js";
import EditorSaveBar from "./EditorSaveBar.jsx";
import ArtworkThumbnail from "./ArtworkThumbnail.jsx";
import BranchSelector from "./BranchSelector.jsx";

const GRID_SIZES = [16, 32, 64, 128];

function rgbToHex(r, g, b) {
  return `#${[r, g, b].map((value) => value.toString(16).padStart(2, "0")).join("")}`;
}

export default function ArtworkEditor({
  owner,
  repoName,
  artworkId,
  branch = "master",
  onBranchChange,
  onDirtyChange,
  onBack,
  onArtworkChanged,
  showToast,
}) {
  const editor = useArtworkEditor();
  const [selectedColor, setSelectedColor] = useState("#e63946");
  const [isEraser, setIsEraser] = useState(false);
  const [isFill, setIsFill] = useState(false);
  const [showGrid, setShowGrid] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [commits, setCommits] = useState([]);
  const [showRemote, setShowRemote] = useState(false);
  const [isWorking, setIsWorking] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    editor.loadArtwork(owner, repoName, artworkId, branch);
  }, [editor.loadArtwork, owner, repoName, artworkId, branch]);

  useEffect(() => {
    onDirtyChange(editor.isDirty);
  }, [editor.isDirty, onDirtyChange]);

  const loadCommits = useCallback(async () => {
    try {
      const result = await apiClient.getArtworkHistory(owner, repoName, editor.artworkId || artworkId, branch);
      setCommits(result.commits || []);
    } catch (error) {
      showToast(error.message || "Could not load artwork history.", "error");
    }
  }, [owner, repoName, artworkId, editor.artworkId, branch, showToast]);

  useEffect(() => {
    if (editor.artworkId) loadCommits();
  }, [editor.artworkId, loadCommits]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (editor.saveState === "saving" || isWorking) return;
      if (event.target instanceof HTMLElement && event.target.matches("input, textarea, select")) return;
      if (event.ctrlKey && event.key.toLowerCase() === "z") {
        event.preventDefault();
        editor.undo();
      } else if (event.ctrlKey && event.key.toLowerCase() === "y") {
        event.preventDefault();
        editor.redo();
      } else if (event.key.toLowerCase() === "e") {
        setIsEraser((value) => !value);
        setIsFill(false);
      } else if (event.key.toLowerCase() === "b") {
        setIsFill((value) => !value);
        setIsEraser(false);
      } else if (event.key.toLowerCase() === "a") {
        setIsEraser(false);
        setIsFill(false);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [editor.undo, editor.redo, editor.saveState, isWorking]);

  const handleSave = async () => {
    try {
      await editor.save();
      await loadCommits();
      showToast("Artwork saved to GitHub.", "success");
    } catch (error) {
      showToast(error.message || "Could not save artwork.", "error");
    }
  };

  const handleRename = async () => {
    if (isWorking) return;
    if (editor.isDirty) {
      showToast("Save your changes before renaming this artwork.", "error");
      return;
    }
    const newName = window.prompt("New artwork name", editor.artworkMeta?.name || "");
    if (newName === null || !newName.trim()) return;
    if (!window.confirm(`Rename "${editor.artworkMeta.name}" to "${newName.trim()}"?`)) return;
    setIsWorking(true);
    try {
      const artwork = await editor.rename(newName.trim());
      onArtworkChanged(artwork.id);
      showToast("Artwork renamed.", "success");
    } catch (error) {
      showToast(error.message || "Could not rename artwork.", "error");
    } finally {
      setIsWorking(false);
    }
  };

  const handleSaveAsNew = async () => {
    if (isWorking) return;
    const name = window.prompt("Name for the new artwork", `${editor.artworkMeta?.name || "Artwork"} copy`);
    if (name === null || !name.trim()) return;
    setIsWorking(true);
    try {
      const artwork = await editor.saveAsNew(name.trim());
      onArtworkChanged(artwork.id);
      setShowRemote(false);
      showToast("Local changes saved as a new artwork.", "success");
    } catch (error) {
      showToast(error.message || "Could not save a new artwork.", "error");
    } finally {
      setIsWorking(false);
    }
  };

  const handleDelete = async () => {
    if (isWorking) return;
    const name = editor.artworkMeta?.name || "this artwork";
    const unsavedWarning = editor.isDirty ? " Your unsaved local edits will also be lost." : "";
    if (!window.confirm(`Delete "${name}" from this album? This cannot be undone.${unsavedWarning}`)) return;
    setIsWorking(true);
    try {
      await apiClient.deleteArtwork(owner, repoName, editor.artworkId, editor.shaRef.current, branch);
      showToast(`Artwork "${name}" deleted.`, "success");
      onBack();
    } catch (error) {
      if (error.status === 409) editor.markConflict();
      showToast(error.message || "Could not delete artwork.", "error");
    } finally {
      setIsWorking(false);
    }
  };

  const handleReloadRemote = async () => {
    if (isWorking) return;
    if (!window.confirm("Discard your local changes and reload the remote artwork?")) return;
    setIsWorking(true);
    try {
      await editor.reloadFromRemote();
      setShowRemote(false);
      showToast("Remote artwork reloaded.", "success");
    } catch (error) {
      showToast(error.message || "Could not reload the remote artwork.", "error");
    } finally {
      setIsWorking(false);
    }
  };

  const handleInspectRemote = async () => {
    if (isWorking) return;
    setIsWorking(true);
    try {
      await editor.inspectRemote();
      setShowRemote(true);
    } catch (error) {
      showToast(error.message || "Could not inspect the remote artwork.", "error");
    } finally {
      setIsWorking(false);
    }
  };

  const paintCell = (index) => {
    if (editor.saveState === "saving" || isWorking) return;
    if (isFill) {
      const target = editor.cells[index];
      const fill = isEraser ? null : selectedColor;
      if (target === fill) return;
      const next = [...editor.cells];
      const stack = [index];
      const visited = new Set();
      while (stack.length) {
        const current = stack.pop();
        if (visited.has(current) || next[current] !== target) continue;
        visited.add(current);
        next[current] = fill;
        const row = Math.floor(current / editor.gridSize);
        const col = current % editor.gridSize;
        if (col > 0) stack.push(current - 1);
        if (col < editor.gridSize - 1) stack.push(current + 1);
        if (row > 0) stack.push(current - editor.gridSize);
        if (row < editor.gridSize - 1) stack.push(current + editor.gridSize);
      }
      editor.setCellsBulk(next);
      return;
    }
    editor.paintCell(index, isEraser ? null : selectedColor);
  };

  const fillBackground = () => {
    editor.setCellsBulk(editor.cells.map((cell) => cell === null ? selectedColor : cell));
  };

  const downloadImage = async () => {
    if (isExporting) return;
    const grid = document.getElementById("pixel-grid");
    if (!grid) {
      showToast("Canvas is not ready to export.", "error");
      return;
    }
    setIsExporting(true);
    grid.classList.add("no-border", "no-gap");
    try {
      const canvas = await html2canvas(grid, { backgroundColor: null, scale: 8 });
      const link = document.createElement("a");
      const filename = (editor.artworkMeta?.name || "gridcraft")
        .trim().replace(/[^a-z0-9-_ ]/gi, "").trim().replace(/\s+/g, "-") || "gridcraft";
      link.download = `${filename}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    } catch (error) {
      console.error("Failed to export artwork", error);
      showToast("PNG export failed.", "error");
    } finally {
      grid.classList.remove("no-border", "no-gap");
      setIsExporting(false);
    }
  };

  const importImage = (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/") && !file.name.toLowerCase().endsWith(".svg")) {
      showToast("Choose a supported image file.", "error");
      return;
    }
    const reader = new FileReader();
    reader.onload = (loadEvent) => {
      const image = new Image();
      image.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = editor.gridSize;
        canvas.height = editor.gridSize;
        const context = canvas.getContext("2d");
        if (!context) {
          showToast("Could not read the imported image.", "error");
          return;
        }
        context.drawImage(image, 0, 0, editor.gridSize, editor.gridSize);
        const pixels = context.getImageData(0, 0, editor.gridSize, editor.gridSize).data;
        const importedCells = [];
        const colors = new Set();
        for (let index = 0; index < editor.gridSize * editor.gridSize; index += 1) {
          const offset = index * 4;
          colors.add(`${pixels[offset]}-${pixels[offset + 1]}-${pixels[offset + 2]}`);
          importedCells.push(pixels[offset + 3] < 30
            ? null
            : rgbToHex(pixels[offset], pixels[offset + 1], pixels[offset + 2]));
        }
        if (colors.size > 80 && !window.confirm("Image has more than 80 distinct colors. Continue importing?")) return;
        editor.setCellsBulk(importedCells);
        showToast("Image imported.", "success");
      };
      image.onerror = () => showToast("Could not decode the selected image.", "error");
      image.src = loadEvent.target.result;
    };
    reader.onerror = () => showToast("Could not read the selected image.", "error");
    reader.readAsDataURL(file);
  };

  if (editor.isLoading) {
    return <div className="artwork-editor-status"><i className="fa-solid fa-spinner fa-spin"></i> Loading artwork…</div>;
  }
  if (!editor.artworkMeta) {
    return (
      <div className="artwork-editor-status artwork-editor-error">
        <p>{editor.loadError || "Artwork could not be loaded."}</p>
        <button className="btn-secondary" onClick={onBack}>Back to album</button>
      </div>
    );
  }

  return (
    <>
      <div className="artwork-branch-control">
        <BranchSelector owner={owner} repoName={repoName} branch={branch} onChange={onBranchChange} showToast={showToast} />
      </div>
      <EditorSaveBar
        albumLabel={`${owner}/${repoName}`}
        artworkName={editor.artworkMeta.name}
        branch={branch}
        saveState={editor.saveState}
        isDirty={editor.isDirty}
        onSave={handleSave}
        onReload={handleReloadRemote}
        onBack={() => {
          if (isWorking || editor.saveState === "saving") return;
          if (!editor.isDirty || window.confirm("Leave without saving your artwork changes?")) onBack();
        }}
        onRename={handleRename}
        onDelete={handleDelete}
        onInspectRemote={handleInspectRemote}
        onSaveAsNew={handleSaveAsNew}
        isBusy={isWorking}
        commits={commits}
      />
      {editor.saveState === "error" && (
        <p className="artwork-save-error" role="alert">Save failed. Your local changes are still available; retry or export a copy.</p>
      )}
      {editor.loadError && (
        <p className="artwork-save-error" role="alert">
          Could not reload the remote artwork: {editor.loadError} Your local changes are still available.
        </p>
      )}
      <Menu
        downloadImage={downloadImage}
        onImport={() => fileInputRef.current?.click()}
        isExporting={isExporting}
        disabled={editor.saveState === "saving" || isWorking}
      />
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,.svg,image/svg+xml"
        hidden
        onChange={importImage}
      />
      <section className="editor-section artwork-editor-section">
        <div className="section-heading"><h2>Pixel editor</h2></div>
        <div className="editor-workspace" style={{ pointerEvents: editor.saveState === "saving" || isWorking ? "none" : undefined }}>
          <main className="canvas-workspace" aria-label="Artwork canvas editor">
            <Grid
              cells={editor.cells}
              gridSize={editor.gridSize}
              showGrid={showGrid}
              isFill={isFill}
              isEraser={isEraser}
              paintCell={paintCell}
              gridGap={showGrid && editor.gridSize < 32 ? 2 : 0}
              backgroundColor={editor.backgroundColor === "transparent" ? "transparent" : editor.backgroundColor}
            />
            <div className="grid-size-selector">
              <span className="grid-size-label">Grid:</span>
              {GRID_SIZES.map((size) => (
                <button
                  key={size}
                  className={`grid-size-btn${editor.gridSize === size ? " grid-size-btn--active" : ""}`}
                  onClick={() => {
                    if (window.confirm(`Changing to ${size}×${size} clears the current drawing. Continue?`)) {
                      editor.changeGridSize(size);
                      setShowGrid(size < 32);
                    }
                  }}
                  disabled={editor.gridSize === size || !showGrid}
                >
                  {size}×{size}
                </button>
              ))}
              <button
                className={`grid-size-btn${!showGrid ? " grid-size-btn--active" : ""}`}
                onClick={() => setShowGrid((value) => !value)}
                title="Toggle grid lines"
              >
                <i className="fa-solid fa-eye"></i>
              </button>
            </div>
            <div className="artwork-background-control">
              <label htmlFor="artwork-background">Canvas background</label>
              <input
                id="artwork-background"
                type="color"
                value={/^#[0-9a-f]{6}$/i.test(editor.backgroundColor) ? editor.backgroundColor : "#ffffff"}
                onChange={(event) => editor.updateBackgroundColor(event.target.value)}
                disabled={!showGrid}
                title="Choose canvas background color"
              />
              <button
                className="btn-secondary"
                onClick={() => editor.updateBackgroundColor("transparent")}
                type="button"
              >
                Transparent
              </button>
            </div>
            <Tools
              undo={editor.undo}
              redo={editor.redo}
              canUndo={editor.history.length > 0}
              canRedo={editor.future.length > 0}
              selectedColor={selectedColor}
              setSelectedColor={setSelectedColor}
              isEraser={isEraser}
              setIsEraser={setIsEraser}
              isFill={isFill}
              setIsFill={setIsFill}
              backgroundColor={editor.backgroundColor}
              setBackgroundColor={editor.updateBackgroundColor}
              fillBackground={fillBackground}
              clearAll={() => editor.clearCanvas()}
              showToast={showToast}
              isPreview={!showGrid}
            />
          </main>
        </div>
      </section>
      {showRemote && editor.remoteArtwork && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="remote-artwork-title">
          <div className="modal-container artwork-remote-modal">
            <div className="modal-header">
              <h3 id="remote-artwork-title">Remote artwork comparison</h3>
              <button className="modal-close-btn" onClick={() => setShowRemote(false)} aria-label="Close comparison">
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>
            <p>The remote file has changed since this copy was opened. Your local copy has not been overwritten.</p>
            <div className="artwork-compare-grid">
              <div>
                <h4>Your local changes</h4>
                <p>{editor.artworkMeta.name} · {editor.gridSize}×{editor.gridSize}</p>
                <ArtworkThumbnail cells={editor.cells} gridSize={editor.gridSize} backgroundColor={editor.backgroundColor} />
              </div>
              <div>
                <h4>Remote version</h4>
                <p>{editor.remoteArtwork.name} · {editor.remoteArtwork.gridSize}×{editor.remoteArtwork.gridSize}</p>
                <ArtworkThumbnail cells={editor.remoteArtwork.cells} gridSize={editor.remoteArtwork.gridSize} backgroundColor={editor.remoteArtwork.backgroundColor} />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-modal-secondary" onClick={() => setShowRemote(false)}>Keep editing</button>
              <button className="btn-modal-secondary" onClick={handleReloadRemote}>Reload remote</button>
              <button className="btn-modal-primary" onClick={handleSaveAsNew}>Save local copy as new artwork</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
