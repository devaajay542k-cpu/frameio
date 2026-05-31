-- Alter organizations table to add logo_url if it doesn't exist
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS logo_url text;

-- Create organization_members table
CREATE TABLE IF NOT EXISTS public.organization_members (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    role text NOT NULL CHECK (role IN ('owner', 'admin', 'member')),
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT unique_organization_user UNIQUE (organization_id, user_id)
);

-- Create organization_invites table
CREATE TABLE IF NOT EXISTS public.organization_invites (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
    email text NOT NULL,
    role text NOT NULL CHECK (role IN ('owner', 'admin', 'member')),
    token text NOT NULL UNIQUE,
    invited_by uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    accepted boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now()
);

-- Create projects table
CREATE TABLE IF NOT EXISTS public.projects (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
    name text NOT NULL,
    description text,
    created_by uuid REFERENCES auth.users(id),
    created_at timestamp with time zone DEFAULT now()
);

-- Create project_members table
CREATE TABLE IF NOT EXISTS public.project_members (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE,
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    role text NOT NULL CHECK (role IN ('editor', 'viewer')),
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT unique_project_user UNIQUE (project_id, user_id)
);

-- Alter videos table to match the specifications
ALTER TABLE public.videos ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE;
ALTER TABLE public.videos ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE public.videos ADD COLUMN IF NOT EXISTS stream_uid text;
ALTER TABLE public.videos ADD COLUMN IF NOT EXISTS thumbnail_url text;
ALTER TABLE public.videos ADD COLUMN IF NOT EXISTS duration_seconds integer DEFAULT 0;
ALTER TABLE public.videos ADD COLUMN IF NOT EXISTS status text DEFAULT 'uploading' CHECK (status IN ('uploading', 'processing', 'ready', 'failed'));

-- Alter comments table to match specifications
ALTER TABLE public.comments ADD COLUMN IF NOT EXISTS content text;
ALTER TABLE public.comments ADD COLUMN IF NOT EXISTS text text; -- Keep for backward compatibility

-- Disable RLS to allow API-managed authorization checks
ALTER TABLE public.organizations DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_members DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_invites DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_members DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.videos DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments DISABLE ROW LEVEL SECURITY;

-- ═══════════════════════════════════════════════════════════════
-- NOTE: Test users are created via scripts/seed-test-users.mjs
-- using the Supabase Admin API. The following seed data is kept
-- as a reference but users should be created via the seed script.
--
-- Test users:
--   owner@testuser.com  (Owner)     password: TestUser@123
--   admin@testuser.com  (Admin)     password: TestUser@123
--   editor@testuser.com (Member)    password: TestUser@123
--   member@testuser.com (Member)    password: TestUser@123
-- ═══════════════════════════════════════════════════════════════

-- Seed organization: Acme Agency (if not already created)
INSERT INTO public.organizations (id, name)
VALUES ('e1111111-1111-1111-1111-111111111111', 'Acme Agency')
ON CONFLICT (id) DO NOTHING;

-- Seed projects (owner will be set by the seed script)
INSERT INTO public.projects (id, organization_id, name, description)
VALUES
  ('d1111111-1111-1111-1111-111111111111', 'e1111111-1111-1111-1111-111111111111', 'Nike Campaign', 'Nike commercial editing drafts and final renders.'),
  ('d2222222-2222-2222-2222-222222222222', 'e1111111-1111-1111-1111-111111111111', 'Samsung Campaign', 'Samsung launch showcase edits.')
ON CONFLICT (id) DO NOTHING;
