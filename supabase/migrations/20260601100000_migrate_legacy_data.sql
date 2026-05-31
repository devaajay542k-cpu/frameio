-- 1. Create a version record for each existing video that doesn't have any version
INSERT INTO public.video_versions (id, video_id, version_number, storage_path, thumbnail_url, duration, file_size, change_notes, status, created_at)
SELECT 
    gen_random_uuid(),
    v.id, 
    1, 
    COALESCE(
        -- Extract the key if it matches Next.js api URL structure: /api/video-file?key=xxx
        substring(v.video_url from 'key=([^&]+)'),
        v.video_url,
        ''
    ),
    v.thumbnail_url,
    COALESCE(v.duration_seconds, 0),
    0,
    'Initial upload',
    'Draft',
    v.created_at
FROM public.videos v
LEFT JOIN public.video_versions vv ON vv.video_id = v.id
WHERE vv.id IS NULL;

-- 2. Link each video to its newly created Version 1 as current_version_id
UPDATE public.videos v
SET current_version_id = vv.id
FROM public.video_versions vv
WHERE vv.video_id = v.id AND v.current_version_id IS NULL;

-- 3. Link all legacy comments to their video's active/current version
UPDATE public.comments c
SET video_version_id = v.current_version_id
FROM public.videos v
WHERE v.id = c.video_id AND c.video_version_id IS NULL;
