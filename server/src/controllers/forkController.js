import { forkService } from "../services/forkService.js";
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

export class ForkController {
  constructor(service = forkService) {
    this.service = service;
  }

  forkAlbum = async (req, res, next) => {
    try {
      const token = requireToken(req, res);
      if (!token) return;
      const { owner, repo } = req.params;
      const result = await this.service.forkAlbum(token, req.user, owner, repo);
      return res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  };

  listUserForks = async (req, res, next) => {
    try {
      const token = requireToken(req, res);
      if (!token) return;
      const page = Math.max(1, parseInt(req.query.page || "1", 10));
      const perPage = Math.min(100, Math.max(1, parseInt(req.query.per_page || "30", 10)));
      const data = await this.service.listUserForks(token, req.user, { page, perPage });
      return res.json(data);
    } catch (err) {
      next(err);
    }
  };
}

export const forkController = new ForkController();
