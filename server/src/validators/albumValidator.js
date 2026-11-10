import { z } from "zod";

export function slugifyRepoName(input) {
  if (!input || typeof input !== "string") return "";
  return input
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 100);
}

export const CreateAlbumSchema = z.object({
  name: z
    .string()
    .min(1, "Album name is required")
    .max(100, "Album name must be 100 characters or fewer")
    .refine((value) => slugifyRepoName(value).length > 0, {
      message: "Album name must include at least one letter or number.",
    }),
  description: z
    .string()
    .max(350, "Description must be 350 characters or fewer")
    .optional()
    .default(""),
});

export const UpdateAlbumSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(350).optional(),
});

export const AlbumManifestSchema = z.object({
  format: z.literal("gridcraft-album"),
  schemaVersion: z.literal(1),
  id: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/),
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional().default(""),
  createdAt: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: "Invalid createdAt date string",
  }),
  updatedAt: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: "Invalid updatedAt date string",
  }),
  createdWith: z.object({
    name: z.literal("GridCraft"),
    version: z.string(),
  }),
  parent: z.object({
    owner: z.string().min(1).max(39),
    slug: z.string().min(1).max(100),
  }).optional(),
});
