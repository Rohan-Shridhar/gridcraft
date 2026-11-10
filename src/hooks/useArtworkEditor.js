/**
 * useArtworkEditor — manages editor state for a single GitHub-backed artwork.
 *
 * Save states:
 *   "unsaved"    — dirty but not yet attempted
 *   "saving"     — PUT in-flight
 *   "saved"      — last save succeeded
 *   "conflict"   — 409 from GitHub (SHA stale)
 *   "error"      — save failed for other reason
 */

import { useState, useCallback, useRef } from "react";
import apiClient from "../services/apiClient.js";

const EMPTY_CELL = null;
const MAX_HISTORY = 15;

export default function useArtworkEditor() {
  const [owner, setOwner] = useState(null);
  const [repoName, setRepoName] = useState(null);
  const [artworkId, setArtworkId] = useState(null);
  const [artworkMeta, setArtworkMeta] = useState(null); // { name, description, gridSize, backgroundColor, createdAt }

  const [cells, setCells] = useState([]);
  const [gridSize, setGridSize] = useState(16);
  const [backgroundColor, setBackgroundColor] = useState("transparent");

  const [history, setHistory] = useState([]);
  const [future, setFuture] = useState([]);

  const [isDirty, setIsDirty] = useState(false);
  const [saveState, setSaveState] = useState("saved"); // "unsaved"|"saving"|"saved"|"conflict"|"error"
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState(null);

  // Tracks the current GitHub file SHA — must be sent on every PUT
  const shaRef = useRef(null);
  // Keeps last good cells in case user wants to discard after conflict
  const lastSavedCellsRef = useRef(null);

  const loadArtwork = useCallback(async (ownerArg, repoArg, idArg) => {
    setOwner(ownerArg);
    setRepoName(repoArg);
    setArtworkId(idArg);
    setIsLoading(true);
    setLoadError(null);
    setSaveState("saved");
    setIsDirty(false);
    setHistory([]);
    setFuture([]);

    try {
      const res = await apiClient.getArtwork(ownerArg, repoArg, idArg);
      const aw = res.artwork;
      shaRef.current = res.sha;
      lastSavedCellsRef.current = [...aw.cells];
      setArtworkMeta({
        name: aw.name,
        description: aw.description || "",
        gridSize: aw.gridSize,
        backgroundColor: aw.backgroundColor,
        createdAt: aw.createdAt,
        updatedAt: aw.updatedAt,
      });
      setGridSize(aw.gridSize);
      setBackgroundColor(aw.backgroundColor);
      setCells([...aw.cells]);
    } catch (err) {
      setLoadError(err.message || "Failed to load artwork.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Push a cell paint (from Grid/Tools interaction)
  const paintCell = useCallback(
    (index, newColor) => {
      setCells((prev) => {
        if (prev[index] === newColor) return prev;
        setHistory((h) => [...h.slice(-MAX_HISTORY + 1), prev]);
        setFuture([]);
        setIsDirty(true);
        setSaveState("unsaved");
        const next = [...prev];
        next[index] = newColor;
        return next;
      });
    },
    []
  );

  const setCellsBulk = useCallback((newCells) => {
    setCells((prev) => {
      setHistory((h) => [...h.slice(-MAX_HISTORY + 1), prev]);
      setFuture([]);
      setIsDirty(true);
      setSaveState("unsaved");
      return [...newCells];
    });
  }, []);

  const undo = useCallback(() => {
    setHistory((h) => {
      if (!h.length) return h;
      const prev = h[h.length - 1];
      setCells((cur) => {
        setFuture((f) => [cur, ...f.slice(0, MAX_HISTORY - 1)]);
        setIsDirty(true);
        setSaveState("unsaved");
        return prev;
      });
      return h.slice(0, -1);
    });
  }, []);

  const redo = useCallback(() => {
    setFuture((f) => {
      if (!f.length) return f;
      const next = f[0];
      setCells((cur) => {
        setHistory((h) => [...h.slice(-MAX_HISTORY + 1), cur]);
        setIsDirty(true);
        setSaveState("unsaved");
        return next;
      });
      return f.slice(1);
    });
  }, []);

  const clearCanvas = useCallback((confirmFn) => {
    if (confirmFn && !confirmFn()) return;
    setCells((prev) => {
      setHistory((h) => [...h.slice(-MAX_HISTORY + 1), prev]);
      setFuture([]);
      setIsDirty(true);
      setSaveState("unsaved");
      return Array(prev.length).fill(EMPTY_CELL);
    });
  }, []);

  const updateBackgroundColor = useCallback((color) => {
    setBackgroundColor(color);
    setIsDirty(true);
    setSaveState("unsaved");
  }, []);

  const save = useCallback(async () => {
    if (!owner || !repoName || !artworkId || !artworkMeta) return;
    setSaveState("saving");
    try {
      const payload = {
        sha: shaRef.current,
        name: artworkMeta.name,
        description: artworkMeta.description,
        gridSize,
        backgroundColor,
        cells,
      };
      const res = await apiClient.saveArtwork(owner, repoName, artworkId, payload);
      shaRef.current = res.sha;
      lastSavedCellsRef.current = [...cells];
      setIsDirty(false);
      setSaveState("saved");
      setArtworkMeta((m) => ({ ...m, updatedAt: new Date().toISOString() }));
    } catch (err) {
      if (err.status === 409) {
        setSaveState("conflict");
      } else {
        setSaveState("error");
      }
      throw err;
    }
  }, [owner, repoName, artworkId, artworkMeta, gridSize, backgroundColor, cells]);

  // Reload fresh copy from GitHub (used after conflict → "Reload Remote")
  const reloadFromRemote = useCallback(async () => {
    if (!owner || !repoName || !artworkId) return;
    await loadArtwork(owner, repoName, artworkId);
  }, [owner, repoName, artworkId, loadArtwork]);

  // Discard local changes, go back to last saved state
  const discardChanges = useCallback(() => {
    if (!lastSavedCellsRef.current) return;
    setCells([...lastSavedCellsRef.current]);
    setHistory([]);
    setFuture([]);
    setIsDirty(false);
    setSaveState("saved");
  }, []);

  return {
    // identity
    owner,
    repoName,
    artworkId,
    artworkMeta,
    // canvas state
    cells,
    gridSize,
    backgroundColor,
    // history
    history,
    future,
    // save tracking
    isDirty,
    saveState,
    shaRef,
    // loading
    isLoading,
    loadError,
    // actions
    loadArtwork,
    paintCell,
    setCellsBulk,
    undo,
    redo,
    clearCanvas,
    updateBackgroundColor,
    save,
    reloadFromRemote,
    discardChanges,
    setArtworkMeta,
  };
}
