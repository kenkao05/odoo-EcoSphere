const PALETTE = {
  active: "bg-emerald-100 text-emerald-700",
  on_track: "bg-emerald-100 text-emerald-700",
  completed: "bg-blue-100 text-blue-700",
  at_risk: "bg-amber-100 text-amber-700",
  draft: "bg-slate-100 text-slate-600",
  under_review: "bg-purple-100 text-purple-700",
  archived: "bg-slate-100 text-slate-500",
  pending: "bg-amber-100 text-amber-700",
  approved: "bg-emerald-100 text-emerald-700",
  rejected: "bg-red-100 text-red-700",
  open: "bg-red-100 text-red-700",
  resolved: "bg-emerald-100 text-emerald-700",
  low: "bg-slate-100 text-slate-600",
  medium: "bg-amber-100 text-amber-700",
  high: "bg-orange-100 text-orange-700",
  critical: "bg-red-100 text-red-700",
  inactive: "bg-slate-100 text-slate-500",
};

export default function StatusBadge({ value }) {
  const key = String(value ?? "").toLowerCase();
  const classes = PALETTE[key] || "bg-slate-100 text-slate-600";
  return (
    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${classes}`}>
      {String(value ?? "").replaceAll("_", " ")}
    </span>
  );
}
