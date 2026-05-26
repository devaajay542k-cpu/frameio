"use client";

import { Folder, Users, Activity, Archive, Settings, Film, ShieldAlert, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface SidebarProps {
  className?: string;
  activeItem?: string;
  onItemSelect?: (item: string) => void;
}

export default function Sidebar({ className, activeItem = "projects", onItemSelect }: SidebarProps) {
  const menuItems = [
    { id: "projects", label: "My Projects", icon: Folder },
    { id: "shared", label: "Shared with Me", icon: Users },
    { id: "activity", label: "Team Activity", icon: Activity },
    { id: "archives", label: "Archives", icon: Archive },
    { id: "settings", label: "Settings", icon: Settings },
  ];

  return (
    <aside className={cn("w-64 border-r border-zinc-800/80 bg-[#09090b] flex flex-col h-[calc(100vh-3.5rem)] sticky top-14", className)}>
      <div className="flex-1 py-6 px-4 space-y-7">
        
        {/* Navigation Section */}
        <div>
          <h2 className="px-3 text-[10px] font-bold tracking-widest text-zinc-500 uppercase mb-3">
            Workspace
          </h2>
          <nav className="space-y-1">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeItem === item.id;

              return (
                <button
                  key={item.id}
                  onClick={() => onItemSelect?.(item.id)}
                  className={cn(
                    "flex w-full items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg transition-all duration-200",
                    isActive
                      ? "bg-zinc-900 text-indigo-400 font-semibold"
                      : "text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900/40"
                  )}
                >
                  <Icon className={cn("h-4.5 w-4.5", isActive ? "text-indigo-400" : "text-zinc-500")} />
                  {item.label}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Team Projects Section */}
        <div>
          <div className="flex items-center justify-between px-3 mb-3">
            <h2 className="text-[10px] font-bold tracking-widest text-zinc-500 uppercase">
              Recent Projects
            </h2>
          </div>
          <div className="space-y-1">
            <button className="flex w-full items-center gap-3 px-3 py-2 text-sm text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900/40 rounded-lg text-left transition-colors">
              <span className="h-2 w-2 rounded-full bg-violet-500" />
              <span className="truncate">Tears of Steel Movie</span>
            </button>
            <button className="flex w-full items-center gap-3 px-3 py-2 text-sm text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900/40 rounded-lg text-left transition-colors">
              <span className="h-2 w-2 rounded-full bg-amber-500" />
              <span className="truncate">Sintel Promos</span>
            </button>
            <button className="flex w-full items-center gap-3 px-3 py-2 text-sm text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900/40 rounded-lg text-left transition-colors">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              <span className="truncate">Animation Tests</span>
            </button>
          </div>
        </div>

      </div>

      {/* Footer Banner */}
      <div className="p-4 border-t border-zinc-800/60 bg-[#121214]/20">
        <div className="p-3.5 rounded-xl border border-zinc-800/80 bg-zinc-950 flex flex-col gap-2 shadow-inner">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4.5 w-4.5 text-amber-400" />
            <span className="text-xs font-semibold text-zinc-200">Aether Pro Plan</span>
          </div>
          <p className="text-[11px] text-zinc-500 leading-normal">
            Enable advanced frame controls, 4K rendering reviews, and multi-user sync.
          </p>
          <button className="w-full mt-1 bg-zinc-900 hover:bg-zinc-800 text-zinc-200 text-xs font-semibold py-1.5 px-3 rounded-lg border border-zinc-800/60 hover:border-zinc-700 transition-all duration-200">
            Upgrade Workspace
          </button>
        </div>
      </div>

    </aside>
  );
}
