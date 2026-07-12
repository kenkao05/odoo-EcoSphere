export default function ProgressBar({ value, colorClass = "bg-esg-env" }) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div className="w-full h-2 rounded-full bg-slate-200 overflow-hidden" role="progressbar" aria-valuenow={clamped} aria-valuemin={0} aria-valuemax={100}>
      <div className={`h-full ${colorClass} transition-all`} style={{ width: `${clamped}%` }} />
    </div>
  );
}
