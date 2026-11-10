import { branchService } from "../services/branchService.js";
import { getSessionAccessToken } from "../middleware/auth.js";
import { resolveBranch } from "../utils/githubClient.js";

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

export class BranchController {
  constructor(service = branchService) {
    this.service = service;
  }

  listBranches = async (req, res, next) => {
    try {
      const token = requireToken(req, res);
      if (!token) return;
      const { owner, repo } = req.params;
      const page = Math.max(1, parseInt(req.query.page || "1", 10));
      const perPage = Math.min(100, Math.max(1, parseInt(req.query.per_page || "30", 10)));
      const data = await this.service.listBranches(token, owner, repo, { page, perPage });
      return res.json(data);
    } catch (err) {
      next(err);
    }
  };

  getBranch = async (req, res, next) => {
    try {
      const token = requireToken(req, res);
      if (!token) return;
      const { owner, repo, branch } = req.params;
      const data = await this.service.getBranch(token, owner, repo, branch);
      return res.json(data);
    } catch (err) {
      next(err);
    }
  };

  createBranch = async (req, res, next) => {
    try {
      const token = requireToken(req, res);
      if (!token) return;
      const { owner, repo } = req.params;
      const result = await this.service.createBranch(token, owner, repo, req.body);
      return res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  };

  renameBranch = async (req, res, next) => {
    try {
      const token = requireToken(req, res);
      if (!token) return;
      const { owner, repo, branch } = req.params;
      const result = await this.service.renameBranch(token, owner, repo, branch, req.body);
      return res.json(result);
    } catch (err) {
      next(err);
    }
  };

  deleteBranch = async (req, res, next) => {
    try {
      const token = requireToken(req, res);
      if (!token) return;
      const { owner, repo, branch } = req.params;
      const result = await this.service.deleteBranch(token, owner, repo, branch);
      return res.json(result);
    } catch (err) {
      next(err);
    }
  };

  compare = async (req, res, next) => {
    try {
      const token = requireToken(req, res);
      if (!token) return;
      const { owner, repo } = req.params;
      const base = req.query.base || req.params.base || "master";
      const head = req.query.head || req.params.head;
      if (!head) {
        return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "head branch is required" } });
      }
      const data = await this.service.compare(token, owner, repo, base, head);
      return res.json(data);
    } catch (err) {
      next(err);
    }
  };

  listCommits = async (req, res, next) => {
    try {
      const token = requireToken(req, res);
      if (!token) return;
      const { owner, repo } = req.params;
      const branch = resolveBranch(req);
      const page = Math.max(1, parseInt(req.query.page || "1", 10));
      const commits = await this.service.listCommits(token, owner, repo, branch, { page });
      return res.json({ commits });
    } catch (err) {
      next(err);
    }
  };
}

export const branchController = new BranchController();
