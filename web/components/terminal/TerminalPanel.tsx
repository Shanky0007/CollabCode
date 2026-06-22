"use client";

import { useEffect, useRef, useCallback } from "react";
import type { Terminal as XTerminal } from "@xterm/xterm";
import type { FitAddon } from "@xterm/addon-fit";

interface ExecutionResult {
  id: string;
  status: string;
  stdout: string | null;
  stderr: string | null;
  execution_time: number | null;
  language: string;
}

const TERMINAL_STATUSES = [
  "accepted", "wrong_answer", "time_limit_exceeded",
  "compilation_error", "runtime_error", "error",
  "internal_error", "exec_format_error",
];

// ANSI helpers
const ANSI = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
  gray: "\x1b[90m",
  bold: "\x1b[1m",
};

const STATUS_ANSI: Record<string, string> = {
  accepted: ANSI.green,
  compilation_error: ANSI.red,
  runtime_error: ANSI.red,
  error: ANSI.red,
  internal_error: ANSI.red,
  wrong_answer: ANSI.yellow,
  time_limit_exceeded: ANSI.yellow,
};

function statusLabel(status: string): string {
  return status.replace(/_/g, " ").toUpperCase();
}

function writeResult(term: XTerminal, result: ExecutionResult) {
  const color = STATUS_ANSI[result.status] ?? ANSI.cyan;

  // Status line
  term.writeln(
    `${ANSI.bold}${color}● ${statusLabel(result.status)}${ANSI.reset}` +
    (result.execution_time != null
      ? `${ANSI.gray}  (${result.execution_time}s)${ANSI.reset}`
      : "")
  );
  term.writeln("");

  if (result.stdout) {
    term.write(result.stdout.replace(/\n/g, "\r\n"));
    if (!result.stdout.endsWith("\n")) term.writeln("");
  }

  if (result.stderr) {
    term.writeln(`${ANSI.red}${result.stderr.replace(/\n/g, "\r\n")}${ANSI.reset}`);
  }

  if (!result.stdout && !result.stderr) {
    term.writeln(`${ANSI.gray}(no output)${ANSI.reset}`);
  }

  term.writeln(`\r\n${ANSI.gray}─────────────────────────${ANSI.reset}`);
}

export default function TerminalPanel({
  jobId,
  runBy,
  onReady,
  onComplete,
}: {
  jobId: string | null;
  runBy?: string | null;
  onReady?: (clear: () => void) => void;
  onComplete?: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<XTerminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Buffer result that arrived before xterm finished initialising
  const pendingResultRef = useRef<ExecutionResult | null>(null);
  // Keep latest runBy readable inside the jobId-keyed poll effect without
  // re-running the effect when only the name changes.
  const runByRef = useRef<string | null | undefined>(runBy);
  runByRef.current = runBy;

  // Initialise xterm — runs once after mount.
  // Uses a closure-local `cancelled` flag instead of a ref so that React
  // StrictMode's mount→unmount→remount cycle doesn't leave two xterm
  // canvases stacked in the same container (which made writes invisible).
  useEffect(() => {
    if (!containerRef.current) return;
    let cancelled = false;

    // Dynamic imports — xterm is browser-only
    Promise.all([
      import("@xterm/xterm"),
      import("@xterm/addon-fit"),
      import("@xterm/addon-web-links"),
    ]).then(([{ Terminal }, { FitAddon }, { WebLinksAddon }]) => {
      if (cancelled || !containerRef.current) return;

      const term = new Terminal({
        theme: {
          background: "#18181b", // zinc-900
          foreground: "#d4d4d8",
          cursor: "#7c3aed",
          selectionBackground: "#7c3aed55",
        },
        fontFamily: "var(--font-geist-mono), 'Fira Code', monospace",
        fontSize: 13,
        lineHeight: 1.5,
        cursorBlink: false,
        disableStdin: true,  // output-only terminal
        scrollback: 5000,
        convertEol: true,
      });

      const fitAddon = new FitAddon();
      term.loadAddon(fitAddon);
      term.loadAddon(new WebLinksAddon());
      term.open(containerRef.current);
      fitAddon.fit();

      termRef.current = term;
      fitRef.current = fitAddon;

      // Welcome prompt
      term.writeln(`${ANSI.gray}CollabCode terminal ready. Press ▶ Run to execute.${ANSI.reset}`);
      term.writeln(`${ANSI.gray}─────────────────────────${ANSI.reset}`);

      // Flush any result that arrived before xterm was ready
      if (pendingResultRef.current) {
        writeResult(term, pendingResultRef.current);
        pendingResultRef.current = null;
      }

      // Expose clear() to parent
      onReady?.(() => {
        term.clear();
        term.writeln(`${ANSI.gray}─────────────────────────${ANSI.reset}`);
      });
    });

    return () => {
      cancelled = true;
      termRef.current?.dispose();
      termRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Resize observer — refit when container changes size
  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver(() => fitRef.current?.fit());
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  // Poll for results whenever jobId changes
  useEffect(() => {
    if (!jobId) return;
    if (pollRef.current) clearInterval(pollRef.current);

    const term = termRef.current;
    if (term) {
      const who = runByRef.current;
      const attribution =
        who && who !== "You"
          ? `${ANSI.gray}  (Run by ${who})${ANSI.reset}`
          : "";
      term.writeln(`\r\n${ANSI.cyan}▶ Running…${ANSI.reset}${attribution}`);
    }

    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/execute/${jobId}`);
        if (!res.ok) return;

        const data: ExecutionResult = await res.json();

        if (TERMINAL_STATUSES.includes(data.status)) {
          clearInterval(pollRef.current!);
          pollRef.current = null;
          if (termRef.current) {
            writeResult(termRef.current, data);
          } else {
            // xterm not ready yet — buffer and flush on init
            pendingResultRef.current = data;
          }
          onComplete?.();
        }
      } catch {
        // keep polling on transient network error
      }
    }, 1000);

    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [jobId]);

  return (
    <div className="h-full bg-[#18181b] flex flex-col">
      {/* Label */}
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-zinc-800 shrink-0">
        <span className="text-xs text-zinc-500 uppercase tracking-wider font-mono">Terminal</span>
        <span className="h-2 w-2 rounded-full bg-green-500" />
      </div>
      {/* xterm container */}
      <div ref={containerRef} className="flex-1 min-h-0 px-1 py-1 overflow-hidden" />
    </div>
  );
}
