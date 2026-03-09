import { auth } from "@clerk/nextjs/server";
import { redirect, notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase";
import RoomWrapper from "./RoomWrapper";

interface Props {
  params: Promise<{ roomId: string }>;
}

async function getRoom(roomId: string, userId: string) {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("rooms")
    .select("id, name, language, owner_id, room_members!inner(user_id, role)")
    .eq("id", roomId)
    .eq("room_members.user_id", userId)
    .single();
  return data;
}

export default async function RoomPage({ params }: Props) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const { roomId } = await params;
  const room = await getRoom(roomId, userId);

  if (!room) notFound();

  const memberRecord = (room.room_members as { user_id: string; role: string }[])[0];

  return (
    <RoomWrapper
      roomId={room.id}
      roomName={room.name}
      initialLanguage={room.language}
      currentUserId={userId}
      currentUserRole={memberRecord.role}
    />
  );
}
