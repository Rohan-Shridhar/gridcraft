import { z } from "zod";

export const SUPPORTED_GRID_SIZES = [16, 32, 64, 128];
const HEX_COLOR_REGEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const ARTWORK_ID_REGEX = /^[a-z0-9-]+$/;
const MAX_CELLS = 128 * 128;
const cellSchema = z.union([z.string().regex(HEX_COLOR_REGEX), z.null()]);

export function sanitizeArtworkId(input) {
  if (!input || typeof input !== "string") return "";
  return input
    .trim()
    .toLowerCase()
    .replace(/[/\\.]+/g, "-")   // path separators and dots become hyphens
    .replace(/[\s_]+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 100);
}

export function isValidColor(color) {
  if (color === null) return true;
  return typeof color === "string" && HEX_COLOR_REGEX.test(color);
}

export function isValidBackgroundColor(color) {
  return color === "transparent" || (typeof color === "string" && HEX_COLOR_REGEX.test(color));
}

export const CreateArtworkInputSchema = z.object({
  name: z.string().min(1, "Artwork name is required").max(100),
  description: z.string().max(500).optional().default(""),
  gridSize: z.number().refine((val) => SUPPORTED_GRID_SIZES.includes(val), {
    message: "gridSize must be one of 16, 32, 64, or 128",
  }),
  backgroundColor: z
    .string()
    .refine(isValidBackgroundColor, {
      message: 'backgroundColor must be "transparent" or a valid hex color string',
    })
    .default("transparent"),
  cells: z.array(cellSchema).max(MAX_CELLS, "Artwork exceeds the maximum grid size").optional(),
}).refine(
  (data) => data.cells === undefined || data.cells.length === data.gridSize * data.gridSize,
  (data) => ({
    message: `cells array length (${data.cells?.length}) must match gridSize * gridSize (${data.gridSize * data.gridSize})`,
    path: ["cells"],
  })
);

export const ArtworkSchema = z
  .object({
    format: z.literal("gridcraft-artwork"),
    schemaVersion: z.literal(1),
    id: z
      .string()
      .min(1)
      .max(100)
      .regex(ARTWORK_ID_REGEX, "id must contain only lowercase alphanumeric characters and hyphens"),
    name: z.string().min(1).max(100),
    description: z.string().max(500).optional().default(""),
    gridSize: z.number().refine((val) => SUPPORTED_GRID_SIZES.includes(val), {
      message: "gridSize must be 16, 32, 64, or 128",
    }),
    width: z.number(),
    height: z.number(),
    backgroundColor: z.string().refine(isValidBackgroundColor, {
      message: 'backgroundColor must be "transparent" or a valid hex color string',
    }),
    cells: z.array(cellSchema).max(MAX_CELLS, "Artwork exceeds the maximum grid size"),
    createdAt: z.string().refine((val) => !isNaN(Date.parse(val)), {
      message: "Invalid createdAt date string",
    }),
    updatedAt: z.string().refine((val) => !isNaN(Date.parse(val)), {
      message: "Invalid updatedAt date string",
    }),
  })
  .refine(
    (data) => data.cells.length === data.gridSize * data.gridSize,
    (data) => ({
      message: `cells array length (${data.cells.length}) must match gridSize * gridSize (${data.gridSize * data.gridSize})`,
      path: ["cells"],
    })
  )
  .refine(
    (data) => data.width === data.gridSize && data.height === data.gridSize,
    {
      message: "width and height must match gridSize",
      path: ["width"],
    }
  );
