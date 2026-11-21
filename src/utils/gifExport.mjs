import gifenc from "gifenc";

const { GIFEncoder, quantize, applyPalette } = gifenc;

export const MAX_GIF_PIXELS = 128 * 128 * 64;
export const MAX_GIF_FRAMES = 120;

export function assertCompatibleFrames(frames) {
  if (!Array.isArray(frames) || !frames.length) {
    throw new Error("A Story needs at least one frame to export.");
  }
  if (frames.length > MAX_GIF_FRAMES) {
    throw new Error(`GIF export supports at most ${MAX_GIF_FRAMES} frames.`);
  }
  const size = frames[0]?.gridSize;
  if (!Number.isInteger(size) || size <= 0) {
    throw new Error("Story frames must have a valid grid size before GIF export.");
  }
  if (frames.some((frame) => !frame || frame.gridSize !== size)) {
    throw new Error("All Story frames must share the same grid size before GIF export.");
  }
  if (frames.some((frame) => !Array.isArray(frame.cells) || frame.cells.length !== size * size)) {
    throw new Error("Story frames must contain complete pixel data before GIF export.");
  }
  if (size * size * frames.length > MAX_GIF_PIXELS) {
    throw new Error("This Story is too large to encode in the browser. Reduce frames or grid size.");
  }
  return size;
}

export function renderFrameToRgba(frame, scale) {
  const width = frame.gridSize * scale;
  const height = width;
  const rgba = new Uint8ClampedArray(width * height * 4);
  const bg = frame.backgroundColor && frame.backgroundColor !== "transparent" ? frame.backgroundColor : null;

  const parseHex = (hex) => {
    const h = hex.replace("#", "");
    const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h.padEnd(6, "0");
    return [
      parseInt(full.slice(0, 2), 16),
      parseInt(full.slice(2, 4), 16),
      parseInt(full.slice(4, 6), 16),
    ];
  };

  for (let y = 0; y < width; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const cellX = Math.floor(x / scale);
      const cellY = Math.floor(y / scale);
      const cell = frame.cells[cellY * frame.gridSize + cellX];
      const idx = (y * width + x) * 4;
      if (cell) {
        const [r, g, b] = parseHex(cell);
        rgba[idx] = r;
        rgba[idx + 1] = g;
        rgba[idx + 2] = b;
        rgba[idx + 3] = 255;
      } else if (bg) {
        const [r, g, b] = parseHex(bg);
        rgba[idx] = r;
        rgba[idx + 1] = g;
        rgba[idx + 2] = b;
        rgba[idx + 3] = 255;
      } else {
        rgba[idx] = 0;
        rgba[idx + 1] = 0;
        rgba[idx + 2] = 0;
        rgba[idx + 3] = 0;
      }
    }
  }
  return { rgba, width, height };
}

export function encodeStoryGif(frames, { loop = true, scale = 8, onProgress } = {}) {
  if (!Number.isInteger(scale) || scale < 1) {
    throw new Error("GIF scale must be a positive integer.");
  }
  const size = assertCompatibleFrames(frames);
  const gif = GIFEncoder();
  const format = "rgba4444";
  frames.forEach((frame, index) => {
    const { rgba, width, height } = renderFrameToRgba(frame, scale);
    const palette = quantize(rgba, 256, { format, oneBitAlpha: true });
    const indexMap = applyPalette(rgba, palette, format);
    const transparentIndex = palette.findIndex((color) => color[3] === 0);
    const durationMs =
      Number.isFinite(frame.durationMs) && frame.durationMs > 0 ? frame.durationMs : 150;
    gif.writeFrame(indexMap, width, height, {
      palette,
      delay: Math.max(20, Math.round(durationMs)),
      repeat: index === 0 ? (loop ? 0 : -1) : undefined,
      transparent: transparentIndex !== -1,
      transparentIndex: transparentIndex !== -1 ? transparentIndex : 0,
    });
    if (onProgress) onProgress(index + 1, frames.length);
  });
  gif.finish();
  return {
    bytes: gif.bytes(),
    width: size * scale,
    height: size * scale,
    frameCount: frames.length,
  };
}

export function downloadGif(bytes, filename = "gridcraft-story.gif") {
  const blob = new Blob([bytes], { type: "image/gif" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
