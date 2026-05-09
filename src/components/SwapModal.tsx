import { useEffect, useRef, useState } from "react";
import { useCommandPalette } from "../sdk/CommandPaletteContext";
import {
  deserializeSwapTransaction,
  fetchSwapQuote,
  fromAtomic,
  toAtomic,
  type SwapQuote,
} from "../sdk/jupiterSwap";
import type { ParsedSwapCommand } from "../sdk/types";

interface Props {
  command: ParsedSwapCommand;
  onClose: () => void;
}

type Status = "idle" | "quoting" | "swapping" | "done" | "error";

export function SwapModal({ command, onClose }: Props) {
  const { connection, walletClient } = useCommandPalette();
  const { fromToken, toToken } = command;

  const [amount, setAmount] = useState<string>(
    command.amount !== null ? String(command.amount) : ""
  );
  const [quote, setQuote] = useState<SwapQuote | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [signature, setSignature] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);


  // Checks if Amount written was correct and the debounces the fetch quote to get a result quote
  useEffect(() => {
    setQuote(null);
    setSignature(null);

    // amount and wallet client are required to fetch a quote
    const numericAmount = Number(amount);
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
    // Cancelled is used to cancel the timeout if the user changes the amount
    let cancelled = false;
    const debounce = window.setTimeout(async () => {
      try {
        setStatus("quoting");
        setMessage(null);
        const result = await fetchSwapQuote({
          inputMint: fromToken.mint,
          outputMint: toToken.mint,
          amount: toAtomic(numericAmount, fromToken.decimals),
          taker: walletClient.publicKey!.toBase58(),
        });
        if (!cancelled) {
          setQuote(result);
          setStatus("idle");
        }
      } catch (err) {
        if (!cancelled) {
          setStatus("error");
          setMessage(err instanceof Error ? err.message : "Failed to fetch quote.");
        }
      }
    }, 350);

    // Clears the timeout if the user changes the amount
    return () => {
      cancelled = true;
      window.clearTimeout(debounce);
    };
  }, [amount, fromToken, toToken, walletClient]);

  const confirmSwap = async () => {
    if (!quote || !walletClient.publicKey) return;
    try {
      setStatus("swapping");
      setMessage("Confirm in your wallet…");
      const tx = deserializeSwapTransaction(quote.transaction);
      const sig = await walletClient.sendTransaction(tx, connection, {
        skipPreflight: false,
        preflightCommitment: "confirmed",
      });
      setSignature(sig);
      setStatus("done");
      setMessage("Swap submitted.");
    } catch (err) {
      setStatus("error");
      setMessage(err instanceof Error ? err.message : "Swap failed.");
    }
  };

  const onBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget && status !== "swapping") onClose();
  };

  const outAmount = quote ? fromAtomic(quote.outAmount, toToken.decimals) : null;
  const minReceived = quote ? fromAtomic(quote.otherAmountThreshold, toToken.decimals) : null;
  const priceImpact = quote ? Number(quote.priceImpactPct) * 100 : null;

  return (
    <div
      className="fixed inset-0 z-[110] flex items-start justify-center bg-zinc-950/70 px-4 pt-[min(20vh,8rem)] backdrop-blur-sm"
      role="presentation"
      onMouseDown={onBackdropClick}
    >
      <div
        className="animate-fade-in w-full max-w-xl overflow-hidden rounded-xl border border-zinc-800 bg-[#1c1c1e] shadow-2xl shadow-black/50"
        role="dialog"
        aria-modal="true"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="border-b border-zinc-800 px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">
            Swap
          </p>
          <p className="mt-0.5 text-sm text-zinc-300">
            {fromToken.symbol} → {toToken.symbol}
          </p>
        </div>

        <div className="space-y-4 p-4">
          <label className="block">
            <span className="text-xs uppercase tracking-wide text-zinc-500">
              Amount ({fromToken.symbol})
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
              disabled={status === "swapping"}
              className="mt-1 w-full rounded-lg border border-zinc-800 bg-[#0c0c0d] px-3 py-2.5 font-mono text-base text-zinc-100 placeholder:text-zinc-600 outline-none transition-[border-color,box-shadow] focus:border-[#5d40a3] focus:ring-2 focus:ring-[#5d40a3]/35 disabled:opacity-50"
            />
          </label>

          <QuoteSummary
            status={status}
            outAmount={outAmount}
            minReceived={minReceived}
            priceImpact={priceImpact}
            toSymbol={toToken.symbol}
          />

          {quote && quote.routePlan.length > 0 && <RouteBreakdown quote={quote} />}

          {message ? (
            <div
              className={`rounded-lg border px-3 py-2 text-sm ${
                status === "error"
                  ? "border-red-500/30 bg-red-500/10 text-red-200"
                  : status === "done"
                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
                    : "border-[#5d40a3]/35 bg-[#3c2b6b]/20 text-zinc-300"
              }`}
            >
              {message}
              {signature ? (
                <p className="mt-2 break-all font-mono text-xs opacity-90">{signature}</p>
              ) : null}
            </div>
          ) : null}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={status === "swapping"}
              className="rounded-lg px-3 py-1.5 text-sm text-zinc-400 transition hover:bg-zinc-800/60 hover:text-zinc-200 disabled:opacity-40"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void confirmSwap()}
              disabled={!quote || status === "swapping" || status === "quoting"}
              className="rounded-lg bg-[#3c2b6b] px-4 py-1.5 text-sm font-medium text-zinc-100 shadow-lg shadow-black/25 transition hover:bg-[#4a3585] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {status === "swapping" ? "Swapping…" : "Confirm swap"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function QuoteSummary({
  status,
  outAmount,
  minReceived,
  priceImpact,
  toSymbol,
}: {
  status: Status;
  outAmount: number | null;
  minReceived: number | null;
  priceImpact: number | null;
  toSymbol: string;
}) {
  if (status === "quoting") {
    return (
      <div className="rounded-lg border border-zinc-800 bg-[#0c0c0d] px-3 py-3 text-sm text-zinc-400">
        Fetching best route…
      </div>
    );
  }
  if (outAmount === null) return null;

  const impactColor =
    priceImpact === null
      ? "text-zinc-400"
      : priceImpact < 1
        ? "text-emerald-400"
        : priceImpact < 3
          ? "text-amber-400"
          : "text-red-400";

  return (
    <div className="rounded-lg border border-zinc-800 bg-[#0c0c0d] p-3">
      <div className="flex items-baseline justify-between">
        <span className="text-xs uppercase tracking-wide text-zinc-500">You receive</span>
        <span className="font-mono text-lg text-zinc-100">
          ~{outAmount.toFixed(6)} {toSymbol}
        </span>
      </div>
      <dl className="mt-3 space-y-1 text-xs">
        <Row label="Min received" value={`${minReceived?.toFixed(6) ?? "—"} ${toSymbol}`} />
        <Row
          label="Price impact"
          value={priceImpact !== null ? `${priceImpact.toFixed(3)}%` : "—"}
          valueClass={impactColor}
        />
      </dl>
    </div>
  );
}

function Row({ label, value, valueClass }: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-zinc-500">{label}</dt>
      <dd className={`font-mono ${valueClass ?? "text-zinc-200"}`}>{value}</dd>
    </div>
  );
}

function RouteBreakdown({ quote }: { quote: SwapQuote }) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-[#0c0c0d] p-3">
      <p className="text-xs uppercase tracking-wide text-zinc-500">Route</p>
      <ol className="mt-2 space-y-1 text-xs text-zinc-300">
        {quote.routePlan.map((hop, i) => (
          <li key={`${hop.label}-${i}`} className="flex items-center justify-between">
            <span>
              <span className="text-[#5d40a3]">{i + 1}.</span> {hop.label}
            </span>
            <span className="font-mono text-zinc-500">{hop.percent}%</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
