import { Video, Comment, User } from "@/types";

export const CURRENT_USER: User = {
  id: "u-1",
  email: "editor@production-studio.co",
  name: "Alex Mercer",
  avatarUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=256&auto=format&fit=crop",
};

export const MOCK_VIDEOS: Video[] = [
  {
    id: "v-1",
    title: "Cinematic Showcase - Tears of Steel (Grade A Edit)",
    description: "Final graded cinematic edit. Let me know what you think of the color balance and timing in the VFX sequences.",
    thumbnailUrl: "https://images.unsplash.com/photo-1485846234645-a62644f84728?q=80&w=640&auto=format&fit=crop",
    videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4",
    duration: 734, // 12:14
    createdAt: "2026-05-20T10:30:00Z",
    commentsCount: 5,
  },
  {
    id: "v-2",
    title: "Commercial Cut - Sintel Trailer Draft",
    description: "Initial cut of the promotional piece. Needs soundtrack feedback and transition validation.",
    thumbnailUrl: "https://images.unsplash.com/photo-1536440136628-849c177e76a1?q=80&w=640&auto=format&fit=crop",
    videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4",
    duration: 52, // 0:52
    createdAt: "2026-05-24T15:45:00Z",
    commentsCount: 3,
  },
  {
    id: "v-3",
    title: "3D Animation Test - Elephants Dream Showcase",
    description: "Experimental rendering test checking global illumination and physical movement speeds.",
    thumbnailUrl: "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?q=80&w=640&auto=format&fit=crop",
    videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4",
    duration: 653, // 10:53
    createdAt: "2026-05-18T08:15:00Z",
    commentsCount: 4,
  },
  {
    id: "v-4",
    title: "Short B-Roll - For Bigger Blazes",
    description: "Short cinematic clip of fire effects. Verify performance on high-speed footage.",
    thumbnailUrl: "https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?q=80&w=640&auto=format&fit=crop",
    videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
    duration: 15, // 0:15
    createdAt: "2026-05-25T11:00:00Z",
    commentsCount: 1,
  }
];

export const MOCK_COMMENTS: Comment[] = [
  // Comments for Video 1
  {
    id: "c-1",
    videoId: "v-1",
    userId: "u-2",
    userName: "Sarah Jenkins (Director)",
    userAvatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=128&auto=format&fit=crop",
    timestamp: 45, // 0:45
    content: "The contrast here feels a little too high. Can we pull back the shadow values slightly so the character's face is more visible?",
    createdAt: "2026-05-21T14:20:00Z",
  },
  {
    id: "c-2",
    videoId: "v-1",
    userId: "u-3",
    userName: "Michael Chen (VFX Lead)",
    userAvatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=128&auto=format&fit=crop",
    timestamp: 120, // 2:00
    content: "VFX tracking looks rock solid here. Excellent tracking markers placement.",
    createdAt: "2026-05-21T16:05:00Z",
  },
  {
    id: "c-3",
    videoId: "v-1",
    userId: "u-2",
    userName: "Sarah Jenkins (Director)",
    userAvatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=128&auto=format&fit=crop",
    timestamp: 210, // 3:30
    content: "This audio transition is slightly abrupt. Let's do a 0.5s linear crossfade.",
    createdAt: "2026-05-22T09:12:00Z",
  },
  {
    id: "c-4",
    videoId: "v-1",
    userId: "u-4",
    userName: "Emily Ross (Colorist)",
    userAvatar: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?q=80&w=128&auto=format&fit=crop",
    timestamp: 340, // 5:40
    content: "Applied a subtle warm lut. Let me know if the skin tones are look clean here.",
    createdAt: "2026-05-22T11:40:00Z",
  },
  {
    id: "c-5",
    videoId: "v-1",
    userId: "u-1",
    userName: "Alex Mercer (You)",
    userAvatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=256&auto=format&fit=crop",
    timestamp: null, // General comment
    content: "I have uploaded the latest edit. Excited to get everyone's thoughts on this version!",
    createdAt: "2026-05-20T10:31:00Z",
  },

  // Comments for Video 2 (Sintel)
  {
    id: "c-6",
    videoId: "v-2",
    userId: "u-2",
    userName: "Sarah Jenkins (Director)",
    userAvatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=128&auto=format&fit=crop",
    timestamp: 10,
    content: "Cut here feels a bit early. Let's hold on this shot for another 15 frames.",
    createdAt: "2026-05-24T18:20:00Z",
  },
  {
    id: "c-7",
    videoId: "v-2",
    userId: "u-3",
    userName: "Michael Chen (VFX Lead)",
    userAvatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=128&auto=format&fit=crop",
    timestamp: 25,
    content: "The scale of the creature feels off in this angle. Can we make it 10% larger?",
    createdAt: "2026-05-24T19:30:00Z",
  },
  {
    id: "c-8",
    videoId: "v-2",
    userId: "u-1",
    userName: "Alex Mercer (You)",
    userAvatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=256&auto=format&fit=crop",
    timestamp: null,
    content: "This is a quick draft. We will polish the renders in the next milestone.",
    createdAt: "2026-05-24T15:46:00Z",
  }
];
