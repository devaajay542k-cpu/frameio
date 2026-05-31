"use client";

import { useEffect, useState } from "react";
import { Folder, Users, Building2, ChevronDown, Plus, Settings, LayoutDashboard } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import { useRouter, useParams, usePathname } from "next/navigation";
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

  const orgIdParam = params?.organizationId as string;
  const projectIdParam = params?.projectId as string;
  const videoIdParam = params?.videoId as string;

  const [userId, setUserId] = useState<string | null>(null);
  const [organizations, setOrganizations] = useState<any[]>([]);
  const [activeOrg, setActiveOrg] = useState<any>(null);
  const [projects, setProjects] = useState<any[]>([]);
  const [loadingOrgs, setLoadingOrgs] = useState(true);

  useEffect(() => {
    async function getAuth() {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) setUserId(session.user.id);
    }
    getAuth();
  }, []);

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

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "?");

  return (
    <aside className={cn(
      "w-56 border-r border-[rgba(255,255,255,0.07)] bg-[#0e0e0e] flex flex-col h-[calc(100vh-3rem)] sticky top-12",
      className
    )}>

      {/* Org Switcher */}
      <div className="px-3 py-2 border-b border-[rgba(255,255,255,0.07)]">
        {loadingOrgs ? (
          <div className="h-7 rounded bg-[#1a1a1a] animate-pulse w-full" />
        ) : activeOrg ? (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <button className="flex w-full items-center justify-between px-2 py-1.5 rounded-md hover:bg-[#1a1a1a] transition-colors cursor-pointer group text-left border-0 outline-none" />
              }
            >
              <div className="flex items-center gap-2 min-w-0">
                <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-indigo-600/20 border border-indigo-500/20 text-indigo-400 font-bold text-[9px] uppercase">
                  {activeOrg.name.slice(0, 2)}
                </div>
                <div className="text-left min-w-0">
                  <p className="text-xs font-medium text-[#ededed] truncate leading-none">{activeOrg.name}</p>
                </div>
              </div>
              <ChevronDown className="h-3.5 w-3.5 text-[#6b6b6b] group-hover:text-[#a1a1a1] transition-colors shrink-0" />
            </DropdownMenuTrigger>
            <DropdownMenuContent
              className="w-52 border-[rgba(255,255,255,0.08)] bg-[#141414]/95 backdrop-blur-md text-[#ededed] shadow-2xl rounded-lg p-1"
              align="start"
            >
              {organizations.map((org) => (
                <DropdownMenuItem
                  key={org.id}
                  onClick={() => handleOrgChange(org.id)}
                  className="text-xs text-[#a1a1a1] hover:text-[#ededed] hover:bg-[#1a1a1a] rounded-md px-2 py-1.5 cursor-pointer transition-colors focus:bg-[#1a1a1a] focus:text-[#ededed]"
                >
                  <div className="flex items-center gap-2">
                    <div className="flex h-4 w-4 items-center justify-center rounded bg-indigo-600/20 text-indigo-400 text-[8px] font-bold uppercase">
                      {org.name.slice(0, 2)}
                    </div>
                    <span>{org.name}</span>
                  </div>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <Link
            href="/orgs"
            className="flex items-center gap-1.5 px-2 py-1.5 rounded-md text-[#6b6b6b] hover:text-[#ededed] hover:bg-[#1a1a1a] transition-colors text-xs"
          >
            <Plus className="h-3.5 w-3.5" />
            New organization
          </Link>
        )}
      </div>

      {/* Nav */}
      <div className="flex-1 overflow-y-auto py-3 px-2 space-y-4">

        {/* Main nav group */}
        <div className="space-y-0.5">
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
                active={isActive(`/organizations/${activeOrg.id}`)}
              />
              <NavItem
                href={`/organizations/${activeOrg.id}?tab=members`}
                icon={Users}
                label="Members"
                active={pathname === `/organizations/${activeOrg.id}` && false}
              />
              {(activeOrg.memberRole === "owner" || activeOrg.memberRole === "admin") && (
                <NavItem
                  href={`/organizations/${activeOrg.id}?tab=invites`}
                  icon={Settings}
                  label="Settings"
                  active={false}
                />
              )}
            </>
          )}
        </div>

        {/* Projects group */}
        {projects.length > 0 && (
          <div>
            <div className="flex items-center justify-between px-2 mb-1">
              <span className="text-[11px] font-medium text-[#6b6b6b] uppercase tracking-wider">Projects</span>
              {activeOrg && (activeOrg.memberRole === "owner" || activeOrg.memberRole === "admin") && (
                <Link href={`/organizations/${activeOrg.id}`} className="text-[#6b6b6b] hover:text-[#ededed] transition-colors">
                  <Plus className="h-3 w-3" />
                </Link>
              )}
            </div>
            <div className="space-y-0.5">
              {projects.map((project) => {
                const isProjActive = pathname === `/projects/${project.id}` || pathname.startsWith(`/projects/${project.id}/`);
                return (
                  <Link
                    key={project.id}
                    href={`/projects/${project.id}`}
                    className={cn(
                      "flex w-full items-center gap-2 px-2 py-1.5 text-xs rounded-md transition-colors",
                      isProjActive
                        ? "bg-[#1a1a1a] text-[#ededed] font-medium"
                        : "text-[#6b6b6b] hover:text-[#a1a1a1] hover:bg-[#141414]"
                    )}
                  >
                    <span className={cn(
                      "h-1.5 w-1.5 rounded-full shrink-0",
                      isProjActive ? "bg-indigo-400" : "bg-[#333]"
                    )} />
                    <span className="truncate">{project.name}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Org switcher footer */}
      {organizations.length > 0 && (
        <div className="px-2 py-3 border-t border-[rgba(255,255,255,0.07)]">
          <Link
            href="/orgs"
            className="flex items-center gap-2 px-2 py-1.5 rounded-md text-[#6b6b6b] hover:text-[#a1a1a1] hover:bg-[#141414] transition-colors text-xs"
          >
            <Building2 className="h-3.5 w-3.5 shrink-0" />
            <span>All organizations</span>
          </Link>
        </div>
      )}
    </aside>
  );
}

function NavItem({ href, icon: Icon, label, active }: { href: string; icon: any; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      className={cn(
        "flex w-full items-center gap-2.5 px-2 py-1.5 text-xs rounded-md transition-colors",
        active
          ? "bg-[#1a1a1a] text-[#ededed] font-medium"
          : "text-[#6b6b6b] hover:text-[#a1a1a1] hover:bg-[#141414]"
      )}
    >
      <Icon className={cn("h-3.5 w-3.5 shrink-0", active ? "text-[#ededed]" : "text-[#6b6b6b]")} />
      {label}
    </Link>
  );
}
