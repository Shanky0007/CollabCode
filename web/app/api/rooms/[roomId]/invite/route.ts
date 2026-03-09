import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import { nanoid } from "nanoid";

type Params = { params: Promise<{ roomId: string }> };

/**
 * POST /api/rooms/:roomId/invite
 * Generates (or returns existing) invite token for the room.
 * Only owners/editors can generate invite links.
 */
export async function POST(_req: NextRequest, { params }: Params) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { roomId } = await params;
  const supabase = createAdminClient();

  // Verify user is owner or editor
  const { data: member } = await supabase
    .from("room_members")
    .select("role")
    .eq("room_id", roomId)
    .eq("user_id", userId)
    .single();

  if (!member || !["owner", "editor"].includes(member.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Check if token already exists
  const { data: room } = await supabase
    .from("rooms")
    .select("invite_token")
    .eq("id", roomId)
    .single();

  if (room?.invite_token) {
    return NextResponse.json({ token: room.invite_token });
  }

  // Generate new token
  const token = nanoid(12);
  await supabase.from("rooms").update({ invite_token: token }).eq("id", roomId);

  return NextResponse.json({ token });
}

/**
 * DELETE /api/rooms/:roomId/invite
 * Revokes (clears) the invite token. Owner only.
 */
export async function DELETE(_req: NextRequest, { params }: Params) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { roomId } = await params;
  const supabase = createAdminClient();

  const { error } = await supabase
    .from("rooms")
    .update({ invite_token: null })
    .eq("id", roomId)
    .eq("owner_id", userId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ revoked: true });
}
