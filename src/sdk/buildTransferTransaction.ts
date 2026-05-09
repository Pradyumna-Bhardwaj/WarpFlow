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
