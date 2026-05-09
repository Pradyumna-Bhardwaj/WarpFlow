import { PublicKey } from "@solana/web3.js";
import type { ParsedTransferCommand } from "./types";

const TRANSFER_PATTERN =
  /^(?:transfer|send)\s+(\d+(?:\.\d+)?)\s*sol\s+to\s+([1-9A-HJ-NP-Za-km-z]{32,44})\s*$/i;

export function parseTransferCommand(input: string):
  | { ok: true; command: ParsedTransferCommand }
  | { ok: false; error: string } {
  const trimmed = input.trim();
  if (!trimmed) {
    return { ok: false, error: "Enter a command." };
  }

  const match = TRANSFER_PATTERN.exec(trimmed);
  if (!match) {
    return {
      ok: false,
      error:
        'Try: transfer 0.1 SOL to <address> — use a valid base58 Solana address.',
    };
  }

  const amountRaw = match[1];
  const addressRaw = match[2];
  if (amountRaw === undefined || addressRaw === undefined) {
    return { ok: false, error: "Could not parse command." };
  }

  const amountSol = Number(amountRaw);
  if (!Number.isFinite(amountSol) || amountSol <= 0) {
    return { ok: false, error: "Amount must be a positive number." };
  }

  let recipient: PublicKey;
  try {
    recipient = new PublicKey(addressRaw);
  } catch {
    return { ok: false, error: "Could not parse recipient address." };
  }

  return {
    ok: true,
    command: { kind: "transfer_sol", amountSol, recipient },
  };
}
