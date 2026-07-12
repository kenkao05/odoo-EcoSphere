import { useEffect, useState } from "react";
import { api } from "../../lib/api.js";
import { TabBar } from "../Environmental/index.jsx";
import DataTable from "../../components/DataTable.jsx";
import Modal from "../../components/Modal.jsx";
import GlassCard from "../../components/GlassCard.jsx";
import StatusBadge from "../../components/StatusBadge.jsx";

const TABS = ["Departments", "Categories", "ESG Configuration", "Notification Settings"];

export default function Settings() {
  const [tab, setTab] = useState("ESG Configuration");
  return (
    <div>
      <TabBar tabs={TABS} active={tab} onChange={setTab} />
      <div className="mt-4">
        {tab === "Departments" && <Departments />}
        {tab === "Categories" && <Categories />}
        {tab === "ESG Configuration" && <EsgConfiguration />}
        {tab === "Notification Settings" && <NotificationSettings />}
      </div>
    </div>
  );
}

const EMPTY_DEPT = { name: "", code: "", head: "" };

function Departments() {
  const [rows, setRows] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_DEPT);

  const load = () => api.get("/departments").then(({ data }) => setRows(data)).catch(() => {});
  useEffect(load, []);

  function openNew() { setEditing(null); setForm(EMPTY_DEPT); setModalOpen(true); }
  function openEdit(row) { setEditing(row); setForm({ name: row.name, code: row.code, head: row.head ?? "" }); setModalOpen(true); }

  async function handleSubmit(e) {
    e.preventDefault();
    if (editing) await api.put(`/departments/${editing.id}`, form);
    else await api.post("/departments", form);
    setModalOpen(false);
    load();
  }
  async function handleDelete(row) {
    if (!confirm(`Delete department "${row.name}"?`)) return;
    await api.delete(`/departments/${row.id}`);
    load();
  }

  const columns = [
    { key: "name", label: "Name" }, { key: "code", label: "Code" }, { key: "head", label: "Head" },
    { key: "employeeCount", label: "Employees" },
    { key: "status", label: "Status", render: (r) => <StatusBadge value={r.status} /> },
  ];

  return (
    <>
      <DataTable columns={columns} rows={rows} onNew={openNew} onEdit={openEdit} onDelete={handleDelete} newLabel="New Department" />
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? "Edit Department" : "New Department"}>
        <form onSubmit={handleSubmit} className="space-y-3">
          <input className="input" placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <input className="input" placeholder="Code" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} required />
          <input className="input" placeholder="Head" value={form.head} onChange={(e) => setForm({ ...form, head: e.target.value })} />
          <button type="submit" className="w-full bg-esg-env text-white font-medium py-2 rounded-lg">Save</button>
        </form>
      </Modal>
    </>
  );
}

function Categories() {
  const [rows, setRows] = useState([]);
  useEffect(() => { api.get("/categories").then(({ data }) => setRows(data)).catch(() => {}); }, []);
  const columns = [
    { key: "name", label: "Name" }, { key: "type", label: "Type" },
    { key: "status", label: "Status", render: (r) => <StatusBadge value={r.status} /> },
  ];
  return <DataTable columns={columns} rows={rows} />;
}

// The control the wireframe never had a home for, per the gap flagged
// earlier in this thread: the 40/30/30 weighting must be admin-editable and
// must sum to 100 (enforced both here and server-side in settings.ts).
function EsgConfiguration() {
  const [config, setConfig] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => { api.get("/settings/esg-configuration").then(({ data }) => setConfig(data)).catch(() => {}); }, []);
  if (!config) return null;

  const sum = Number(config.environmentalWeight) + Number(config.socialWeight) + Number(config.governanceWeight);

  async function save() {
    if (Math.round(sum) !== 100) { setError("Weights must sum to 100."); return; }
    setError("");
    await api.put("/settings/esg-configuration", {
      environmentalWeight: Number(config.environmentalWeight),
      socialWeight: Number(config.socialWeight),
      governanceWeight: Number(config.governanceWeight),
      autoEmissionCalc: config.autoEmissionCalc,
      evidenceRequiredForCsr: config.evidenceRequiredForCsr,
      autoAwardBadges: config.autoAwardBadges,
    });
    alert("Saved.");
  }

  return (
    <GlassCard className="max-w-lg">
      <h3 className="font-semibold mb-3">ESG Score Weighting</h3>
      {["environmentalWeight", "socialWeight", "governanceWeight"].map((key) => (
        <div key={key} className="mb-3">
          <label className="text-sm text-slate-600 capitalize">{key.replace("Weight", "")} %</label>
          <input
            type="number" className="input" value={config[key]}
            onChange={(e) => setConfig({ ...config, [key]: e.target.value })}
          />
        </div>
      ))}
      <p className={`text-xs mb-3 ${Math.round(sum) === 100 ? "text-slate-400" : "text-red-500"}`}>Sum: {sum} (must equal 100)</p>
      {error && <p className="text-xs text-red-500 mb-2">{error}</p>}

      <h3 className="font-semibold mb-2 mt-4">Toggles</h3>
      {[
        ["autoEmissionCalc", "Enable auto emission calculation"],
        ["evidenceRequiredForCsr", "Require evidence for all CSR activities"],
        ["autoAwardBadges", "Auto-award badges on challenge completion"],
      ].map(([key, label]) => (
        <label key={key} className="flex items-center gap-2 text-sm mb-2">
          <input type="checkbox" checked={config[key]} onChange={(e) => setConfig({ ...config, [key]: e.target.checked })} />
          {label}
        </label>
      ))}

      <button onClick={save} className="mt-3 bg-esg-env text-white font-medium py-2 rounded-lg w-full">Save configuration</button>
    </GlassCard>
  );
}

function NotificationSettings() {
  const [settings, setSettings] = useState(null);
  useEffect(() => { api.get("/settings/notification-settings").then(({ data }) => setSettings(data)).catch(() => {}); }, []);
  if (!settings) return null;

  async function save() {
    await api.put("/settings/notification-settings", {
      complianceAlerts: settings.complianceAlerts, approvalDecisions: settings.approvalDecisions,
      policyReminders: settings.policyReminders, badgeUnlocks: settings.badgeUnlocks,
    });
    alert("Saved.");
  }

  return (
    <GlassCard className="max-w-lg">
      <h3 className="font-semibold mb-3">Notification Settings</h3>
      {[
        ["complianceAlerts", "Email/in-app alerts for new compliance issues"],
        ["approvalDecisions", "CSR/Challenge approval decisions"],
        ["policyReminders", "Policy acknowledgement reminders"],
        ["badgeUnlocks", "Badge unlocks"],
      ].map(([key, label]) => (
        <label key={key} className="flex items-center gap-2 text-sm mb-2">
          <input type="checkbox" checked={settings[key]} onChange={(e) => setSettings({ ...settings, [key]: e.target.checked })} />
          {label}
        </label>
      ))}
      <button onClick={save} className="mt-3 bg-esg-env text-white font-medium py-2 rounded-lg w-full">Save</button>
    </GlassCard>
  );
}
