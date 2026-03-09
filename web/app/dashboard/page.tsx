import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase";
import DashboardClient from "@/components/dashboard/DashboardClient";

async function getRooms(userId: string) {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("rooms")
    .select("id, name, language, created_at, room_members!inner(user_id)")
    .eq("room_members.user_id", userId)
    .order("created_at", { ascending: false })
    .limit(20);
  return data ?? [];
}

export default async function DashboardPage() {
  const { userId } = await auth();
  if (!userId) redirect("/");

  const user = await currentUser();
  const rooms = await getRooms(userId);

  return (
    <DashboardClient
      rooms={rooms as { id: string; name: string; language: string; created_at: string }[]}
      userName={user?.firstName}
      userImageUrl={user?.imageUrl}
    />
  );
}
