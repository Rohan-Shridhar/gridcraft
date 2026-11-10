import { albumService } from "../services/albumService.js";
import { getSessionAccessToken } from "../middleware/auth.js";

export class AlbumController {
  constructor(service = albumService) {
    this.service = service;
  }

  listAlbums = async (req, res, next) => {
    try {
      const token = getSessionAccessToken(req);
      if (!token) {
        return res.status(401).json({
          error: { code: "UNAUTHORIZED", message: "Missing or invalid session token." },
        });
      }

      const page = Math.max(1, parseInt(req.query.page || "1", 10));
      const perPage = Math.min(100, Math.max(1, parseInt(req.query.per_page || "30", 10)));

      const data = await this.service.listAlbums(token, { page, perPage });
      return res.json(data);
    } catch (err) {
      next(err);
    }
  };

  createAlbum = async (req, res, next) => {
    try {
      const token = getSessionAccessToken(req);
      if (!token) {
        return res.status(401).json({
          error: { code: "UNAUTHORIZED", message: "Missing or invalid session token." },
        });
      }

      const result = await this.service.createAlbum(token, req.user, req.body);
      return res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  };

  getAlbum = async (req, res, next) => {
    try {
      const token = getSessionAccessToken(req);
      if (!token) {
        return res.status(401).json({
          error: { code: "UNAUTHORIZED", message: "Missing or invalid session token." },
        });
      }

      const { owner, repo } = req.params;
      const data = await this.service.getAlbum(token, owner, repo);
      return res.json(data);
    } catch (err) {
      next(err);
    }
  };

  updateAlbum = async (req, res, next) => {
    try {
      const token = getSessionAccessToken(req);
      if (!token) {
        return res.status(401).json({
          error: { code: "UNAUTHORIZED", message: "Missing or invalid session token." },
        });
      }

      const { owner, repo } = req.params;
      const data = await this.service.updateAlbum(token, owner, repo, req.body);
      return res.json(data);
    } catch (err) {
      next(err);
    }
  };

  deleteAlbum = async (req, res, next) => {
    try {
      const token = getSessionAccessToken(req);
      if (!token) {
        return res.status(401).json({
          error: { code: "UNAUTHORIZED", message: "Missing or invalid session token." },
        });
      }

      const { owner, repo } = req.params;
      const { confirmName } = req.body;

      const data = await this.service.deleteAlbum(token, owner, repo, confirmName);
      return res.json(data);
    } catch (err) {
      next(err);
    }
  };

  listCommits = async (req, res, next) => {
    try {
      const token = getSessionAccessToken(req);
      if (!token) {
        return res.status(401).json({
          error: { code: "UNAUTHORIZED", message: "Missing or invalid session token." },
        });
      }

      const { owner, repo } = req.params;
      const branch = req.query.branch || "master";
      const commits = await this.service.listCommits(token, owner, repo, branch);
      return res.json({ commits });
    } catch (err) {
      next(err);
    }
  };

  getTree = async (req, res, next) => {
    try {
      const token = getSessionAccessToken(req);
      if (!token) {
        return res.status(401).json({
          error: { code: "UNAUTHORIZED", message: "Missing or invalid session token." },
        });
      }

      const { owner, repo } = req.params;
      const branch = req.query.branch || "master";
      const tree = await this.service.getTree(token, owner, repo, branch);
      return res.json({ tree });
    } catch (err) {
      next(err);
    }
  };

  initializeRepo = async (req, res, next) => {
    try {
      const token = getSessionAccessToken(req);
      if (!token) {
        return res.status(401).json({
          error: { code: "UNAUTHORIZED", message: "Missing or invalid session token." },
        });
      }

      const { owner, repo } = req.params;
      const result = await this.service.initializeExistingRepo(token, req.user, owner, repo);
      return res.json(result);
    } catch (err) {
      next(err);
    }
  };
}

export const albumController = new AlbumController();
