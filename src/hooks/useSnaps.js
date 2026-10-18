import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "gridcraft.snaps";
const SCHEMA_VERSION = 1;
const GRID_SIZES = [16, 32, 64, 128];
const HEX_COLOR = /^#[0-9a-f]{3}(?:[0-9a-f]{3})?$/i;

function isValidSnap(snap) {
  return (
    snap &&
    typeof snap.id === "string" &&
    snap.id.length > 0 &&
    Number.isInteger(snap.sequence) &&
    snap.sequence > 0 &&
    typeof snap.title === "string" &&
    snap.title.trim().length > 0 &&
    typeof snap.createdAt === "string" &&
    Number.isFinite(Date.parse(snap.createdAt)) &&
    GRID_SIZES.includes(snap.gridSize) &&
    Array.isArray(snap.cells) &&
    snap.cells.length === snap.gridSize * snap.gridSize &&
    snap.cells.every(
      (color) => color === null || (typeof color === "string" && HEX_COLOR.test(color))
    ) &&
    (snap.backgroundColor === "transparent" ||
      (typeof snap.backgroundColor === "string" &&
        HEX_COLOR.test(snap.backgroundColor)))
  );
}

function loadSnaps() {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved === null) return { snaps: [], notice: null };

    const data = JSON.parse(saved);
    if (
      !data ||
      data.version !== SCHEMA_VERSION ||
      !Array.isArray(data.snaps)
    ) {
      return {
        snaps: [],
        notice: "Saved snaps were invalid or from an unsupported version.",
      };
    }

    const seenIds = new Set();
    const snaps = data.snaps.filter((snap) => {
      if (!isValidSnap(snap) || seenIds.has(snap.id)) return false;
      seenIds.add(snap.id);
      return true;
    });

    return {
      snaps,
      notice:
        snaps.length !== data.snaps.length
          ? "Some invalid saved snaps were skipped."
          : null,
    };
  } catch (error) {
    console.error("Failed to load saved snaps", error);
    return {
      snaps: [],
      notice: "Saved snaps could not be read and were not loaded.",
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
  const [snaps, setSnaps] = useState(initialData.snaps);
  const [selectedSnapId, setSelectedSnapId] = useState(
    initialData.snaps[0]?.id ?? null
  );
  const [isPlaying, setIsPlaying] = useState(false);
  const [storageError, setStorageError] = useState(null);

  useEffect(() => {
    if (initialData.notice) showToast(initialData.notice);
  }, [initialData.notice, showToast]);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ version: SCHEMA_VERSION, snaps })
      );
      setStorageError(null);
    } catch (error) {
      console.error("Failed to save snaps", error);
      setStorageError("Snaps could not be saved to this browser.");
    }
  }, [snaps]);

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
    if (snaps.length < 2) {
      showToast("Add at least two snaps to start a presentation");
      return;
    }
    if (selectedSnap) applySnapshot(selectedSnap);
    setIsPlaying(true);
    showToast("Presentation started", "success");
  }, [snaps.length, selectedSnap, applySnapshot, showToast]);

  const stopPresentation = useCallback(() => {
    setIsPlaying(false);
    showToast("Presentation stopped", "success");
  }, [showToast]);

  useEffect(() => {
    if (!isPlaying || snaps.length < 2) return undefined;

    const intervalId = window.setInterval(() => {
      setSelectedSnapId((currentId) => {
        const index = snaps.findIndex((snap) => snap.id === currentId);
        const nextSnap = snaps[(index + 1 + snaps.length) % snaps.length];
        applySnapshot(nextSnap);
        return nextSnap.id;
      });
    }, 2000);

    return () => window.clearInterval(intervalId);
  }, [isPlaying, snaps, applySnapshot]);

  useEffect(() => {
    if (isPlaying && snaps.length < 2) setIsPlaying(false);
  }, [isPlaying, snaps.length]);

  return {
    snaps,
    selectedSnap,
    selectedSnapId,
    isPlaying,
    storageError,
    createSnap,
    selectSnap,
    renameSnap,
    duplicateSnap,
    deleteSnap,
    clearSnaps,
    moveSnap,
    reorderSnap,
    restoreSnap,
    startPresentation,
    stopPresentation,
  };
}
