export interface User {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string;
}

export interface VideoVersion {
  id: string;
  video_id: string;
  version_number: number;
  storage_path: string;
  thumbnail_url?: string;
  duration: number;
  file_size: number;
  uploaded_by?: string;
  change_notes?: string;
  status: "Draft" | "In Review" | "Changes Requested" | "Approved" | "Final";
  created_at: string;
  uploader?: {
    id: string;
    name: string;
    email: string;
    avatar?: string;
  };
}

export interface Comment {
  id: string;
  videoId: string;
  videoVersionId?: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  timestamp: number | null; // Null if it is a general comment, or number in seconds
  content: string;
  createdAt: string;
}

export interface Video {
  id: string;
  title: string;
  description: string;
  thumbnailUrl: string;
  videoUrl: string;
  duration: number; // in seconds
  createdAt: string;
  commentsCount: number;
  project_id?: string;
  current_version_id?: string | null;
  versions?: VideoVersion[];
}
