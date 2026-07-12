import { useEffect, useState } from "react";
import { api } from "../lib/api.js";

// Public, unauthenticated page — reached via /whistleblower, outside
// ProtectedRoute in App.jsx. No sidebar, no login prompt: requiring auth
// here would attach an identity to every report via the session, which
// defeats the entire point of a whistleblower portal.
const CATEGORIES = [
  { value: "ethics", label: "Ethics" },
  { value: "safety", label: "Safety" },
  { value: "financial", label: "Financial" },
  { value: "harassment", label: "Harassment" },
  { value: "other", label: "Other" },
];

export default function WhistleblowerReport() {
  const [departments, setDepartments] = useState([]);
  const [category, setCategory] = useState("ethics");
  const [description, setDescription] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(null); // { id } once submitted

  useEffect(() => {
    api.get("/whistleblower/departments").then(({ data }) => setDepartments(data)).catch(() => {});
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (description.trim().length < 10) {
      setError("Please provide at least a few sentences of detail (10+ characters).");
      return;
    }
    setSubmitting(true);
    try {
      const { data } = await api.post("/whistleblower", {
        category,
        description: description.trim(),
        ...(departmentId ? { departmentId: Number(departmentId) } : {}),
      });
      setSubmitted(data);
    } catch (err) {
      setError(err.response?.data?.error ?? "Something went wrong submitting your report. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface px-4">
        <div className="glass rounded-xl2 p-8 w-full max-w-sm text-center">
          <div className="w-12 h-12 rounded-full bg-esg-social/10 text-esg-social flex items-center justify-center mx-auto mb-4 text-2xl">✓</div>
          <h1 className="font-display font-semibold text-lg mb-2">Report submitted</h1>
          <p className="text-sm text-slate-500">
            Your report has been received anonymously. No identifying information was collected or stored.
          </p>
          <p className="text-xs text-slate-400 mt-4">Reference: #{submitted.id}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface px-4 py-10">
      <div className="glass rounded-xl2 p-8 w-full max-w-md">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-9 h-9 rounded-lg bg-esg-gov flex items-center justify-center text-white font-display font-bold">E</div>
          <span className="font-display font-semibold text-xl">EcoSphere</span>
        </div>
        <h1 className="font-semibold text-lg mt-4">Whistleblower Report</h1>
        <p className="text-sm text-slate-500 mt-1 mb-6">
          This form is completely anonymous. No login is required, and no identifying
          information — name, email, IP address — is ever collected or stored.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-medium text-slate-600">Category</label>
            <select
              className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-esg-gov"
              value={category} onChange={(e) => setCategory(e.target.value)}
            >
              {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>

          <div>
            <label className="text-sm font-medium text-slate-600">
              Department <span className="text-slate-400 font-normal">(optional)</span>
            </label>
            <select
              className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-esg-gov"
              value={departmentId} onChange={(e) => setDepartmentId(e.target.value)}
            >
              <option value="">Prefer not to say</option>
              {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>

          <div>
            <label className="text-sm font-medium text-slate-600">What happened?</label>
            <textarea
              required rows={6} value={description} onChange={(e) => setDescription(e.target.value)}
              className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-esg-gov resize-none"
              placeholder="Describe what you observed, when, and any relevant details. Avoid including your own name or contact details."
            />
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}

          <button
            type="submit" disabled={submitting}
            className="w-full bg-esg-gov text-white font-medium py-2 rounded-lg hover:opacity-90 disabled:opacity-50"
          >
            {submitting ? "Submitting..." : "Submit report anonymously"}
          </button>
        </form>
      </div>
    </div>
  );
}
