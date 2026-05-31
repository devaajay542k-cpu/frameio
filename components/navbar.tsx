"use client";

import { useRouter } from "next/navigation";
import { Film, Bell, LogOut, User as UserIcon, Settings, Menu, Plus, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

interface NavbarProps {
  onUploadClick?: () => void;
  onMobileMenuClick?: () => void;
}

interface UserProfile {
  name: string;
  email: string;
  avatarUrl?: string;
}

export default function Navbar({ onUploadClick, onMobileMenuClick }: NavbarProps) {
  const router = useRouter();
  const [user, setUser] = useState<UserProfile | null>(null);

  useEffect(() => {
    async function getUser() {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const metadata = session.user.user_metadata || {};
        setUser({
          name: metadata.full_name || metadata.name || session.user.email?.split("@")[0] || "User",
          email: session.user.email || "",
          avatarUrl: metadata.avatar_url || undefined,
        });
      }
    }
    getUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        const metadata = session.user.user_metadata || {};
        setUser({
          name: metadata.full_name || metadata.name || session.user.email?.split("@")[0] || "User",
          email: session.user.email || "",
          avatarUrl: metadata.avatar_url || undefined,
        });
      } else {
        setUser(null);
      }
    });

    return () => { subscription.unsubscribe(); };
  }, []);

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut();
      router.push("/login");
    } catch {
      router.push("/login");
    }
  };

  const displayName = user?.name || "User";
  const displayEmail = user?.email || "";
  const initials = displayName.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2) || "U";

  return (
    <header className="sticky top-0 z-40 w-full h-12 border-b border-[rgba(255,255,255,0.07)] bg-[#0e0e0e] flex items-center">
      <div className="flex h-full w-full items-center justify-between px-4">

        {/* Left: Logo */}
        <div className="flex items-center gap-3">
          {onMobileMenuClick && (
            <button
              onClick={onMobileMenuClick}
              className="md:hidden p-1.5 rounded-md text-[#6b6b6b] hover:text-[#ededed] hover:bg-[#1a1a1a] transition-colors"
            >
              <Menu className="h-4 w-4" />
            </button>
          )}
          <button
            onClick={() => router.push("/")}
            className="flex items-center gap-2 group"
          >
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-indigo-600">
              <Film className="h-3.5 w-3.5 text-white" />
            </div>
            <span className="text-sm font-semibold text-[#ededed] tracking-tight">
              ShotFlow
            </span>
          </button>

          {/* Breadcrumb separator style */}
          <span className="text-[#333] text-base font-light select-none hidden sm:block">/</span>
        </div>

        {/* Right: actions */}
        <div className="flex items-center gap-1">

          <button className="p-1.5 rounded-md text-[#6b6b6b] hover:text-[#ededed] hover:bg-[#1a1a1a] transition-colors">
            <Bell className="h-4 w-4" />
          </button>

          {/* User menu */}
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <button className="flex items-center gap-1.5 px-2 py-1 rounded-md hover:bg-[#1a1a1a] transition-colors group" />
              }
            >
              <Avatar className="h-6 w-6 rounded-full">
                {user?.avatarUrl && <AvatarImage src={user.avatarUrl} alt={displayName} />}
                <AvatarFallback className="bg-indigo-600/20 text-indigo-400 text-[10px] font-bold rounded-full">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <ChevronDown className="h-3 w-3 text-[#6b6b6b] group-hover:text-[#a1a1a1] transition-colors" />
            </DropdownMenuTrigger>
            <DropdownMenuContent
              className="w-56 border-[rgba(255,255,255,0.08)] bg-[#141414]/95 backdrop-blur-md text-[#ededed] shadow-2xl rounded-lg p-1"
              align="end"
            >
              <div className="px-2 py-1.5 mb-1">
                <p className="text-xs font-medium text-[#ededed] truncate">{displayName}</p>
                <p className="text-[11px] text-[#6b6b6b] truncate mt-0.5">{displayEmail}</p>
              </div>
              <DropdownMenuSeparator className="bg-[rgba(255,255,255,0.07)] my-1" />
              <DropdownMenuGroup>
                <DropdownMenuItem className="text-xs text-[#a1a1a1] hover:text-[#ededed] hover:bg-[#1a1a1a] rounded-md px-2 py-1.5 cursor-pointer transition-colors focus:bg-[#1a1a1a] focus:text-[#ededed]">
                  <UserIcon className="mr-2 h-3.5 w-3.5" />
                  Account
                </DropdownMenuItem>
                <DropdownMenuItem className="text-xs text-[#a1a1a1] hover:text-[#ededed] hover:bg-[#1a1a1a] rounded-md px-2 py-1.5 cursor-pointer transition-colors focus:bg-[#1a1a1a] focus:text-[#ededed]">
                  <Settings className="mr-2 h-3.5 w-3.5" />
                  Settings
                </DropdownMenuItem>
              </DropdownMenuGroup>
              <DropdownMenuSeparator className="bg-[rgba(255,255,255,0.07)] my-1" />
              <DropdownMenuItem
                onClick={handleSignOut}
                className="text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-md px-2 py-1.5 cursor-pointer transition-colors focus:bg-red-500/10 focus:text-red-300"
              >
                <LogOut className="mr-2 h-3.5 w-3.5" />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
