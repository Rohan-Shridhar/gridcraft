import { issueService } from "../services/issueService.js";
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

export class IssueController {
  constructor(service = issueService) {
    this.service = service;
  }

  listIssues = async (req, res, next) => {
    try {
      const token = requireToken(req, res);
      if (!token) return;
      const { owner, repo } = req.params;
      const data = await this.service.listIssues(token, owner, repo, {
        state: req.query.state,
        page: Math.max(1, parseInt(req.query.page || "1", 10)),
        perPage: Math.min(100, Math.max(1, parseInt(req.query.per_page || "20", 10))),
        author: req.query.author,
        assignee: req.query.assignee,
        labels: req.query.labels,
        q: req.query.q,
      });
      return res.json(data);
    } catch (err) {
      next(err);
    }
  };

  getIssue = async (req, res, next) => {
    try {
      const token = requireToken(req, res);
      if (!token) return;
      const { owner, repo, number } = req.params;
      const data = await this.service.getIssue(token, owner, repo, number, Math.max(1, parseInt(req.query.page || "1", 10)));
      return res.json(data);
    } catch (err) {
      next(err);
    }
  };

  createIssue = async (req, res, next) => {
    try {
      const token = requireToken(req, res);
      if (!token) return;
      const { owner, repo } = req.params;
      const result = await this.service.createIssue(token, owner, repo, req.body);
      return res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  };

  updateIssue = async (req, res, next) => {
    try {
      const token = requireToken(req, res);
      if (!token) return;
      const { owner, repo, number } = req.params;
      const result = await this.service.updateIssue(token, owner, repo, number, req.body);
      return res.json(result);
    } catch (err) {
      next(err);
    }
  };

  addComment = async (req, res, next) => {
    try {
      const token = requireToken(req, res);
      if (!token) return;
      const { owner, repo, number } = req.params;
      const result = await this.service.addComment(token, owner, repo, number, req.body?.body);
      return res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  };
}

export const issueController = new IssueController();
