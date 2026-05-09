import { useCallback, useEffect, useRef, useState } from "react";
import { buildSolTransferTransaction } from "./buildTransferTransaction";
import { parseTransferCommand } from "./parseTransfer";
import { parseSwapCommand } from "./parseSwap";
import { useCommandPalette } from "./CommandPaletteContext";

export function CommandPalette() {
  const { setOpen, connection, walletClient, openSwap } = useCommandPalette();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "done" | "error">(
    "idle"
  );
  const [message, setMessage] = useState<string | null>(null);
  const [signature, setSignature] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const resetFeedback = useCallback(() => {
    setStatus("idle");
    setMessage(null);
    setSignature(null);
  }, []);

  const runCommand = useCallback(async () => {
    resetFeedback();

    const swap = parseSwapCommand(query);
    if (swap.ok) {
      if (!walletClient.publicKey) {
        setStatus("error");
        setMessage("Connect a wallet first.");
        return;
      }
      openSwap(swap.command);
      setQuery("");
      return;
    }

    const parsed = parseTransferCommand(query);
    if (!parsed.ok) {
      setStatus("error");
      setMessage(parsed.error);
      return;
    }

    const { publicKey } = walletClient;
    if (!publicKey) {
      setStatus("error");
      setMessage("Connect a wallet first.");
      return;
    }

    const { amountSol, recipient } = parsed.command;

    try {
      setStatus("sending");
      setMessage("Confirm in your wallet…");
      const tx = await buildSolTransferTransaction(
        connection,
        publicKey,
        recipient,
        amountSol
      );
      const sig = await walletClient.sendTransaction(tx, connection, {
        skipPreflight: false,
        preflightCommitment: "confirmed",
      });
      setStatus("done");
      setSignature(sig);
      setMessage("Transaction sent.");
      setQuery("");
    } catch (err) {
      setStatus("error");
      setMessage(err instanceof Error ? err.message : "Transaction failed.");
    }
  }, [connection, query, resetFeedback, walletClient, openSwap]);

  const onBackdropPointerDown = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      setOpen(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center bg-zinc-950/70 px-4 pt-[min(20vh,8rem)] backdrop-blur-sm"
      role="presentation"
      onMouseDown={onBackdropPointerDown}
    >
      <div
        className="animate-fade-in w-full max-w-xl overflow-hidden rounded-xl border border-zinc-700/80 bg-zinc-900 shadow-2xl shadow-black/50"
        role="dialog"
        aria-modal="true"
        aria-labelledby="command-palette-title"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="border-b border-zinc-800 px-4 py-3">
          <p
            id="command-palette-title"
            className="text-xs font-medium uppercase tracking-wider text-zinc-500"
          >
            Command palette
          </p>
          <p className="mt-0.5 font-mono text-sm text-zinc-400">
            <kbd className="rounded border border-zinc-600 bg-zinc-800 px-1.5 py-0.5 text-[11px] text-zinc-300">
              ⌘K
            </kbd>
            <span className="mx-1.5 text-zinc-600">·</span>
            <kbd className="rounded border border-zinc-600 bg-zinc-800 px-1.5 py-0.5 text-[11px] text-zinc-300">
              Ctrl K
            </kbd>
            <span className="ml-2">to toggle · Esc to close</span>
          </p>
        </div>

        <div className="p-3">
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              if (status !== "idle") resetFeedback();
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void runCommand();
              }
            }}
            placeholder="transfer 0.1 SOL to <address>  ·  swap SOL for USDC"
            className="w-full rounded-lg border border-zinc-700 bg-zinc-950/80 px-3 py-2.5 font-mono text-sm text-zinc-100 placeholder:text-zinc-600 outline-none ring-violet-500/40 focus:border-violet-500/60 focus:ring-2"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            disabled={status === "sending"}
          />

          <p className="mt-3 text-xs leading-relaxed text-zinc-500">
            Natural language commands. Examples:{" "}
            <span className="font-mono text-zinc-400">send 0.05 sol to So111…</span>
            <span className="mx-1.5 text-zinc-600">·</span>
            <span className="font-mono text-zinc-400">swap SOL for USDC</span>
          </p>

          {message ? (
            <div
              className={`mt-3 rounded-lg border px-3 py-2 text-sm ${
                status === "error"
                  ? "border-red-500/30 bg-red-500/10 text-red-200"
                  : status === "done"
                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
                    : "border-violet-500/30 bg-violet-500/10 text-violet-200"
              }`}
            >
              {message}
              {signature ? (
                <p className="mt-2 break-all font-mono text-xs opacity-90">
                  {signature}
                </p>
              ) : null}
            </div>
          ) : null}

          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-lg px-3 py-1.5 text-sm text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-200"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void runCommand()}
              disabled={status === "sending" || !query.trim()}
              className="rounded-lg bg-violet-600 px-4 py-1.5 text-sm font-medium text-white shadow-lg shadow-violet-900/30 transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {status === "sending" ? "Sending…" : "Run"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
