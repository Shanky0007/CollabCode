import { auth, currentUser } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("rooms")
    .select("id, name, language, created_at, owner_id, room_members!inner(user_id)")
    .eq("room_members.user_id", userId)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { name, language = "javascript" } = await req.json();
  if (!name) return NextResponse.json({ error: "Room name is required" }, { status: 400 });

  const supabase = createAdminClient();

  // Ensure user exists in Supabase (webhook may not have fired yet).
  // rooms.owner_id references users(id), so this must succeed before inserting.
  const clerkUser = await currentUser();
  const email = clerkUser?.emailAddresses[0]?.emailAddress;
  if (!clerkUser || !email) {
    return NextResponse.json({ error: "No email address on your account" }, { status: 400 });
  }

  const { error: userError } = await supabase.from("users").upsert({
    id: userId,
    email,
    username: clerkUser.username ?? (`${clerkUser.firstName ?? ""}${clerkUser.lastName ?? ""}`.trim() || null),
    avatar_url: clerkUser.imageUrl,
  }, { onConflict: "id" });

  if (userError) {
    return NextResponse.json({ error: userError.message }, { status: 500 });
  }

  // Create the room
  const { data: room, error: roomError } = await supabase
    .from("rooms")
    .insert({ name, language, owner_id: userId })
    .select("id, name, language, created_at")
    .single();

  if (roomError || !room) {
    return NextResponse.json(
      { error: roomError?.message ?? "Failed to create room" },
      { status: 500 },
    );
  }

  // Add creator as owner in room_members
  const { error: memberError } = await supabase
    .from("room_members")
    .insert({ room_id: room.id, user_id: userId, role: "owner" });

  if (memberError) {
    // Roll back the orphaned room so it can't linger without its owner-member row
    await supabase.from("rooms").delete().eq("id", room.id);
    return NextResponse.json({ error: memberError.message }, { status: 500 });
  }

  return NextResponse.json(room, { status: 201 });
}
