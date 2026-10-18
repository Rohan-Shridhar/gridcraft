import { createSnapSvgData } from "./snapSvg.mjs";

export const SNAP_EXPORT_FORMAT = "gridcraft-snaps";
export const SNAP_EXPORT_VERSION = 1;
export const MAX_SNAP_IMPORT_BYTES = 25 * 1024 * 1024;
export const MAX_IMPORTED_SNAPS = 100;

const HEX_COLOR = /^#[0-9a-f]{3}(?:[0-9a-f]{3})?$/i;
const GRID_SIZES = [16, 32, 64, 128];

export function validateSnapExport(data) {
  if (
    !data ||
    typeof data !== "object" ||
    Array.isArray(data) ||
    data.format !== SNAP_EXPORT_FORMAT ||
    data.version !== SNAP_EXPORT_VERSION ||
    !Array.isArray(data.snaps) ||
    data.snaps.length > MAX_IMPORTED_SNAPS
  ) {
    return { valid: false, error: "This is not a supported GridCraft snaps file." };
  }

  const ids = new Set();
  for (const snap of data.snaps) {
    if (
      !snap ||
      typeof snap !== "object" ||
      typeof snap.id !== "string" ||
      !snap.id ||
      snap.id.length > 128 ||
      ids.has(snap.id) ||
      !Number.isInteger(snap.sequence) ||
      snap.sequence < 1 ||
      typeof snap.title !== "string" ||
      !snap.title.trim() ||
      snap.title.length > 80 ||
      typeof snap.createdAt !== "string" ||
      !Number.isFinite(Date.parse(snap.createdAt)) ||
      !GRID_SIZES.includes(snap.gridSize) ||
      !Array.isArray(snap.cells) ||
      snap.cells.length !== snap.gridSize * snap.gridSize ||
      !snap.cells.every(
        (color) => color === null || (typeof color === "string" && HEX_COLOR.test(color))
      ) ||
      !(
        snap.backgroundColor === "transparent" ||
        (typeof snap.backgroundColor === "string" &&
          HEX_COLOR.test(snap.backgroundColor))
      ) ||
      (snap.caption !== undefined &&
        (typeof snap.caption !== "string" || snap.caption.length > 120)) ||
      (snap.notes !== undefined &&
        (typeof snap.notes !== "string" || snap.notes.length > 1000)) ||
      (snap.includedInPresentation !== undefined &&
        typeof snap.includedInPresentation !== "boolean") ||
      (snap.durationMs !== undefined &&
        (!Number.isFinite(snap.durationMs) ||
          snap.durationMs < 500 ||
          snap.durationMs > 10000))
    ) {
      return {
        valid: false,
        error: "The file contains an invalid snapshot or unsupported canvas dimensions.",
      };
    }
    ids.add(snap.id);
  }

  return { valid: true, snaps: data.snaps };
}

export function createSnapExportData(snaps) {
  return {
    format: SNAP_EXPORT_FORMAT,
    version: SNAP_EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    snaps: snaps.map((snap) => ({
      id: snap.id,
      createdAt: snap.createdAt,
      sequence: snap.sequence,
      title: snap.title,
      cells: [...snap.cells],
      gridSize: snap.gridSize,
      backgroundColor: snap.backgroundColor,
      caption: snap.caption ?? "",
      notes: snap.notes ?? "",
      includedInPresentation: snap.includedInPresentation !== false,
      durationMs: snap.durationMs ?? 1500,
    })),
  };
}

export function exportSnapsJson(snaps) {
  const json = JSON.stringify(createSnapExportData(snaps), null, 2);
  downloadBlob(
    new Blob([json], { type: "application/json;charset=utf-8" }),
    "gridcraft-snaps.json"
  );
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function safeFilePart(name) {
  return (typeof name === "string" ? name : "")
    .trim()
    .replace(/[^a-z0-9-_]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "snap";
}

export function exportSnapSvg(snap) {
  const data = createSnapSvgData(snap);
  if (!data) throw new Error("This snap has invalid pixel data.");

  const background = data.backgroundFill
    ? `<rect width="${data.gridSize}" height="${data.gridSize}" fill="${data.backgroundFill}"/>`
    : "";
  const pixels = data.rectangles
    .map(
      ({ x, y, width, height, fill }) =>
        `<rect x="${x}" y="${y}" width="${width}" height="${height}" fill="${fill}"/>`
    )
    .join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${data.viewBox}" shape-rendering="crispEdges">${background}${pixels}</svg>`;
  downloadBlob(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }), `${safeFilePart(snap.title)}.svg`);
}

