import { useEffect, useState } from "react";
import { api } from "../../lib/api.js";
import DataTable from "../../components/DataTable.jsx";
import Goals from "./Goals.jsx";

const TABS = ["Emission Factors", "Product ESG Profiles", "Carbon Transactions", "Environmental Goals"];

export default function Environmental() {
  const [tab, setTab] = useState("Environmental Goals");

  return (
    <div>
      <TabBar tabs={TABS} active={tab} onChange={setTab} />
      <div className="mt-4">
        {tab === "Emission Factors" && <EmissionFactors />}
        {tab === "Product ESG Profiles" && <ProductProfiles />}
        {tab === "Carbon Transactions" && <CarbonTransactions />}
        {tab === "Environmental Goals" && <Goals />}
      </div>
    </div>
  );
}

export function TabBar({ tabs, active, onChange }) {
  return (
    <div className="flex gap-2 flex-wrap">
      {tabs.map((t) => (
        <button
          key={t}
          onClick={() => onChange(t)}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            active === t ? "bg-esg-env text-white" : "glass text-slate-600 hover:bg-white/80"
          }`}
        >
          {t}
        </button>
      ))}
    </div>
  );
}

// GHG Protocol Scope 1/2/3 fields — schema decided since the PDF left this
// model undefined (see schema.ts comment). Uses the CRUD factory's
// /emission-factors endpoint; admin-only writes, everyone can read.
function EmissionFactors() {
  const [rows, setRows] = useState([]);
  useEffect(() => { api.get("/emission-factors").then(({ data }) => setRows(data)).catch(() => {}); }, []);
  const columns = [
    { key: "name", label: "Name" },
    { key: "scope", label: "Scope" },
    { key: "activityType", label: "Activity Type" },
    { key: "unit", label: "Unit" },
    { key: "co2ePerUnit", label: "kgCO₂e / unit" },
    { key: "source", label: "Source" },
  ];
  return <DataTable columns={columns} rows={rows} />;
}

function ProductProfiles() {
  const [rows, setRows] = useState([]);
  useEffect(() => { api.get("/products").then(({ data }) => setRows(data)).catch(() => {}); }, []);
  const columns = [
    { key: "name", label: "Product" },
    { key: "sku", label: "SKU" },
    { key: "footprintPerUnitKgCo2e", label: "Footprint (kgCO₂e/unit)" },
    { key: "sustainableSourcing", label: "Sustainable Sourcing", render: (r) => (r.sustainableSourcing ? "Yes" : "No") },
    { key: "recyclablePackaging", label: "Recyclable Packaging", render: (r) => (r.recyclablePackaging ? "Yes" : "No") },
  ];
  return <DataTable columns={columns} rows={rows} />;
}

// Manual-entry log; co2eAmount is always server-computed (quantity × factor),
// never trusted from the client — see environmental.ts POST /carbon-transactions.
function CarbonTransactions() {
  const [rows, setRows] = useState([]);
  useEffect(() => { api.get("/carbon-transactions").then(({ data }) => setRows(data)).catch(() => {}); }, []);
  const columns = [
    { key: "transactionDate", label: "Date" },
    { key: "sourceType", label: "Source" },
    { key: "quantity", label: "Quantity" },
    { key: "co2eAmount", label: "CO₂e (kg)" },
  ];
  return <DataTable columns={columns} rows={rows} />;
}
