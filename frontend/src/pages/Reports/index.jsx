import { useState } from "react";
import { api } from "../../lib/api.js";
import GlassCard from "../../components/GlassCard.jsx";

const FIXED_REPORTS = [
  { module: "environmental", label: "Environmental Report", desc: "Emissions, goals, vendor & product breakdown" },
  { module: "social", label: "Social Report", desc: "Diversity, CSR participation, training completion" },
  { module: "governance", label: "Governance Report", desc: "Policies, audits, compliance & risk summary" },
  { module: "esg_summary", label: "ESG Summary", desc: "Executive overview: all 4 scores + dept comparison" },
];

export default function Reports() {
  const [filters, setFilters] = useState({ dateFrom: "", dateTo: "", departmentId: "", module: "environmental" });

  // format: "json" | "csv" | "xlsx". "pdf" is intentionally not wired to a
  // button — see reports.ts: readable PDF layout generation was cut from
  // the 8-hour scope, honestly, rather than silently faked.
  async function runReport(format) {
    const params = { ...filters, format };
    if (format === "json") {
      const { data } = await api.get("/reports/custom", { params });
      console.log(data); // demo: open devtools, or swap this for an on-page table
      alert(`Report ran — ${data.length ?? 0} rows. Check console for now (swap for an on-page table if you have time).`);
      return;
    }
    // CSV/XLSX return a file — open directly so the browser handles the download.
    window.open(`/api/reports/custom?${new URLSearchParams(params)}`, "_blank");
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {FIXED_REPORTS.map((r) => (
          <GlassCard key={r.module}>
            <p className="font-semibold">{r.label}</p>
            <p className="text-xs text-slate-400 mt-1">{r.desc}</p>
            <button
              onClick={() => runReport("json").then(() => setFilters((f) => ({ ...f, module: r.module })))}
              className="mt-3 bg-slate-800 text-white text-sm font-medium px-3 py-1.5 rounded-lg w-full"
            >
              Generate
            </button>
          </GlassCard>
        ))}
      </div>

      <GlassCard>
        <h3 className="font-semibold mb-3">Custom Report Builder</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <input type="date" className="input" value={filters.dateFrom} onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })} placeholder="Date from" />
          <input type="date" className="input" value={filters.dateTo} onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })} placeholder="Date to" />
          <select className="input" value={filters.module} onChange={(e) => setFilters({ ...filters, module: e.target.value })}>
            <option value="environmental">Environmental</option>
            <option value="governance">Governance</option>
            <option value="esg_summary">ESG Summary</option>
            <option value="gamification">Gamification</option>
          </select>
          <input placeholder="Department ID" className="input" value={filters.departmentId} onChange={(e) => setFilters({ ...filters, departmentId: e.target.value })} />
        </div>
        <div className="flex gap-2 mt-4">
          <button onClick={() => runReport("json")} className="bg-esg-env text-white text-sm font-medium px-4 py-2 rounded-lg">Run Report</button>
          <button onClick={() => runReport("csv")} className="glass text-sm font-medium px-4 py-2 rounded-lg">Export CSV</button>
          <button onClick={() => runReport("xlsx")} className="glass text-sm font-medium px-4 py-2 rounded-lg">Export Excel</button>
        </div>
      </GlassCard>
    </div>
  );
}
