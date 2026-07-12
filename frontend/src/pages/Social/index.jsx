import { useEffect, useState } from "react";
import { CheckCircle2, XCircle } from "lucide-react";
import { api } from "../../lib/api.js";
import { useAuth } from "../../context/AuthContext.jsx";
import { TabBar } from "../Environmental/index.jsx";
import DataTable from "../../components/DataTable.jsx";
import StatusBadge from "../../components/StatusBadge.jsx";
import GlassCard from "../../components/GlassCard.jsx";
import ProofUploader from "../../components/ProofUploader.jsx";

const TABS = ["CSR Activities", "My Submissions", "Employee Participation", "Diversity Dashboard"];

export default function Social() {
  const [tab, setTab] = useState("CSR Activities");
  return (
    <div>
      <TabBar tabs={TABS} active={tab} onChange={setTab} />
      <div className="mt-4">
        {tab === "CSR Activities" && <CsrActivities />}
        {tab === "My Submissions" && <MySubmissions />}
        {tab === "Employee Participation" && <ParticipationQueue />}
        {tab === "Diversity Dashboard" && <DiversityDashboard />}
      </div>
    </div>
  );
}

// Where an employee actually attaches evidence to their own CSR submission.
// The admin ParticipationQueue below is admin-only (server-enforced), so this
// is the only place a regular employee can reach their own participation
// rows and upload proof against them.
function MySubmissions() {
  const [rows, setRows] = useState([]);
  const load = () => api.get("/participation/mine").then(({ data }) => setRows(data)).catch(() => {});
  useEffect(load, []);

  if (rows.length === 0) {
    return <p className="text-slate-400 text-sm">You haven't joined any CSR activities yet — do that from the "CSR Activities" tab.</p>;
  }

  return (
    <div className="space-y-3">
      {rows.map((r) => (
        <GlassCard key={r.id} className="flex items-center justify-between">
          <div>
            <p className="font-medium">{r.activityTitle}</p>
            <p className="text-xs text-slate-400 mt-0.5">
              {r.evidenceRequired ? "Evidence required" : "Evidence optional"} · {r.pointsEarned ? `${r.pointsEarned} pts earned` : "Pending review"}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <StatusBadge value={r.approvalStatus} />
            <ProofUploader
              endpoint={`/participation/${r.id}/proof`}
              hasProof={!!r.proofUrl}
              onUploaded={load}
            />
          </div>
        </GlassCard>
      ))}
    </div>
  );
}

function CsrActivities() {
  const [activities, setActivities] = useState([]);
  const load = () => api.get("/csr-activities").then(({ data }) => setActivities(data)).catch(() => {});
  useEffect(load, []);

  async function join(id) {
    await api.post(`/csr-activities/${id}/join`);
    alert("Joined! Go to the \"My Submissions\" tab to attach proof if this activity requires evidence.");
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {activities.map((a) => (
        <GlassCard key={a.id}>
          <p className="font-semibold">{a.name}</p>
          <p className="text-xs text-slate-400 mt-1">{a.evidenceRequired ? "Evidence Required" : "Open"}</p>
          <button onClick={() => join(a.id)} className="mt-3 bg-esg-social text-white text-sm font-medium px-3 py-1.5 rounded-lg w-full">
            Join
          </button>
        </GlassCard>
      ))}
      {activities.length === 0 && <p className="text-slate-400 text-sm">No CSR activities yet.</p>}
    </div>
  );
}

// Admin approval queue. Approving is blocked server-side (422) if the
// activity requires evidence and no proofUrl is attached yet — this button
// just surfaces that same rule, it isn't the enforcement itself.
function ParticipationQueue() {
  const [rows, setRows] = useState([]);
  const load = () => api.get("/participation").then(({ data }) => setRows(data)).catch(() => {});
  useEffect(load, []);

  async function decide(id, decision) {
    try {
      await api.put(`/participation/${id}/decision`, { decision, points: 10 });
      load();
    } catch (err) {
      alert(err.response?.data?.error ?? "Action failed");
    }
  }

  const columns = [
    { key: "employeeId", label: "Employee" },
    { key: "csrActivityId", label: "Activity" },
    { key: "proofUrl", label: "Proof", render: (r) => (r.proofUrl ? "Attached" : "—") },
    { key: "pointsEarned", label: "Points" },
    { key: "approvalStatus", label: "Approval", render: (r) => <StatusBadge value={r.approvalStatus} /> },
    {
      key: "actions", label: "",
      render: (r) => r.approvalStatus === "pending" && (
        <div className="flex gap-2">
          <button onClick={() => decide(r.id, "approved")} className="text-emerald-500" aria-label="Approve"><CheckCircle2 size={18} /></button>
          <button onClick={() => decide(r.id, "rejected")} className="text-red-500" aria-label="Reject"><XCircle size={18} /></button>
        </div>
      ),
    },
  ];
  return <DataTable columns={columns} rows={rows} />;
}

// Aggregate-only per socialInsights.ts (buckets <5 employees suppressed
// server-side). Never render a per-employee gender/salary row here.
function DiversityDashboard() {
  const [data, setData] = useState(null);
  useEffect(() => { api.get("/diversity").then(({ data }) => setData(data)).catch(() => {}); }, []);
  if (!data) return <p className="text-slate-400 text-sm">Loading, or you don't have admin access to this view.</p>;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <GlassCard>
        <h3 className="font-semibold mb-2">Gender Distribution</h3>
        {data.genderDistribution.map((g) => (
          <div key={g.gender} className="flex justify-between text-sm py-1 border-b border-surface-border last:border-0">
            <span className="capitalize">{g.gender}</span><span>{g.count}</span>
          </div>
        ))}
      </GlassCard>
      <GlassCard>
        <h3 className="font-semibold mb-2">Age Distribution</h3>
        {data.ageDistribution.map((a) => (
          <div key={a.age_band} className="flex justify-between text-sm py-1 border-b border-surface-border last:border-0">
            <span>{a.age_band}</span><span>{a.count}</span>
          </div>
        ))}
      </GlassCard>
      <p className="text-xs text-slate-400 md:col-span-2">{data.note}</p>
    </div>
  );
}
