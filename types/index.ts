export interface User {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string;
}

export interface Comment {
  id: string;
  videoId: string;
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
}
