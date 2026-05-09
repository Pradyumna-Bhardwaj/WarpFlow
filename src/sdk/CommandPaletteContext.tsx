import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Connection } from "@solana/web3.js";
import { CommandPalette } from "./CommandPalette";
import { CrossChainModal } from "../components/CrossChainModal";
import { SwapModal } from "../components/SwapModal";
import type {
  ParsedCrossChainTransferCommand,
  ParsedSwapCommand,
  SolanaWalletClient,
} from "./types";

export interface CommandPaletteContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
  toggle: () => void;
  connection: Connection;
  walletClient: SolanaWalletClient;
  openSwap: (command: ParsedSwapCommand) => void;
  closeSwap: () => void;
  openCrossChain: (command: ParsedCrossChainTransferCommand) => void;
  closeCrossChain: () => void;
}

const CommandPaletteContext = createContext<CommandPaletteContextValue | null>(null);

export function useCommandPalette(): CommandPaletteContextValue {
  const ctx = useContext(CommandPaletteContext);
  if (!ctx) {
    throw new Error("useCommandPalette must be used within CommandPaletteProvider");
  }
  return ctx;
}

export interface CommandPaletteProviderProps {
  children: ReactNode;
  connection: Connection;
  walletClient: SolanaWalletClient;
}

export function CommandPaletteProvider({
  children,
  connection,
  walletClient,
}: CommandPaletteProviderProps) {
  const [open, setOpen] = useState(false);
  const [swapCommand, setSwapCommand] = useState<ParsedSwapCommand | null>(null);
  const [crossChainCommand, setCrossChainCommand] =
    useState<ParsedCrossChainTransferCommand | null>(null);

  const toggle = useCallback(() => setOpen((v) => !v), []);
  const openSwap = useCallback((cmd: ParsedSwapCommand) => {
    setOpen(false);
    setCrossChainCommand(null);
    setSwapCommand(cmd);
  }, []);
  const closeSwap = useCallback(() => setSwapCommand(null), []);
  const openCrossChain = useCallback((cmd: ParsedCrossChainTransferCommand) => {
    setOpen(false);
    setSwapCommand(null);
    setCrossChainCommand(cmd);
  }, []);
  const closeCrossChain = useCallback(() => setCrossChainCommand(null), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (crossChainCommand) {
          e.preventDefault();
          setCrossChainCommand(null);
          return;
        }
        if (swapCommand) {
          e.preventDefault();
          setSwapCommand(null);
          return;
        }
        if (open) {
          e.preventDefault();
          setOpen(false);
          return;
        }
      }
      const isK = e.key === "k" || e.key === "K";
      if (isK && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, swapCommand, crossChainCommand]);

  const value = useMemo(
    () => ({
      open,
      setOpen,
      toggle,
      connection,
      walletClient,
      openSwap,
      closeSwap,
      openCrossChain,
      closeCrossChain,
    }),
    [open, toggle, connection, walletClient, openSwap, closeSwap, openCrossChain, closeCrossChain]
  );

  return (
    <CommandPaletteContext.Provider value={value}>
      {children}
      {open ? <CommandPalette /> : null}
      {swapCommand ? <SwapModal command={swapCommand} onClose={closeSwap} /> : null}
      {crossChainCommand ? (
        <CrossChainModal command={crossChainCommand} onClose={closeCrossChain} />
      ) : null}
    </CommandPaletteContext.Provider>
  );
}
