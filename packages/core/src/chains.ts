import { bsc, bscTestnet, type Chain } from "viem/chains";

export type SupportedChainId = 56 | 97;

export interface ChainConfig {
  id: SupportedChainId;
  name: string;
  chain: Chain;
  rpcUrl: string;
  identityRegistry: `0x${string}`;
  reputationRegistry: `0x${string}`;
  explorer: string;
  testnet: boolean;
}

// Canonical ERC-8004 registries curated by the 8004 team. Verified by RPC on 2026-09-04:
// mainnet identity is an EIP-1967 proxy named "AgentIdentity" with ids past 334,000.
export const CHAINS: Record<SupportedChainId, ChainConfig> = {
  56: {
    id: 56,
    name: "BNB Smart Chain",
    chain: bsc,
    rpcUrl: process.env.BSC_RPC_URL ?? "https://bsc-dataseed.binance.org",
    identityRegistry: "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432",
    reputationRegistry: "0x8004BAa17C55a88189AE136b182e5fdA19dE9b63",
    explorer: "https://bscscan.com",
    testnet: false,
  },
  97: {
    id: 97,
    name: "BSC Testnet",
    chain: bscTestnet,
    rpcUrl: process.env.BSC_TESTNET_RPC_URL ?? "https://data-seed-prebsc-1-s1.bnbchain.org:8545",
    identityRegistry: "0x8004A818BFB912233c491871b3d84c89A494BD9e",
    reputationRegistry: "0x8004B663056A597Dffe9eCcC1965A193B7388713",
    explorer: "https://testnet.bscscan.com",
    testnet: true,
  },
};

export function chainConfig(chainId: number): ChainConfig {
  const c = CHAINS[chainId as SupportedChainId];
  if (!c) throw new Error(`Unsupported chain ${chainId}; supported: ${Object.keys(CHAINS).join(", ")}`);
  return c;
}

export function agentKey(chainId: number, tokenId: bigint | number | string): string {
  return `${chainId}:${tokenId.toString()}`;
}
