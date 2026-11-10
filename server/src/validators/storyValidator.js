import { z } from "zod";
import { sanitizeArtworkId } from "./artworkValidator.js";

export function sanitizeStoryId(input) {
  return sanitizeArtworkId(input);
}

const FrameSchema = z.object({
  artworkId: z.string().min(1).max(100),
  artworkPath: z
    .string()
    .regex(/^artworks\/[a-z0-9-]+\.json$/, "artworkPath must be artworks/<id>.json"),
  durationMs: z.number().int().min(20).max(10000),
});

export const CreateStoryInputSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional().default(""),
  loop: z.boolean().optional().default(true),
  defaultFrameDurationMs: z.number().int().min(20).max(10000).optional().default(150),
  frames: z.array(FrameSchema).optional().default([]),
});

export const StorySchema = z
  .object({
    format: z.literal("gridcraft-story"),
    schemaVersion: z.literal(1),
    id: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/),
    name: z.string().min(1).max(100),
    description: z.string().max(500).optional().default(""),
    loop: z.boolean(),
    defaultFrameDurationMs: z.number().int().min(20).max(10000),
    frames: z.array(FrameSchema),
    createdAt: z.string().refine((val) => !isNaN(Date.parse(val))),
    updatedAt: z.string().refine((val) => !isNaN(Date.parse(val))),
  })
  .refine(
    (data) => data.frames.every((frame) => frame.artworkPath === `artworks/${frame.artworkId}.json`),
    { message: "Each frame artworkPath must match artworkId", path: ["frames"] }
  );

export { FrameSchema };
