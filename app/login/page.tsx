"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Film, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";

export default function LoginPage() {
  const router = useRouter();
  const [isSignUp, setIsSignUp] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [showResend, setShowResend] = useState(false);
  const [resending, setResending] = useState(false);

  const handleResendVerification = async () => {
    if (!email) return;
    setResending(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: email,
      });
      if (error) {
        setErrorMsg(error.message);
      } else {
        setSuccessMsg("Verification email resent successfully! Please check your inbox.");
        setShowResend(false);
      }
    } catch (err) {
      setErrorMsg("Failed to resend verification email.");
      console.error(err);
    } finally {
      setResending(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;

    setIsLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    setShowResend(false);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        if (
          error.message.toLowerCase().includes("email not confirmed") ||
          error.message.toLowerCase().includes("confirm your email") ||
          error.message.toLowerCase().includes("email_not_confirmed")
        ) {
          setErrorMsg("Please verify your email address before signing in. Check your inbox for the verification link.");
          setShowResend(true);
        } else {
          setErrorMsg(error.message);
        }
      } else if (data.session) {
        router.push("/");
      }
    } catch (err) {
      setErrorMsg("An unexpected error occurred during sign in.");
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password || !fullName.trim()) return;

    setIsLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName.trim(),
          },
        },
      });

      if (error) {
        setErrorMsg(error.message);
      } else {
        if (data.session) {
          // If auto-logged in
          router.push("/");
        } else {
          setSuccessMsg(
            "Account created successfully! Please check your email for a confirmation link or sign in."
          );
          setIsSignUp(false);
          setPassword("");
        }
      }
    } catch (err) {
      setErrorMsg("An unexpected error occurred during sign up.");
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setIsGoogleLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/`,
        },
      });
      if (error) {
        setErrorMsg(error.message);
        setIsGoogleLoading(false);
      }
    } catch (err) {
      setErrorMsg("An unexpected error occurred with Google login.");
      console.error(err);
      setIsGoogleLoading(false);
    }
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
            <CardTitle className="text-xl text-center text-zinc-100 font-semibold">
              {isSignUp ? "Create a new account" : "Sign in to your account"}
            </CardTitle>
            <CardDescription className="text-center text-zinc-500 text-xs">
              {isSignUp
                ? "Start reviewing and grading videos with your production team"
                : "Review and grade videos with your production team"}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            {errorMsg && (
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-400 space-y-2">
                <p>{errorMsg}</p>
                {showResend && (
                  <button
                    type="button"
                    onClick={handleResendVerification}
                    disabled={resending}
                    className="text-[10px] text-indigo-400 hover:text-indigo-300 font-bold hover:underline bg-transparent border-0 cursor-pointer p-0 block mt-1"
                  >
                    {resending ? "Resending..." : "Resend verification email"}
                  </button>
                )}
              </div>
            )}
            {successMsg && (
              <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-400">
                {successMsg}
              </div>
            )}
            
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
              {isSignUp ? "Sign up with Google" : "Continue with Google"}
            </Button>


            {/* Separator */}
            <div className="relative my-1">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-zinc-800" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-[#121214] px-2 text-zinc-500 font-medium">
                  {isSignUp ? "Or sign up with credentials" : "Or continue with credentials"}
                </span>
              </div>
            </div>

            {/* Credentials Form */}
            <form onSubmit={isSignUp ? handleSignUp : handleLogin} className="space-y-4">
              {isSignUp && (
                <div className="space-y-1.5">
                  <Label htmlFor="fullName" className="text-zinc-400 text-xs font-semibold">Full name</Label>
                  <Input
                    id="fullName"
                    type="text"
                    placeholder="Jane Doe"
                    disabled={isLoading || isGoogleLoading}
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="bg-zinc-900/50 border-zinc-800/80 text-zinc-100 placeholder:text-zinc-600 focus:border-zinc-700 focus:ring-1 focus:ring-zinc-700 h-10 rounded-lg text-sm"
                    required
                  />
                </div>
              )}
              
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
                  {!isSignUp && (
                    <a href="#" className="text-xs text-indigo-400 hover:text-indigo-300 hover:underline">Forgot?</a>
                  )}
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
                id="email-submit-btn"
                type="submit"
                disabled={isLoading || isGoogleLoading || !email || !password || (isSignUp && !fullName.trim())}
                className="w-full h-10 bg-indigo-600 hover:bg-indigo-500 text-zinc-50 font-medium rounded-lg shadow-lg shadow-indigo-600/10 hover:shadow-indigo-500/20 transition-all duration-200"
              >
                {isLoading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin text-zinc-100" />
                ) : null}
                {isSignUp ? "Sign Up with Email" : "Sign In with Email"}
              </Button>
            </form>
          </CardContent>
          <CardFooter className="pt-2 pb-6 flex flex-wrap justify-between items-center text-xs text-zinc-500 border-t border-zinc-800/50 mt-4">
            <span className="mt-2">
              {isSignUp ? "Already have an account?" : "Don't have an account?"}
            </span>
            <button
              type="button"
              onClick={() => {
                setIsSignUp(!isSignUp);
                setErrorMsg(null);
                setSuccessMsg(null);
              }}
              className="text-zinc-300 hover:text-zinc-100 hover:underline font-medium mt-2 bg-transparent border-0 cursor-pointer p-0"
            >
              {isSignUp ? "Sign in now" : "Create one now"}
            </button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
