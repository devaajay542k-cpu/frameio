"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Mail, Check, AlertCircle, Building2, Shield, ArrowRight, Loader2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

function AcceptInvitePageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [invite, setInvite] = useState<any>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [accepting, setAccepting] = useState(false);

  useEffect(() => {
    async function verifyInvite() {
      if (!token) {
        setErrorMsg("Missing invitation token.");
        setLoading(false);
        return;
      }

      try {
        // 1. Check Authentication Session
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          // Redirect to login but save the invite URL to come back
          router.push(`/login?redirectTo=/accept-invite?token=${token}`);
          return;
        }

        const user = session.user;
        setCurrentUser(user);

        // 2. Fetch the invite record
        const { data: inviteRecord, error: inviteError } = await supabase
          .from("organization_invites")
          .select("*, organizations(name)")
          .eq("token", token)
          .maybeSingle();

        if (inviteError || !inviteRecord) {
          setErrorMsg("Invitation not found or token has expired.");
          setLoading(false);
          return;
        }

        if (inviteRecord.accepted) {
          setErrorMsg("This invitation has already been accepted.");
          setLoading(false);
          return;
        }

        setInvite(inviteRecord);
      } catch (err) {
        console.error("Error verifying invite:", err);
        setErrorMsg("An unexpected error occurred.");
      } finally {
        setLoading(false);
      }
    }

    verifyInvite();
  }, [token, router]);

  const handleAcceptInvite = async () => {
    if (!invite || !currentUser) return;

    setAccepting(true);
    try {
      // 1. Create organization member record
      const { error: memberError } = await supabase
        .from("organization_members")
        .insert({
          organization_id: invite.organization_id,
          user_id: currentUser.id,
          role: invite.role, // Inherit role: member or admin
        });

      // Ignore conflict if user is already a member (just proceed)
      if (memberError && !memberError.message.includes("duplicate key")) {
        throw memberError;
      }

      // 2. Mark the invite as accepted
      const { error: inviteUpdateError } = await supabase
        .from("organization_invites")
        .update({ accepted: true })
        .eq("id", invite.id);

      if (inviteUpdateError) throw inviteUpdateError;

      // 3. Redirect to organization page
      router.push(`/organizations/${invite.organization_id}`);
    } catch (err) {
      console.error("Failed to accept invite:", err);
      toast.error("Failed to accept invitation. Please try again.");
      setAccepting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#09090b] flex items-center justify-center">
        <div className="text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent mx-auto mb-4" />
          <p className="text-sm text-zinc-400">Verifying your invitation...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen flex items-center justify-center bg-[#09090b] px-4 overflow-hidden">
      {/* Background gradients */}
      <div className="absolute inset-0 z-0 overflow-hidden">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-amber-600/10 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 w-full max-w-[440px]">
        
        {/* Card */}
        <Card className="border border-zinc-800/80 bg-[#121214]/60 backdrop-blur-xl shadow-2xl rounded-2xl">
          
          {errorMsg ? (
            /* ERROR STATE */
            <>
              <CardHeader className="space-y-1 pb-6 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-500/10 border border-red-500/20 mx-auto mb-4">
                  <AlertCircle className="h-6 w-6 text-red-400" />
                </div>
                <CardTitle className="text-xl text-zinc-100 font-bold">Invitation Error</CardTitle>
                <CardDescription className="text-zinc-500 text-xs">
                  {errorMsg}
                </CardDescription>
              </CardHeader>
              <CardFooter className="pt-2 pb-6">
                <Button
                  onClick={() => router.push("/")}
                  className="w-full bg-zinc-900 border border-zinc-800 text-zinc-300 hover:bg-zinc-800 h-10 rounded-lg text-xs font-semibold"
                >
                  Back to Dashboard
                </Button>
              </CardFooter>
            </>
          ) : (
            /* ACCEPT STATE */
            <>
              <CardHeader className="space-y-1 pb-6 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-indigo-500/10 border border-indigo-500/20 mx-auto mb-4">
                  <Mail className="h-6 w-6 text-indigo-400" />
                </div>
                <CardTitle className="text-xl text-zinc-100 font-bold">Workspace Invitation</CardTitle>
                <CardDescription className="text-zinc-500 text-xs">
                  You have been invited to join a collaborative workspace
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-5 text-center">
                <div className="p-4 bg-zinc-900/60 border border-zinc-850 rounded-xl space-y-2">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600/10 border border-indigo-500/20 text-indigo-400 font-bold mx-auto">
                    <Building2 className="h-5 w-5" />
                  </div>
                  <h3 className="text-base font-bold text-zinc-200 mt-2">
                    {invite?.organizations?.name}
                  </h3>
                  <div className="flex items-center justify-center gap-1.5 text-xs text-zinc-500 mt-1 capitalize">
                    <Shield className="h-3.5 w-3.5 text-zinc-400" />
                    Role: {invite?.role}
                  </div>
                </div>

                <p className="text-xs text-zinc-500 leading-relaxed px-2">
                  Accepting this invite will add your account <span className="text-zinc-300 font-semibold">{currentUser?.email}</span> to this organization, granting access to shared campaign projects.
                </p>

                <Button
                  onClick={handleAcceptInvite}
                  disabled={accepting}
                  className="w-full h-11 bg-indigo-600 hover:bg-indigo-500 text-zinc-50 font-bold rounded-xl shadow-lg shadow-indigo-600/10 hover:shadow-indigo-500/20 transition-all duration-200"
                >
                  {accepting ? (
                    <div className="flex items-center gap-2 justify-center">
                      <Loader2 className="h-4 w-4 animate-spin text-zinc-100" />
                      <span>Joining Workspace...</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 justify-center">
                      <Check className="h-4 w-4" />
                      <span>Accept & Join Workspace</span>
                    </div>
                  )}
                </Button>
              </CardContent>

              <CardFooter className="pt-2 pb-6 border-t border-zinc-800/40 text-center flex flex-col gap-2 mt-4 text-[10px] text-zinc-600">
                <span>Signed in as {currentUser?.email}</span>
                <button
                  onClick={async () => {
                    await supabase.auth.signOut();
                    router.push(`/login?redirectTo=/accept-invite?token=${token}`);
                  }}
                  className="text-indigo-400 hover:text-indigo-300 hover:underline cursor-pointer"
                >
                  Switch account
                </button>
              </CardFooter>
            </>
          )}

        </Card>
      </div>
    </div>
  );
}

export default function AcceptInvitePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#09090b] flex items-center justify-center">
        <div className="text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent mx-auto mb-4" />
          <p className="text-sm text-zinc-400">Verifying your invitation...</p>
        </div>
      </div>
    }>
      <AcceptInvitePageContent />
    </Suspense>
  );
}
