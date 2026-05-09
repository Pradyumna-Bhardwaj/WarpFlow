import {
  Connection,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  Transaction,
} from "@solana/web3.js";

export async function buildSolTransferTransaction(
  connection: Connection,
  from: PublicKey,
  to: PublicKey,
  amountSol: number
): Promise<Transaction> {
  const lamports = Math.round(amountSol * LAMPORTS_PER_SOL);
  if (lamports <= 0) {
    throw new Error("Amount too small after converting to lamports.");
  }

  const { blockhash, lastValidBlockHeight } =
    await connection.getLatestBlockhash("confirmed");

  const ix = SystemProgram.transfer({
    fromPubkey: from,
    toPubkey: to,
    lamports,
  });

  const tx = new Transaction({
    feePayer: from,
    blockhash,
    lastValidBlockHeight,
  }).add(ix);

  return tx;
}

/** Sends an exact lamport amount (e.g. from a 1Click `amountIn` quote). */
export async function buildSolTransferTransactionLamports(
  connection: Connection,
  from: PublicKey,
  to: PublicKey,
  lamports: bigint
): Promise<Transaction> {
  if (lamports <= 0n) {
    throw new Error("Lamports must be positive.");
  }
  const n = Number(lamports);
  if (!Number.isSafeInteger(n)) {
    throw new Error("Amount is too large for a single SystemProgram transfer.");
  }

  const { blockhash, lastValidBlockHeight } =
    await connection.getLatestBlockhash("confirmed");

  const ix = SystemProgram.transfer({
    fromPubkey: from,
    toPubkey: to,
    lamports: n,
  });

  return new Transaction({
    feePayer: from,
    blockhash,
    lastValidBlockHeight,
  }).add(ix);
}
