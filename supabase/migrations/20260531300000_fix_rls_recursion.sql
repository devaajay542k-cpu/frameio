-- 1. Helper Functions (SECURITY DEFINER to prevent RLS recursion loops)

-- Check if user is member of organization
CREATE OR REPLACE FUNCTION public.is_org_member(user_id uuid, org_id uuid)
RETURNS boolean AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.organization_members 
        WHERE organization_id = org_id AND user_id = $1
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check if user is member of project
CREATE OR REPLACE FUNCTION public.is_project_member(user_id uuid, project_id uuid)
RETURNS boolean AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.project_members 
        WHERE project_id = $2 AND user_id = $1
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check if user is owner/admin of org for a given project ID
CREATE OR REPLACE FUNCTION public.is_org_admin_or_owner_for_project(user_id uuid, project_id uuid)
RETURNS boolean AS $$
DECLARE
    org_id uuid;
BEGIN
    SELECT organization_id INTO org_id FROM public.projects WHERE id = project_id;
    IF org_id IS NULL THEN
        RETURN FALSE;
    END IF;
    RETURN public.is_org_admin_or_owner(user_id, org_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 2. Drop existing policies to recreate them without recursion
DROP POLICY IF EXISTS "Users can view organizations they belong to" ON public.organizations;
DROP POLICY IF EXISTS "Members can view organization memberships" ON public.organization_members;
DROP POLICY IF EXISTS "Owners and admins can manage organization memberships" ON public.organization_members;
DROP POLICY IF EXISTS "View projects if org admin/owner or project member" ON public.projects;
DROP POLICY IF EXISTS "Owners and admins can manage project members" ON public.project_members;


-- 3. Recreate policies using helper functions

-- organizations select policy
CREATE POLICY "Users can view organizations they belong to"
ON public.organizations FOR SELECT
USING (
    public.is_org_member(auth.uid(), id)
);

-- organization_members select policy (fixed recursion!)
CREATE POLICY "Members can view organization memberships"
ON public.organization_members FOR SELECT
USING (
    public.is_org_member(auth.uid(), organization_id)
);

-- organization_members write policy
CREATE POLICY "Owners and admins can manage organization memberships"
ON public.organization_members FOR ALL
USING (
    public.is_org_admin_or_owner(auth.uid(), organization_id)
);

-- projects select policy
CREATE POLICY "View projects if org admin/owner or project member"
ON public.projects FOR SELECT
USING (
    public.is_org_admin_or_owner(auth.uid(), organization_id) OR
    public.is_project_member(auth.uid(), id)
);

-- project_members write policy
CREATE POLICY "Owners and admins can manage project members"
ON public.project_members FOR ALL
USING (
    public.is_org_admin_or_owner_for_project(auth.uid(), project_id)
);
