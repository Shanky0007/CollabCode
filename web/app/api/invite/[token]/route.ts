import { auth, currentUser } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";

/**
 * POST /api/invite/:token — accept an invite and join the room.
 * Returns {roomId} so client can redirect.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { token } = await params;
  const supabase = createAdminClient();

  // Look up room by invite token
  const { data: room, error } = await supabase
    .from("rooms")
    .select("id, name")
    .eq("invite_token", token)
    .single();

  if (error || !room) {
    return NextResponse.json({ error: "Invalid or expired invite link" }, { status: 404 });
  }

  // Ensure the joining user exists in Supabase first. The Clerk webhook may
  // not have fired locally (no tunnel), and room_members.user_id has a foreign
  // key to users(id) — without this row the membership insert fails silently
  // and the room page 404s for the new joiner.
  const clerkUser = await currentUser();
  if (clerkUser) {
    await supabase.from("users").upsert(
      {
        id: userId,
        email: clerkUser.emailAddresses[0]?.emailAddress ?? "",
        username:
          clerkUser.username ??
          (`${clerkUser.firstName ?? ""}${clerkUser.lastName ?? ""}`.trim() || null),
        avatar_url: clerkUser.imageUrl,
      },
      { onConflict: "id" }
    );
  }

  // Upsert membership — if already a member, this is a no-op
  const { error: memberError } = await supabase.from("room_members").upsert(
    { room_id: room.id, user_id: userId, role: "editor" },
    { onConflict: "room_id,user_id" }
  );

  if (memberError) {
    return NextResponse.json(
      { error: "Failed to join room. Please try again." },
      { status: 500 }
    );
  }

  return NextResponse.json({ roomId: room.id, roomName: room.name });
}
