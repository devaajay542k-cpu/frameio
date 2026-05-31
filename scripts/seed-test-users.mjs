import { createClient } from "@supabase/supabase-js";

// ── Config ──────────────────────────────────────────────

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ── Old users to remove ─────────────────────────────────
const OLD_USER_IDS = [
  "a1111111-1111-1111-1111-111111111111", // alice
  "b2222222-2222-2222-2222-222222222222", // bob
  "c3333333-3333-3333-3333-333333333333", // john
];

const OLD_EMAILS = [
  "alice@production-studio.co",
  "bob@production-studio.co",
  "john@production-studio.co",
];

// ── New users to create ─────────────────────────────────
const ORG_ID = "e1111111-1111-1111-1111-111111111111"; // Acme Agency
const PASSWORD = "TestUser@123";

const NEW_USERS = [
  { email: "owner@testuser.com", fullName: "Test Owner", orgRole: "owner" },
  { email: "admin@testuser.com", fullName: "Test Admin", orgRole: "admin" },
  { email: "editor@testuser.com", fullName: "Test Editor", orgRole: "member" },
  { email: "member@testuser.com", fullName: "Test Member", orgRole: "member" },
];

// Project IDs from seed
const NIKE_PROJECT = "d1111111-1111-1111-1111-111111111111";
const SAMSUNG_PROJECT = "d2222222-2222-2222-2222-222222222222";

