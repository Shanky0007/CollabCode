"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Editor, { type Monaco } from "@monaco-editor/react";
import type { editor as MonacoEditor } from "monaco-editor";
import * as Y from "yjs";
import { MonacoBinding } from "y-monaco";
import { LiveblocksYjsProvider } from "@liveblocks/yjs";
import {
  useRoom,
  useOthers,
  useSelf,
  useUpdateMyPresence,
  useBroadcastEvent,
  useEventListener,
} from "@/lib/liveblocks";
import TerminalPanel from "@/components/terminal/TerminalPanel";
import StdinInput from "@/components/terminal/StdinInput";

interface Props {
  roomId: string;
  language: string;
  readOnly: boolean;
}

export default function CollaborativeEditor({ roomId, language, readOnly }: Props) {
  const room = useRoom();

  const editorRef = useRef<MonacoEditor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<Monaco | null>(null);
  const bindingRef = useRef<MonacoBinding | null>(null);
  const providerRef = useRef<LiveblocksYjsProvider | null>(null);
  const docRef = useRef<Y.Doc | null>(null);
  // Tracks the Monaco content widgets we add for remote cursors so we can
  // remove the old ones each time presence changes.
  const cursorWidgetsRef = useRef<MonacoEditor.IContentWidget[]>([]);

  const [isExecuting, setIsExecuting] = useState(false);
  const [executionJobId, setExecutionJobId] = useState<string | null>(null);
  const [runBy, setRunBy] = useState<string | null>(null);
  const [stdin, setStdin] = useState("");
  const termClearRef = useRef<(() => void) | null>(null);
  // True while we are actively polling a job we triggered ourselves.
  // Prevents a remote EXECUTION_QUEUED broadcast from hijacking our terminal.
  const locallyPollingRef = useRef(false);

  const broadcast = useBroadcastEvent();
  const updateMyPresence = useUpdateMyPresence();
  const self = useSelf();

  // Others for cursor decorations
  const others = useOthers();

  // When another collaborator starts a run, show the output here too.
  // Guard: skip if we're currently polling our own job — their broadcast
  // would clear our terminal and redirect our poll to the wrong job.
  useEventListener(({ event }) => {
    if (event.type === "EXECUTION_QUEUED") {
      if (!locallyPollingRef.current) {
        termClearRef.current?.();
        setRunBy(event.triggeredBy);
        setExecutionJobId(event.jobId);
      }
    }
  });

  const handleEditorMount = useCallback(
    (editor: MonacoEditor.IStandaloneCodeEditor, monaco: Monaco) => {
      editorRef.current = editor;
      monacoRef.current = monaco;

      // Yjs document — one per room, persisted by Liveblocks
      const yDoc = new Y.Doc();
      docRef.current = yDoc;

      // Bridge: syncs the Y.Doc over Liveblocks WebSocket
      const provider = new LiveblocksYjsProvider(room, yDoc);
      providerRef.current = provider;

      // Shared text — key must match across all clients in the room
      const yText = yDoc.getText("colab:code");

      // Wait for Liveblocks to sync existing content before binding Monaco.
      // Without this, new joiners start with an empty Y.Doc that overwrites
      // the room's shared content before the sync arrives.
      //
      // NOTE: LiveblocksYjsProvider emits "sync" (not "synced" like y-websocket).
      // We also check the `.synced` property in case the provider is already
      // synced by the time the editor mounts (common on fast connections / tab 1).
      const bindMonaco = () => {
        if (bindingRef.current) return; // guard against double-bind
        const binding = new MonacoBinding(
          yText,
          editor.getModel()!,
          new Set([editor]),
          provider.awareness as any
        );
        bindingRef.current = binding;
      };

      if ((provider as any).synced) {
        bindMonaco();
      } else {
        provider.once("sync", bindMonaco);
      }

      // Publish our cursor position to others via Liveblocks presence,
      // so they can render a colored caret + name label where we're typing.
      editor.onDidChangeCursorPosition((e) => {
        updateMyPresence({
          selection: {
            lineNumber: e.position.lineNumber,
            column: e.position.column,
          },
        });
      });

      // Publish an initial position immediately so collaborators see our caret
      // before we move it (onDidChangeCursorPosition only fires on movement).
      const initial = editor.getPosition();
      if (initial) {
        updateMyPresence({
          selection: { lineNumber: initial.lineNumber, column: initial.column },
        });
      }
    },
    [room, updateMyPresence]
  );

  // Render a colored caret + name label for each remote collaborator.
  //
  // We use Monaco "content widgets" — fully DOM-controlled nodes positioned
  // exactly at each remote user's cursor. This is far more reliable than CSS
  // decorations for zero-width cursor positions: we own the markup, so the
  // colored bar and the name flag always render.
  useEffect(() => {
    if (!monacoRef.current || !editorRef.current) return;

    const monaco = monacoRef.current;
    const editor = editorRef.current;

    // Remove widgets from the previous render.
    for (const w of cursorWidgetsRef.current) {
      editor.removeContentWidget(w);
    }
    cursorWidgetsRef.current = [];

    const remote = others.filter((o) => o.presence?.selection);

    for (const o of remote) {
      const sel = o.presence!.selection!;
      const color = o.info?.color ?? "#7c3aed";
      const name = o.info?.name ?? "Anonymous";

      // Build the cursor DOM: a thin vertical bar + a name flag above it.
      const node = document.createElement("div");
      node.className = "remote-cursor-widget";

      const caret = document.createElement("div");
      caret.className = "remote-cursor-caret";
      caret.style.backgroundColor = color;

      const label = document.createElement("div");
      label.className = "remote-cursor-flag";
      label.style.backgroundColor = color;
      label.textContent = name;

      node.appendChild(label);
      node.appendChild(caret);

      const widget: MonacoEditor.IContentWidget = {
        getId: () => `remote-cursor-${o.connectionId}`,
        getDomNode: () => node,
        getPosition: () => ({
          position: { lineNumber: sel.lineNumber, column: sel.column },
          preference: [
            monaco.editor.ContentWidgetPositionPreference.EXACT,
          ],
        }),
      };

      editor.addContentWidget(widget);
      cursorWidgetsRef.current.push(widget);
    }

    return () => {
      const ed = editorRef.current;
      if (!ed) return;
      for (const w of cursorWidgetsRef.current) {
        ed.removeContentWidget(w);
      }
      cursorWidgetsRef.current = [];
    };
  }, [others]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      bindingRef.current?.destroy();
      bindingRef.current = null;
      providerRef.current?.destroy();
      providerRef.current = null;
      docRef.current?.destroy();
      docRef.current = null;
    };
  }, []);

  const handleRun = useCallback(async () => {
    if (!editorRef.current || isExecuting) return;
    const code = editorRef.current.getValue();
    if (!code.trim()) return;

    // Clear terminal and show fresh run
    termClearRef.current?.();
    setIsExecuting(true);
    setExecutionJobId(null);
    setRunBy("You");

    try {
      const res = await fetch("/api/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomId,
          language,
          source_code: code,
          stdin: stdin.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (data.jobId) {
        locallyPollingRef.current = true;
        setExecutionJobId(data.jobId);
        // Send our display name so collaborators' terminals show "Run by <name>".
        const myName = self?.info?.name ?? "Anonymous";
        broadcast({ type: "EXECUTION_QUEUED", jobId: data.jobId, triggeredBy: myName });
      }
    } catch (err) {
      console.error("Execution request failed:", err);
    } finally {
      setIsExecuting(false);
    }
  }, [roomId, language, stdin, isExecuting, self, broadcast]);

  return (
    <div className="flex flex-col h-full">
      {/* Editor toolbar */}
      <div className="flex items-center justify-end gap-2 px-3 py-1.5 bg-zinc-900 border-b border-zinc-800 shrink-0">
        <button
          onClick={handleRun}
          disabled={isExecuting || readOnly}
          className="flex items-center gap-1.5 rounded-md bg-green-600 hover:bg-green-500 disabled:opacity-50 disabled:cursor-not-allowed px-3 py-1.5 text-sm font-semibold transition-colors"
        >
          {isExecuting ? (
            <>
              <span className="h-3 w-3 rounded-full border-2 border-white border-t-transparent animate-spin" />
              Running…
            </>
          ) : (
            <>▶ Run</>
          )}
        </button>
      </div>

      {/* Editor + output split */}
      <div className="flex flex-col flex-1 min-h-0">
        {/* Monaco Editor — 65% height */}
        <div className="flex-[4] min-h-0">
          <Editor
            height="100%"
            language={language === "cpp" ? "cpp" : language}
            theme="vs-dark"
            onMount={handleEditorMount}
            options={{
              fontSize: 14,
              fontFamily: "var(--font-geist-mono), 'Fira Code', monospace",
              minimap: { enabled: false },
              scrollBeyondLastLine: false,
              readOnly,
              cursorBlinking: "smooth",
              smoothScrolling: true,
              padding: { top: 12 },
              lineNumbersMinChars: 3,
              renderLineHighlight: "gutter",
              // Critical for collaborative editing — don't auto-format on paste
              formatOnPaste: false,
              formatOnType: false,
            }}
          />
        </div>

        {/* Output panel — 35% height */}
        <div className="flex-[2] min-h-0 border-t border-zinc-800 flex flex-col">
          <TerminalPanel
            jobId={executionJobId}
            runBy={runBy}
            onReady={(clearFn) => { termClearRef.current = clearFn; }}
            onComplete={() => { locallyPollingRef.current = false; }}
          />
          <StdinInput
            value={stdin}
            onChange={setStdin}
            disabled={isExecuting || readOnly}
          />
        </div>
      </div>
    </div>
  );
}
