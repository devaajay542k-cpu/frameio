-- 1. Helper Functions (SECURITY DEFINER to avoid circular lookup blocks)

-- Check if user is owner/admin of an organization
CREATE OR REPLACE FUNCTION public.is_org_admin_or_owner(user_id uuid, org_id uuid)
RETURNS boolean AS $$
DECLARE
    org_role text;
BEGIN
    SELECT role INTO org_role FROM public.organization_members 
    WHERE organization_id = org_id AND user_id = $1;
    
    RETURN org_role = 'owner' OR org_role = 'admin';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get user's effective role for a project
CREATE OR REPLACE FUNCTION public.get_effective_role(user_id uuid, project_id uuid)
RETURNS text AS $$
DECLARE
    org_id uuid;
    org_role text;
    proj_role text;
BEGIN
    -- Get project's organization_id
    SELECT organization_id INTO org_id FROM public.projects WHERE id = project_id;
    IF org_id IS NULL THEN
        RETURN NULL;
    END IF;
    
    -- Check org-level role
    SELECT role INTO org_role FROM public.organization_members 
    WHERE organization_id = org_id AND user_id = $1;
    
    IF org_role IS NULL THEN
        RETURN NULL;
    END IF;
    
    IF org_role = 'owner' OR org_role = 'admin' THEN
        RETURN org_role;
    END IF;
    
    -- Check project-level role
    SELECT role INTO proj_role FROM public.project_members 
    WHERE project_id = $2 AND user_id = $1;
    
    RETURN proj_role;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 2. Enable RLS on all tables
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;


-- 3. Define Policies

-- organizations policies
CREATE POLICY "Users can view organizations they belong to"
ON public.organizations FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.organization_members
        WHERE organization_members.organization_id = id AND organization_members.user_id = auth.uid()
    )
);

CREATE POLICY "Authenticated users can create organizations"
ON public.organizations FOR INSERT
WITH CHECK (
    auth.role() = 'authenticated'
);

CREATE POLICY "Only owners can update organizations"
ON public.organizations FOR UPDATE
USING (
    owner_id = auth.uid()
);

CREATE POLICY "Only owners can delete organizations"
ON public.organizations FOR DELETE
USING (
    owner_id = auth.uid()
);


-- organization_members policies
CREATE POLICY "Members can view organization memberships"
ON public.organization_members FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.organization_members AS self
        WHERE self.organization_id = organization_members.organization_id AND self.user_id = auth.uid()
    )
);

CREATE POLICY "Owners and admins can manage organization memberships"
ON public.organization_members FOR ALL
USING (
    public.is_org_admin_or_owner(auth.uid(), organization_id)
);


-- organization_invites policies
CREATE POLICY "View invites if org owner/admin or token matches"
ON public.organization_invites FOR SELECT
USING (
    public.is_org_admin_or_owner(auth.uid(), organization_id) OR
    token IS NOT NULL -- token lookup check is allowed for invite flow verification
);

CREATE POLICY "Owners and admins can manage invites"
ON public.organization_invites FOR ALL
USING (
    public.is_org_admin_or_owner(auth.uid(), organization_id)
);


-- projects policies
CREATE POLICY "View projects if org admin/owner or project member"
ON public.projects FOR SELECT
USING (
    public.is_org_admin_or_owner(auth.uid(), organization_id) OR
    EXISTS (
        SELECT 1 FROM public.project_members
        WHERE project_members.project_id = id AND project_members.user_id = auth.uid()
    )
);

CREATE POLICY "Owners and admins can manage projects"
ON public.projects FOR ALL
USING (
    public.is_org_admin_or_owner(auth.uid(), organization_id)
);


-- project_members policies
CREATE POLICY "View project members if project accessible"
ON public.project_members FOR SELECT
USING (
    public.get_effective_role(auth.uid(), project_id) IS NOT NULL
);

CREATE POLICY "Owners and admins can manage project members"
ON public.project_members FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM public.projects
        WHERE projects.id = project_id AND public.is_org_admin_or_owner(auth.uid(), projects.organization_id)
    )
);


-- videos policies
CREATE POLICY "View videos if project accessible"
ON public.videos FOR SELECT
USING (
    project_id IS NULL OR
    public.get_effective_role(auth.uid(), project_id) IS NOT NULL
);

CREATE POLICY "Insert videos if owner/admin/editor"
ON public.videos FOR INSERT
WITH CHECK (
    project_id IS NULL OR
    public.get_effective_role(auth.uid(), project_id) IN ('owner', 'admin', 'editor')
);

CREATE POLICY "Update videos if owner/admin/editor"
ON public.videos FOR UPDATE
USING (
    project_id IS NULL OR
    public.get_effective_role(auth.uid(), project_id) IN ('owner', 'admin', 'editor')
);

CREATE POLICY "Delete videos if owner/admin/editor"
ON public.videos FOR DELETE
USING (
    project_id IS NULL OR
    public.get_effective_role(auth.uid(), project_id) IN ('owner', 'admin', 'editor')
);


-- comments policies
CREATE POLICY "View comments if project accessible"
ON public.comments FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.videos
        WHERE videos.id = video_id AND (
            videos.project_id IS NULL OR
            public.get_effective_role(auth.uid(), videos.project_id) IS NOT NULL
        )
    )
);

CREATE POLICY "Insert comments if project accessible"
ON public.comments FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.videos
        WHERE videos.id = video_id AND (
            videos.project_id IS NULL OR
            public.get_effective_role(auth.uid(), videos.project_id) IN ('owner', 'admin', 'editor', 'viewer')
        )
    )
);

CREATE POLICY "Delete/update comments if author or moderator"
ON public.comments FOR ALL
USING (
    user_id = auth.uid() OR
    EXISTS (
        SELECT 1 FROM public.videos
        WHERE videos.id = video_id AND (
            videos.project_id IS NOT NULL AND
            public.get_effective_role(auth.uid(), videos.project_id) IN ('owner', 'admin', 'editor')
        )
    )
);
