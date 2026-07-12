import { useState } from "react";
import { Search, Pencil, Trash2, Plus } from "lucide-react";

// columns: [{ key, label, render?: (row) => node }]
// Reused by every simple master-data page (Departments, Categories, Emission
// Factors, Products, Policies, Badges, Rewards, Audits) instead of a bespoke
// table per page — mirrors the backend's crudFactory.ts one-implementation
// approach on the frontend side.
export default function DataTable({ columns, rows, onSearch, onNew, onEdit, onDelete, newLabel = "New" }) {
  const [search, setSearch] = useState("");

  function handleSearch(e) {
    const value = e.target.value;
    setSearch(value);
    onSearch?.(value);
  }

  return (
    <div className="solid-surface rounded-xl2 overflow-hidden">
      <div className="flex items-center justify-between p-4 border-b border-surface-border gap-3">
        <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 flex-1 max-w-xs">
          <Search size={16} className="text-slate-400" />
          <input
            value={search}
            onChange={handleSearch}
            placeholder="Search..."
            className="bg-transparent outline-none text-sm w-full"
          />
        </div>
        {onNew && (
          <button
            onClick={onNew}
            className="flex items-center gap-1.5 bg-esg-env text-white text-sm font-medium px-3 py-1.5 rounded-lg hover:opacity-90"
          >
            <Plus size={16} /> {newLabel}
          </button>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 text-slate-500 text-left">
              {columns.map((col) => (
                <th key={col.key} className="px-4 py-2.5 font-medium">{col.label}</th>
              ))}
              {(onEdit || onDelete) && <th className="px-4 py-2.5" />}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={columns.length + 1} className="px-4 py-8 text-center text-slate-400">
                  Nothing here yet.
                </td>
              </tr>
            )}
            {rows.map((row) => (
              <tr key={row.id} className="border-t border-surface-border hover:bg-slate-50/60">
                {columns.map((col) => (
                  <td key={col.key} className="px-4 py-2.5">
                    {col.render ? col.render(row) : row[col.key]}
                  </td>
                ))}
                {(onEdit || onDelete) && (
                  <td className="px-4 py-2.5">
                    <div className="flex gap-2 justify-end">
                      {onEdit && (
                        <button onClick={() => onEdit(row)} className="text-slate-400 hover:text-esg-env" aria-label="Edit">
                          <Pencil size={15} />
                        </button>
                      )}
                      {onDelete && (
                        <button onClick={() => onDelete(row)} className="text-slate-400 hover:text-red-500" aria-label="Delete">
                          <Trash2 size={15} />
                        </button>
                      )}
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}