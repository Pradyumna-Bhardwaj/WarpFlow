import { findToken, type TokenInfo } from "./tokens";
import type { ParsedSwapCommand } from "./types";

const SWAP_PATTERN =
  /^swap\s+(?:my\s+)?(?:(\d+(?:\.\d+)?)\s+)?([a-z]{2,10})\s+(?:for|to|with)\s+([a-z]{2,10})\s*$/i;

export function parseSwapCommand(input: string):
  | { ok: true; command: ParsedSwapCommand }
  | { ok: false; error: string } {
  const match = SWAP_PATTERN.exec(input.trim());
  if (!match) {
    return {
      ok: false,
      error: 'Try: swap SOL for USDC — or: swap 0.1 SOL for USDC.',
    };
  }

  const [, amountRaw, fromRaw, toRaw] = match;

  const fromToken: TokenInfo | undefined = findToken(fromRaw!);
  const toToken: TokenInfo | undefined = findToken(toRaw!);

  if (!fromToken) return { ok: false, error: `Unknown token: ${fromRaw}` };
  if (!toToken)   return { ok: false, error: `Unknown token: ${toRaw}` };
  if (fromToken.mint === toToken.mint) {
    return { ok: false, error: "Input and output tokens must differ." };
  }

  const amount = amountRaw ? Number(amountRaw) : null;
  if (amount !== null && (!Number.isFinite(amount) || amount <= 0)) {
    return { ok: false, error: "Amount must be a positive number." };
  }

  return {
    ok: true,
    command: { kind: "swap", fromToken, toToken, amount },
  };
}
