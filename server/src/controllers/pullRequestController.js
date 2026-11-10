import { pullRequestService } from "../services/pullRequestService.js";
import { getSessionAccessToken } from "../middleware/auth.js";

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

export class PullRequestController {
  constructor(service = pullRequestService) {
    this.service = service;
  }

  listPulls = async (req, res, next) => {
    try {
      const token = requireToken(req, res);
      if (!token) return;
      const { owner, repo } = req.params;
      const data = await this.service.listPulls(token, owner, repo, {
        state: req.query.state,
        page: Math.max(1, parseInt(req.query.page || "1", 10)),
        perPage: Math.min(100, Math.max(1, parseInt(req.query.per_page || "20", 10))),
      });
      return res.json(data);
    } catch (err) {
      next(err);
    }
  };

  getPull = async (req, res, next) => {
    try {
      const token = requireToken(req, res);
      if (!token) return;
      const { owner, repo, number } = req.params;
      const commentsPage = Math.max(1, parseInt(req.query.page || "1", 10));
      const data = await this.service.getPull(token, owner, repo, number, commentsPage);
      return res.json(data);
    } catch (err) {
      next(err);
    }
  };

  createPull = async (req, res, next) => {
    try {
      const token = requireToken(req, res);
      if (!token) return;
      const { owner, repo } = req.params;
      const result = await this.service.createPull(token, owner, repo, req.body);
      return res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  };

  updatePull = async (req, res, next) => {
    try {
      const token = requireToken(req, res);
      if (!token) return;
      const { owner, repo, number } = req.params;
      const result = await this.service.updatePull(token, owner, repo, number, req.body);
      return res.json(result);
    } catch (err) {
      next(err);
    }
  };

  submitReview = async (req, res, next) => {
    try {
      const token = requireToken(req, res);
      if (!token) return;
      const { owner, repo, number } = req.params;
      const result = await this.service.submitReview(token, owner, repo, number, req.body);
      return res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  };

  commentOnPull = async (req, res, next) => {
    try {
      const token = requireToken(req, res);
      if (!token) return;
      const { owner, repo, number } = req.params;
      const result = await this.service.commentOnPull(token, owner, repo, number, req.body?.body);
      return res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  };

  mergePull = async (req, res, next) => {
    try {
      const token = requireToken(req, res);
      if (!token) return;
      const { owner, repo, number } = req.params;
      const result = await this.service.mergePull(token, owner, repo, number, req.body);
      return res.json(result);
    } catch (err) {
      next(err);
    }
  };
}

export const pullRequestController = new PullRequestController();
