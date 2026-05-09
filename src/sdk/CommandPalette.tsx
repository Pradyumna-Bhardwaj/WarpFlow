import { useCallback, useEffect, useRef, useState } from "react";
import { buildSolTransferTransaction } from "./buildTransferTransaction";
import { parseTransferCommand } from "./parseTransfer";
import { parseCrossChainTransferCommand } from "./parseCrossChainTransfer";
import { parseSwapCommand } from "./parseSwap";
import { useCommandPalette } from "./CommandPaletteContext";

export function CommandPalette() {
  const { setOpen, connection, walletClient, openSwap, openCrossChain } =
    useCommandPalette();
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

    const trimmed = query.trim();

    const cross = parseCrossChainTransferCommand(query);
    if (cross.ok) {
      if (!walletClient.publicKey) {
        setStatus("error");
        setMessage("Connect a wallet first.");
        return;
      }
      openCrossChain(cross.command);
      setQuery("");
      return;
    }
    if (/^bridge\s/i.test(trimmed) && !cross.ok) {
      setStatus("error");
      setMessage(cross.error);
      return;
    }

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
    if (/^swap\s/i.test(trimmed) && !swap.ok) {
      setStatus("error");
      setMessage(swap.error);
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
  }, [connection, query, resetFeedback, walletClient, openCrossChain, openSwap]);

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
        className="animate-fade-in w-full max-w-xl overflow-hidden rounded-xl border border-zinc-800 bg-[#1c1c1e] shadow-2xl shadow-black/50"
        role="dialog"
        aria-modal="true"
        aria-labelledby="command-palette-title"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="border-b border-zinc-800 px-5 py-4">
          <p
            id="command-palette-title"
            className="text-xs font-medium uppercase tracking-wider text-zinc-500"
          >
            Command palette
          </p>
          <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-xs text-zinc-400 sm:text-sm">
            <span className="inline-flex items-center gap-1.5">
              <kbd className="rounded border border-zinc-600 bg-zinc-800/90 px-1.5 py-0.5 text-[11px] text-zinc-300">
                ⌘K
              </kbd>
              <span className="text-zinc-600">/</span>
              <kbd className="rounded border border-zinc-600 bg-zinc-800/90 px-1.5 py-0.5 text-[11px] text-zinc-300">
                Ctrl K
              </kbd>
            </span>
            <span className="text-zinc-600">·</span>
            <span>toggle</span>
            <span className="text-zinc-600">·</span>
            <span>Esc closes</span>
          </p>
        </div>

        <div className="space-y-6 px-5 pb-5 pt-5">
          <div>
            <label
              htmlFor="command-palette-input"
              className="sr-only"
            >
              Command
            </label>
            <input
              id="command-palette-input"
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
              placeholder="Type a command — e.g. transfer 0.1 SOL to …"
              className="w-full rounded-lg border border-zinc-800 bg-[#0c0c0d] px-4 py-3 font-mono text-sm leading-relaxed text-zinc-100 placeholder:text-zinc-600 outline-none ring-violet-500/30 focus:border-violet-500/55 focus:ring-2"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              disabled={status === "sending"}
            />
            <p className="mt-2 text-xs leading-relaxed text-zinc-500">
              Press Enter or Run. Natural language on one line.
            </p>
          </div>

          <div className="rounded-lg border border-zinc-800/80 bg-zinc-950/40 p-4">
            <p className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">
              Examples
            </p>
            <ul className="mt-3 space-y-3 text-sm">
              <li className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:gap-4">
                <span className="shrink-0 text-xs font-medium uppercase tracking-wide text-zinc-500">
                  Transfer
                </span>
                <code className="break-all rounded-md bg-[#0c0c0d] px-2.5 py-1.5 font-mono text-[13px] text-zinc-300 ring-1 ring-zinc-800">
                  send 0.05 sol to &lt;Solana address&gt;
                </code>
              </li>
              <li className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:gap-4">
                <span className="shrink-0 text-xs font-medium uppercase tracking-wide text-zinc-500">
                  Swap
                </span>
                <code className="break-all rounded-md bg-[#0c0c0d] px-2.5 py-1.5 font-mono text-[13px] text-zinc-300 ring-1 ring-zinc-800">
                  swap SOL for USDC
                </code>
              </li>
              <li className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:gap-4">
                <span className="shrink-0 text-xs font-medium uppercase tracking-wide text-zinc-500">
                  Bridge
                </span>
                <code className="break-all rounded-md bg-[#0c0c0d] px-2.5 py-1.5 font-mono text-[13px] text-zinc-300 ring-1 ring-zinc-800">
                  bridge sol to eth
                </code>
              </li>
            </ul>
          </div>

          {message ? (
            <div
              className={`rounded-lg border px-4 py-3 text-sm leading-relaxed ${
                status === "error"
                  ? "border-red-500/30 bg-red-500/10 text-red-200"
                  : status === "done"
                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
                    : "border-violet-500/30 bg-violet-500/10 text-violet-200"
              }`}
            >
              {message}
              {signature ? (
                <p className="mt-3 break-all font-mono text-xs opacity-90">
                  {signature}
                </p>
              ) : null}
            </div>
          ) : null}

          <div className="flex justify-end gap-2 border-t border-zinc-800/80 pt-5">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-lg px-3 py-2 text-sm text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-200"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void runCommand()}
              disabled={status === "sending" || !query.trim()}
              className="rounded-lg bg-violet-600 px-5 py-2 text-sm font-medium text-white shadow-lg shadow-violet-900/30 transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {status === "sending" ? "Sending…" : "Run"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
