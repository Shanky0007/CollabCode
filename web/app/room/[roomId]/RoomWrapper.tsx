"use client";

import dynamic from "next/dynamic";
import { RoomProvider } from "@/lib/liveblocks";
import { LiveObject, LiveMap } from "@liveblocks/client";
import AvatarStack from "@/components/presence/AvatarStack";
import LanguageSelector from "@/components/editor/LanguageSelector";
import { useState, useCallback } from "react";
import Link from "next/link";

// Monaco must never render on the server
const CollaborativeEditor = dynamic(
  () => import("@/components/editor/CollaborativeEditor"),
  { ssr: false, loading: () => <EditorSkeleton /> }
);

interface Props {
  roomId: string;
  roomName: string;
  initialLanguage: string;
  currentUserId: string;
  currentUserRole: string;
}

export default function RoomWrapper({
  roomId,
  roomName,
  initialLanguage,
  currentUserRole,
}: Props) {
  const [language, setLanguage] = useState(initialLanguage);
  const canEdit = currentUserRole === "owner" || currentUserRole === "editor";

  const handleLanguageChange = useCallback(
    async (lang: string) => {
      setLanguage(lang);
      try {
        await fetch(`/api/rooms/${roomId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ language: lang }),
        });
      } catch {
        // non-critical — local state already updated
      }
    },
    [roomId]
  );

  return (
    <RoomProvider
      id={roomId}
      initialPresence={{ cursor: null, selection: null, user: { id: "", name: "", avatar: "", color: "" } }}
      initialStorage={{
        language: new LiveObject({ value: language }),
        activeUsers: new LiveMap(),
      }}
    >
      <div className="flex flex-col h-screen bg-zinc-950 text-zinc-100">
        {/* Top bar */}
        <header className="flex items-center justify-between border-b border-zinc-800 px-4 py-2 shrink-0">
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="text-zinc-500 hover:text-zinc-300 transition-colors text-sm">
              ← Dashboard
            </Link>
            <span className="text-zinc-600">|</span>
            <span className="text-sm font-medium text-zinc-200 truncate max-w-[200px]">
              {roomName}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <LanguageSelector
              value={language}
              onChange={handleLanguageChange}
              disabled={!canEdit}
            />
            <AvatarStack />
          </div>
        </header>

        {/* Editor */}
        <div className="flex-1 min-h-0">
          <CollaborativeEditor
            roomId={roomId}
            language={language}
            readOnly={!canEdit}
          />
        </div>
      </div>
    </RoomProvider>
  );
}

function EditorSkeleton() {
  return (
    <div className="w-full h-full bg-zinc-900 animate-pulse flex items-center justify-center">
      <span className="text-zinc-600 text-sm">Loading editor…</span>
    </div>
  );
}
