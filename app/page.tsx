"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    async function checkAuthAndRedirect() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          router.push("/login");
          return;
        }

        // Fetch user's organizations
        const { data: memberships, error } = await supabase
          .from("organization_members")
          .select("organization_id")
          .eq("user_id", session.user.id)
          .order("created_at", { ascending: true });

        if (error) {
          console.error("Error fetching memberships on homepage:", error.message);
          router.push("/orgs");
          return;
        }

        if (memberships && memberships.length > 0) {
          // If we have a stored organization preference, try to use it
          const storedOrg = localStorage.getItem("shotflow_active_org");
          const matched = memberships.find(m => m.organization_id === storedOrg);
          if (matched) {
            router.push(`/organizations/${matched.organization_id}`);
          } else {
            router.push(`/organizations/${memberships[0].organization_id}`);
          }
        } else {
          router.push("/orgs");
        }
      } catch (err) {
        console.error("Homepage redirection failure:", err);
        router.push("/login");
      }
    }

    checkAuthAndRedirect();
  }, [router]);

  return (
    <div className="min-h-screen bg-[#09090b] flex items-center justify-center">
      <div className="text-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent mx-auto mb-4" />
        <p className="text-sm text-zinc-400">Loading workspace...</p>
      </div>
    </div>
  );
}
