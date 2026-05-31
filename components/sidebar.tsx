"use client";

import { useEffect, useState } from "react";
import {
  Folder,
  Users,
  Building2,
  ChevronDown,
  ChevronRight,
  Plus,
  Settings,
  LayoutDashboard,
  Mail,
  Search,
  LogOut,
  User,
  Shield
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import { useRouter, useParams, usePathname, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface SidebarProps {
  className?: string;
  activeItem?: string;
  onItemSelect?: (item: string) => void;
}

export default function Sidebar({ className }: SidebarProps) {
  const router = useRouter();
  const params = useParams();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentTab = searchParams.get("tab");

  const orgIdParam = params?.organizationId as string;
  const projectIdParam = params?.projectId as string;
  const videoIdParam = params?.videoId as string;

  const [userId, setUserId] = useState<string | null>(null);
  const [userMeta, setUserMeta] = useState<{ name: string; email: string; avatarUrl?: string } | null>(null);
  const [organizations, setOrganizations] = useState<any[]>([]);
  const [activeOrg, setActiveOrg] = useState<any>(null);
  const [projects, setProjects] = useState<any[]>([]);
  const [loadingOrgs, setLoadingOrgs] = useState(true);

  // Revamp States
  const [projectsCollapsed, setProjectsCollapsed] = useState(false);
  const [projectSearch, setProjectSearch] = useState("");
  const [memberCount, setMemberCount] = useState<number | null>(null);
  const [inviteCount, setInviteCount] = useState<number | null>(null);

  // Load auth state
  useEffect(() => {
    async function getAuth() {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setUserId(session.user.id);
        const meta = session.user.user_metadata || {};
        setUserMeta({
          name: meta.full_name || meta.name || session.user.email?.split("@")[0] || "User",
          email: session.user.email || "",
          avatarUrl: meta.avatar_url || "",
        });
      }
    }
    getAuth();
  }, []);

  // Fetch orgs
  useEffect(() => {
    if (!userId) return;
    async function fetchOrgs() {
      try {
        const { data, error } = await supabase
          .from("organization_members")
          .select("organization_id, role, organizations(*)")
          .eq("user_id", userId);
        if (error) throw error;
        if (data) {
          const orgList = data.map((item: any) => ({
            ...item.organizations,
            memberRole: item.role,
          })).filter(Boolean);
          setOrganizations(orgList);
          if (orgList.length > 0) {
            let active = orgList[0];
            if (orgIdParam) {
              const matched = orgList.find((o: any) => o.id === orgIdParam);
              if (matched) active = matched;
            } else if (projectIdParam) {
              const { data: proj } = await supabase.from("projects").select("organization_id").eq("id", projectIdParam).maybeSingle();
              if (proj) { const m = orgList.find((o: any) => o.id === proj.organization_id); if (m) active = m; }
            } else if (videoIdParam) {
              const { data: vid } = await supabase.from("videos").select("project_id").eq("id", videoIdParam).maybeSingle();
              if (vid?.project_id) {
                const { data: proj } = await supabase.from("projects").select("organization_id").eq("id", vid.project_id).maybeSingle();
                if (proj) { const m = orgList.find((o: any) => o.id === proj.organization_id); if (m) active = m; }
              }
            } else {
              const stored = localStorage.getItem("shotflow_active_org");
              if (stored) { const m = orgList.find((o: any) => o.id === stored); if (m) active = m; }
            }
            setActiveOrg(active);
            localStorage.setItem("shotflow_active_org", active.id);
          }
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoadingOrgs(false);
      }
    }
    fetchOrgs();
  }, [userId, orgIdParam, projectIdParam, videoIdParam]);

  // Fetch projects and stats
  useEffect(() => {
    if (!activeOrg?.id || !userId) return;
    async function fetchProjects() {
      try {
        const { data: allProjects } = await supabase.from("projects").select("*").eq("organization_id", activeOrg.id).order("created_at", { ascending: false });
        if (activeOrg.memberRole === "owner" || activeOrg.memberRole === "admin") {
          setProjects(allProjects || []);
        } else {
          const { data: pm } = await supabase.from("project_members").select("project_id").eq("user_id", userId);
          const ids = pm?.map((p: any) => p.project_id) || [];
          setProjects((allProjects || []).filter((p: any) => ids.includes(p.id)));
        }
      } catch (err) { console.error(err); }
    }
    
    // Fetch members count
    supabase
      .from("organization_members")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", activeOrg.id)
      .then(({ count }) => setMemberCount(count));

    // Fetch pending invites count
    supabase
      .from("organization_invites")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", activeOrg.id)
      .eq("accepted", false)
      .then(({ count }) => setInviteCount(count));

    fetchProjects();
  }, [activeOrg, userId]);

  const handleOrgChange = (orgId: string) => {
    const selected = organizations.find((o) => o.id === orgId);
    if (selected) {
      setActiveOrg(selected);
      localStorage.setItem("shotflow_active_org", selected.id);
      router.push(`/organizations/${selected.id}`);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "?");

  // Filtering projects
  const filteredProjects = projects.filter((project) =>
    project.name.toLowerCase().includes(projectSearch.toLowerCase())
  );

  return (
    <aside className={cn(
      "w-56 border-r border-zinc-800/80 bg-[#09090b] flex flex-col h-[calc(100vh-3.5rem)] sticky top-14 select-none",
      className
    )}>

      {/* Org Switcher Header */}
      <div className="px-4 py-4 border-b border-zinc-850">
        {loadingOrgs ? (
          <div className="h-8 rounded-lg bg-zinc-900/60 animate-pulse w-full border border-zinc-850" />
        ) : activeOrg ? (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <button className="flex w-full items-center justify-between px-2.5 py-2 rounded-lg bg-zinc-950/30 hover:bg-zinc-900 border border-zinc-850 hover:border-zinc-800 transition-all cursor-pointer group text-left outline-hidden" />
              }
            >
              <div className="flex items-center gap-2 min-w-0">
                <div className="flex h-5.5 w-5.5 shrink-0 items-center justify-center rounded bg-indigo-600/10 border border-indigo-500/20 text-indigo-400 font-bold text-[9px] uppercase tracking-wide">
                  {activeOrg.name.slice(0, 2)}
                </div>
                <div className="text-left min-w-0">
                  <p className="text-xs font-semibold text-zinc-100 truncate leading-none">{activeOrg.name}</p>
                </div>
              </div>
              <ChevronDown className="h-3.5 w-3.5 text-zinc-550 group-hover:text-zinc-350 transition-colors shrink-0" />
            </DropdownMenuTrigger>
            <DropdownMenuContent
              className="w-50 border-zinc-850 bg-[#121214]/95 backdrop-blur-md text-zinc-100 shadow-2xl rounded-xl p-1"
              align="start"
            >
              <span className="text-[9px] uppercase font-bold tracking-wider text-zinc-550 px-2 py-1 block">
                Organizations
              </span>
              {organizations.map((org) => (
                <DropdownMenuItem
                  key={org.id}
                  onClick={() => handleOrgChange(org.id)}
                  className="text-xs text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900 rounded-lg px-2 py-1.5 cursor-pointer transition-colors focus:bg-zinc-900 focus:text-zinc-100"
                >
                  <div className="flex items-center gap-2">
                    <div className="flex h-4.5 w-4.5 items-center justify-center rounded bg-indigo-600/10 text-indigo-400 text-[8px] font-bold uppercase">
                      {org.name.slice(0, 2)}
                    </div>
                    <span className="truncate max-w-[140px]">{org.name}</span>
                  </div>
                </DropdownMenuItem>
              ))}
              <div className="border-t border-zinc-850 my-1" />
              <DropdownMenuItem
                onClick={() => router.push("/orgs")}
                className="text-xs text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900 rounded-lg px-2 py-1.5 cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5 mr-1.5" />
                <span>Create Organization</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <Link
            href="/orgs"
            className="flex items-center gap-1.5 px-2.5 py-2 rounded-lg bg-zinc-950/30 hover:bg-zinc-900 border border-zinc-850 text-zinc-450 hover:text-zinc-200 transition-colors text-xs font-semibold"
          >
            <Plus className="h-3.5 w-3.5 text-indigo-400" />
            New Organization
          </Link>
        )}
      </div>

      {/* Main Navigation Area */}
      <div className="flex-1 overflow-y-auto py-5 px-4 space-y-6 scrollbar-thin scrollbar-thumb-zinc-800">

        {/* Global Navigation Links */}
        <div className="space-y-2">
          <NavItem
            href="/orgs"
            icon={LayoutDashboard}
            label="Dashboard"
            active={isActive("/orgs")}
          />
          {activeOrg && (
            <>
              <NavItem
                href={`/organizations/${activeOrg.id}`}
                icon={Folder}
                label="Projects"
                count={projects.length}
                active={pathname === `/organizations/${activeOrg.id}` && (currentTab === "projects" || !currentTab)}
              />
              <NavItem
                href={`/organizations/${activeOrg.id}?tab=members`}
                icon={Users}
                label="Members"
                count={memberCount || undefined}
                active={pathname === `/organizations/${activeOrg.id}` && currentTab === "members"}
              />
              {(activeOrg.memberRole === "owner" || activeOrg.memberRole === "admin") && (
                <NavItem
                  href={`/organizations/${activeOrg.id}?tab=invites`}
                  icon={Mail}
                  label="Pending Invites"
                  count={inviteCount || undefined}
                  active={pathname === `/organizations/${activeOrg.id}` && currentTab === "invites"}
                />
              )}
            </>
          )}
        </div>

        {/* Inline Projects List Section */}
        {activeOrg && (
          <div className="space-y-2 pt-2 border-t border-zinc-850/50">
            {/* Section Header */}
            <div className="flex items-center justify-between px-2 text-zinc-550 mb-1">
              <button
                type="button"
                onClick={() => setProjectsCollapsed(!projectsCollapsed)}
                className="flex items-center gap-1 hover:text-zinc-350 transition-colors text-left"
              >
                {projectsCollapsed ? (
                  <ChevronRight className="h-3 w-3 shrink-0" />
                ) : (
                  <ChevronDown className="h-3 w-3 shrink-0" />
                )}
                <span className="text-[10px] font-bold uppercase tracking-wider">My Projects</span>
              </button>
              {(activeOrg.memberRole === "owner" || activeOrg.memberRole === "admin") && (
                <button
                  onClick={() => router.push(`/organizations/${activeOrg.id}`)}
                  className="text-zinc-550 hover:text-indigo-400 transition-colors cursor-pointer"
                  title="Create new project"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* Filter and Collapsible Projects List */}
            {!projectsCollapsed && (
              <div className="space-y-2 animate-fade-in">
                {projects.length > 4 && (
                  <div className="relative px-2">
                    <Search className="absolute left-4 top-2 h-3 w-3 text-zinc-550" />
                    <input
                      type="text"
                      placeholder="Filter projects…"
                      value={projectSearch}
                      onChange={(e) => setProjectSearch(e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-850 rounded-lg pl-6 pr-2 py-1 text-[11px] text-zinc-300 placeholder:text-zinc-600 focus:border-zinc-800 outline-none"
                    />
                  </div>
                )}

                <div className="space-y-1.5">
                  {filteredProjects.length > 0 ? (
                    filteredProjects.map((project) => {
                      const isProjActive = pathname === `/projects/${project.id}` || pathname.startsWith(`/projects/${project.id}/`);
                      return (
                        <Link
                          key={project.id}
                          href={`/projects/${project.id}`}
                          className={cn(
                            "flex w-full items-center gap-2.5 px-3 py-2 text-xs rounded-lg transition-all",
                            isProjActive
                              ? "bg-zinc-900/60 text-zinc-100 font-semibold border border-zinc-850/60 shadow-sm shadow-black/10"
                              : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-950/40 border border-transparent"
                          )}
                        >
                          <span className={cn(
                            "h-1.5 w-1.5 rounded-full shrink-0 transition-transform duration-200",
                            isProjActive ? "bg-indigo-400 scale-110" : "bg-zinc-700"
                          )} />
                          <span className="truncate">{project.name}</span>
                        </Link>
                      );
                    })
                  ) : projects.length > 0 ? (
                    <p className="text-[10px] text-zinc-600 italic px-3 py-1">No matches found</p>
                  ) : (
                    <p className="text-[10px] text-zinc-600 italic px-3 py-1">No projects created yet</p>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* All Organizations Footer */}
      {organizations.length > 0 && (
        <div className="px-3 py-3 border-t border-zinc-850/80 bg-zinc-950/10">
          <Link
            href="/orgs"
            className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-zinc-950/40 transition-all text-xs font-semibold"
          >
            <Building2 className="h-4 w-4 shrink-0 text-zinc-550" />
            <span>All Organizations</span>
          </Link>
        </div>
      )}
    </aside>
  );
}

interface NavItemProps {
  href: string;
  icon: any;
  label: string;
  active: boolean;
  count?: number;
}

function NavItem({ href, icon: Icon, label, active, count }: NavItemProps) {
  return (
    <Link
      href={href}
      className={cn(
        "group flex w-full items-center justify-between px-3 py-2 text-xs rounded-lg border transition-all duration-150",
        active
          ? "bg-zinc-900 text-zinc-100 font-semibold border-zinc-850 shadow-xs"
          : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-950/40 border-transparent"
      )}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <Icon className={cn(
          "h-3.5 w-3.5 shrink-0 transition-transform duration-200 group-hover:scale-105",
          active ? "text-indigo-400" : "text-zinc-550 group-hover:text-zinc-450"
        )} />
        <span className="truncate">{label}</span>
      </div>
      {count !== undefined && (
        <span className={cn(
          "text-[9px] font-bold px-1.5 py-0.2 rounded-full border transition-all",
          active
            ? "bg-indigo-600/10 text-indigo-400 border-indigo-500/20"
            : "bg-zinc-950 text-zinc-600 border-zinc-850 group-hover:text-zinc-450"
        )}>
          {count}
        </span>
      )}
    </Link>
  );
}
