import { auth } from "@clerk/nextjs/server";
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

  // Upsert membership — if already a member, this is a no-op
  await supabase.from("room_members").upsert(
    { room_id: room.id, user_id: userId, role: "editor" },
    { onConflict: "room_id,user_id" }
  );

  return NextResponse.json({ roomId: room.id, roomName: room.name });
}
