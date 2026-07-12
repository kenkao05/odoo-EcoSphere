import { useEffect, useState } from "react";
import { api } from "../../lib/api.js";
import DataTable from "../../components/DataTable.jsx";
import Modal from "../../components/Modal.jsx";
import ProgressBar from "../../components/ProgressBar.jsx";
import StatusBadge from "../../components/StatusBadge.jsx";

const EMPTY_FORM = { name: "", departmentId: "", targetCo2: "", currentCo2: "0", deadline: "", status: "active" };

export default function Goals() {
  const [goals, setGoals] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});

  function load() {
    api.get("/goals").then(({ data }) => setGoals(data)).catch(() => {});
  }
  useEffect(() => {
    load();
    api.get("/departments").then(({ data }) => setDepartments(data)).catch(() => {});
  }, []);

  const filtered = goals.filter((g) => g.name.toLowerCase().includes(search.toLowerCase()));

  function openNew() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setErrors({});
    setModalOpen(true);
  }
  function openEdit(row) {
    setEditing(row);
    setForm({
      name: row.name, departmentId: String(row.departmentId), targetCo2: String(row.targetCo2),
      currentCo2: String(row.currentCo2), deadline: row.deadline, status: row.status,
    });
    setErrors({});
    setModalOpen(true);
  }

  // Mirrors the backend's environmentalGoalInsert zod schema (validation.ts)
  // client-side, so the user sees the error before a round-trip — the
  // server still re-validates, this is UX only, never a substitute.
  function validate() {
    const e = {};
    if (!form.name.trim()) e.name = "Required";
    if (!form.departmentId) e.departmentId = "Required";
    if (!form.targetCo2 || Number(form.targetCo2) <= 0) e.targetCo2 = "Must be a positive number";
    if (!form.deadline) e.deadline = "Required";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!validate()) return;
    const payload = {
      name: form.name,
      departmentId: Number(form.departmentId),
      targetCo2: Number(form.targetCo2),
      currentCo2: Number(form.currentCo2),
      deadline: form.deadline,
      status: form.status,
    };
    if (editing) {
      await api.put(`/goals/${editing.id}`, payload);
    } else {
      await api.post("/goals", payload);
    }
    setModalOpen(false);
    load();
  }

  async function handleDelete(row) {
    if (!confirm(`Delete goal "${row.name}"?`)) return;
    await api.delete(`/goals/${row.id}`);
    load();
  }

  const deptName = (id) => departments.find((d) => d.id === id)?.name ?? "—";

  const columns = [
    { key: "name", label: "Name" },
    { key: "departmentId", label: "Department", render: (r) => deptName(r.departmentId) },
    { key: "targetCo2", label: "Target CO₂", render: (r) => `${r.targetCo2} t` },
    { key: "currentCo2", label: "Current CO₂", render: (r) => `${r.currentCo2} t` },
    {
      key: "progress", label: "Progress",
      render: (r) => {
        const pct = r.targetCo2 > 0 ? Math.round((1 - r.currentCo2 / r.targetCo2) * 100) : 0;
        return <div className="w-32"><ProgressBar value={pct} /></div>;
      },
    },
    { key: "deadline", label: "Deadline" },
    { key: "status", label: "Status", render: (r) => <StatusBadge value={r.status} /> },
  ];

  return (
    <>
      <DataTable
        columns={columns}
        rows={filtered}
        onSearch={setSearch}
        onNew={openNew}
        onEdit={openEdit}
        onDelete={handleDelete}
        newLabel="New Goal"
      />

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? "Edit Goal" : "New Goal"}>
        <form onSubmit={handleSubmit} className="space-y-3">
          <Field label="Name" error={errors.name}>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input" />
          </Field>
          <Field label="Department" error={errors.departmentId}>
            <select value={form.departmentId} onChange={(e) => setForm({ ...form, departmentId: e.target.value })} className="input">
              <option value="">Select...</option>
              {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Target CO₂ (t)" error={errors.targetCo2}>
              <input type="number" step="0.01" value={form.targetCo2} onChange={(e) => setForm({ ...form, targetCo2: e.target.value })} className="input" />
            </Field>
            <Field label="Current CO₂ (t)">
              <input type="number" step="0.01" value={form.currentCo2} onChange={(e) => setForm({ ...form, currentCo2: e.target.value })} className="input" />
            </Field>
          </div>
          <Field label="Deadline" error={errors.deadline}>
            <input type="date" value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} className="input" />
          </Field>
          <Field label="Status">
            <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="input">
              {["active", "on_track", "at_risk", "completed"].map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </Field>
          <button type="submit" className="w-full bg-esg-env text-white font-medium py-2 rounded-lg mt-2">
            {editing ? "Save changes" : "Create goal"}
          </button>
        </form>
      </Modal>
    </>
  );
}

function Field({ label, error, children }) {
  return (
    <div>
      <label className="text-sm font-medium text-slate-600">{label}</label>
      <div className="mt-1">{children}</div>
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  );
}