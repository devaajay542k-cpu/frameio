"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Film, Loader2 } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;

    setIsLoading(true);
    // Simulate login redirect after 1.5 seconds
    setTimeout(() => {
      setIsLoading(false);
      router.push("/");
    }, 1200);
  };

  const handleGoogleLogin = () => {
    setIsGoogleLoading(true);
    // Simulate login redirect after 1.5 seconds
    setTimeout(() => {
      setIsGoogleLoading(false);
      router.push("/");
    }, 1200);
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center bg-[#09090b] px-4 overflow-hidden">
      {/* Background Gradients */}
      <div className="absolute inset-0 z-0 overflow-hidden">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-violet-600/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-amber-600/10 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-indigo-500/5 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 w-full max-w-[420px]">
        {/* Logo Header */}
        <div className="flex flex-col items-center mb-8">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 via-indigo-600 to-amber-600 p-0.5 shadow-xl shadow-indigo-500/10">
            <div className="flex h-full w-full items-center justify-center rounded-[10px] bg-[#09090b]">
              <Film className="h-6 w-6 text-indigo-400" />
            </div>
          </div>
          <h1 className="mt-4 text-2xl font-bold tracking-tight bg-gradient-to-r from-zinc-50 via-zinc-100 to-zinc-400 bg-clip-text text-transparent font-sans">
            AETHER
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            Frame-accurate video review and collaboration
          </p>
        </div>

        {/* Card Container */}
        <Card className="border border-zinc-800/80 bg-[#121214]/60 backdrop-blur-xl shadow-2xl rounded-2xl">
          <CardHeader className="space-y-1 pb-6">
            <CardTitle className="text-xl text-center text-zinc-100 font-semibold">Sign in to your account</CardTitle>
            <CardDescription className="text-center text-zinc-500 text-xs">
              Review and grade videos with your production team
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            {/* Google Sign In */}
            <Button
              variant="outline"
              type="button"
              disabled={isLoading || isGoogleLoading}
              onClick={handleGoogleLogin}
              className="relative w-full h-11 border-zinc-800 bg-zinc-900/40 text-zinc-300 hover:bg-zinc-800/50 hover:text-zinc-100 font-medium transition-all duration-200"
            >
              {isGoogleLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin text-zinc-400" />
              ) : (
                <svg className="mr-2 h-4 w-4" aria-hidden="true" focusable="false" data-prefix="fab" data-icon="google" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 488 512">
                  <path fill="currentColor" d="M488 261.8C488 403.3 391.1 504 248 504 110.8 504 0 393.2 0 256S110.8 8 248 8c66.8 0 123 24.5 166.3 64.9l-67.5 64.9C258.5 52.6 94.3 116.6 94.3 256c0 86.5 69.1 156.6 153.7 156.6 98.2 0 135-70.4 140.8-106.9H248v-85.3h236.1c2.3 12.7 3.9 24.9 3.9 41.4z"></path>
                </svg>
              )}
              Continue with Google
            </Button>

            {/* Separator */}
            <div className="relative my-2">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-zinc-800" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-[#121214] px-2 text-zinc-500 font-medium">Or continue with</span>
              </div>
            </div>

            {/* Credentials Login Form */}
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-zinc-400 text-xs font-semibold">Email address</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="name@studio.com"
                  disabled={isLoading || isGoogleLoading}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="bg-zinc-900/50 border-zinc-800/80 text-zinc-100 placeholder:text-zinc-600 focus:border-zinc-700 focus:ring-1 focus:ring-zinc-700 h-10 rounded-lg text-sm"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password" className="text-zinc-400 text-xs font-semibold">Password</Label>
                  <a href="#" className="text-xs text-indigo-400 hover:text-indigo-300 hover:underline">Forgot?</a>
                </div>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  disabled={isLoading || isGoogleLoading}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="bg-zinc-900/50 border-zinc-800/80 text-zinc-100 placeholder:text-zinc-600 focus:border-zinc-700 focus:ring-1 focus:ring-zinc-700 h-10 rounded-lg text-sm"
                  required
                />
              </div>

              <Button
                type="submit"
                disabled={isLoading || isGoogleLoading || !email || !password}
                className="w-full h-10 bg-indigo-600 hover:bg-indigo-500 text-zinc-50 font-medium rounded-lg shadow-lg shadow-indigo-600/10 hover:shadow-indigo-500/20 transition-all duration-200"
              >
                {isLoading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin text-zinc-100" />
                ) : null}
                Sign In with Email
              </Button>
            </form>
          </CardContent>
          <CardFooter className="pt-2 pb-6 flex flex-wrap justify-between items-center text-xs text-zinc-500 border-t border-zinc-800/50 mt-4">
            <span className="mt-2">Don&apos;t have an account?</span>
            <a href="#" className="text-zinc-300 hover:text-zinc-100 hover:underline font-medium mt-2">Create one now</a>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
