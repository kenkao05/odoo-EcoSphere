import { useEffect, useState } from "react";
import { api } from "../../lib/api.js";
import { TabBar } from "../Environmental/index.jsx";
import GlassCard from "../../components/GlassCard.jsx";
import StatusBadge from "../../components/StatusBadge.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import ProofUploader from "../../components/ProofUploader.jsx";

const TABS = ["Challenges", "My Submissions", "Badges", "Rewards", "Kudos", "Leaderboard"];

export default function Gamification() {
  const [tab, setTab] = useState("Challenges");
  return (
    <div>
      <TabBar tabs={TABS} active={tab} onChange={setTab} />
      <div className="mt-4">
        {tab === "Challenges" && <Challenges />}
        {tab === "My Submissions" && <MyChallengeSubmissions />}
        {tab === "Badges" && <Badges />}
        {tab === "Rewards" && <Rewards />}
        {tab === "Kudos" && <Kudos />}
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
    alert("Joined! Go to the \"My Submissions\" tab to attach proof and track approval.");
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

// Same purpose as Social's MySubmissions: the only place an employee can
// reach their own challenge participation rows and attach proof. The admin
// list at GET /challenge-participation is admin-only.
function MyChallengeSubmissions() {
  const [rows, setRows] = useState([]);
  const load = () => api.get("/challenge-participation/mine").then(({ data }) => setRows(data)).catch(() => {});
  useEffect(load, []);

  if (rows.length === 0) {
    return <p className="text-slate-400 text-sm">You haven't joined any challenges yet — do that from the "Challenges" tab.</p>;
  }

  return (
    <div className="space-y-3">
      {rows.map((r) => (
        <GlassCard key={r.id} className="flex items-center justify-between">
          <div>
            <p className="font-medium">{r.challengeTitle}</p>
            <p className="text-xs text-slate-400 mt-0.5">
              {r.evidenceRequired ? "Evidence required" : "Evidence optional"} · {r.xpAwarded ? `${r.xpAwarded} XP awarded` : "Pending review"}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <StatusBadge value={r.approvalStatus} />
            <ProofUploader
              endpoint={`/challenge-participation/${r.id}/proof`}
              hasProof={!!r.proofUrl}
              onUploaded={load}
            />
          </div>
        </GlassCard>
      ))}
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

// v3 fix: backend (/kudos, /kudos/feed) existed with no way to reach it —
// this tab is the fix. /employees/directory (also added in v3) is the only
// employee-list endpoint a non-admin can call, since GET /employees is
// admin-only and returns full records this picker doesn't need.
function Kudos() {
  const { employee } = useAuth();
  const [directory, setDirectory] = useState([]);
  const [feed, setFeed] = useState([]);
  const [toEmployeeId, setToEmployeeId] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);

  const load = () => {
    api.get("/employees/directory").then(({ data }) => setDirectory(data)).catch(() => {});
    api.get("/kudos/feed").then(({ data }) => setFeed(data)).catch(() => {});
  };
  useEffect(load, []);

  const nameOf = (id) => directory.find((d) => d.id === id)?.name ?? `#${id}`;
  const colleagues = directory.filter((d) => d.id !== employee?.id);

  async function send(e) {
    e.preventDefault();
    setError("");
    if (!toEmployeeId) { setError("Pick a colleague first."); return; }
    if (!message.trim()) { setError("Say what it's for."); return; }
    setSending(true);
    try {
      await api.post("/kudos", { toEmployeeId: Number(toEmployeeId), message: message.trim() });
      setToEmployeeId("");
      setMessage("");
      load();
    } catch (err) {
      setError(err.response?.data?.error ?? "Couldn't send kudos.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <GlassCard>
        <h3 className="font-semibold mb-3">Give kudos</h3>
        <form onSubmit={send} className="space-y-3">
          <select
            className="input" value={toEmployeeId}
            onChange={(e) => setToEmployeeId(e.target.value)}
          >
            <option value="">Pick a colleague...</option>
            {colleagues.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          <textarea
            rows={3} maxLength={200} value={message} onChange={(e) => setMessage(e.target.value)}
            className="input resize-none" placeholder="What did they do? (max 200 chars)"
          />
          {error && <p className="text-xs text-red-500">{error}</p>}
          <button
            type="submit" disabled={sending}
            className="bg-esg-social text-white text-sm font-medium py-2 rounded-lg w-full disabled:opacity-50"
          >
            {sending ? "Sending..." : "Send kudos (+5 pts)"}
          </button>
        </form>
      </GlassCard>

      <GlassCard>
        <h3 className="font-semibold mb-3">Recent kudos</h3>
        <div className="space-y-3 max-h-80 overflow-y-auto">
          {feed.map((k) => (
            <div key={k.id} className="text-sm border-b border-surface-border last:border-0 pb-2">
              <p><span className="font-medium">{nameOf(k.fromEmployeeId)}</span> → <span className="font-medium">{nameOf(k.toEmployeeId)}</span></p>
              <p className="text-slate-500 text-xs mt-0.5">{k.message}</p>
            </div>
          ))}
          {feed.length === 0 && <p className="text-slate-400 text-sm">No kudos given yet.</p>}
        </div>
      </GlassCard>
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
