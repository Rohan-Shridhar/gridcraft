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

import { useState, useCallback, useRef, useReducer } from "react";
import apiClient from "../services/apiClient.js";
import { artworkHistoryReducer, createArtworkHistory } from "../utils/artworkHistory.mjs";

const EMPTY_CELL = null;
const SUPPORTED_GRID_SIZES = [16, 32, 64, 128];

export default function useArtworkEditor() {
  const [owner, setOwner] = useState(null);
  const [repoName, setRepoName] = useState(null);
  const [storyId, setStoryId] = useState(null);
  const [artworkId, setArtworkId] = useState(null);
  const [branch, setBranch] = useState("master");
  const [artworkMeta, setArtworkMeta] = useState(null); // { name, description, gridSize, backgroundColor, createdAt }

  const [{ cells, history, future }, dispatchHistory] = useReducer(
    artworkHistoryReducer, [], createArtworkHistory
  );
  const [gridSize, setGridSize] = useState(16);
  const [backgroundColor, setBackgroundColor] = useState("transparent");

  const [isDirty, setIsDirty] = useState(false);
  const [saveState, setSaveState] = useState("saved"); // "unsaved"|"saving"|"saved"|"conflict"|"error"
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [remoteArtwork, setRemoteArtwork] = useState(null);

  // Tracks the current GitHub file SHA — must be sent on every PUT
  const shaRef = useRef(null);
  // Keeps last good cells in case user wants to discard after conflict
  const lastSavedArtworkRef = useRef(null);
  const editRevisionRef = useRef(0);
  const writeInFlightRef = useRef(false);

  const markDirty = useCallback(() => {
    editRevisionRef.current += 1;
    setIsDirty(true);
    if (!writeInFlightRef.current) setSaveState("unsaved");
  }, []);

  const finishWrite = useCallback((revision, wasDirty = false) => {
    const dirty = wasDirty || editRevisionRef.current !== revision;
    setIsDirty(dirty);
    setSaveState(dirty ? "unsaved" : "saved");
    return dirty;
  }, []);


  const loadArtwork = useCallback(async (ownerArg, repoArg, storyArg, idArg, branchArg = "master") => {
    setOwner(ownerArg);
    setRepoName(repoArg);
    setStoryId(storyArg);
    setArtworkId(idArg);
    setBranch(branchArg);
    setIsLoading(true);
    setLoadError(null);

    try {
      const res = await apiClient.getArtwork(ownerArg, repoArg, storyArg, idArg, branchArg);
      const aw = res.artwork;
      shaRef.current = res.sha;
      lastSavedArtworkRef.current = aw;
      setSaveState("saved");
      setIsDirty(false);
      setRemoteArtwork(null);
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
      dispatchHistory({ type: "reset", cells: aw.cells });
    } catch (err) {
      setLoadError(err.message || "Failed to load artwork.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Keep each canvas/history transition in one pure reducer update.
  const paintCell = useCallback((index, newColor) => {
    if (cells[index] === newColor) return;
    dispatchHistory({ type: "paint", index, color: newColor });
    markDirty();
  }, [cells, markDirty]);

  const setCellsBulk = useCallback((newCells) => {
    dispatchHistory({ type: "replace", cells: newCells });
    markDirty();
  }, [markDirty]);

  const changeGridSize = useCallback((newSize) => {
    if (!SUPPORTED_GRID_SIZES.includes(newSize) || newSize === gridSize) return;
    dispatchHistory({ type: "reset", cells: Array(newSize * newSize).fill(EMPTY_CELL) });
    setGridSize(newSize);
    markDirty();
  }, [gridSize, markDirty]);

  const undo = useCallback(() => {
    if (!history.length) return;
    dispatchHistory({ type: "undo" });
    markDirty();
  }, [history, markDirty]);

  const redo = useCallback(() => {
    if (!future.length) return;
    dispatchHistory({ type: "redo" });
    markDirty();
  }, [future, markDirty]);

  const clearCanvas = useCallback((confirmFn) => {
    if (confirmFn && !confirmFn()) return;
    dispatchHistory({ type: "clear" });
    markDirty();
  }, [markDirty]);

  const updateBackgroundColor = useCallback((color) => {
    setBackgroundColor(color);
    markDirty();
  }, [markDirty]);

  const save = useCallback(async () => {
    if (!owner || !repoName || !artworkId || !artworkMeta || writeInFlightRef.current) return;
    writeInFlightRef.current = true;
    const revision = editRevisionRef.current;
    setSaveState("saving");
    try {
      const payload = {
        sha: shaRef.current,
        name: artworkMeta.name,
        description: artworkMeta.description,
        createdAt: artworkMeta.createdAt,
        gridSize,
        backgroundColor,
        cells,
      };
      const res = await apiClient.saveArtwork(owner, repoName, storyId, artworkId, payload, branch);
      shaRef.current = res.sha;
      lastSavedArtworkRef.current = res.artwork;
      finishWrite(revision);
      setArtworkMeta((m) => ({ ...m, updatedAt: res.artwork.updatedAt }));
    } catch (err) {
      if (err.status === 409) {
        setSaveState("conflict");
      } else {
        setSaveState("error");
      }
      throw err;
    } finally {
      writeInFlightRef.current = false;
    }
  }, [owner, repoName, storyId, artworkId, artworkMeta, gridSize, backgroundColor, cells, branch, finishWrite]);

  // Reload fresh copy from GitHub (used after conflict → "Reload Remote")
  const reloadFromRemote = useCallback(async () => {
    if (!owner || !repoName || !storyId || !artworkId) return;
    await loadArtwork(owner, repoName, storyId, artworkId, branch);
  }, [owner, repoName, storyId, artworkId, branch, loadArtwork]);

  const inspectRemote = useCallback(async () => {
    if (!owner || !repoName || !storyId || !artworkId) return null;
    const result = await apiClient.getArtwork(owner, repoName, storyId, artworkId, branch);
    setRemoteArtwork(result.artwork);
    return result.artwork;
  }, [owner, repoName, storyId, artworkId, branch]);

  const saveAsNew = useCallback(async (name) => {
    if (!owner || !repoName || !storyId || !artworkMeta || writeInFlightRef.current) return;
    writeInFlightRef.current = true;
    const revision = editRevisionRef.current;
    setSaveState("saving");
    try {
      const result = await apiClient.createArtwork(owner, repoName, storyId, {
        name,
        description: artworkMeta.description || "",
        gridSize,
        backgroundColor,
        cells,
      }, branch);
      const artwork = result.artwork;
      setArtworkId(artwork.id);
      setArtworkMeta({
        name: artwork.name,
        description: artwork.description || "",
        gridSize: artwork.gridSize,
        backgroundColor: artwork.backgroundColor,
        createdAt: artwork.createdAt,
        updatedAt: artwork.updatedAt,
      });
      shaRef.current = result.sha;
      lastSavedArtworkRef.current = artwork;
      setRemoteArtwork(null);
      const dirty = finishWrite(revision);
      if (!dirty) dispatchHistory({ type: "resetHistory" });
      return artwork;
    } catch (error) {
      setSaveState("error");
      throw error;
    } finally {
      writeInFlightRef.current = false;
    }
  }, [owner, repoName, storyId, artworkMeta, gridSize, backgroundColor, cells, branch, finishWrite]);

  const rename = useCallback(async (newName) => {
    if (!owner || !repoName || !storyId || !artworkId || !shaRef.current || writeInFlightRef.current) return;
    writeInFlightRef.current = true;
    const revision = editRevisionRef.current;
    setSaveState("saving");
    try {
      const result = await apiClient.renameArtwork(owner, repoName, storyId, artworkId, {
        newName,
        sha: shaRef.current,
      }, branch);
      setArtworkId(result.artworkId);
      shaRef.current = result.sha;
      lastSavedArtworkRef.current = result.artwork;
      setArtworkMeta((meta) => ({
        ...meta,
        name: result.artwork.name,
        updatedAt: result.artwork.updatedAt,
      }));
      finishWrite(revision, isDirty);
      return result.artwork;
    } catch (error) {
      setSaveState(error.status === 409 ? "conflict" : "error");
      throw error;
    } finally {
      writeInFlightRef.current = false;
    }
  }, [owner, repoName, storyId, artworkId, branch, isDirty, finishWrite]);

  const discardChanges = useCallback(() => {
    const saved = lastSavedArtworkRef.current;
    if (!saved) return;
    dispatchHistory({ type: "reset", cells: saved.cells });
    setGridSize(saved.gridSize);
    setBackgroundColor(saved.backgroundColor);
    setArtworkMeta({
      name: saved.name,
      description: saved.description || "",
      gridSize: saved.gridSize,
      backgroundColor: saved.backgroundColor,
      createdAt: saved.createdAt,
      updatedAt: saved.updatedAt,
    });
    setIsDirty(false);
    setSaveState("saved");
  }, []);

  const markConflict = useCallback(() => setSaveState("conflict"), []);

  return {
    // identity
    owner,
    repoName,
    artworkId,
    branch,
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
    remoteArtwork,
    // actions
    loadArtwork,
    paintCell,
    setCellsBulk,
    changeGridSize,
    undo,
    redo,
    clearCanvas,
    updateBackgroundColor,
    save,
    reloadFromRemote,
    inspectRemote,
    saveAsNew,
    rename,
    discardChanges,
    markConflict,
    setArtworkMeta,
  };
}
