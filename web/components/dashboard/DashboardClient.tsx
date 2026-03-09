"use client";

import { useState } from "react";
import Link from "next/link";
import CreateRoomModal from "./CreateRoomModal";
import InviteButton from "./InviteButton";

interface Room {
  id: string;
  name: string;
  language: string;
  created_at: string;
}

interface Props {
  rooms: Room[];
  userName?: string | null;
  userImageUrl?: string | null;
}

export default function DashboardClient({ rooms, userName, userImageUrl }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* Header */}
      <header className="border-b border-zinc-800 px-6 py-4 flex items-center justify-between">
        <h1 className="text-lg font-semibold text-violet-400">CollabCode</h1>
        <div className="flex items-center gap-3">
          <span className="text-sm text-zinc-400">{userName}</span>
          {userImageUrl && (
            <img src={userImageUrl} alt="avatar" className="h-8 w-8 rounded-full" />
          )}
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-10">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-2xl font-bold">Your Rooms</h2>
          <button
            onClick={() => setOpen(true)}
            className="rounded-lg bg-violet-600 hover:bg-violet-500 px-4 py-2 text-sm font-semibold transition-colors"
          >
            + New Room
          </button>
        </div>

        {rooms.length === 0 ? (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-12 text-center text-zinc-500">
            No rooms yet. Create one to get started.
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {rooms.map((room) => (
              <div
                key={room.id}
                className="rounded-xl border border-zinc-800 bg-zinc-900 p-5 hover:border-violet-600 transition-colors flex flex-col gap-3"
              >
                <Link href={`/room/${room.id}`} className="flex-1">
                  <p className="font-semibold truncate">{room.name}</p>
                  <p className="text-sm text-zinc-500 mt-1">{room.language}</p>
                  <p className="text-xs text-zinc-600 mt-3">
                    {new Date(room.created_at).toLocaleDateString("en-GB", {
                      day: "2-digit", month: "2-digit", year: "numeric",
                    })}
                  </p>
                </Link>
                <div className="flex justify-end">
                  <InviteButton roomId={room.id} />
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      <CreateRoomModal open={open} onClose={() => setOpen(false)} />
    </div>
  );
}
