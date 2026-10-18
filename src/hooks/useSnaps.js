import { useCallback, useEffect, useMemo, useState } from "react";
import {
  DEFAULT_SLIDE_DURATION_MS,
  MAX_SNAP_COUNT,
  SNAP_STORAGE_KEY,
  normalizeSnap,
  parseStoredSnaps,
  serializeStoredSnaps,
} from "../utils/snapStorage.mjs";

function loadSnaps() {
  try {
    return parseStoredSnaps(window.localStorage.getItem(SNAP_STORAGE_KEY));
  } catch (error) {
    console.error("Failed to load saved snaps", error);
    return {
      snaps: [],
      notice: "Saved snaps could not be read and were not loaded.",
      canPersist: false,
    };
  }
}

function createId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export default function useSnaps({
  cells,
  gridSize,
  backgroundColor,
  applySnapshot,
  showToast,
}) {
  const [initialData] = useState(loadSnaps);
  const [canPersist, setCanPersist] = useState(initialData.canPersist);
  const [storageRecoveryRequired, setStorageRecoveryRequired] = useState(
    !initialData.canPersist
  );
  const [snaps, setSnaps] = useState(initialData.snaps);
  const [selectedSnapId, setSelectedSnapId] = useState(
    initialData.snaps[0]?.id ?? null
  );
  const [isPlaying, setIsPlaying] = useState(false);
  const [presentationStartSnapId, setPresentationStartSnapId] = useState(null);
  const [storageError, setStorageError] = useState(null);

  useEffect(() => {
    if (initialData.notice) showToast(initialData.notice);
  }, [initialData.notice, showToast]);

  useEffect(() => {
    if (!canPersist) return;
    try {
      window.localStorage.setItem(
        SNAP_STORAGE_KEY,
        serializeStoredSnaps(snaps)
      );
      setStorageError(null);
    } catch (error) {
      console.error("Failed to save snaps", error);
      setStorageError(
        "Snaps could not be saved to this browser. Your existing saved snaps were kept; export a backup before closing."
      );
    }
  }, [snaps, canPersist]);

  const createSnap = useCallback(() => {
    const sequence =
      snaps.reduce((highest, snap) => Math.max(highest, snap.sequence), 0) + 1;
    const snap = {
      id: createId(),
      createdAt: new Date().toISOString(),
      sequence,
      title: `Snap ${sequence}`,
      cells: cells.map((color) => color ?? null),
      gridSize,
      backgroundColor,
      caption: "",
      notes: "",
      includedInPresentation: true,
      durationMs: DEFAULT_SLIDE_DURATION_MS,
    };

    setSnaps((current) => [...current, snap]);
    setSelectedSnapId(snap.id);
    showToast(`${snap.title} captured`, "success");
  }, [snaps, cells, gridSize, backgroundColor, showToast]);

  const renameSnap = useCallback((id, title) => {
    const trimmedTitle = title.trim().slice(0, 80);
    if (!trimmedTitle) return;
    setSnaps((current) =>
      current.map((snap) =>
        snap.id === id ? { ...snap, title: trimmedTitle } : snap
      )
    );
  }, []);

  const duplicateSnap = useCallback(
    (id) => {
      const original = snaps.find((snap) => snap.id === id);
      if (!original) return;

      const sequence =
        snaps.reduce((highest, snap) => Math.max(highest, snap.sequence), 0) +
        1;
      const duplicate = {
        ...original,
        id: createId(),
        createdAt: new Date().toISOString(),
        sequence,
        title: `${original.title} copy`,
        cells: [...original.cells],
      };

      setSnaps((current) => {
        const index = current.findIndex((snap) => snap.id === id);
        if (index === -1) return current;
        return [
          ...current.slice(0, index + 1),
          duplicate,
          ...current.slice(index + 1),
        ];
      });
      setSelectedSnapId(duplicate.id);
      showToast("Snap duplicated", "success");
    },
    [snaps, showToast]
  );

  const duplicateLastSnap = useCallback(() => {
    if (snaps.length === 0) {
      showToast("Capture a snap before duplicating the last slide");
      return;
    }
    duplicateSnap(snaps[snaps.length - 1].id);
  }, [snaps, duplicateSnap, showToast]);

  const updateSnap = useCallback((id, updates) => {
    setSnaps((current) =>
      current.map((snap) => (snap.id === id ? { ...snap, ...updates } : snap))
    );
  }, []);

  const deleteSnap = useCallback(
    (id) => {
      const index = snaps.findIndex((snap) => snap.id === id);
      if (index === -1) return;

      const remaining = snaps.filter((snap) => snap.id !== id);
      setSnaps(remaining);
      if (selectedSnapId === id) {
        setSelectedSnapId(remaining[Math.min(index, remaining.length - 1)]?.id ?? null);
      }
      showToast("Snap deleted", "success");
    },
    [snaps, selectedSnapId, showToast]
  );

  const clearSnaps = useCallback(() => {
    setSnaps([]);
    setSelectedSnapId(null);
    setIsPlaying(false);
    showToast("All snaps cleared", "success");
  }, [showToast]);

  const importSnaps = useCallback(
    (importedSnaps) => {
      if (snaps.length + importedSnaps.length > MAX_SNAP_COUNT) {
        showToast(`A maximum of ${MAX_SNAP_COUNT} snaps can be stored`);
        return false;
      }

      const existingIds = new Set(snaps.map((snap) => snap.id));
      const startSequence = snaps.reduce(
        (highest, snap) => Math.max(highest, snap.sequence),
        0
      );
      const imported = importedSnaps.map((snap, index) => {
        let id = snap.id;
        while (existingIds.has(id)) id = createId();
        existingIds.add(id);
        return {
          ...normalizeSnap(snap),
          id,
          sequence: startSequence + index + 1,
          cells: [...snap.cells],
        };
      });

      setCanPersist(true);
      setStorageRecoveryRequired(false);
      setSnaps((current) => [...current, ...imported]);
      if (imported[0]) setSelectedSnapId(imported[0].id);
      showToast(
        `${imported.length} snap${imported.length === 1 ? "" : "s"} imported`,
        "success"
      );
      return true;
    },
    [snaps, showToast]
  );

  const replaceUnrecognizedStorage = useCallback(() => {
    setCanPersist(true);
    setStorageRecoveryRequired(false);
    showToast("Recovered snaps will replace the unreadable saved data", "success");
  }, [showToast]);

  const moveSnap = useCallback(
    (id, direction) => {
      const index = snaps.findIndex((snap) => snap.id === id);
      const nextIndex = index + direction;
      if (index < 0 || nextIndex < 0 || nextIndex >= snaps.length) return;

      const reordered = [...snaps];
      [reordered[index], reordered[nextIndex]] = [
        reordered[nextIndex],
        reordered[index],
      ];
      setSnaps(reordered);
    },
    [snaps]
  );

  const reorderSnap = useCallback(
    (id, targetId, position = "before") => {
      if (id === targetId) return;
      const sourceIndex = snaps.findIndex((snap) => snap.id === id);
      const targetIndex = snaps.findIndex((snap) => snap.id === targetId);
      if (sourceIndex < 0 || targetIndex < 0) return;

      const reordered = [...snaps];
      const [snap] = reordered.splice(sourceIndex, 1);
      let insertionIndex = targetIndex + (position === "after" ? 1 : 0);
      if (sourceIndex < insertionIndex) insertionIndex -= 1;
      reordered.splice(insertionIndex, 0, snap);
      setSnaps(reordered);
    },
    [snaps]
  );

  const selectedSnap =
    snaps.find((snap) => snap.id === selectedSnapId) ?? null;

  const selectSnap = useCallback((id) => {
    setSelectedSnapId(id);
  }, []);

  const restoreSnap = useCallback(
    (snap) => {
      if (!snap) return;
      applySnapshot(snap);
      showToast(`${snap.title} loaded onto the canvas`, "success");
    },
    [applySnapshot, showToast]
  );

  const startPresentation = useCallback(() => {
    const includedSnaps = snaps.filter(
      (snap) => snap.includedInPresentation !== false
    );
    if (includedSnaps.length === 0) {
      showToast("Include at least one snap in the presentation");
      return;
    }
    const startSnap =
      includedSnaps.find((snap) => snap.id === selectedSnapId) ??
      includedSnaps[0];
    setPresentationStartSnapId(startSnap.id);
    setIsPlaying(true);
  }, [snaps, selectedSnapId, showToast]);

  const stopPresentation = useCallback(() => {
    setIsPlaying(false);
    setPresentationStartSnapId(null);
  }, []);

  useEffect(() => {
    if (isPlaying && snaps.length === 0) setIsPlaying(false);
  }, [isPlaying, snaps.length]);

  const presentationSnaps = useMemo(
    () => snaps.filter((snap) => snap.includedInPresentation !== false),
    [snaps]
  );

  return {
    snaps,
    presentationSnaps,
    selectedSnap,
    selectedSnapId,
    isPlaying,
    presentationStartSnapId,
    storageError,
    storageRecoveryRequired,
    importSnaps,
    replaceUnrecognizedStorage,
    createSnap,
    selectSnap,
    renameSnap,
    duplicateSnap,
    duplicateLastSnap,
    deleteSnap,
    updateSnap,
    clearSnaps,
    moveSnap,
    reorderSnap,
    restoreSnap,
    startPresentation,
    stopPresentation,
  };
}
