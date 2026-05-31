-- Drop the existing select policy on organizations
DROP POLICY IF EXISTS "Users can view organizations they belong to" ON public.organizations;

-- Recreate it to allow both owners (creator) and members to view the organization
CREATE POLICY "Users can view organizations they belong to"
ON public.organizations FOR SELECT
USING (
    owner_id = auth.uid() OR
    public.is_org_member(auth.uid(), id)
);
