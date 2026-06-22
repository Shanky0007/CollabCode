import { createClient, LiveMap, LiveObject } from "@liveblocks/client";
import { createRoomContext } from "@liveblocks/react";

const client = createClient({
  authEndpoint: "/api/liveblocks-auth",
  // Throttle presence updates to reduce bandwidth
  throttle: 100,
});

// ─── Liveblocks Type Definitions ─────────────────────────────────────────────

export type Presence = {
  cursor: { x: number; y: number } | null;
  // Monaco editor cursor position
  selection: { lineNumber: number; column: number } | null;
  user: {
    id: string;
    name: string;
    avatar: string;
    color: string; // random color assigned per session
  };
};

export type Storage = {
  // The live shared code content (managed by Yjs separately, but we store metadata here)
  language: LiveObject<{ value: string }>;
  // Map of userId -> last active timestamp for room analytics
  activeUsers: LiveMap<string, number>;
};

export type UserMeta = {
  id: string;
  info: {
    name: string;
    avatar: string;
    color: string;
  };
};

export type RoomEvent =
  | { type: "EXECUTION_QUEUED"; jobId: string; triggeredBy: string }
  | { type: "EXECUTION_COMPLETE"; jobId: string; status: string }
  | { type: "LANGUAGE_CHANGED"; language: string; changedBy: string };

// triggeredBy carries the runner's display name so collaborators' terminals
// can show "Run by <name>". "me" is no longer used — see CollaborativeEditor.

// ─── Room Context ─────────────────────────────────────────────────────────────

export const {
  RoomProvider,
  useRoom,
  useMyPresence,
  useUpdateMyPresence,
  useOthers,
  useOthersMapped,
  useSelf,
  useBroadcastEvent,
  useEventListener,
  useStorage,
  useMutation,
  useStatus,
} = createRoomContext<Presence, Storage, UserMeta, RoomEvent>(client);
