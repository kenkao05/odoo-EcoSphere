import { NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  LayoutDashboard, Leaf, Users, ShieldCheck, Trophy, FileBarChart, Settings as SettingsIcon,
  Bell, LogOut,
} from "lucide-react";
import { useAuth } from "../context/AuthContext.jsx";

const NAV = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/environmental", label: "Environmental", icon: Leaf },
  { to: "/social", label: "Social", icon: Users },
  { to: "/governance", label: "Governance", icon: ShieldCheck },
  { to: "/gamification", label: "Gamification", icon: Trophy },
  { to: "/reports", label: "Reports", icon: FileBarChart },
  { to: "/settings", label: "Settings", icon: SettingsIcon, adminOnly: true },
];

export default function Layout() {
  const { employee, isAdmin, notifications, logout } = useAuth();
  const navigate = useNavigate();
  const unread = notifications.filter((n) => !n.read).length;

  return (
    <div className="flex min-h-screen">
      <aside className="w-60 glass m-3 rounded-xl2 flex flex-col p-4 sticky top-3 h-[calc(100vh-1.5rem)]">
        <div className="flex items-center gap-2 mb-6 px-1">
          <div className="w-8 h-8 rounded-lg bg-esg-env flex items-center justify-center text-white font-display font-bold">E</div>
          <span className="font-display font-semibold text-lg">EcoSphere</span>
        </div>
        <nav className="flex-1 space-y-1">
          {NAV.filter((item) => !item.adminOnly || isAdmin).map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive ? "bg-esg-env/10 text-esg-env" : "text-slate-600 hover:bg-slate-100"
                }`
              }
            >
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
        </nav>
        <button
          onClick={() => { logout(); navigate("/login"); }}
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-slate-500 hover:bg-slate-100"
        >
          <LogOut size={18} /> Log out
        </button>
      </aside>

      <div className="flex-1 flex flex-col">
        <header className="glass m-3 ml-0 rounded-xl2 flex items-center justify-between px-5 py-3">
          <div />
          <div className="flex items-center gap-4">
            <button className="relative text-slate-500 hover:text-slate-800" aria-label="Notifications">
              <Bell size={20} />
              {unread > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center">
                  {unread}
                </span>
              )}
            </button>
            <div className="flex items-center gap-2 text-sm">
              <div className="w-8 h-8 rounded-full bg-esg-overall/10 text-esg-overall flex items-center justify-center font-semibold">
                {employee?.name?.[0]?.toUpperCase() ?? "?"}
              </div>
              <div>
                <p className="font-medium leading-none">{employee?.name}</p>
                <p className="text-xs text-slate-400 capitalize">{employee?.role}</p>
              </div>
            </div>
          </div>
        </header>
        <main className="flex-1 p-3 pt-0">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
