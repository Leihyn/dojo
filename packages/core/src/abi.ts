// Minimal ERC-8004 ABI fragments (spec: https://eips.ethereum.org/EIPS/eip-8004).
export const identityRegistryAbi = [
  { type: "function", name: "tokenURI", stateMutability: "view", inputs: [{ name: "tokenId", type: "uint256" }], outputs: [{ type: "string" }] },
  { type: "function", name: "ownerOf", stateMutability: "view", inputs: [{ name: "tokenId", type: "uint256" }], outputs: [{ type: "address" }] },
  { type: "function", name: "getAgentWallet", stateMutability: "view", inputs: [{ name: "agentId", type: "uint256" }], outputs: [{ type: "address" }] },
  { type: "function", name: "getMetadata", stateMutability: "view", inputs: [{ name: "agentId", type: "uint256" }, { name: "key", type: "string" }], outputs: [{ type: "bytes" }] },
  { type: "function", name: "register", stateMutability: "nonpayable", inputs: [{ name: "agentURI", type: "string" }], outputs: [{ name: "agentId", type: "uint256" }] },
  { type: "function", name: "setAgentURI", stateMutability: "nonpayable", inputs: [{ name: "agentId", type: "uint256" }, { name: "newURI", type: "string" }], outputs: [] },
  { type: "event", name: "Registered", inputs: [{ name: "agentId", type: "uint256", indexed: true }, { name: "agentURI", type: "string", indexed: false }, { name: "owner", type: "address", indexed: true }] },
  { type: "event", name: "URIUpdated", inputs: [{ name: "agentId", type: "uint256", indexed: true }, { name: "newURI", type: "string", indexed: false }, { name: "updatedBy", type: "address", indexed: true }] },
] as const;

export const reputationRegistryAbi = [
  {
    type: "function", name: "giveFeedback", stateMutability: "nonpayable",
    inputs: [
      { name: "agentId", type: "uint256" }, { name: "value", type: "int128" }, { name: "valueDecimals", type: "uint8" },
      { name: "tag1", type: "string" }, { name: "tag2", type: "string" }, { name: "endpoint", type: "string" },
      { name: "feedbackURI", type: "string" }, { name: "feedbackHash", type: "bytes32" },
    ],
    outputs: [],
  },
  {
    type: "function", name: "getSummary", stateMutability: "view",
    inputs: [{ name: "agentId", type: "uint256" }, { name: "clientAddresses", type: "address[]" }, { name: "tag1", type: "string" }, { name: "tag2", type: "string" }],
    outputs: [{ name: "count", type: "uint64" }, { name: "summaryValue", type: "int128" }, { name: "summaryValueDecimals", type: "uint8" }],
  },
  {
    type: "function", name: "readAllFeedback", stateMutability: "view",
    inputs: [{ name: "agentId", type: "uint256" }, { name: "clientAddresses", type: "address[]" }, { name: "tag1", type: "string" }, { name: "tag2", type: "string" }, { name: "includeRevoked", type: "bool" }],
    outputs: [
      { name: "clients", type: "address[]" }, { name: "feedbackIndexes", type: "uint64[]" }, { name: "values", type: "int128[]" },
      { name: "valueDecimals", type: "uint8[]" }, { name: "tag1s", type: "string[]" }, { name: "tag2s", type: "string[]" }, { name: "revokedStatuses", type: "bool[]" },
    ],
  },
  {
    type: "event", name: "NewFeedback",
    inputs: [
      { name: "agentId", type: "uint256", indexed: true }, { name: "clientAddress", type: "address", indexed: true }, { name: "feedbackIndex", type: "uint64", indexed: false },
      { name: "value", type: "int128", indexed: false }, { name: "valueDecimals", type: "uint8", indexed: false }, { name: "indexedTag1", type: "string", indexed: true },
      { name: "tag1", type: "string", indexed: false }, { name: "tag2", type: "string", indexed: false }, { name: "endpoint", type: "string", indexed: false },
      { name: "feedbackURI", type: "string", indexed: false }, { name: "feedbackHash", type: "bytes32", indexed: false },
    ],
  },
] as const;
