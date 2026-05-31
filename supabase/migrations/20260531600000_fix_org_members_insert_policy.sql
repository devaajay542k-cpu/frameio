-- 1. Helper function (SECURITY DEFINER) to check if a user is invited to an organization
CREATE OR REPLACE FUNCTION public.is_invited_user(p_user_id uuid, p_org_id uuid)
RETURNS boolean AS $$
DECLARE
    user_email text;
BEGIN
    SELECT email INTO user_email FROM auth.users WHERE id = p_user_id;
    IF user_email IS NULL THEN
        RETURN FALSE;
    END IF;
    
    RETURN EXISTS (
        SELECT 1 FROM public.organization_invites
        WHERE organization_id = p_org_id 
        AND LOWER(email) = LOWER(user_email)
        AND accepted = false
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Drop the old all-encompassing policy
DROP POLICY IF EXISTS "Owners and admins can manage organization memberships" ON public.organization_members;

-- 3. Create specific write policies for organization memberships

-- INSERT: Allow if user is the organization owner, an admin, or the invited user accepting an invite
CREATE POLICY "Insert organization memberships"
ON public.organization_members FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.organizations 
        WHERE organizations.id = organization_id 
        AND organizations.owner_id = auth.uid()
    ) OR
    public.is_org_admin_or_owner(auth.uid(), organization_id) OR
    (
        user_id = auth.uid() AND
        public.is_invited_user(auth.uid(), organization_id)
    )
);

-- UPDATE: Allow organization admins and owners to update memberships
CREATE POLICY "Owners and admins can update organization memberships"
ON public.organization_members FOR UPDATE
USING (
    public.is_org_admin_or_owner(auth.uid(), organization_id)
);

-- DELETE: Allow organization admins and owners to delete memberships
CREATE POLICY "Owners and admins can delete organization memberships"
ON public.organization_members FOR DELETE
USING (
    public.is_org_admin_or_owner(auth.uid(), organization_id)
);
