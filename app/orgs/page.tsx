"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Navbar from "@/components/navbar";
import Sidebar from "@/components/sidebar";
import { Building2, Plus, Users, Calendar, Mail, Check, X, Loader2, ChevronRight } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function OrgsDashboard() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [organizations, setOrganizations] = useState<any[]>([]);
  const [pendingInvites, setPendingInvites] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [orgName, setOrgName] = useState("");
  const [creating, setCreating] = useState(false);
  const [processingInviteId, setProcessingInviteId] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) { router.push("/login"); return; }
        const user = session.user;
        setCurrentUser(user);

        const { data: membersData, error: membersError } = await supabase
          .from("organization_members")
          .select("role, created_at, organizations(*)")
          .eq("user_id", user.id);
        if (membersError) throw membersError;
        if (membersData) {
          setOrganizations(membersData.map((item: any) => ({ ...item.organizations, memberRole: item.role, joinedAt: item.created_at })).filter(Boolean));
        }

        if (user.email) {
          const { data: invitesData } = await supabase
            .from("organization_invites")
            .select("*, organizations(name)")
            .eq("email", user.email.toLowerCase().trim())
            .eq("accepted", false);
          setPendingInvites(invitesData || []);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [router]);

  const handleCreateOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orgName.trim() || !currentUser) return;
    setCreating(true);
    try {
      const { data: org, error: orgError } = await supabase.from("organizations").insert({ name: orgName.trim(), owner_id: currentUser.id }).select().single();
      if (orgError) throw orgError;
      const { error: memberError } = await supabase.from("organization_members").insert({ organization_id: org.id, user_id: currentUser.id, role: "owner" });
      if (memberError) throw memberError;
      setOrgName("");
      setCreateOpen(false);
      setOrganizations((prev) => [...prev, { ...org, memberRole: "owner", joinedAt: new Date().toISOString() }]);
      router.push(`/organizations/${org.id}`);
    } catch (err) {
      console.error(err);
      alert("Failed to create organization.");
    } finally {
      setCreating(false);
    }
  };

  const handleAcceptInvite = async (invite: any) => {
    setProcessingInviteId(invite.id);
    try {
      const { error: joinError } = await supabase.from("organization_members").insert({ organization_id: invite.organization_id, user_id: currentUser.id, role: invite.role });
      if (joinError) throw joinError;
      await supabase.from("organization_invites").update({ accepted: true }).eq("id", invite.id);
      setPendingInvites((prev) => prev.filter((i) => i.id !== invite.id));
      const { data: orgDetails } = await supabase.from("organizations").select("*").eq("id", invite.organization_id).single();
      if (orgDetails) setOrganizations((prev) => [...prev, { ...orgDetails, memberRole: invite.role, joinedAt: new Date().toISOString() }]);
    } catch (err) {
      console.error(err);
      alert("Failed to accept invite.");
    } finally {
      setProcessingInviteId(null);
    }
  };

  const handleDeclineInvite = async (inviteId: string) => {
    setProcessingInviteId(inviteId);
    try {
      await supabase.from("organization_invites").delete().eq("id", inviteId);
      setPendingInvites((prev) => prev.filter((i) => i.id !== inviteId));
    } catch (err) {
      console.error(err);
    } finally {
      setProcessingInviteId(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0e0e0e] flex items-center justify-center">
        <div className="flex items-center gap-2 text-[#6b6b6b] text-sm">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0e0e0e]">
      <Navbar />
      <div className="flex">
        <Sidebar className="hidden md:flex" activeItem="shared" />
        <main className="flex-1 min-h-[calc(100vh-3rem)] overflow-auto">
          <div className="max-w-5xl mx-auto px-6 py-8 space-y-8">

            {/* Page header */}
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-base font-semibold text-[#ededed]">Organizations</h1>
                <p className="text-xs text-[#6b6b6b] mt-0.5">Manage your workspaces and team access</p>
              </div>
              <Button
                onClick={() => setCreateOpen(true)}
                className="h-8 px-3 text-xs bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-md shadow-none border-0 transition-colors flex items-center gap-1.5"
              >
                <Plus className="h-3.5 w-3.5" />
                New organization
              </Button>
            </div>

            {/* Pending invites */}
            {pendingInvites.length > 0 && (
              <div className="rounded-lg border border-zinc-800 border-l-2 border-l-indigo-500 bg-zinc-950/40 overflow-hidden">
                <div className="px-4 py-3 border-b border-zinc-850 flex items-center gap-2">
                  <Mail className="h-3.5 w-3.5 text-indigo-400" />
                  <span className="text-xs font-medium text-[#ededed]">
                    {pendingInvites.length} pending invite{pendingInvites.length > 1 ? "s" : ""}
                  </span>
                </div>
                <div className="divide-y divide-[rgba(255,255,255,0.05)]">
                  {pendingInvites.map((invite) => (
                    <div key={invite.id} className="flex items-center justify-between px-4 py-3">
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-[#ededed] truncate">{invite.organizations?.name}</p>
                        <p className="text-[11px] text-[#6b6b6b] mt-0.5 capitalize">Invited as {invite.role}</p>
                      </div>
                      <div className="flex gap-2 ml-4 shrink-0">
                        <button
                          onClick={() => handleAcceptInvite(invite)}
                          disabled={processingInviteId === invite.id}
                          className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium bg-indigo-600 hover:bg-indigo-500 text-white rounded-md transition-colors disabled:opacity-50"
                        >
                          {processingInviteId === invite.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                          Accept
                        </button>
                        <button
                          onClick={() => handleDeclineInvite(invite.id)}
                          disabled={processingInviteId === invite.id}
                          className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-[#6b6b6b] hover:text-[#ededed] hover:bg-[#1a1a1a] border border-[rgba(255,255,255,0.07)] rounded-md transition-colors disabled:opacity-50"
                        >
                          <X className="h-3 w-3" />
                          Decline
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Organizations table */}
            {organizations.length > 0 ? (
              <div className="rounded-lg border border-[rgba(255,255,255,0.07)] overflow-hidden">
                {/* Table header */}
                <div className="grid grid-cols-[1fr_auto_auto_auto] gap-4 items-center px-4 py-2 bg-[#141414] border-b border-[rgba(255,255,255,0.07)]">
                  <span className="text-[11px] font-medium text-[#6b6b6b] uppercase tracking-wider">Name</span>
                  <span className="text-[11px] font-medium text-[#6b6b6b] uppercase tracking-wider w-20 text-center">Role</span>
                  <span className="text-[11px] font-medium text-[#6b6b6b] uppercase tracking-wider w-28 text-right">Joined</span>
                  <span className="w-4" />
                </div>
                {/* Rows */}
                <div className="divide-y divide-[rgba(255,255,255,0.05)]">
                  {organizations.map((org) => (
                    <button
                      key={org.id}
                      onClick={() => router.push(`/organizations/${org.id}`)}
                      className="w-full grid grid-cols-[1fr_auto_auto_auto] gap-4 items-center px-4 py-3 hover:bg-[#141414] transition-colors group text-left"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-indigo-600/10 border border-indigo-500/20 text-indigo-400 font-bold text-[10px] uppercase">
                          {org.name.slice(0, 2)}
                        </div>
                        <span className="text-sm font-medium text-[#ededed] truncate group-hover:text-white">{org.name}</span>
                      </div>
                      <div className="w-20 flex justify-center">
                        <RoleBadge role={org.memberRole} />
                      </div>
                      <div className="w-28 text-right">
                        <span className="text-xs text-[#6b6b6b]">
                          {new Date(org.joinedAt || org.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                        </span>
                      </div>
                      <ChevronRight className="h-4 w-4 text-[#333] group-hover:text-[#6b6b6b] transition-colors" />
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-20 text-center rounded-lg border border-dashed border-[rgba(255,255,255,0.07)] bg-[#141414]/40">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-[#1a1a1a] border border-[rgba(255,255,255,0.07)] mb-4">
                  <Building2 className="h-5 w-5 text-[#6b6b6b]" />
                </div>
                <h3 className="text-sm font-medium text-[#ededed] mb-1">No organizations</h3>
                <p className="text-xs text-[#6b6b6b] max-w-xs mb-4">
                  Create a workspace to start organizing your projects and collaborating with your team.
                </p>
                <Button
                  onClick={() => setCreateOpen(true)}
                  className="h-8 px-3 text-xs bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-md shadow-none border-0"
                >
                  Create organization
                </Button>
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Create Org Modal */}
      <Dialog open={createOpen} onOpenChange={(open) => !open && setCreateOpen(false)}>
        <DialogContent className="sm:max-w-md border-[rgba(255,255,255,0.08)] bg-[#141414] text-[#ededed] shadow-2xl rounded-lg p-6">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold text-[#ededed]">Create organization</DialogTitle>
            <p className="text-xs text-[#6b6b6b] mt-1">
              Set up a shared workspace to manage projects and team members.
            </p>
          </DialogHeader>
          <form onSubmit={handleCreateOrg} className="space-y-4 pt-3">
            <div className="space-y-1.5">
              <label htmlFor="org-name-input" className="text-xs font-medium text-[#a1a1a1]">
                Organization name
              </label>
              <Input
                id="org-name-input"
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                placeholder="e.g. Acme Productions"
                className="h-8 text-xs bg-[#0e0e0e] border-[rgba(255,255,255,0.1)] text-[#ededed] placeholder-[#444] focus:border-indigo-500/50 focus:ring-indigo-500/20 rounded-md"
                required
                disabled={creating}
                autoFocus
              />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setCreateOpen(false)}
                className="h-8 px-3 text-xs text-[#6b6b6b] hover:text-[#ededed] hover:bg-[#1a1a1a] rounded-md"
                disabled={creating}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="h-8 px-3 text-xs bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-md shadow-none border-0"
                disabled={creating || !orgName.trim()}
              >
                {creating ? <><Loader2 className="h-3 w-3 animate-spin mr-1.5" />Creating...</> : "Create organization"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function RoleBadge({ role }: { role: string }) {
  const styles: Record<string, string> = {
    owner: "bg-violet-500/10 text-violet-400 border-violet-500/20",
    admin: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    member: "bg-[#1a1a1a] text-[#6b6b6b] border-[rgba(255,255,255,0.07)]",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium border capitalize ${styles[role] || styles.member}`}>
      {role}
    </span>
  );
}
