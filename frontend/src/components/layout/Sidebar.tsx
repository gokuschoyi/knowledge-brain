import { BrainCircuit, Files, GitBranch, LayoutDashboard, MessageSquare, Sparkles, Upload } from "lucide-react";
import { NavLink } from "react-router-dom";

const items = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/ingest", label: "Ingest", icon: Upload },
  { to: "/chat", label: "Chat", icon: MessageSquare },
  { to: "/graph", label: "Knowledge Graph", icon: GitBranch },
  { to: "/self-healing", label: "Self-Healing", icon: Sparkles },
  { to: "/documents", label: "Documents", icon: Files },
];

export function Sidebar() {
  return (
    <aside className="flex w-64 flex-col border-r border-slate-800 bg-slate-950 px-4 py-6">
      <div className="mb-8 flex items-center gap-3 text-white">
        <BrainCircuit className="h-6 w-6 text-cyan-400" />
        <div>
          <div className="text-sm font-semibold">Knowledge Brain</div>
          <div className="text-xs text-slate-400">Autonomous knowledge ops</div>
        </div>
      </div>
      <nav className="space-y-1">
        {items.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-md px-3 py-2 text-sm ${isActive ? "bg-slate-800 text-white" : "text-slate-400 hover:bg-slate-900 hover:text-white"}`
            }
          >
            <Icon className="h-4 w-4" />
            {label}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