async function main() {
  console.log("═══════════════════════════════════════════");
  console.log("  AETHER — Test User Seed Script");
  console.log("═══════════════════════════════════════════\n");

  // ────────────────────────────────────────────────────
  // STEP 1: Clean up old data
  // ────────────────────────────────────────────────────
  console.log("🧹 STEP 1: Cleaning up old users...\n");

  // Remove project_members for old users
  for (const uid of OLD_USER_IDS) {
    const { error } = await supabase
      .from("project_members")
      .delete()
      .eq("user_id", uid);
    if (error) console.warn(`  ⚠ project_members cleanup for ${uid}: ${error.message}`);
    else console.log(`  ✓ Removed project_members for ${uid}`);
  }

  // Remove organization_members for old users
  for (const uid of OLD_USER_IDS) {
    const { error } = await supabase
      .from("organization_members")
      .delete()
      .eq("user_id", uid);
    if (error) console.warn(`  ⚠ organization_members cleanup for ${uid}: ${error.message}`);
    else console.log(`  ✓ Removed organization_members for ${uid}`);
  }

  // Remove organization_invites sent by old users
  for (const uid of OLD_USER_IDS) {
    const { error } = await supabase
      .from("organization_invites")
      .delete()
      .eq("invited_by", uid);
    if (error) console.warn(`  ⚠ organization_invites cleanup for ${uid}: ${error.message}`);
    else console.log(`  ✓ Removed organization_invites by ${uid}`);
  }

  // Remove organization_invites sent TO old emails
  for (const email of OLD_EMAILS) {
    const { error } = await supabase
      .from("organization_invites")
      .delete()
      .eq("email", email);
    if (error) console.warn(`  ⚠ organization_invites cleanup for ${email}: ${error.message}`);
    else console.log(`  ✓ Removed organization_invites for ${email}`);
  }

  // Remove comments by old users
  for (const uid of OLD_USER_IDS) {
    const { error } = await supabase
      .from("comments")
      .delete()
      .eq("user_id", uid);
    if (error) console.warn(`  ⚠ comments cleanup for ${uid}: ${error.message}`);
    else console.log(`  ✓ Removed comments by ${uid}`);
  }

  // Update organization owner_id temporarily (will be reassigned)
  console.log(`\n  Updating org owner_id to prevent FK issues...`);

  // Delete old auth users
  for (const uid of OLD_USER_IDS) {
    const { error } = await supabase.auth.admin.deleteUser(uid);
    if (error) console.warn(`  ⚠ Auth user delete ${uid}: ${error.message}`);
    else console.log(`  ✓ Deleted auth user ${uid}`);
  }

  console.log("\n✅ Old users cleaned up.\n");

  // ────────────────────────────────────────────────────
  // STEP 2: Create new test users
  // ────────────────────────────────────────────────────
  console.log("👤 STEP 2: Creating new test users...\n");

  const createdUsers = [];

  for (const user of NEW_USERS) {
    // First check if user already exists
    const { data: existingUsers } = await supabase.auth.admin.listUsers();
    const existing = existingUsers?.users?.find(
      (u) => u.email?.toLowerCase() === user.email.toLowerCase()
    );

    if (existing) {
      console.log(`  ℹ User ${user.email} already exists (${existing.id}), skipping creation.`);
      createdUsers.push({ ...user, id: existing.id });
      continue;
    }

    const { data, error } = await supabase.auth.admin.createUser({
      email: user.email,
      password: PASSWORD,
      email_confirm: true,
      user_metadata: {
        full_name: user.fullName,
      },
    });

    if (error) {
      console.error(`  ✗ Failed to create ${user.email}: ${error.message}`);
      continue;
    }

    console.log(`  ✓ Created ${user.email} → ${data.user.id}`);
    createdUsers.push({ ...user, id: data.user.id });
  }

  if (createdUsers.length === 0) {
    console.error("\n❌ No users created. Aborting.");
    process.exit(1);
  }

  console.log(`\n✅ ${createdUsers.length} users created/found.\n`);

  // ────────────────────────────────────────────────────
  // STEP 3: Update organization owner
  // ────────────────────────────────────────────────────
  const ownerUser = createdUsers.find((u) => u.orgRole === "owner");
  if (ownerUser) {
    console.log("🏢 STEP 3: Updating organization owner...\n");
    const { error } = await supabase
      .from("organizations")
      .update({ owner_id: ownerUser.id })
      .eq("id", ORG_ID);
    if (error) console.error(`  ✗ Failed to update org owner: ${error.message}`);
    else console.log(`  ✓ Organization "Acme Agency" owner → ${ownerUser.email} (${ownerUser.id})`);
    console.log();
  }

  // ────────────────────────────────────────────────────
  // STEP 4: Clear existing org members for this org & create new memberships
  // ────────────────────────────────────────────────────
  console.log("👥 STEP 4: Setting up organization memberships...\n");

  // Clear any stale org memberships for this org
  await supabase.from("organization_members").delete().eq("organization_id", ORG_ID);

  for (const user of createdUsers) {
    const { error } = await supabase.from("organization_members").upsert(
      {
        organization_id: ORG_ID,
        user_id: user.id,
        role: user.orgRole,
      },
      { onConflict: "organization_id,user_id" }
    );
    if (error) console.error(`  ✗ Org membership for ${user.email}: ${error.message}`);
    else console.log(`  ✓ ${user.email} → org role: ${user.orgRole}`);
  }

  console.log();

  // ────────────────────────────────────────────────────
  // STEP 5: Set up project memberships
  // ────────────────────────────────────────────────────
  console.log("📁 STEP 5: Setting up project memberships...\n");

  // Clear old project members
  await supabase.from("project_members").delete().eq("project_id", NIKE_PROJECT);
  await supabase.from("project_members").delete().eq("project_id", SAMSUNG_PROJECT);

  // Update projects created_by to the new owner
  if (ownerUser) {
    await supabase.from("projects").update({ created_by: ownerUser.id }).eq("organization_id", ORG_ID);
    console.log(`  ✓ Updated projects created_by → ${ownerUser.email}`);
  }

  const editorUser = createdUsers.find((u) => u.email === "editor@testuser.com");
  const memberUser = createdUsers.find((u) => u.email === "member@testuser.com");

  // Nike Campaign: editor@testuser.com → editor, member@testuser.com → viewer
  if (editorUser) {
    const { error } = await supabase.from("project_members").upsert(
      { project_id: NIKE_PROJECT, user_id: editorUser.id, role: "editor" },
      { onConflict: "project_id,user_id" }
    );
    if (error) console.error(`  ✗ Nike editor: ${error.message}`);
    else console.log(`  ✓ Nike Campaign: ${editorUser.email} → editor`);
  }

  if (memberUser) {
    const { error } = await supabase.from("project_members").upsert(
      { project_id: NIKE_PROJECT, user_id: memberUser.id, role: "viewer" },
      { onConflict: "project_id,user_id" }
    );
    if (error) console.error(`  ✗ Nike viewer: ${error.message}`);
    else console.log(`  ✓ Nike Campaign: ${memberUser.email} → viewer`);
  }

  // Samsung Campaign: editor@testuser.com → editor
  if (editorUser) {
    const { error } = await supabase.from("project_members").upsert(
      { project_id: SAMSUNG_PROJECT, user_id: editorUser.id, role: "editor" },
      { onConflict: "project_id,user_id" }
    );
    if (error) console.error(`  ✗ Samsung editor: ${error.message}`);
    else console.log(`  ✓ Samsung Campaign: ${editorUser.email} → editor`);
  }

  console.log();

  // ────────────────────────────────────────────────────
  // STEP 6: Clean up stale invites for old emails
  // ────────────────────────────────────────────────────
  console.log("🧹 STEP 6: Cleaning up stale invitations...\n");
  for (const email of OLD_EMAILS) {
    await supabase.from("organization_invites").delete().eq("email", email);
    console.log(`  ✓ Removed any invites for ${email}`);
  }

  console.log();

  // ────────────────────────────────────────────────────
  // SUMMARY
  // ────────────────────────────────────────────────────
  console.log("═══════════════════════════════════════════");
  console.log("  ✅ SEED COMPLETE — Summary");
  console.log("═══════════════════════════════════════════\n");

  console.log("  Organization: Acme Agency");
  console.log(`  Org ID: ${ORG_ID}\n`);

  console.log("  ┌─────────────────────────┬──────────────────────────────────────────┬─────────┐");
  console.log("  │ Email                   │ User ID                                  │ Org Role│");
  console.log("  ├─────────────────────────┼──────────────────────────────────────────┼─────────┤");
  for (const u of createdUsers) {
    console.log(
      `  │ ${u.email.padEnd(23)} │ ${u.id.padEnd(40)} │ ${u.orgRole.padEnd(7)} │`
    );
  }
  console.log("  └─────────────────────────┴──────────────────────────────────────────┴─────────┘\n");

  console.log("  Project Memberships:");
  console.log("  ─────────────────────────────────────────");
  console.log("  • Nike Campaign:");
  console.log(`    - owner@testuser.com  → owner (inherent)`);
  console.log(`    - admin@testuser.com  → admin (inherent)`);
  if (editorUser) console.log(`    - editor@testuser.com → editor`);
  if (memberUser) console.log(`    - member@testuser.com → viewer`);
  console.log("  • Samsung Campaign:");
  console.log(`    - owner@testuser.com  → owner (inherent)`);
  console.log(`    - admin@testuser.com  → admin (inherent)`);
  if (editorUser) console.log(`    - editor@testuser.com → editor`);
  console.log();
  console.log(`  🔐 Default password for all: ${PASSWORD}`);
  console.log();
}

main().catch(console.error);
