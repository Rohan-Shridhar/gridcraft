import { z } from "zod";

export const BRANCH_NAME_REGEX = /^(?!\/)(?!.*\.\.)[A-Za-z0-9._\-\/]+(?<!\/)(?<!\.lock)$/;

export function assertSafeBranchName(name) {
  if (!name || typeof name !== "string" || name === "HEAD" || !BRANCH_NAME_REGEX.test(name) || name.includes("\\")) {
    const err = new Error("Invalid branch name");
    err.status = 400;
    err.code = "VALIDATION_ERROR";
    throw err;
  }
  return name;
}

export const CreateBranchSchema = z.object({
  name: z.string().min(1).max(255),
  from: z.string().min(1).max(255).optional().default("master"),
});

export const RenameBranchSchema = z.object({
  newName: z.string().min(1).max(255),
});