function drawSnap(context, snap, outputSize) {
  const cellSize = outputSize / snap.gridSize;
  context.clearRect(0, 0, outputSize, outputSize);
  if (snap.backgroundColor !== "transparent") {
    context.fillStyle = snap.backgroundColor;
    context.fillRect(0, 0, outputSize, outputSize);
  }
  snap.cells.forEach((color, index) => {
    if (color === null) return;
    context.fillStyle = color;
    context.fillRect(
      (index % snap.gridSize) * cellSize,
      Math.floor(index / snap.gridSize) * cellSize,
      cellSize,
      cellSize
    );
  });
}

export function exportSnapPng(snap) {
  if (!createSnapSvgData(snap)) throw new Error("This snap has invalid pixel data.");
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = snap.gridSize * 8;
  drawSnap(canvas.getContext("2d"), snap, canvas.width);
  return new Promise((resolve, reject) => {
    try {
      canvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error("The browser could not create a PNG image."));
          return;
        }
        try {
          downloadBlob(blob, `${safeFilePart(snap.title)}.png`);
          resolve();
        } catch (error) {
          reject(error);
        }
      }, "image/png");
    } catch (error) {
      reject(error);
    }
  });
}

function wait(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

export async function exportSnapsWebm(snaps, frameDurationMs) {
  if (!Array.isArray(snaps) || snaps.length === 0) {
    throw new Error("Include at least one snap to export an animation.");
  }
  if (!Number.isFinite(frameDurationMs) || frameDurationMs < 500 || frameDurationMs > 10000) {
    throw new Error("Frame duration must be between 0.5 and 10 seconds.");
  }
  if (snaps.length > 40 || snaps.length * frameDurationMs > 120000) {
    throw new Error("Reduce the number of slides or frame duration to 120 seconds or less.");
  }
  if (!snaps.every((snap) => createSnapSvgData(snap))) {
    throw new Error("One or more snaps have invalid pixel data.");
  }
  if (
    typeof MediaRecorder === "undefined" ||
    typeof HTMLCanvasElement.prototype.captureStream !== "function"
  ) {
    throw new Error("Animated WebM export is not supported by this browser.");
  }

  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 1024;
  const context = canvas.getContext("2d");
  const stream = canvas.captureStream(30);
  const mimeType =
    typeof MediaRecorder.isTypeSupported === "function"
      ? ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"].find(
          (type) => MediaRecorder.isTypeSupported(type)
        )
      : undefined;
  const recorder = mimeType
    ? new MediaRecorder(stream, { mimeType })
    : new MediaRecorder(stream);
  const chunks = [];
  const stopped = new Promise((resolve, reject) => {
    recorder.addEventListener("dataavailable", (event) => {
      if (event.data.size) chunks.push(event.data);
    });
    recorder.addEventListener("stop", resolve, { once: true });
    recorder.addEventListener(
      "error",
      () => reject(new Error("The browser failed while encoding the WebM animation.")),
      { once: true }
    );
  });

  try {
    drawSnap(context, snaps[0], canvas.width);
    recorder.start();
    await wait(frameDurationMs);
    for (const snap of snaps.slice(1)) {
      drawSnap(context, snap, canvas.width);
      await wait(frameDurationMs);
    }
    recorder.stop();
    await stopped;
  } catch (error) {
    if (recorder.state !== "inactive") recorder.stop();
    throw error;
  } finally {
    stream.getTracks().forEach((track) => track.stop());
  }

  downloadBlob(new Blob(chunks, { type: recorder.mimeType || "video/webm" }), "gridcraft-animation.webm");
}
