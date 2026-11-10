import { branchService } from "../services/branchService.js";
import { getSessionAccessToken } from "../middleware/auth.js";
import { resolveBranch, resolveLibraryBranch } from "../utils/githubClient.js";
import { ARTWORKS_REPOSITORY } from "../services/albumService.js";

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

function requireOwner(req, res, owner) {
  if (req.user?.login?.toLowerCase() === owner.toLowerCase()) return true;
  res.status(403).json({
    error: { code: "FORBIDDEN", message: "Only the library owner can manage its branches." },
  });
  return false;
}

async function branchFor(service, token, owner, branch) {
  if (!service.fetch) return branch || "master";
  return resolveLibraryBranch(service.fetch, token, owner, branch);
}

export class BranchController {
  constructor(service = branchService) {
    this.service = service;
  }

  listBranches = async (req, res, next) => {
    try {
      const token = requireToken(req, res);
      if (!token) return;
      const { owner } = req.params;
      const page = Math.max(1, parseInt(req.query.page || "1", 10));
      const perPage = Math.min(100, Math.max(1, parseInt(req.query.per_page || "30", 10)));
      const data = await this.service.listBranches(token, owner, ARTWORKS_REPOSITORY, { page, perPage });
      return res.json(data);
    } catch (err) {
      next(err);
    }
  };

  getBranch = async (req, res, next) => {
    try {
      const token = requireToken(req, res);
      if (!token) return;
      const { owner, branch } = req.params;
      const resolvedBranch = await branchFor(this.service, token, owner, branch);
      const data = await this.service.getBranch(token, owner, ARTWORKS_REPOSITORY, resolvedBranch);
      return res.json(data);
    } catch (err) {
      next(err);
    }
  };

  createBranch = async (req, res, next) => {
    try {
      const token = requireToken(req, res);
      if (!token) return;
      const { owner } = req.params;
      if (!requireOwner(req, res, owner)) return;
      const result = await this.service.createBranch(token, owner, ARTWORKS_REPOSITORY, req.body);
      return res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  };

  renameBranch = async (req, res, next) => {
    try {
      const token = requireToken(req, res);
      if (!token) return;
      const { owner, branch } = req.params;
      if (!requireOwner(req, res, owner)) return;
      const result = await this.service.renameBranch(token, owner, ARTWORKS_REPOSITORY, branch, req.body);
      return res.json(result);
    } catch (err) {
      next(err);
    }
  };

  deleteBranch = async (req, res, next) => {
    try {
      const token = requireToken(req, res);
      if (!token) return;
      const { owner, branch } = req.params;
      if (!requireOwner(req, res, owner)) return;
      const result = await this.service.deleteBranch(token, owner, ARTWORKS_REPOSITORY, branch);
      return res.json(result);
    } catch (err) {
      next(err);
    }
  };

  compare = async (req, res, next) => {
    try {
      const token = requireToken(req, res);
      if (!token) return;
      const { owner } = req.params;
      const base = await branchFor(this.service, token, owner, req.query.base || req.params.base);
      const head = req.query.head || req.params.head;
      if (!head) {
        return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "head branch is required" } });
      }
      const data = await this.service.compare(token, owner, ARTWORKS_REPOSITORY, base, head);
      return res.json(data);
    } catch (err) {
      next(err);
    }
  };

  listCommits = async (req, res, next) => {
    try {
      const token = requireToken(req, res);
      if (!token) return;
      const { owner } = req.params;
      const branch = await branchFor(this.service, token, owner, resolveBranch(req));
      const page = Math.max(1, parseInt(req.query.page || "1", 10));
      const commits = await this.service.listCommits(token, owner, ARTWORKS_REPOSITORY, branch, { page });
      return res.json({ commits });
    } catch (err) {
      next(err);
    }
  };
}

export const branchController = new BranchController();
