import { z } from "zod";

const GITHUB_REPO_REGEX = /^[a-zA-Z0-9_.-]+$/;

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
    .regex(
      GITHUB_REPO_REGEX,
      "Repository name can only contain alphanumeric characters, hyphens, underscores, and periods."
    )
    .refine((val) => !val.startsWith(".") && !val.startsWith("-"), {
      message: "Repository name cannot start with a hyphen or period.",
    }),
  description: z
    .string()
    .max(350, "Description must be 350 characters or fewer")
    .optional()
    .default(""),
  isPrivate: z.boolean().optional().default(false),
  readme: z.string().max(2000, "README content is too large").optional(),
});

export const UpdateAlbumSchema = z.object({
  description: z.string().max(350).optional(),
  isPrivate: z.boolean().optional(),
});

export const AlbumManifestSchema = z.object({
  format: z.literal("gridcraft-album"),
  schemaVersion: z.literal(1),
  id: z.string().min(1),
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
});
