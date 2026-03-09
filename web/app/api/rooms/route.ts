import { auth, currentUser } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("rooms")
    .select("id, name, language, created_at, owner_id")
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

  // Ensure user exists in Supabase (webhook may not have fired yet)
  const clerkUser = await currentUser();
  if (clerkUser) {
    await supabase.from("users").upsert({
      id: userId,
      email: clerkUser.emailAddresses[0]?.emailAddress ?? "",
      username: clerkUser.username ?? (`${clerkUser.firstName ?? ""}${clerkUser.lastName ?? ""}`.trim() || null),
      avatar_url: clerkUser.imageUrl,
    }, { onConflict: "id" });
  }

  // Create the room
  const { data: room, error: roomError } = await supabase
    .from("rooms")
    .insert({ name, language, owner_id: userId })
    .select("id, name, language, created_at")
    .single();

  if (roomError || !room) {
    return NextResponse.json({ error: "Failed to create room" }, { status: 500 });
  }

  // Add creator as owner in room_members
  await supabase
    .from("room_members")
    .insert({ room_id: room.id, user_id: userId, role: "owner" });

  return NextResponse.json(room, { status: 201 });
}
