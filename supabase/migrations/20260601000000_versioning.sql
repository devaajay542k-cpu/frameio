-- 1. Create video_versions table
CREATE TABLE IF NOT EXISTS public.video_versions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    video_id uuid REFERENCES public.videos(id) ON DELETE CASCADE,
    version_number integer NOT NULL,
    storage_path text NOT NULL,
    thumbnail_url text,
    duration integer DEFAULT 0,
    file_size bigint DEFAULT 0,
    uploaded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    change_notes text,
    status text NOT NULL DEFAULT 'Draft' CHECK (status IN ('Draft', 'In Review', 'Changes Requested', 'Approved', 'Final')),
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT unique_video_version UNIQUE (video_id, version_number)
);

-- 2. Alter videos table to add version reference and audit columns
ALTER TABLE public.videos ADD COLUMN IF NOT EXISTS current_version_id uuid REFERENCES public.video_versions(id) ON DELETE SET NULL;
ALTER TABLE public.videos ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.videos ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT now();

-- 3. Alter comments table to add video_version_id reference
ALTER TABLE public.comments ADD COLUMN IF NOT EXISTS video_version_id uuid REFERENCES public.video_versions(id) ON DELETE CASCADE;

-- 4. Enable RLS on video_versions table
ALTER TABLE public.video_versions ENABLE ROW LEVEL SECURITY;

-- 5. Drop old comment policies and recreate them using video_version_id
DROP POLICY IF EXISTS "View comments if project accessible" ON public.comments;
DROP POLICY IF EXISTS "Insert comments if project accessible" ON public.comments;
DROP POLICY IF EXISTS "Delete/update comments if author or moderator" ON public.comments;

-- Recreate comments policies to use video_version_id
CREATE POLICY "View comments if project accessible"
ON public.comments FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.video_versions
        JOIN public.videos ON videos.id = video_versions.video_id
        WHERE video_versions.id = video_version_id AND (
            videos.project_id IS NULL OR
            public.get_effective_role(auth.uid(), videos.project_id) IS NOT NULL
        )
    )
);

CREATE POLICY "Insert comments if project accessible"
ON public.comments FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.video_versions
        JOIN public.videos ON videos.id = video_versions.video_id
        WHERE video_versions.id = video_version_id AND (
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
        SELECT 1 FROM public.video_versions
        JOIN public.videos ON videos.id = video_versions.video_id
        WHERE video_versions.id = video_version_id AND (
            videos.project_id IS NOT NULL AND
            public.get_effective_role(auth.uid(), videos.project_id) IN ('owner', 'admin', 'editor')
        )
    )
);

-- 6. Define RLS Policies for video_versions
CREATE POLICY "View video versions if project accessible"
ON public.video_versions FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.videos
        WHERE videos.id = video_id AND (
            videos.project_id IS NULL OR
            public.get_effective_role(auth.uid(), videos.project_id) IS NOT NULL
        )
    )
);

CREATE POLICY "Insert video versions if owner/admin/editor"
ON public.video_versions FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.videos
        WHERE videos.id = video_id AND (
            videos.project_id IS NULL OR
            public.get_effective_role(auth.uid(), videos.project_id) IN ('owner', 'admin', 'editor')
        )
    )
);

CREATE POLICY "Update video versions if owner/admin/editor"
ON public.video_versions FOR UPDATE
USING (
    EXISTS (
        SELECT 1 FROM public.videos
        WHERE videos.id = video_id AND (
            videos.project_id IS NULL OR
            public.get_effective_role(auth.uid(), videos.project_id) IN ('owner', 'admin', 'editor')
        )
    )
);

CREATE POLICY "Delete video versions if owner"
ON public.video_versions FOR DELETE
USING (
    EXISTS (
        SELECT 1 FROM public.videos
        WHERE videos.id = video_id AND (
            videos.project_id IS NULL OR
            public.get_effective_role(auth.uid(), videos.project_id) = 'owner'
        )
    )
);

-- 7. Trigger to enforce "Only the latest version can be marked Final"
CREATE OR REPLACE FUNCTION public.check_video_version_final_status()
RETURNS TRIGGER AS $$
DECLARE
    max_ver integer;
BEGIN
    IF NEW.status = 'Final' THEN
        SELECT COALESCE(MAX(version_number), 0) INTO max_ver 
        FROM public.video_versions 
        WHERE video_id = NEW.video_id;
        
        -- If updating an existing version to Final, make sure it is indeed the latest version number
        IF NEW.version_number < max_ver THEN
            RAISE EXCEPTION 'Only the latest version may be marked Final.';
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_check_video_version_final_status ON public.video_versions;
CREATE TRIGGER trg_check_video_version_final_status
BEFORE INSERT OR UPDATE OF status ON public.video_versions
FOR EACH ROW EXECUTE FUNCTION public.check_video_version_final_status();
