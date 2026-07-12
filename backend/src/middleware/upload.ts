import multer from "multer";
import path from "path";
import fs from "fs";
import type { Request } from "express";

// All uploaded evidence (CSR proof, challenge proof) lands here. Created on
// boot if missing (see server.ts). Served statically at /uploads — see
// server.ts's `app.use("/uploads", express.static(UPLOAD_DIR))`.
export const UPLOAD_DIR = path.join(process.cwd(), "uploads");

if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
]);
const MAX_FILE_BYTES = 8 * 1024 * 1024; // 8MB — generous for a phone photo or a scanned PDF

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    // Never trust the original filename for the on-disk name (path traversal,
    // collisions, weird characters) -- generate our own, keep the extension
    // only for human/browser convenience when someone opens it directly.
    const ext = path.extname(file.originalname).toLowerCase();
    const safeName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
    cb(null, safeName);
  },
});

function fileFilter(_req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) {
  if (!ALLOWED_MIME.has(file.mimetype)) {
    return cb(new Error("UNSUPPORTED_FILE_TYPE"));
  }
  cb(null, true);
}

export const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_FILE_BYTES, files: 1 },
});

// Turns a saved file into the URL the frontend stores in proofUrl / documentPath.
// Relative, not absolute -- the frontend prefixes it with its own API base URL,
// so this works the same in local dev and behind whatever host you deploy to.
export function toPublicUrl(filename: string): string {
  return `/uploads/${filename}`;
}

// Shared Express error handler for multer-specific failures (wrong type, too
// large, etc.) -- without this, those errors fall through as unhandled 500s
// with a confusing stack trace instead of a message the frontend can show.
export function handleUploadError(err: unknown, _req: Request, res: any, next: any) {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(413).json({ error: "File too large. Maximum size is 8MB." });
    }
    return res.status(400).json({ error: `Upload error: ${err.message}` });
  }
  if (err instanceof Error && err.message === "UNSUPPORTED_FILE_TYPE") {
    return res.status(415).json({ error: "Unsupported file type. Use JPEG, PNG, WebP, or PDF." });
  }
  next(err);
}
