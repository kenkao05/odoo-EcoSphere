import { useEffect, useState } from "react";
import { api } from "../../lib/api.js";
import { TabBar } from "../Environmental/index.jsx";
import GlassCard from "../../components/GlassCard.jsx";
import StatusBadge from "../../components/StatusBadge.jsx";
import { useAuth } from "../../context/AuthContext.jsx";

const TABS = ["Challenges", "Badges", "Rewards", "Leaderboard"];

export default function Gamification() {
  const [tab, setTab] = useState("Challenges");
  return (
    <div>
      <TabBar tabs={TABS} active={tab} onChange={setTab} />
      <div className="mt-4">
        {tab === "Challenges" && <Challenges />}
        {tab === "Badges" && <Badges />}
        {tab === "Rewards" && <Rewards />}
        {tab === "Leaderboard" && <Leaderboard />}
      </div>
    </div>
  );
}

function Challenges() {
  const [rows, setRows] = useState([]);
  const load = () => api.get("/challenges").then(({ data }) => setRows(data)).catch(() => {});
  useEffect(load, []);

  async function join(id) {
    await api.post(`/challenges/${id}/join`);
    alert("Joined! An admin will review your submission once you mark progress complete.");
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {rows.map((c) => (
        <GlassCard key={c.id}>
          <div className="flex justify-between items-start">
            <p className="font-semibold">{c.title}</p>
            <StatusBadge value={c.status} />
          </div>
          <p className="text-xs text-slate-400 mt-1">XP: {c.xp} · {c.difficulty} · Deadline {c.deadline}</p>
          {c.status === "active" && (
            <button onClick={() => join(c.id)} className="mt-3 bg-esg-overall text-white text-sm font-medium px-3 py-1.5 rounded-lg w-full">
              Join Challenge
            </button>
          )}
        </GlassCard>
      ))}
      {rows.length === 0 && <p className="text-slate-400 text-sm">No challenges yet.</p>}
    </div>
  );
}

// Auto-award engine runs server-side (badgeEngine.ts) whenever XP or
// completed-challenge count changes; this view is read-only, there's no
// "grant badge" button anywhere by design — PDF Section 8 says award is
// automatic, not admin-triggered, when the toggle is on.
function Badges() {
  const [rows, setRows] = useState([]);
  useEffect(() => { api.get("/badges").then(({ data }) => setRows(data)).catch(() => {}); }, []);
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {rows.map((b) => (
        <GlassCard key={b.id} className="text-center">
          <p className="font-semibold">{b.name}</p>
          <p className="text-xs text-slate-400 mt-1">{b.description}</p>
          <p className="text-[11px] text-slate-400 mt-2">
            Unlocks at {b.unlockRuleValue} {b.unlockRuleType === "xp_threshold" ? "XP" : "completed challenges"}
          </p>
        </GlassCard>
      ))}
    </div>
  );
}

function Rewards() {
  const [rows, setRows] = useState([]);
  const { employee } = useAuth();
  const load = () => api.get("/rewards").then(({ data }) => setRows(data)).catch(() => {});
  useEffect(load, []);

  async function redeem(id) {
    try {
      await api.post(`/rewards/${id}/redeem`);
      alert("Redeemed! Your points balance and the reward's stock have both updated.");
      load();
    } catch (err) {
      alert(err.response?.data?.error ?? "Redemption failed");
    }
  }

  return (
    <div>
      <p className="text-sm text-slate-500 mb-3">Your points balance: <strong>{employee?.pointsBalance ?? 0}</strong></p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {rows.map((r) => (
          <GlassCard key={r.id}>
            <p className="font-semibold">{r.name}</p>
            <p className="text-xs text-slate-400 mt-1">{r.pointsRequired} pts · {r.stock} in stock</p>
            <button
              onClick={() => redeem(r.id)}
              disabled={r.stock < 1}
              className="mt-3 bg-esg-social text-white text-sm font-medium px-3 py-1.5 rounded-lg w-full disabled:opacity-40"
            >
              {r.stock < 1 ? "Out of stock" : "Redeem"}
            </button>
          </GlassCard>
        ))}
      </div>
    </div>
  );
}

function Leaderboard() {
  const [rows, setRows] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [scope, setScope] = useState("");

  useEffect(() => { api.get("/departments").then(({ data }) => setDepartments(data)).catch(() => {}); }, []);
  useEffect(() => {
    api.get("/leaderboard", { params: scope ? { department: scope } : {} }).then(({ data }) => setRows(data)).catch(() => {});
  }, [scope]);

  return (
    <GlassCard>
      <div className="flex justify-between items-center mb-3">
        <h3 className="font-semibold">Leaderboard</h3>
        <select className="input w-48" value={scope} onChange={(e) => setScope(e.target.value)}>
          <option value="">Global</option>
          {departments.map((d) => <option key={d.id} value={d.id}>{d.name} (Eco-War)</option>)}
        </select>
      </div>
      {rows.map((r) => (
        <div key={r.employeeId} className="flex justify-between text-sm py-2 border-b border-surface-border last:border-0">
          <span>#{r.rank} {r.name} <span className="text-slate-400">· {r.departmentName}</span></span>
          <span className="font-medium">{r.xpTotal} XP</span>
        </div>
      ))}
    </GlassCard>
  );
}
