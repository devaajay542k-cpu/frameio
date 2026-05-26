"use client";

import { useRouter } from "next/navigation";
import { Film, Search, Bell, LogOut, User as UserIcon, Settings, Menu, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CURRENT_USER } from "@/lib/mock-data";

interface NavbarProps {
  onUploadClick: () => void;
  onMobileMenuClick?: () => void;
}

export default function Navbar({ onUploadClick, onMobileMenuClick }: NavbarProps) {
  const router = useRouter();

  const handleSignOut = () => {
    router.push("/login");
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-zinc-800/80 bg-[#09090b]/80 backdrop-blur-md">
      <div className="flex h-14 items-center justify-between px-4 md:px-6">
        
        {/* Left Section: Logo & Toggle */}
        <div className="flex items-center gap-3">
          {onMobileMenuClick && (
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/50"
              onClick={onMobileMenuClick}
            >
              <Menu className="h-5 w-5" />
            </Button>
          )}

          <div 
            onClick={() => router.push("/")}
            className="flex items-center gap-2.5 cursor-pointer group"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-violet-600 via-indigo-600 to-amber-600 p-0.5 shadow-md shadow-indigo-500/5 transition-transform duration-300 group-hover:scale-105">
              <div className="flex h-full w-full items-center justify-center rounded-[7px] bg-[#09090b]">
                <Film className="h-4.5 w-4.5 text-indigo-400" />
              </div>
            </div>
            <span className="font-sans font-bold tracking-tight text-zinc-100 text-base">
              AETHER
            </span>
          </div>
        </div>

        {/* Middle Section: Search Bar (Desktop) */}
        <div className="hidden md:flex relative max-w-md w-full mx-8">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
          <Input
            type="search"
            placeholder="Search videos, files, folders..."
            className="w-full bg-zinc-900/50 border-zinc-800/80 text-zinc-100 pl-9 pr-4 placeholder:text-zinc-600 focus:border-zinc-700 focus:ring-1 focus:ring-zinc-700 h-9 rounded-lg text-sm"
          />
        </div>

        {/* Right Section: Upload, Actions, User */}
        <div className="flex items-center gap-3">
          
          <Button
            size="sm"
            onClick={onUploadClick}
            className="bg-indigo-600 hover:bg-indigo-500 text-zinc-50 font-medium h-9 px-4 rounded-lg shadow-md shadow-indigo-600/10 hover:shadow-indigo-500/20 transition-all duration-200"
          >
            <Plus className="mr-1.5 h-4 w-4" />
            Upload
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className="text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900 h-9 w-9 rounded-lg"
          >
            <Bell className="h-4.5 w-4.5" />
          </Button>

          {/* User Profile Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="ghost"
                  className="relative h-9 w-9 rounded-full border border-zinc-800/80 p-0 hover:bg-zinc-800/20"
                />
              }
            >
              <Avatar className="h-8.5 w-8.5">
                <AvatarImage src={CURRENT_USER.avatarUrl} alt={CURRENT_USER.name} />
                <AvatarFallback className="bg-indigo-900/40 text-indigo-300 text-xs">AM</AvatarFallback>
              </Avatar>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56 border-zinc-800 bg-[#121214] text-zinc-200" align="end">
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium text-zinc-200 leading-none">{CURRENT_USER.name}</p>
                  <p className="text-xs text-zinc-500 leading-none">{CURRENT_USER.email}</p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator className="bg-zinc-800/60" />
              <DropdownMenuItem className="hover:bg-zinc-800/60 cursor-pointer focus:bg-zinc-800/60 focus:text-zinc-100">
                <UserIcon className="mr-2 h-4 w-4 text-zinc-400" />
                <span>My Profile</span>
              </DropdownMenuItem>
              <DropdownMenuItem className="hover:bg-zinc-800/60 cursor-pointer focus:bg-zinc-800/60 focus:text-zinc-100">
                <Settings className="mr-2 h-4 w-4 text-zinc-400" />
                <span>Settings</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-zinc-800/60" />
              <DropdownMenuItem 
                onClick={handleSignOut}
                className="hover:bg-red-950/20 hover:text-red-400 text-red-400 cursor-pointer focus:bg-red-950/20 focus:text-red-400"
              >
                <LogOut className="mr-2 h-4 w-4" />
                <span>Sign Out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

        </div>
      </div>
    </header>
  );
}
