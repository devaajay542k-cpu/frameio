-- 1. Helper function (SECURITY DEFINER) to check if a user's email matches a given email
CREATE OR REPLACE FUNCTION public.match_user_email(p_user_id uuid, p_email text)
RETURNS boolean AS $$
DECLARE
    user_email text;
BEGIN
    SELECT email INTO user_email FROM auth.users WHERE id = p_user_id;
    RETURN LOWER(user_email) = LOWER(p_email);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Create UPDATE policy on organization_invites to allow invited users to accept their own invites
CREATE POLICY "Invited users can update their own invite status"
ON public.organization_invites FOR UPDATE
USING (
    public.match_user_email(auth.uid(), email)
)
WITH CHECK (
    public.match_user_email(auth.uid(), email)
);
