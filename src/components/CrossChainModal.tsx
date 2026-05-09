import { useEffect, useRef, useState } from "react";
import { PublicKey } from "@solana/web3.js";
import { useCommandPalette } from "../sdk/CommandPaletteContext";
import {
  fetchExecutionStatus,
  fetchOneClickQuote,
  fromAtomicWei,
  normalizeEthereumRecipient,
  solToAtomicLamports,
  submitDepositTxHash,
  type OneClickSwapStatus,
  type OneClickQuoteResponse,
} from "../sdk/nearIntents1Click";
import { buildSolTransferTransactionLamports } from "../sdk/buildTransferTransaction";
import type { ParsedCrossChainTransferCommand } from "../sdk/types";

interface Props {
  command: ParsedCrossChainTransferCommand;
  onClose: () => void;
}

type Status =
  | "idle"
  | "quoting"
  | "depositing"
  | "awaiting_bridge"
  | "done"
  | "error";

const POLL_TERMINAL: OneClickSwapStatus[] = ["SUCCESS", "FAILED", "REFUNDED"];

function isCompleteEthAddress(s: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(s.trim());
}

export function CrossChainModal({ command, onClose }: Props) {
  const { connection, walletClient } = useCommandPalette();

  const [amount, setAmount] = useState<string>(
    command.amountSol !== null ? String(command.amountSol) : ""
  );
  const [recipient, setRecipient] = useState<string>(command.recipientEth ?? "");
  const [dryQuote, setDryQuote] = useState<OneClickQuoteResponse | null>(null);
  const [bridgeStatus, setBridgeStatus] = useState<OneClickSwapStatus | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [signature, setSignature] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const isDevnet = connection.rpcEndpoint.toLowerCase().includes("devnet");

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    setDryQuote(null);
    setSignature(null);
    setBridgeStatus(null);

    const numericAmount = Number(amount);
    const trimmed = recipient.trim();

    if (!isCompleteEthAddress(trimmed)) {
      setStatus("idle");
      setMessage(null);
      return;
    }

    const recipientNormalized = trimmed.toLowerCase();

    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      setStatus("idle");
      setMessage(null);
      return;
    }

    if (!walletClient.publicKey) {
      setStatus("error");
      setMessage("Connect a wallet to fetch a quote.");
      return;
    }

    let cancelled = false;
    const debounce = window.setTimeout(async () => {
      try {
        setStatus("quoting");
        setMessage(null);
        const lamports = solToAtomicLamports(numericAmount);
        const result = await fetchOneClickQuote({
          dry: true,
          amountLamports: lamports,
          recipientEthNormalized: recipientNormalized,
          refundSolanaBase58: walletClient.publicKey!.toBase58(),
        });
        if (!cancelled) {
          setDryQuote(result);
          setStatus("idle");
        }
      } catch (err) {
        if (!cancelled) {
          setDryQuote(null);
          setStatus("error");
          setMessage(err instanceof Error ? err.message : "Failed to fetch quote.");
        }
      }
    }, 380);

    return () => {
      cancelled = true;
      window.clearTimeout(debounce);
    };
  }, [amount, recipient, walletClient]);

  const confirmBridge = async () => {
    if (!dryQuote || !walletClient.publicKey) return;

    let recipientNormalized: string;
    try {
      recipientNormalized = normalizeEthereumRecipient(recipient);
    } catch (err) {
      setStatus("error");
      setMessage(err instanceof Error ? err.message : "Invalid recipient.");
      return;
    }

    const numericAmount = Number(amount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      setStatus("error");
      setMessage("Enter a valid SOL amount.");
      return;
    }

    try {
      setStatus("depositing");
      setMessage("Creating deposit address…");

      const lamports = solToAtomicLamports(numericAmount);
      const live = await fetchOneClickQuote({
        dry: false,
        amountLamports: lamports,
        recipientEthNormalized: recipientNormalized,
        refundSolanaBase58: walletClient.publicKey.toBase58(),
      });

      const deposit = live.quote.depositAddress;
      if (!deposit) {
        throw new Error("Quote did not include a deposit address.");
      }

      const depositPk = new PublicKey(deposit);
      const amountIn = BigInt(live.quote.amountIn);

      setMessage("Confirm in your wallet…");
      const tx = await buildSolTransferTransactionLamports(
        connection,
        walletClient.publicKey,
        depositPk,
        amountIn
      );
      const sig = await walletClient.sendTransaction(tx, connection, {
        skipPreflight: false,
        preflightCommitment: "confirmed",
      });
      setSignature(sig);

      try {
        await submitDepositTxHash({ depositAddress: deposit, txHash: sig });
      } catch {
        /* optional speed-up; status still works without it */
      }

      setStatus("awaiting_bridge");
      setMessage("Deposit sent. Waiting for NEAR Intents settlement…");

      let last: OneClickSwapStatus | null = null;
      for (let i = 0; i < 40; i++) {
        await new Promise((r) => setTimeout(r, 3000));
        try {
          const { status: s } = await fetchExecutionStatus({
            depositAddress: deposit,
            depositMemo: live.quote.depositMemo,
          });
          last = s;
          setBridgeStatus(s);
          if (POLL_TERMINAL.includes(s)) break;
        } catch {
          /* continue polling */
        }
      }

      if (last === "SUCCESS") {
        setStatus("done");
        setMessage("Bridge completed. Check your Ethereum wallet for ETH.");
      } else if (last === "REFUNDED") {
        setStatus("error");
        setMessage("Swap was refunded to your Solana refund address.");
      } else if (last === "FAILED") {
        setStatus("error");
        setMessage("Swap failed. Check explorer or your refund address.");
      } else {
        setStatus("error");
        setMessage(
          `Still processing or status unavailable (last: ${last ?? "unknown"}). Track on NEAR Intents explorer.`
        );
      }
    } catch (err) {
      setStatus("error");
      setMessage(err instanceof Error ? err.message : "Bridge failed.");
    }
  };

  const onBackdropClick = (e: React.MouseEvent) => {
    if (
      e.target === e.currentTarget &&
      status !== "depositing" &&
      status !== "awaiting_bridge"
    ) {
      onClose();
    }
  };

  const estimatedEth = dryQuote
    ? fromAtomicWei(dryQuote.quote.minAmountOut)
    : null;

  return (
    <div
      className="fixed inset-0 z-[110] overflow-y-auto overscroll-y-contain bg-zinc-950/70 px-4 py-10 backdrop-blur-sm sm:px-6 sm:py-12"
      role="presentation"
      onMouseDown={onBackdropClick}
    >
      <div className="mx-auto flex min-h-[calc(100dvh-5rem)] w-full max-w-xl items-start justify-center sm:items-center">
        <div
          className="animate-fade-in flex w-full max-h-[calc(100dvh-5rem)] flex-col overflow-hidden rounded-xl border border-zinc-800 bg-[#1c1c1e] shadow-2xl shadow-black/50"
          role="dialog"
          aria-modal="true"
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div className="shrink-0 border-b border-zinc-800 px-6 py-4">
            <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">
              Cross-chain (NEAR Intents)
            </p>
            <p className="mt-1 text-sm text-zinc-300">
              {command.fromAsset.toUpperCase()} → {command.toAsset.toUpperCase()}
            </p>
          </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-6 space-y-6">
          {isDevnet ? (
            <div className="rounded-lg border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-sm leading-relaxed text-amber-100">
              You are on Solana Devnet. NEAR Intents deposits expect{" "}
              <span className="font-medium">mainnet SOL</span> at the deposit address. Use
              mainnet in production or expect the deposit not to be recognized.
            </div>
          ) : null}

          <div className="space-y-5 rounded-xl border border-zinc-800/80 bg-zinc-950/30 p-5">
            <p className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">
              Deposit details
            </p>
            <div>
              <span className="text-xs uppercase tracking-wide text-zinc-500">
                Amount (SOL)
              </span>
              <input
                ref={inputRef}
                type="number"
                inputMode="decimal"
                min="0"
                step="any"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.0"
                disabled={status === "depositing" || status === "awaiting_bridge"}
                className="mt-2 w-full rounded-lg border border-zinc-800 bg-[#0c0c0d] px-4 py-3 font-mono text-base text-zinc-100 placeholder:text-zinc-600 outline-none transition focus:border-[#5d40a3] focus:ring-2 focus:ring-[#5d40a3]/35 disabled:opacity-50"
              />
            </div>

            <div className="border-t border-zinc-800/60 pt-5">
              <span className="text-xs uppercase tracking-wide text-zinc-500">
                ETH recipient (0x…)
              </span>
              <input
                type="text"
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                placeholder="0x…"
                disabled={status === "depositing" || status === "awaiting_bridge"}
                spellCheck={false}
                autoComplete="off"
                className="mt-2 w-full rounded-lg border border-zinc-800 bg-[#0c0c0d] px-4 py-3 font-mono text-sm leading-relaxed text-zinc-100 placeholder:text-zinc-600 outline-none transition focus:border-[#5d40a3] focus:ring-2 focus:ring-[#5d40a3]/35 disabled:opacity-50"
              />
              <p className="mt-2 text-xs leading-relaxed text-zinc-500">
                Refunds use your connected Solana wallet on the origin chain.
              </p>
            </div>
          </div>

          <QuoteSummary
            status={status}
            estimatedEth={estimatedEth}
            timeSec={dryQuote?.quote.timeEstimate}
            bridgeStatus={bridgeStatus}
          />

          {message ? (
            <div
              className={`rounded-lg border px-4 py-3 text-sm leading-relaxed ${
                status === "error"
                  ? "border-red-500/30 bg-red-500/10 text-red-200"
                  : status === "done"
                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
                    : "border-[#5d40a3]/35 bg-[#3c2b6b]/20 text-zinc-300"
              }`}
            >
              {message}
              {signature ? (
                <p className="mt-3 break-all font-mono text-xs opacity-90">{signature}</p>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="flex shrink-0 justify-end gap-3 border-t border-zinc-800 bg-[#1c1c1e] px-6 py-4">
          <button
              type="button"
              onClick={onClose}
              disabled={status === "depositing" || status === "awaiting_bridge"}
              className="rounded-lg px-3 py-2 text-sm text-zinc-400 transition hover:bg-zinc-800/60 hover:text-zinc-200 disabled:opacity-40"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void confirmBridge()}
              disabled={
                !dryQuote ||
                status === "quoting" ||
                status === "depositing" ||
                status === "awaiting_bridge"
              }
              className="rounded-lg bg-[#3c2b6b] px-4 py-2 text-sm font-medium text-zinc-100 shadow-lg shadow-black/25 transition hover:bg-[#4a3585] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {status === "depositing"
                ? "Depositing…"
                : status === "awaiting_bridge"
                  ? "Bridging…"
                  : "Confirm bridge"}
          </button>
        </div>
        </div>
      </div>
    </div>
  );
}

function QuoteSummary({
  status,
  estimatedEth,
  timeSec,
  bridgeStatus,
}: {
  status: Status;
  estimatedEth: number | null;
  timeSec: number | undefined;
  bridgeStatus: OneClickSwapStatus | null;
}) {
  if (status === "quoting") {
    return (
      <div className="rounded-lg border border-zinc-800 bg-[#0c0c0d] px-4 py-4 text-sm text-zinc-400">
        Fetching 1Click quote…
      </div>
    );
  }
  if (estimatedEth === null) return null;

  return (
    <div className="rounded-lg border border-zinc-800 bg-[#0c0c0d] p-4">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
        <span className="text-xs uppercase tracking-wide text-zinc-500">Min. ETH (est.)</span>
        <span className="font-mono text-lg text-zinc-100 sm:text-right">
          ~{estimatedEth.toFixed(6)} ETH
        </span>
      </div>
      <dl className="mt-4 space-y-2 border-t border-zinc-800/80 pt-4 text-xs text-zinc-400">
        {timeSec != null ? (
          <div className="flex justify-between">
            <dt>Est. time after deposit</dt>
            <dd className="font-mono text-zinc-300">~{timeSec}s</dd>
          </div>
        ) : null}
        <div className="flex justify-between">
          <dt>Slippage</dt>
          <dd className="font-mono text-zinc-300">1%</dd>
        </div>
        {bridgeStatus ? (
          <div className="flex justify-between">
            <dt>Bridge status</dt>
            <dd className="font-mono text-violet-300/90">{bridgeStatus}</dd>
          </div>
        ) : null}
      </dl>
      <div className="mt-4 border-t border-zinc-800/80 pt-4">
        <p className="text-[11px] leading-relaxed text-zinc-500">
          Optional: set <span className="font-mono text-zinc-400">VITE_ONECLICK_JWT</span> in env
          to reduce API fees (see NEAR Intents docs).
        </p>
      </div>
    </div>
  );
}
