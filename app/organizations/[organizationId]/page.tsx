"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Navbar from "@/components/navbar";
import Sidebar from "@/components/sidebar";
import { Folder, Users, Mail, Plus, ExternalLink, Shield, Trash2, ShieldCheck, UserPlus, Clipboard, Check } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export default function OrganizationPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const organizationId = params.organizationId as string;

  const [currentUser, setCurrentUser] = useState<any>(null);
  const [organization, setOrganization] = useState<any>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [projects, setProjects] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [invites, setInvites] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Tabs state
  const activeTab = searchParams.get("tab") || "projects";

  // Create Project state
  const [projectOpen, setProjectOpen] = useState(false);
  const [projectName, setProjectName] = useState("");
  const [projectDesc, setProjectDesc] = useState("");
  const [creatingProject, setCreatingProject] = useState(false);

  // Invite state
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("member");
  const [inviting, setInviting] = useState(false);
  const [copiedInviteId, setCopiedInviteId] = useState<string | null>(null);
  const [cancelingInvite, setCancelingInvite] = useState<any>(null);

  useEffect(() => {
    async function loadOrgData() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          router.push("/login");
          return;
        }

        const user = session.user;
        setCurrentUser(user);

        // 1. Fetch organization details
        const { data: org, error: orgError } = await supabase
          .from("organizations")
          .select("*")
          .eq("id", organizationId)
          .maybeSingle();

        if (orgError || !org) {
          console.error("Organization not found:", orgError);
          setOrganization(null);
          setLoading(false);
          return;
        }

        setOrganization(org);

        // 2. Fetch current user's membership and role in this org
        const { data: membership, error: memberError } = await supabase
          .from("organization_members")
          .select("role")
          .eq("organization_id", organizationId)
          .eq("user_id", user.id)
          .maybeSingle();

        if (!membership) {
          // Access Denied: user does not belong to this org
          setUserRole(null);
          setLoading(false);
          return;
        }

        setUserRole(membership.role);

        // 3. Fetch Projects
        const { data: allProjects } = await supabase
          .from("projects")
          .select("*")
          .eq("organization_id", organizationId)
          .order("created_at", { ascending: false });

        if (membership.role === "owner" || membership.role === "admin") {
          setProjects(allProjects || []);
        } else {
          // If plain member, only load projects they are assigned to
          const { data: assignedProjects } = await supabase
            .from("project_members")
            .select("project_id")
            .eq("user_id", user.id);

          const allowedIds = assignedProjects?.map((p) => p.project_id) || [];
          const filtered = (allProjects || []).filter((p) => allowedIds.includes(p.id));
          setProjects(filtered);
        }

        // 4. Fetch Members from the enriched organization members API
        const membersRes = await fetch(`/api/organizations/${organizationId}/members?userId=${user.id}`);
        if (membersRes.ok) {
          const enrichedMembers = await membersRes.json();
          setMembers(enrichedMembers);
        } else {
          console.warn("Failed to fetch organization members from API, falling back to basic metadata");
          const { data: orgMembers } = await supabase
            .from("organization_members")
            .select("*")
            .eq("organization_id", organizationId);

          const fallbackMembers = orgMembers?.map(m => ({
            ...m,
            name: `User (${m.user_id.slice(0, 5)})`,
            email: "user@production-studio.co",
            avatar: "",
          })) || [];
          setMembers(fallbackMembers);
        }

        // 5. Fetch Invites (only pending ones — not yet accepted)
        const { data: orgInvites } = await supabase
          .from("organization_invites")
          .select("*")
          .eq("organization_id", organizationId)
          .eq("accepted", false)
          .order("created_at", { ascending: false });

        setInvites(orgInvites || []);
      } catch (err) {
        console.error("Error loading organization page:", err);
      } finally {
        setLoading(false);
      }
    }

    loadOrgData();
  }, [organizationId, router, searchParams]);

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectName.trim() || !currentUser || !organization) return;

    setCreatingProject(true);
    try {
      const response = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organization_id: organization.id,
          name: projectName.trim(),
          description: projectDesc.trim(),
          user_id: currentUser.id,
        }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Failed to create project");
      }

      const newProject = await response.json();

      setProjects((prev) => [newProject, ...prev]);
      setProjectName("");
      setProjectDesc("");
      setProjectOpen(false);
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "Failed to create project");
    } finally {
      setCreatingProject(false);
    }
  };

  const handleCreateInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim() || !currentUser || !organization) return;

    setInviting(true);
    try {
      const response = await fetch("/api/invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId: organization.id,
          email: inviteEmail.trim(),
          role: inviteRole,
          userId: currentUser.id,
        }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Failed to invite member");
      }

      const newInvite = await response.json();

      setInvites((prev) => [newInvite, ...prev]);
      setInviteEmail("");
      setInviteOpen(false);
      toast.success(`Invite generated successfully! You can copy the token from the Invites tab.`);
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "Failed to generate invite");
    } finally {
      setInviting(false);
    }
  };

  const handleCancelInvite = async (inviteId: string) => {
    try {
      const response = await fetch(`/api/invites?inviteId=${inviteId}&userId=${currentUser.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to cancel invite");
      }

      setInvites((prev) => prev.filter((i) => i.id !== inviteId));
      toast.success("Invitation cancelled successfully");
    } catch (err) {
      console.error(err);
      toast.error("Failed to cancel invite");
    }
  };

  const handleCopyInviteLink = (invite: any) => {
    const inviteLink = `${window.location.origin}/accept-invite?token=${invite.token}`;
    navigator.clipboard.writeText(inviteLink).then(() => {
      setCopiedInviteId(invite.id);
      setTimeout(() => setCopiedInviteId(null), 2000);
    });
  };

  const handleTabChange = (tab: string) => {
    router.push(`/organizations/${organizationId}?tab=${tab}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#09090b] flex items-center justify-center">
        <div className="text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent mx-auto mb-4" />
          <p className="text-sm text-zinc-400">Loading organization workspace...</p>
        </div>
      </div>
    );
  }

  if (!organization || !userRole) {
    return (
      <div className="min-h-screen bg-[#09090b] flex items-center justify-center">
        <div className="text-center p-6 border border-zinc-800 bg-zinc-950 rounded-2xl max-w-sm">
          <Shield className="h-10 w-10 text-red-400 mx-auto mb-4" />
          <h2 className="text-lg font-bold text-zinc-200 mb-2">Access Denied</h2>
          <p className="text-sm text-zinc-500 mb-6">
            You do not belong to this organization or it does not exist. Please contact your workspace administrator.
          </p>
          <Button onClick={() => router.push("/orgs")} className="bg-zinc-900 border border-zinc-800 text-zinc-300 hover:bg-zinc-800 w-full">
            Back to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  const isOwnerOrAdmin = userRole === "owner" || userRole === "admin";

  return (
    <div className="min-h-screen bg-[#09090b]">
      <Navbar />

      <div className="flex">
        <Sidebar className="hidden md:flex" />

        <main className="flex-1 min-h-[calc(100vh-3.5rem)]">
          <div className="px-6 md:px-8 py-8 max-w-6xl mx-auto space-y-8">
            
            {/* Org Header */}
            <div className="flex items-center gap-4 border-b border-zinc-800/60 pb-6">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 text-zinc-100 font-extrabold text-lg uppercase shadow-lg shadow-indigo-600/10">
                {organization.name.slice(0, 2)}
              </div>
              <div>
                <h1 className="text-xl font-bold tracking-tight text-zinc-100 font-sans">{organization.name}</h1>
                <p className="text-xs text-zinc-500 mt-1 flex items-center gap-1.5 capitalize">
                  <ShieldCheck className="h-3.5 w-3.5 text-indigo-400" />
                  Your Role: {userRole}
                </p>
              </div>
            </div>

            {/* Navigation Tabs */}
            <div className="flex border-b border-zinc-800/80">
              <button
                onClick={() => handleTabChange("projects")}
                className={`px-5 py-3 text-xs font-semibold border-b-2 tracking-wide transition-all ${
                  activeTab === "projects"
                    ? "border-indigo-500 text-indigo-400"
                    : "border-transparent text-zinc-500 hover:text-zinc-300"
                }`}
              >
                Projects ({projects.length})
              </button>
              <button
                onClick={() => handleTabChange("members")}
                className={`px-5 py-3 text-xs font-semibold border-b-2 tracking-wide transition-all ${
                  activeTab === "members"
                    ? "border-indigo-500 text-indigo-400"
                    : "border-transparent text-zinc-500 hover:text-zinc-300"
                }`}
              >
                Members ({members.length})
              </button>
              {isOwnerOrAdmin && (
                <button
                  onClick={() => handleTabChange("invites")}
                  className={`px-5 py-3 text-xs font-semibold border-b-2 tracking-wide transition-all ${
                    activeTab === "invites"
                      ? "border-indigo-500 text-indigo-400"
                      : "border-transparent text-zinc-500 hover:text-zinc-300"
                  }`}
                >
                  Pending Invites ({invites.length})
                </button>
              )}
            </div>

            {/* Tab Contents */}
            <div className="pt-2">
              
              {/* PROJECTS TAB */}
              {activeTab === "projects" && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <h2 className="text-sm font-bold text-zinc-400 tracking-wider uppercase">Projects</h2>
                    {isOwnerOrAdmin && (
                      <Button
                        onClick={() => setProjectOpen(true)}
                        size="sm"
                        className="bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs"
                      >
                        <Plus className="h-4 w-4" />
                        Create Project
                      </Button>
                    )}
                  </div>

                  {projects.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {projects.map((proj) => (
                        <div
                          key={proj.id}
                          onClick={() => router.push(`/projects/${proj.id}`)}
                          className="group border border-zinc-800/80 bg-zinc-900/20 hover:bg-zinc-900/60 p-5 rounded-2xl cursor-pointer transition-all duration-200 hover:border-zinc-700/80"
                        >
                          <div className="flex items-start justify-between gap-4 mb-3">
                            <div className="h-9 w-9 rounded-lg bg-zinc-850 flex items-center justify-center border border-zinc-800 text-indigo-400">
                              <Folder className="h-4.5 w-4.5" />
                            </div>
                            <span className="text-[10px] text-zinc-500 font-medium">
                              {new Date(proj.created_at).toLocaleDateString()}
                            </span>
                          </div>
                          <h3 className="text-sm font-bold text-zinc-200 group-hover:text-white truncate">
                            {proj.name}
                          </h3>
                          <p className="text-[11px] text-zinc-500 line-clamp-2 mt-1 leading-normal">
                            {proj.description || "No description provided."}
                          </p>
                          <div className="mt-4 pt-3 border-t border-zinc-800/40 flex items-center text-xs text-zinc-400 group-hover:text-indigo-400 transition-colors">
                            <span>Open Project</span>
                            <ExternalLink className="h-3 w-3 ml-1 transform group-hover:translate-x-0.5 transition-transform" />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-20 border border-dashed border-zinc-850 rounded-2xl bg-zinc-950/10">
                      <Folder className="h-8 w-8 text-zinc-600 mx-auto mb-4" />
                      <p className="text-sm text-zinc-400 font-semibold">No projects yet</p>
                      <p className="text-xs text-zinc-500 mt-1 mb-4">Create your first creative campaign project container</p>
                      {isOwnerOrAdmin && (
                        <Button onClick={() => setProjectOpen(true)} size="sm" className="bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg">
                          Create Project
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* MEMBERS TAB */}
              {activeTab === "members" && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <h2 className="text-sm font-bold text-zinc-400 tracking-wider uppercase">Workspace Members</h2>
                    {isOwnerOrAdmin && (
                      <Button
                        onClick={() => setInviteOpen(true)}
                        size="sm"
                        className="bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs"
                      >
                        <UserPlus className="h-4 w-4" />
                        Invite Member
                      </Button>
                    )}
                  </div>

                  <div className="border border-zinc-800 bg-[#121214]/30 rounded-2xl overflow-hidden shadow-inner">
                    <div className="divide-y divide-zinc-800/60">
                      {members.map((member) => (
                        <div key={member.id} className="flex items-center justify-between p-4 hover:bg-zinc-900/20">
                          <div className="flex items-center gap-3">
                            <div className="h-9 w-9 rounded-full bg-zinc-800 border border-zinc-700/80 overflow-hidden flex items-center justify-center text-xs font-bold text-zinc-300">
                              {member.avatar ? (
                                <img src={member.avatar} alt={member.name} className="h-full w-full object-cover" />
                              ) : (
                                member.name.slice(0, 2).toUpperCase()
                              )}
                            </div>
                            <div>
                              <p className="text-xs font-bold text-zinc-200">{member.name}</p>
                              <p className="text-[10px] text-zinc-500 mt-0.5">{member.email}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className={`text-[10px] font-semibold uppercase px-2 py-0.5 border rounded-full ${
                              member.role === "owner"
                                ? "bg-violet-600/10 text-violet-400 border-violet-500/20"
                                : member.role === "admin"
                                ? "bg-amber-600/10 text-amber-400 border-amber-500/20"
                                : "bg-zinc-900 text-zinc-400 border-zinc-800"
                            }`}>
                              {member.role}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* INVITES TAB (Admins/Owners only) */}
              {activeTab === "invites" && isOwnerOrAdmin && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <h2 className="text-sm font-bold text-zinc-400 tracking-wider uppercase">Pending Invites</h2>
                    <Button
                      onClick={() => setInviteOpen(true)}
                      size="sm"
                      className="bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs"
                    >
                      <UserPlus className="h-4 w-4" />
                      Create Invite
                    </Button>
                  </div>

                  {invites.length > 0 ? (
                    <div className="border border-zinc-800 bg-[#121214]/30 rounded-2xl overflow-hidden">
                      <div className="divide-y divide-zinc-800/60">
                        {invites.map((invite) => (
                          <div key={invite.id} className="flex items-center justify-between p-4 hover:bg-zinc-900/20">
                            <div>
                              <p className="text-xs font-bold text-zinc-200">{invite.email}</p>
                              <p className="text-[10px] text-zinc-500 mt-0.5 capitalize">Role: {invite.role}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              {/* Copy Link button (for demo ease) */}
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleCopyInviteLink(invite)}
                                className="h-8 border border-zinc-800 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 rounded-lg text-xs"
                              >
                                {copiedInviteId === invite.id ? (
                                  <>
                                    <Check className="h-3.5 w-3.5 text-emerald-400" />
                                    Copied!
                                  </>
                                ) : (
                                  <>
                                    <Clipboard className="h-3.5 w-3.5" />
                                    Copy Invite Link
                                  </>
                                )}
                              </Button>

                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setCancelingInvite(invite)}
                                className="h-8 hover:bg-red-500/10 hover:text-red-400 text-zinc-500 rounded-lg"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-16 border border-dashed border-zinc-850 rounded-2xl">
                      <Mail className="h-8 w-8 text-zinc-600 mx-auto mb-4" />
                      <p className="text-sm text-zinc-400 font-semibold">No pending invites</p>
                      <p className="text-xs text-zinc-500 mt-1">Generate an invite token to add external users to the organization</p>
                    </div>
                  )}
                </div>
              )}

            </div>

          </div>
        </main>
      </div>

      {/* Create Project Modal */}
      <Dialog open={projectOpen} onOpenChange={(open) => !open && setProjectOpen(false)}>
        <DialogContent className="sm:max-w-md border-zinc-800 bg-[#121214] text-zinc-100 shadow-2xl rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold text-zinc-100">
              Create Project
            </DialogTitle>
            <p className="text-xs text-zinc-500 mt-1">
              Add a project container to store video drafts and collect frame feedbacks.
            </p>
          </DialogHeader>

          <form onSubmit={handleCreateProject} className="space-y-4 py-4">
            <div className="space-y-2">
              <label htmlFor="project-name-input" className="text-xs font-semibold text-zinc-400">
                Project Name
              </label>
              <Input
                id="project-name-input"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                placeholder="e.g. Autumn Product Launch"
                className="w-full bg-zinc-900 border-zinc-800 text-zinc-100 placeholder-zinc-600 focus:border-indigo-500"
                required
                disabled={creatingProject}
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="project-desc-input" className="text-xs font-semibold text-zinc-400">
                Description (Optional)
              </label>
              <Input
                id="project-desc-input"
                value={projectDesc}
                onChange={(e) => setProjectDesc(e.target.value)}
                placeholder="Briefly describe what this project contains"
                className="w-full bg-zinc-900 border-zinc-800 text-zinc-100 placeholder-zinc-600 focus:border-indigo-500"
                disabled={creatingProject}
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setProjectOpen(false)}
                className="text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 h-9 px-4 rounded-lg cursor-pointer"
                disabled={creatingProject}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="bg-indigo-600 hover:bg-indigo-500 text-zinc-50 font-medium h-9 px-4 rounded-lg shadow-md transition-all duration-200 cursor-pointer"
                disabled={creatingProject || !projectName.trim()}
              >
                {creatingProject ? (
                  <div className="flex items-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-200 border-t-transparent" />
                    <span>Creating...</span>
                  </div>
                ) : (
                  "Create Project"
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Invite Member Modal */}
      <Dialog open={inviteOpen} onOpenChange={(open) => !open && setInviteOpen(false)}>
        <DialogContent className="sm:max-w-md border-zinc-800 bg-[#121214] text-zinc-100 shadow-2xl rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold text-zinc-100">
              Invite Team Member
            </DialogTitle>
            <p className="text-xs text-zinc-500 mt-1">
              Send an invite token to grant organization access.
            </p>
          </DialogHeader>

          <form onSubmit={handleCreateInvite} className="space-y-4 py-4">
            <div className="space-y-2">
              <label htmlFor="invite-email-input" className="text-xs font-semibold text-zinc-400">
                Email Address
              </label>
              <Input
                id="invite-email-input"
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="colleague@agency.com"
                className="w-full bg-zinc-900 border-zinc-800 text-zinc-100 placeholder-zinc-600 focus:border-indigo-500"
                required
                disabled={inviting}
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="invite-role-select" className="text-xs font-semibold text-zinc-400">
                Organization Role
              </label>
              <select
                id="invite-role-select"
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value)}
                className="w-full h-10 px-3 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-200 focus:border-indigo-500 text-sm"
                disabled={inviting}
              >
                <option value="member">Member (Assigned projects only)</option>
                <option value="admin">Admin (Manage projects, invites, delete videos)</option>
              </select>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setInviteOpen(false)}
                className="text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 h-9 px-4 rounded-lg cursor-pointer"
                disabled={inviting}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="bg-indigo-600 hover:bg-indigo-500 text-zinc-50 font-medium h-9 px-4 rounded-lg shadow-md transition-all duration-200 cursor-pointer"
                disabled={inviting || !inviteEmail.trim()}
              >
                {inviting ? (
                  <div className="flex items-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-200 border-t-transparent" />
                    <span>Inviting...</span>
                  </div>
                ) : (
                  "Generate Invite"
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Cancel Invite Confirmation Dialog */}
      <Dialog open={!!cancelingInvite} onOpenChange={(open) => !open && setCancelingInvite(null)}>
        <DialogContent className="sm:max-w-md border-zinc-800 bg-[#121214] text-zinc-100 shadow-2xl rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold text-red-400">
              Cancel Invitation
            </DialogTitle>
            <div className="text-xs text-zinc-500 mt-2 leading-relaxed">
              Are you sure you want to cancel the invitation for <span className="text-zinc-300 font-semibold">{cancelingInvite?.email}</span>? They will no longer be able to join the organization using this link.
            </div>
          </DialogHeader>
          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setCancelingInvite(null)}
              className="text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 h-9 px-4 rounded-lg cursor-pointer text-xs"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={async () => {
                if (!cancelingInvite) return;
                await handleCancelInvite(cancelingInvite.id);
                setCancelingInvite(null);
              }}
              className="bg-red-600 hover:bg-red-500 text-zinc-50 font-medium h-9 px-4 rounded-lg shadow-md transition-all duration-200 cursor-pointer text-xs"
            >
              Cancel Invite
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
