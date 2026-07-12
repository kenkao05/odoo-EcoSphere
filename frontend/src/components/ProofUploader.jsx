import { useState, useRef } from "react";
import { Paperclip, CheckCircle2, Loader2 } from "lucide-react";
import { uploadFile } from "../lib/api.js";

// endpoint: e.g. `/participation/${id}/proof` or `/challenge-participation/${id}/proof`
// Accepts JPEG/PNG/WebP/PDF up to 8MB — same limits enforced server-side in
// middleware/upload.ts, this just gives the user an earlier, friendlier error.
export default function ProofUploader({ endpoint, hasProof, onUploaded }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef(null);

  async function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) {
      setError("File too large (max 8MB).");
      return;
    }
    setError("");
    setBusy(true);
    try {
      await uploadFile(endpoint, file);
      onUploaded?.();
    } catch (err) {
      setError(err.response?.data?.error ?? "Upload failed.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  if (hasProof) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-emerald-600">
        <CheckCircle2 size={14} /> Attached
      </span>
    );
  }

  return (
    <div className="inline-flex flex-col items-start">
      <label className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-esg-env cursor-pointer">
        {busy ? <Loader2 size={14} className="animate-spin" /> : <Paperclip size={14} />}
        {busy ? "Uploading…" : "Attach proof"}
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,application/pdf"
          className="hidden"
          disabled={busy}
          onChange={handleFile}
        />
      </label>
      {error && <span className="text-xs text-red-500 mt-0.5">{error}</span>}
    </div>
  );
}
