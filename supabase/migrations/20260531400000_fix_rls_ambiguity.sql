-- 1. Drop existing helper functions with CASCADE to clear any parameter signature conflicts.
-- This will also automatically drop any dependent RLS policies, which we will recreate below.
DROP FUNCTION IF EXISTS public.is_org_member(uuid, uuid) CASCADE;
DROP FUNCTION IF EXISTS public.is_project_member(uuid, uuid) CASCADE;
DROP FUNCTION IF EXISTS public.is_org_admin_or_owner(uuid, uuid) CASCADE;
DROP FUNCTION IF EXISTS public.is_org_admin_or_owner_for_project(uuid, uuid) CASCADE;
DROP FUNCTION IF EXISTS public.get_effective_role(uuid, uuid) CASCADE;

-- 2. Redefine helper functions using prefixed parameter names to avoid PL/pgSQL variable vs column name conflicts.

-- Check if user is member of organization
CREATE OR REPLACE FUNCTION public.is_org_member(p_user_id uuid, p_org_id uuid)
RETURNS boolean AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.organization_members 
        WHERE organization_id = p_org_id AND user_id = p_user_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check if user is member of project
CREATE OR REPLACE FUNCTION public.is_project_member(p_user_id uuid, p_project_id uuid)
RETURNS boolean AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.project_members 
        WHERE project_id = p_project_id AND user_id = p_user_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check if user is owner or admin of organization
CREATE OR REPLACE FUNCTION public.is_org_admin_or_owner(p_user_id uuid, p_org_id uuid)
RETURNS boolean AS $$
DECLARE
    org_role text;
BEGIN
    SELECT role INTO org_role FROM public.organization_members 
    WHERE organization_id = p_org_id AND user_id = p_user_id;
    
    RETURN org_role = 'owner' OR org_role = 'admin';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check if user is owner/admin of org for a given project ID
CREATE OR REPLACE FUNCTION public.is_org_admin_or_owner_for_project(p_user_id uuid, p_project_id uuid)
RETURNS boolean AS $$
DECLARE
    p_org_id uuid;
BEGIN
    SELECT organization_id INTO p_org_id FROM public.projects WHERE id = p_project_id;
    IF p_org_id IS NULL THEN
        RETURN FALSE;
    END IF;
    RETURN public.is_org_admin_or_owner(p_user_id, p_org_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get user's effective role for a project
CREATE OR REPLACE FUNCTION public.get_effective_role(p_user_id uuid, p_project_id uuid)
RETURNS text AS $$
DECLARE
    p_org_id uuid;
    org_role text;
    proj_role text;
BEGIN
    -- Get project's organization_id
    SELECT organization_id INTO p_org_id FROM public.projects WHERE id = p_project_id;
    IF p_org_id IS NULL THEN
        RETURN NULL;
    END IF;
    
    -- Check org-level role
    SELECT role INTO org_role FROM public.organization_members 
    WHERE organization_id = p_org_id AND user_id = p_user_id;
    
    IF org_role IS NULL THEN
        RETURN NULL;
    END IF;
    
    IF org_role = 'owner' OR org_role = 'admin' THEN
        RETURN org_role;
    END IF;
    
    -- Check project-level role
    SELECT role INTO proj_role FROM public.project_members 
    WHERE project_id = p_project_id AND user_id = p_user_id;
    
    RETURN proj_role;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 3. Recreate the RLS policies that were dropped by the CASCADE operation.

-- organizations SELECT policy
CREATE POLICY "Users can view organizations they belong to"
ON public.organizations FOR SELECT
USING (
    public.is_org_member(auth.uid(), id)
);

-- organization_members policies
CREATE POLICY "Members can view organization memberships"
ON public.organization_members FOR SELECT
USING (
    public.is_org_member(auth.uid(), organization_id)
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
    token IS NOT NULL
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
    public.is_project_member(auth.uid(), id)
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
    public.is_org_admin_or_owner_for_project(auth.uid(), project_id)
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
