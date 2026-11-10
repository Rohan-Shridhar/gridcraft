import { storyService } from "../services/storyService.js";
import { getSessionAccessToken } from "../middleware/auth.js";
import { resolveBranch, resolveLibraryBranch } from "../utils/githubClient.js";

async function branchFor(service, token, owner, req) {
  if (!service.fetch) return resolveBranch(req) || "master";
  return resolveLibraryBranch(service.fetch, token, owner, resolveBranch(req));
}

function requireToken(req, res) {
  const token = getSessionAccessToken(req);
  if (!token) {
    res.status(401).json({
      error: { code: "UNAUTHORIZED", message: "Missing or invalid session token." },
    });
    return null;
  }
  return token;
}

export class StoryController {
  constructor(service = storyService) {
    this.service = service;
  }

  listStories = async (req, res, next) => {
    try {
      const token = requireToken(req, res);
      if (!token) return;
      const { owner, repo } = req.params;
      const branch = await branchFor(this.service, token, owner, req);
      const stories = await this.service.listStories(token, owner, repo, branch);
      return res.json({ stories });
    } catch (err) {
      next(err);
    }
  };

  getStory = async (req, res, next) => {
    try {
      const token = requireToken(req, res);
      if (!token) return;
      const { owner, repo, storyId } = req.params;
      const branch = await branchFor(this.service, token, owner, req);
      const data = await this.service.getStory(token, owner, repo, storyId, branch);
      return res.json(data);
    } catch (err) {
      next(err);
    }
  };

  createStory = async (req, res, next) => {
    try {
      const token = requireToken(req, res);
      if (!token) return;
      const { owner, repo } = req.params;
      const branch = await branchFor(this.service, token, owner, req);
      const result = await this.service.createStory(
        token,
        req.user,
        owner,
        repo,
        req.body,
        branch
      );
      return res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  };

  saveStory = async (req, res, next) => {
    try {
      const token = requireToken(req, res);
      if (!token) return;
      const { owner, repo, storyId } = req.params;
      const branch = await branchFor(this.service, token, owner, req);
      const result = await this.service.saveStory(
        token,
        req.user,
        owner,
        repo,
        storyId,
        req.body,
        branch
      );
      return res.json(result);
    } catch (err) {
      next(err);
    }
  };

  deleteStory = async (req, res, next) => {
    try {
      const token = requireToken(req, res);
      if (!token) return;
      const { owner, repo, storyId } = req.params;
      const branch = await branchFor(this.service, token, owner, req);
      const result = await this.service.deleteStory(
        token,
        req.user,
        owner,
        repo,
        storyId,
        req.body?.sha,
        branch
      );
      return res.json(result);
    } catch (err) {
      next(err);
    }
  };

  addFrame = async (req, res, next) => {
    try {
      const token = requireToken(req, res);
      if (!token) return;
      const { owner, repo, storyId } = req.params;
      const branch = await branchFor(this.service, token, owner, req);
      const result = await this.service.addFrame(
        token,
        req.user,
        owner,
        repo,
        storyId,
        req.body,
        req.body?.sha,
        branch
      );
      return res.json(result);
    } catch (err) {
      next(err);
    }
  };

  reorderFrames = async (req, res, next) => {
    try {
      const token = requireToken(req, res);
      if (!token) return;
      const { owner, repo, storyId } = req.params;
      const branch = await branchFor(this.service, token, owner, req);
      const result = await this.service.reorderFrames(
        token,
        req.user,
        owner,
        repo,
        storyId,
        req.body?.frameIds || req.body?.order || [],
        req.body?.sha,
        branch
      );
      return res.json(result);
    } catch (err) {
      next(err);
    }
  };
}

export const storyController = new StoryController();
