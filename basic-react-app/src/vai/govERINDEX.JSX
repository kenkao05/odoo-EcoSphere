import { useEffect, useState } from "react";
import { api } from "../../lib/api.js";
import { TabBar } from "../Environmental/index.jsx";
import DataTable from "../../components/DataTable.jsx";
import Modal from "../../components/Modal.jsx";
import StatusBadge from "../../components/StatusBadge.jsx";

const TABS = ["Policies", "Policy Acknowledgements", "Audits", "Compliance Issues"];

export default function Governance() {
  const [tab, setTab] = useState("Compliance Issues");
  return (
    <div>
      <TabBar tabs={TABS} active={tab} onChange={setTab} />
      <div className="mt-4">
        {tab === "Policies" && <Policies />}
        {tab === "Policy Acknowledgements" && <PolicyAcks />}
        {tab === "Audits" && <Audits />}
        {tab === "Compliance Issues" && <ComplianceIssues />}
      </div>
    </div>
  );
}

function Policies() {
  const [rows, setRows] = useState([]);
  useEffect(() => { api.get("/policies").then(({ data }) => setRows(data)).catch(() => {}); }, []);
  const columns = [
    { key: "title", label: "Title" }, { key: "category", label: "Category" },
    { key: "version", label: "Version" }, { key: "effectiveDate", label: "Effective Date" },
    { key: "status", label: "Status", render: (r) => <StatusBadge value={r.status} /> },
  ];
  return <DataTable columns={columns} rows={rows} />;
}

function PolicyAcks() {
  const [rows, setRows] = useState([]);
  useEffect(() => { api.get("/policy-acknowledgements").then(({ data }) => setRows(data)).catch(() => {}); }, []);
  const columns = [
    { key: "policyTitle", label: "Policy" }, { key: "employeeName", label: "Employee" },
    { key: "acknowledgedAt", label: "Acknowledged", render: (r) => (r.acknowledgedAt ? new Date(r.acknowledgedAt).toLocaleDateString() : "Pending") },
  ];
  return <DataTable columns={columns} rows={rows} />;
}

function Audits() {
  const [rows, setRows] = useState([]);
  useEffect(() => { api.get("/audits").then(({ data }) => setRows(data)).catch(() => {}); }, []);
  const columns = [
    { key: "title", label: "Title" }, { key: "departmentId", label: "Department" },
    { key: "auditor", label: "Auditor" }, { key: "date", label: "Date" },
    { key: "findings", label: "Findings" },
    { key: "status", label: "Status", render: (r) => <StatusBadge value={r.status} /> },
  ];
  return <DataTable columns={columns} rows={rows} />;
}

const EMPTY_FORM = { title: "", departmentId: "", ownerId: "", severity: "medium", dueDate: "", description: "" };

// This is the wireframe gap called out explicitly in the PDF (Section 8:
// Owner + Due Date "not optional"). The columns below exist here on purpose,
// where the original mockup had neither.
function ComplianceIssues() {
  const [rows, setRows] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});

  const load = () => api.get("/compliance-issues").then(({ data }) => setRows(data)).catch(() => {});
  useEffect(() => {
    load();
    api.get("/departments").then(({ data }) => setDepartments(data)).catch(() => {});
    api.get("/employees").then(({ data }) => setEmployees(data)).catch(() => {});
  }, []);

  function validate() {
    const e = {};
    if (!form.title.trim()) e.title = "Required";
    if (!form.departmentId) e.departmentId = "Required";
    if (!form.ownerId) e.ownerId = "Owner is required — PDF Section 8 business rule";
    if (!form.dueDate) e.dueDate = "Due date is required — PDF Section 8 business rule";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!validate()) return;
    await api.post("/compliance-issues", {
      title: form.title, departmentId: Number(form.departmentId), ownerId: Number(form.ownerId),
      severity: form.severity, dueDate: form.dueDate, description: form.description,
    });
    setModalOpen(false);
    setForm(EMPTY_FORM);
    load();
  }

  const empName = (id) => employees.find((e) => e.id === id)?.name ?? id;
  const deptName = (id) => departments.find((d) => d.id === id)?.name ?? id;

  const columns = [
    { key: "title", label: "Issue" },
    { key: "severity", label: "Severity", render: (r) => <StatusBadge value={r.severity} /> },
    { key: "departmentId", label: "Department", render: (r) => deptName(r.departmentId) },
    { key: "ownerId", label: "Owner", render: (r) => empName(r.ownerId) },
    { key: "dueDate", label: "Due Date" },
    { key: "status", label: "Status", render: (r) => <StatusBadge value={r.status} /> },
  ];

  return (
    <>
      <DataTable columns={columns} rows={rows} onNew={() => setModalOpen(true)} newLabel="New Issue" />
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="New Compliance Issue">
        <form onSubmit={handleSubmit} className="space-y-3">
          <F label="Issue title" error={errors.title}><input className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></F>
          <F label="Department" error={errors.departmentId}>
            <select className="input" value={form.departmentId} onChange={(e) => setForm({ ...form, departmentId: e.target.value })}>
              <option value="">Select...</option>
              {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </F>
          <F label="Owner (required)" error={errors.ownerId}>
            <select className="input" value={form.ownerId} onChange={(e) => setForm({ ...form, ownerId: e.target.value })}>
              <option value="">Select...</option>
              {employees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
          </F>
          <F label="Due date (required)" error={errors.dueDate}>
            <input type="date" className="input" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} />
          </F>
          <F label="Severity">
            <select className="input" value={form.severity} onChange={(e) => setForm({ ...form, severity: e.target.value })}>
              {["low", "medium", "high", "critical"].map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </F>
          <F label="Description"><textarea className="input" rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></F>
          <button type="submit" className="w-full bg-esg-gov text-white font-medium py-2 rounded-lg">Raise issue</button>
        </form>
      </Modal>
    </>
  );
}

function F({ label, error, children }) {
  return (
    <div>
      <label className="text-sm font-medium text-slate-600">{label}</label>
      <div className="mt-1">{children}</div>
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  );
}