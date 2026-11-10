import { artworkService } from "../services/artworkService.js";
import { getSessionAccessToken } from "../middleware/auth.js";
import { resolveBranch } from "../utils/githubClient.js";

export class ArtworkController {
  constructor(service = artworkService) {
    this.service = service;
  }

  listArtworks = async (req, res, next) => {
    try {
      const token = getSessionAccessToken(req);
      if (!token) {
        return res.status(401).json({
          error: { code: "UNAUTHORIZED", message: "Missing or invalid session token." },
        });
      }

      const { owner, repo } = req.params;
      const branch = resolveBranch(req);
      const artworks = await this.service.listArtworks(token, owner, repo, branch);
      return res.json({ artworks });
    } catch (err) {
      next(err);
    }
  };

  getArtwork = async (req, res, next) => {
    try {
      const token = getSessionAccessToken(req);
      if (!token) {
        return res.status(401).json({
          error: { code: "UNAUTHORIZED", message: "Missing or invalid session token." },
        });
      }

      const { owner, repo, artworkId } = req.params;
      const branch = resolveBranch(req);
      const data = await this.service.getArtwork(token, owner, repo, artworkId, branch);
      return res.json(data);
    } catch (err) {
      next(err);
    }
  };

  createArtwork = async (req, res, next) => {
    try {
      const token = getSessionAccessToken(req);
      if (!token) {
        return res.status(401).json({
          error: { code: "UNAUTHORIZED", message: "Missing or invalid session token." },
        });
      }

      const { owner, repo } = req.params;
      const branch = resolveBranch(req);
      const result = await this.service.createArtwork(
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

  saveArtwork = async (req, res, next) => {
    try {
      const token = getSessionAccessToken(req);
      if (!token) {
        return res.status(401).json({
          error: { code: "UNAUTHORIZED", message: "Missing or invalid session token." },
        });
      }

      const { owner, repo, artworkId } = req.params;
      const branch = resolveBranch(req);
      const result = await this.service.saveArtwork(
        token,
        req.user,
        owner,
        repo,
        artworkId,
        req.body,
        branch
      );
      return res.json(result);
    } catch (err) {
      next(err);
    }
  };

  deleteArtwork = async (req, res, next) => {
    try {
      const token = getSessionAccessToken(req);
      if (!token) {
        return res.status(401).json({
          error: { code: "UNAUTHORIZED", message: "Missing or invalid session token." },
        });
      }

      const { owner, repo, artworkId } = req.params;
      const sha = req.body?.sha || req.query?.sha;
      const branch = resolveBranch(req);
      const result = await this.service.deleteArtwork(
        token,
        req.user,
        owner,
        repo,
        artworkId,
        sha,
        branch
      );
      return res.json(result);
    } catch (err) {
      next(err);
    }
  };

  getArtworkHistory = async (req, res, next) => {
    try {
      const token = getSessionAccessToken(req);
      if (!token) {
        return res.status(401).json({
          error: { code: "UNAUTHORIZED", message: "Missing or invalid session token." },
        });
      }

      const { owner, repo, artworkId } = req.params;
      const branch = resolveBranch(req);
      const commits = await this.service.getArtworkHistory(token, owner, repo, artworkId, branch);
      return res.json({ commits });
    } catch (err) {
      next(err);
    }
  };

  renameArtwork = async (req, res, next) => {
    try {
      const token = getSessionAccessToken(req);
      if (!token) {
        return res.status(401).json({
          error: { code: "UNAUTHORIZED", message: "Missing or invalid session token." },
        });
      }

      const { owner, repo, artworkId } = req.params;
      const branch = resolveBranch(req);
      const result = await this.service.renameArtwork(token, req.user, owner, repo, artworkId, {
        newName: req.body?.newName || req.body?.name,
        sha: req.body?.sha,
        branch,
      });
      return res.json(result);
    } catch (err) {
      next(err);
    }
  };
}

export const artworkController = new ArtworkController();
