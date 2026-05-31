"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Navbar from "@/components/navbar";
import Sidebar from "@/components/sidebar";
import VideoCard from "@/components/video-card";
import UploadModal from "@/components/upload-modal";
import { getEffectiveRole, hasPermission, Role } from "@/lib/auth-utils";
import { Film, UserPlus, Users, Plus, Shield, ArrowLeft, Loader2, Edit3, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Video } from "@/types";

export default function ProjectPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.projectId as string;

  const [currentUser, setCurrentUser] = useState<any>(null);
  const [project, setProject] = useState<any>(null);
  const [effectiveRole, setEffectiveRole] = useState<Role | null>(null);
  const [videos, setVideos] = useState<Video[]>([]);
  const [projectMembers, setProjectMembers] = useState<any[]>([]);
  const [orgMembers, setOrgMembers] = useState<any[]>([]);
  
  // Permissions
  const [canUpload, setCanUpload] = useState(false);
  const [canInvite, setCanInvite] = useState(false);
  const [canDeleteProj, setCanDeleteProj] = useState(false);

  // States
  const [loading, setLoading] = useState(true);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [addMemberOpen, setAddMemberOpen] = useState(false);
  const [addingMember, setAddingMember] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Edit Video Title Dialog
  const [editingVideo, setEditingVideo] = useState<Video | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [savingTitle, setSavingTitle] = useState(false);

  // Delete Video Dialog
  const [deletingVideo, setDeletingVideo] = useState<Video | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Confirm states for removing member / deleting project
  const [removingMember, setRemovingMember] = useState<any>(null);
  const [deleteProjectOpen, setDeleteProjectOpen] = useState(false);

  // Add Member inputs
  const [memberEmail, setMemberEmail] = useState("");
  const [memberRole, setMemberRole] = useState<"editor" | "viewer">("viewer");

  useEffect(() => {
    async function loadProjectDetails() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          router.push("/login");
          return;
        }

        const user = session.user;
        setCurrentUser(user);

        // 1. Fetch Project Details
        const { data: proj, error: projError } = await supabase
          .from("projects")
          .select("*, organizations(name)")
          .eq("id", projectId)
          .maybeSingle();

        if (projError || !proj) {
          console.error("Project not found:", projError);
          setProject(null);
          setLoading(false);
          return;
        }

        setProject(proj);

        // 2. Resolve Effective Role
        const role = await getEffectiveRole(user.id, projectId);
        setEffectiveRole(role);

        if (!role) {
          setLoading(false);
          return;
        }

        // 3. Resolve permissions
        const uploadPerm = await hasPermission(user.id, projectId, "UPLOAD_VIDEO");
        const invitePerm = await hasPermission(user.id, projectId, "INVITE_MEMBER");
        const deleteProjPerm = await hasPermission(user.id, projectId, "DELETE_PROJECT");

        setCanUpload(uploadPerm);
        setCanInvite(invitePerm);
        setCanDeleteProj(deleteProjPerm);

        // 4. Fetch Videos in project
        const { data: vids } = await supabase
          .from("videos")
          .select("*")
          .eq("project_id", projectId)
          .order("created_at", { ascending: false });

        if (vids) {
          const mappedVideos: Video[] = vids.map((item: any) => ({
            id: item.id,
            title: item.title,
            description: item.description || "",
            thumbnailUrl: item.thumbnail_url || "https://images.unsplash.com/photo-1485846234645-a62644f84728?q=80&w=640",
            videoUrl: item.video_url || "",
            duration: item.duration_seconds || 0,
            createdAt: item.created_at || new Date().toISOString(),
            commentsCount: 0, // In dynamic mode, comments count is resolved by joining or separate query
          }));

          // Fetch comments counts for each video
          for (const video of mappedVideos) {
            const { count } = await supabase
              .from("comments")
              .select("*", { count: "exact", head: true })
              .eq("video_id", video.id);
            video.commentsCount = count || 0;
          }

          setVideos(mappedVideos);
        }

        // 5. Fetch Organization Members to populate dropdown
        let orgMembersList: any[] = [];
        const orgMembersRes = await fetch(`/api/organizations/${proj.organization_id}/members?userId=${user.id}`);
        if (orgMembersRes.ok) {
          orgMembersList = await orgMembersRes.json();
          setOrgMembers(orgMembersList);
        }

        // 6. Fetch Project Members
        const { data: membersData } = await supabase
          .from("project_members")
          .select("*")
          .eq("project_id", projectId);

        const enriched = membersData?.map(m => {
          const matchedOrgMember = orgMembersList?.find((om: any) => om.user_id === m.user_id);
          return {
            ...m,
            name: matchedOrgMember?.name || `User (${m.user_id.slice(0, 5)})`,
            email: matchedOrgMember?.email || "user@production-studio.co",
            avatar: matchedOrgMember?.avatar || ""
          };
        }) || [];

        setProjectMembers(enriched);

      } catch (err) {
        console.error("Error loading project data:", err);
      } finally {
        setLoading(false);
      }
    }

    loadProjectDetails();
  }, [projectId, router, refreshTrigger]);

  const handleAddProjectMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!memberEmail.trim() || !currentUser) return;

    setAddingMember(true);
    try {
      const response = await fetch("/api/projects/members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          email: memberEmail.trim(),
          role: memberRole,
          userId: currentUser.id,
        }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Failed to add member");
      }

      setRefreshTrigger(prev => prev + 1);
      setMemberEmail("");
      setAddMemberOpen(false);
      toast.success("Member added successfully!");
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "Failed to add project member");
    } finally {
      setAddingMember(false);
    }
  };

  const handleRemoveMember = async (targetUserId: string, isOrgLevel?: boolean) => {
    try {
      if (isOrgLevel) {
        // Remove from organization_members (org-level admin removal)
        const response = await fetch(
          `/api/projects/members?projectId=${projectId}&targetUserId=${targetUserId}&userId=${currentUser.id}&orgLevel=true`,
          { method: "DELETE" }
        );
        if (!response.ok) {
          const err = await response.json();
          throw new Error(err.error || "Failed to remove member");
        }
        // Remove from orgMembers state so UI updates immediately
        setOrgMembers(prev => prev.filter(m => m.user_id !== targetUserId));
      } else {
        const response = await fetch(
          `/api/projects/members?projectId=${projectId}&targetUserId=${targetUserId}&userId=${currentUser.id}`,
          { method: "DELETE" }
        );
        if (!response.ok) {
          const err = await response.json();
          throw new Error(err.error || "Failed to remove member");
        }
        setProjectMembers(prev => prev.filter(m => m.user_id !== targetUserId));
      }
      toast.success("Member removed successfully");
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "Failed to remove member");
    }
  };

  const handleDeleteProject = async () => {
    try {
      const response = await fetch(`/api/projects?projectId=${projectId}&userId=${currentUser.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete project");
      }

      toast.success("Project deleted successfully");
      router.push(`/organizations/${project.organization_id}`);
    } catch (err) {
      console.error(err);
      toast.error("Failed to delete project");
    }
  };

  // Edit Video Title methods
  const startEditTitle = (video: Video) => {
    setEditingVideo(video);
    setNewTitle(video.title);
  };

  const handleSaveVideoTitle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingVideo || !newTitle.trim()) return;

    setSavingTitle(true);
    try {
      const { error } = await supabase
        .from("videos")
        .update({ title: newTitle.trim() })
        .eq("id", editingVideo.id);

      if (error) throw error;

      setVideos(prev => prev.map(v => v.id === editingVideo.id ? { ...v, title: newTitle.trim() } : v));
      setEditingVideo(null);
    } catch (err) {
      console.error(err);
      toast.error("Failed to update video title");
    } finally {
      setSavingTitle(false);
    }
  };

  // Delete Video methods
  const handleDeleteVideo = async () => {
    if (!deletingVideo || !currentUser) return;

    setDeleting(true);
    try {
      const res = await fetch(`/api/videos/${deletingVideo.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: currentUser.id }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete video");
      }

      setVideos(prev => prev.filter(v => v.id !== deletingVideo.id));
      setDeletingVideo(null);
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "Failed to delete video");
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#09090b] flex items-center justify-center">
        <div className="text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent mx-auto mb-4" />
          <p className="text-sm text-zinc-400">Loading project...</p>
        </div>
      </div>
    );
  }

  if (!project || !effectiveRole) {
    return (
      <div className="min-h-screen bg-[#09090b] flex items-center justify-center">
        <div className="text-center p-6 border border-zinc-800 bg-zinc-950 rounded-2xl max-w-sm">
          <Shield className="h-10 w-10 text-red-400 mx-auto mb-4" />
          <h2 className="text-lg font-bold text-zinc-200 mb-2">Access Denied</h2>
          <p className="text-sm text-zinc-500 mb-6">
            You do not have permission to access this project, or it does not exist.
          </p>
          <Button onClick={() => router.push("/orgs")} className="bg-zinc-900 border border-zinc-800 text-zinc-300 hover:bg-zinc-800 w-full">
            Back to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  // Only show org-level "member" role users in the Add Member dropdown
  // (owners and admins already have default project access)
  const assignableMembers = orgMembers.filter(
    (om) => om.role === "member" && !projectMembers.some((pm) => pm.user_id === om.user_id)
  );

  // Build the displayed members list: owners/admins from org + explicit project members
  const orgOwnersAndAdmins = orgMembers
    .filter((om) => om.role === "owner" || om.role === "admin")
    .map((om) => ({
      id: `org-${om.user_id}`,
      user_id: om.user_id,
      role: om.role, // "owner" or "admin" — org-level role
      name: om.name,
      email: om.email,
      avatar: om.avatar,
      _isOrgLevel: true, // flag to distinguish from explicit project members
    }));

  // Merge: org owners/admins first, then explicit project members (excluding duplicates)
  const displayedMembers = [
    ...orgOwnersAndAdmins,
    ...projectMembers.filter(
      (pm) => !orgOwnersAndAdmins.some((oa) => oa.user_id === pm.user_id)
    ),
  ];

  // Role hierarchy for removal permissions
  const ROLE_RANK: Record<string, number> = { owner: 4, admin: 3, editor: 2, viewer: 1, member: 0 };
  const currentUserOrgRole = orgMembers.find((om) => om.user_id === currentUser?.id)?.role;
  const currentUserRank = ROLE_RANK[currentUserOrgRole || ""] ?? 0;

  const canRemoveMember = (targetMember: any) => {
    // Nobody can remove an owner
    if (targetMember.role === "owner") return false;

    // Can't remove yourself through this UI
    if (targetMember.user_id === currentUser?.id) return false;

    const targetRank = ROLE_RANK[targetMember.role] ?? 0;

    // Only users with higher org rank can remove lower-ranked members
    // Owner can remove admins, editors, viewers; admin can remove editors/viewers
    if (currentUserRank <= targetRank) return false;
    if (!canInvite) return false;
    return true;
  };

  return (
    <div className="min-h-screen bg-[#09090b]">
      <Navbar onUploadClick={() => setUploadOpen(true)} onMobileMenuClick={() => {}} />

      <div className="flex">
        <Sidebar className="hidden md:flex" />

        <main className="flex-1 min-h-[calc(100vh-3.5rem)]">
          <div className="px-6 md:px-8 py-8 max-w-7xl mx-auto space-y-8">
            
            {/* Back to Org page link */}
            <button
              onClick={() => router.push(`/organizations/${project.organization_id}`)}
              className="text-xs text-zinc-500 hover:text-zinc-300 flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to {project.organizations?.name || "Organization"}
            </button>

            {/* Project Header details */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6 border-b border-zinc-800/65 pb-6">
              <div className="space-y-1">
                <h1 className="text-2xl font-bold tracking-tight text-zinc-100 font-sans">{project.name}</h1>
                <p className="text-xs text-zinc-500 leading-relaxed max-w-2xl">{project.description || "No description provided."}</p>
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-[10px] bg-indigo-600/10 text-indigo-400 border border-indigo-500/25 px-2.5 py-0.5 rounded-full capitalize font-semibold tracking-wide">
                    Project Role: {effectiveRole}
                  </span>
                </div>
              </div>
              
              <div className="flex flex-wrap gap-3">
                {canDeleteProj && (
                  <Button
                    onClick={() => setDeleteProjectOpen(true)}
                    variant="ghost"
                    className="border border-red-500/20 text-red-400 hover:bg-red-500/15 text-xs h-10 px-4 rounded-lg flex items-center gap-1.5"
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete Project
                  </Button>
                )}
                {canUpload && (
                  <Button
                    onClick={() => setUploadOpen(true)}
                    className="bg-indigo-600 hover:bg-indigo-500 text-zinc-50 font-semibold h-10 px-5 rounded-lg shadow-md shadow-indigo-600/10 hover:shadow-indigo-500/20 transition-all flex items-center gap-2"
                  >
                    <Plus className="h-4.5 w-4.5" />
                    Upload Video
                  </Button>
                )}
              </div>
            </div>

            {/* Split Content: Videos Grid + Members Sidebar */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 items-start">
              
              {/* Videos Grid */}
              <div className="lg:col-span-3 space-y-6">
                <h2 className="text-sm font-bold text-zinc-400 tracking-wider uppercase">Project Video Assets ({videos.length})</h2>

                {videos.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                    {videos.map((vid) => (
                      <VideoCard
                        key={vid.id}
                        video={vid}
                        onEditTitle={effectiveRole !== "viewer" ? startEditTitle : undefined}
                        onDeleteVideo={effectiveRole !== "viewer" ? setDeletingVideo : undefined}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-24 text-center rounded-2xl border border-dashed border-zinc-850 bg-zinc-950/10">
                    <Film className="h-10 w-10 text-zinc-600 mb-4" />
                    <p className="text-sm text-zinc-400 font-semibold">No videos in this project</p>
                    <p className="text-xs text-zinc-500 mt-1 mb-6">Start collaborating by uploading your first creative cut.</p>
                    {canUpload && (
                      <Button onClick={() => setUploadOpen(true)} className="bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg">
                        Upload Your First Video
                      </Button>
                    )}
                  </div>
                )}
              </div>

              {/* Members Sidebar Panel */}
              <div className="border border-zinc-800 bg-[#121214]/30 rounded-2xl p-5 space-y-6">
                <div className="flex items-center justify-between border-b border-zinc-800/80 pb-4">
                  <div className="flex items-center gap-2">
                    <Users className="h-4.5 w-4.5 text-indigo-400" />
                    <h3 className="text-sm font-bold text-zinc-200">Project Access ({displayedMembers.length})</h3>
                  </div>
                  {canInvite && (
                    <button
                      onClick={() => setAddMemberOpen(true)}
                      className="text-xs text-indigo-400 hover:text-indigo-300 font-bold flex items-center gap-0.5 cursor-pointer"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Add
                    </button>
                  )}
                </div>

                <div className="space-y-4">
                  {displayedMembers.map((m) => (
                    <div key={m.id} className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="h-7 w-7 rounded-full bg-zinc-800 overflow-hidden flex items-center justify-center text-[10px] font-bold text-zinc-400 shrink-0">
                          {m.avatar ? (
                            <img src={m.avatar} alt={m.name} className="h-full w-full object-cover" />
                          ) : (
                            m.name.slice(0, 2).toUpperCase()
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="text-[11px] font-bold text-zinc-300 truncate">{m.name}</p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <p className="text-[9px] text-zinc-500 truncate capitalize">{m.role}</p>
                            {m._isOrgLevel && (
                              <span className="text-[8px] bg-violet-600/10 text-violet-400 border border-violet-500/20 px-1.5 py-0.5 rounded-full font-semibold">Org</span>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      {canRemoveMember(m) && (
                        <button
                          onClick={() => setRemovingMember(m)}
                          className="text-[10px] text-zinc-600 hover:text-red-400 hover:bg-red-500/10 p-1.5 rounded transition-all cursor-pointer"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  ))}
                  {displayedMembers.length === 0 && (
                    <p className="text-xs text-zinc-600 italic">No assigned project members yet.</p>
                  )}
                </div>
              </div>

            </div>

          </div>
        </main>
      </div>

      {/* Upload Modal Container */}
      <UploadModal
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        onSuccess={() => setRefreshTrigger(prev => prev + 1)}
        projectId={projectId}
      />

      {/* Add Member Modal */}
      <Dialog open={addMemberOpen} onOpenChange={(open) => !open && setAddMemberOpen(false)}>
        <DialogContent className="sm:max-w-md border-zinc-800 bg-[#121214] text-zinc-100 shadow-2xl rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold text-zinc-100">
              Assign Project Member
            </DialogTitle>
            <p className="text-xs text-zinc-500 mt-1">
              Add users to this project with specialized editor/viewer roles. Note: they must belong to the organization.
            </p>
          </DialogHeader>

          <form onSubmit={handleAddProjectMember} className="space-y-4 py-4">
            <div className="space-y-2">
              <label htmlFor="member-email-select" className="text-xs font-semibold text-zinc-400">
                Select Member
              </label>
              <select
                id="member-email-select"
                value={memberEmail}
                onChange={(e) => setMemberEmail(e.target.value)}
                className="w-full h-10 px-3 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-200 focus:border-indigo-500 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                required
                disabled={addingMember}
              >
                <option value="">Choose a member...</option>
                {assignableMembers.map((m) => (
                  <option key={m.user_id} value={m.email}>
                    {m.name} ({m.email})
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label htmlFor="member-role-select" className="text-xs font-semibold text-zinc-400">
                Project Role
              </label>
              <select
                id="member-role-select"
                value={memberRole}
                onChange={(e) => setMemberRole(e.target.value as any)}
                className="w-full h-10 px-3 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-200 focus:border-indigo-500 text-sm"
                disabled={addingMember}
              >
                <option value="viewer">Viewer (View and leave comments only)</option>
                <option value="editor">Editor (Upload/delete videos, leave comments)</option>
              </select>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setAddMemberOpen(false)}
                className="text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 h-9 px-4 rounded-lg cursor-pointer"
                disabled={addingMember}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="bg-indigo-600 hover:bg-indigo-500 text-zinc-50 font-medium h-9 px-4 rounded-lg shadow-md transition-all duration-200 cursor-pointer"
                disabled={addingMember || !memberEmail.trim()}
              >
                {addingMember ? (
                  <div className="flex items-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-200 border-t-transparent" />
                    <span>Adding...</span>
                  </div>
                ) : (
                  "Add Member"
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Title Dialog */}
      <Dialog open={!!editingVideo} onOpenChange={(open) => !open && setEditingVideo(null)}>
        <DialogContent className="sm:max-w-md border-zinc-800 bg-[#121214] text-zinc-100 shadow-2xl rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold text-zinc-100">
              Rename Video
            </DialogTitle>
            <p className="text-xs text-zinc-500 mt-1">
              Give your video project a new name.
            </p>
          </DialogHeader>

          <form onSubmit={handleSaveVideoTitle} className="space-y-4 py-4">
            <div className="space-y-2">
              <label htmlFor="edit-video-title-input" className="text-xs font-semibold text-zinc-400">
                Title
              </label>
              <Input
                id="edit-video-title-input"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Enter title"
                className="w-full bg-zinc-900 border-zinc-800 text-zinc-100 focus:border-indigo-500"
                required
                disabled={savingTitle}
                autoFocus
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setEditingVideo(null)}
                className="text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 h-9 rounded-lg px-4 cursor-pointer"
                disabled={savingTitle}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="bg-indigo-600 hover:bg-indigo-500 text-zinc-50 font-medium h-9 px-4 rounded-lg shadow-md transition-all duration-200 cursor-pointer"
                disabled={savingTitle || !newTitle.trim()}
              >
                {savingTitle ? "Saving..." : "Save changes"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Video Confirmation Dialog */}
      <Dialog open={!!deletingVideo} onOpenChange={(open) => !open && setDeletingVideo(null)}>
        <DialogContent className="sm:max-w-md border-zinc-800 bg-[#121214] text-zinc-100 shadow-2xl rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold text-red-400">
              Delete Video
            </DialogTitle>
            <div className="text-xs text-zinc-500 mt-1 leading-relaxed">
              Are you sure you want to delete <span className="text-zinc-300 font-semibold">&ldquo;{deletingVideo?.title}&rdquo;</span>? This will permanently delete the video file from the R2 bucket and erase all comments. This action cannot be undone.
            </div>
          </DialogHeader>

          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setDeletingVideo(null)}
              className="text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 h-9 px-4 cursor-pointer"
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleDeleteVideo}
              className="bg-red-600 hover:bg-red-500 text-zinc-50 font-medium h-9 px-4 rounded-lg shadow-md transition-all duration-200 cursor-pointer"
              disabled={deleting}
            >
              {deleting ? "Deleting..." : "Delete Video"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Remove Member Confirmation Dialog */}
      <Dialog open={!!removingMember} onOpenChange={(open) => !open && setRemovingMember(null)}>
        <DialogContent className="sm:max-w-md border-zinc-800 bg-[#121214] text-zinc-100 shadow-2xl rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold text-red-400">
              Remove Member
            </DialogTitle>
            <div className="text-xs text-zinc-500 mt-2 leading-relaxed">
              {removingMember?._isOrgLevel ? (
                <span>
                  Are you sure you want to remove <span className="text-zinc-300 font-semibold">{removingMember?.name}</span> from the entire organization? This will also remove them from all projects.
                </span>
              ) : (
                <span>
                  Are you sure you want to remove <span className="text-zinc-300 font-semibold">{removingMember?.name}</span> from this project?
                </span>
              )}
            </div>
          </DialogHeader>
          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setRemovingMember(null)}
              className="text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 h-9 px-4 rounded-lg cursor-pointer text-xs"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={async () => {
                if (!removingMember) return;
                await handleRemoveMember(removingMember.user_id, removingMember._isOrgLevel);
                setRemovingMember(null);
              }}
              className="bg-red-600 hover:bg-red-500 text-zinc-50 font-medium h-9 px-4 rounded-lg shadow-md transition-all duration-200 cursor-pointer text-xs"
            >
              Remove Member
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Project Confirmation Dialog */}
      <Dialog open={deleteProjectOpen} onOpenChange={(open) => !open && setDeleteProjectOpen(false)}>
        <DialogContent className="sm:max-w-md border-zinc-800 bg-[#121214] text-zinc-100 shadow-2xl rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold text-red-400">
              Delete Project
            </DialogTitle>
            <div className="text-xs text-zinc-500 mt-2 leading-relaxed font-normal">
              Are you sure you want to delete <span className="text-zinc-300 font-semibold">&ldquo;{project?.name}&rdquo;</span>? This will permanently delete the project and all video assets inside. This action cannot be undone.
            </div>
          </DialogHeader>
          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setDeleteProjectOpen(false)}
              className="text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 h-9 px-4 rounded-lg cursor-pointer text-xs"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={async () => {
                await handleDeleteProject();
                setDeleteProjectOpen(false);
              }}
              className="bg-red-600 hover:bg-red-500 text-zinc-50 font-medium h-9 px-4 rounded-lg shadow-md transition-all duration-200 cursor-pointer text-xs"
            >
              Delete Project
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
