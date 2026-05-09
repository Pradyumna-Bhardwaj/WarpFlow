import { VersionedTransaction } from "@solana/web3.js";

const JUPITER_API = "https://api.jup.ag/swap/v2";
const apiKey = import.meta.env.VITE_JUPITER_API_KEY as string | undefined;

export interface RouteHop {
  label: string;
  inputMint: string;
  outputMint: string;
  inAmount: string;
  outAmount: string;
  feeAmount: string;
  percent: number;
}

export interface SwapQuote {
  inputMint: string;
  outputMint: string;
  inAmount: string;
  outAmount: string;
  otherAmountThreshold: string;
  slippageBps: number;
  priceImpactPct: string;
  routePlan: RouteHop[];
  transaction: string;
  requestId?: string;
}

export interface FetchQuoteParams {
  inputMint: string;
  outputMint: string;
  amount: bigint;
  taker: string;
  slippageBps?: number;
}

/**
 * Requests a swap quote + prebuilt transaction from Jupiter Meta-Aggregator.
 * Returns normalized quote data used by the swap modal UI.
 */
export async function fetchSwapQuote(params: FetchQuoteParams): Promise<SwapQuote> {
  if (!apiKey) {
    throw new Error("Set VITE_JUPITER_API_KEY in .env to use swaps.");
  }

  const query = new URLSearchParams({
    inputMint: params.inputMint,
    outputMint: params.outputMint,
    amount: params.amount.toString(),
    taker: params.taker,
    slippageBps: String(params.slippageBps ?? 50),
  });

  const res = await fetch(`${JUPITER_API}/order?${query}`, {
    headers: { "x-api-key": apiKey },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Quote failed (${res.status}): ${text || res.statusText}`);
  }

  const data = await res.json();

  return {
    inputMint: data.inputMint,
    outputMint: data.outputMint,
    inAmount: data.inAmount,
    outAmount: data.outAmount,
    otherAmountThreshold: data.otherAmountThreshold,
    slippageBps: data.slippageBps,
    priceImpactPct: data.priceImpactPct,
    routePlan: (data.routePlan ?? []).map((hop: { swapInfo: Record<string, string>; percent: number }) => ({
      label: hop.swapInfo.label,
      inputMint: hop.swapInfo.inputMint,
      outputMint: hop.swapInfo.outputMint,
      inAmount: hop.swapInfo.inAmount,
      outAmount: hop.swapInfo.outAmount,
      feeAmount: hop.swapInfo.feeAmount,
      percent: hop.percent,
    })),
    transaction: data.transaction,
    requestId: data.requestId,
  };
}

/**
 * Converts Jupiter's base64-encoded transaction into a VersionedTransaction
 * that can be signed and sent by the wallet adapter.
 */
export function deserializeSwapTransaction(base64Tx: string): VersionedTransaction {
  const bytes = Uint8Array.from(atob(base64Tx), (c) => c.charCodeAt(0));
  return VersionedTransaction.deserialize(bytes);
}

/**
 * Converts a user-facing decimal token amount (e.g. 0.1 USDC) into atomic
 * integer units expected by on-chain programs and Jupiter APIs.
 */
export function toAtomic(amount: number, decimals: number): bigint {
  const factor = 10 ** decimals;
  return BigInt(Math.round(amount * factor));
}

/**
 * Converts atomic token units back into a user-facing decimal number for UI
 * display (e.g. quote output, min received, etc.).
 */
export function fromAtomic(atomic: string | bigint, decimals: number): number {
  const value = typeof atomic === "string" ? BigInt(atomic) : atomic;
  const factor = BigInt(10 ** decimals);
  const whole = value / factor;
  const frac = value % factor;
  return Number(whole) + Number(frac) / Number(factor);
}
