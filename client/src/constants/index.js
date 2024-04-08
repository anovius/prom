const PROMETHEUS_CONTRACT_ADDRESS = "0x75459A499a79ccD7C5Fae3201738F9E4677D69E4";

const PROMETHEUS_CONTRACT_ABI = [
	{ inputs: [], stateMutability: "nonpayable", type: "constructor" },
	{
		anonymous: false,
		inputs: [
			{ indexed: true, internalType: "address", name: "owner", type: "address" },
			{ indexed: true, internalType: "address", name: "spender", type: "address" },
			{ indexed: false, internalType: "uint256", name: "value", type: "uint256" },
		],
		name: "Approval",
		type: "event",
	},
	{
		anonymous: false,
		inputs: [{ indexed: false, internalType: "uint256", name: "_maxTxAmount", type: "uint256" }],
		name: "MaxTxAmountUpdated",
		type: "event",
	},
	{
		anonymous: false,
		inputs: [
			{ indexed: true, internalType: "address", name: "previousOwner", type: "address" },
			{ indexed: true, internalType: "address", name: "newOwner", type: "address" },
		],
		name: "OwnershipTransferred",
		type: "event",
	},
	{
		anonymous: false,
		inputs: [
			{ indexed: true, internalType: "address", name: "from", type: "address" },
			{ indexed: true, internalType: "address", name: "to", type: "address" },
			{ indexed: false, internalType: "uint256", name: "value", type: "uint256" },
		],
		name: "Transfer",
		type: "event",
	},
	{
		inputs: [{ internalType: "address", name: "", type: "address" }],
		name: "_buyMap",
		outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
		stateMutability: "view",
		type: "function",
	},
	{
		inputs: [],
		name: "_maxTxAmount",
		outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
		stateMutability: "view",
		type: "function",
	},
	{
		inputs: [],
		name: "_maxWalletSize",
		outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
		stateMutability: "view",
		type: "function",
	},
	{
		inputs: [],
		name: "_swapTokensAtAmount",
		outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
		stateMutability: "view",
		type: "function",
	},
	{
		inputs: [
			{ internalType: "address", name: "owner", type: "address" },
			{ internalType: "address", name: "spender", type: "address" },
		],
		name: "allowance",
		outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
		stateMutability: "view",
		type: "function",
	},
	{
		inputs: [
			{ internalType: "address", name: "spender", type: "address" },
			{ internalType: "uint256", name: "amount", type: "uint256" },
		],
		name: "approve",
		outputs: [{ internalType: "bool", name: "", type: "bool" }],
		stateMutability: "nonpayable",
		type: "function",
	},
	{
		inputs: [{ internalType: "address", name: "account", type: "address" }],
		name: "balanceOf",
		outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
		stateMutability: "view",
		type: "function",
	},
	{
		inputs: [{ internalType: "address[]", name: "bots_", type: "address[]" }],
		name: "blockBots",
		outputs: [],
		stateMutability: "nonpayable",
		type: "function",
	},
	{
		inputs: [{ internalType: "address", name: "", type: "address" }],
		name: "bots",
		outputs: [{ internalType: "bool", name: "", type: "bool" }],
		stateMutability: "view",
		type: "function",
	},
	{
		inputs: [],
		name: "decimals",
		outputs: [{ internalType: "uint8", name: "", type: "uint8" }],
		stateMutability: "pure",
		type: "function",
	},
	{
		inputs: [
			{ internalType: "address[]", name: "accounts", type: "address[]" },
			{ internalType: "bool", name: "excluded", type: "bool" },
		],
		name: "excludeMultipleAccountsFromFees",
		outputs: [],
		stateMutability: "nonpayable",
		type: "function",
	},
	{ inputs: [], name: "manualsend", outputs: [], stateMutability: "nonpayable", type: "function" },
	{ inputs: [], name: "manualswap", outputs: [], stateMutability: "nonpayable", type: "function" },
	{
		inputs: [],
		name: "name",
		outputs: [{ internalType: "string", name: "", type: "string" }],
		stateMutability: "pure",
		type: "function",
	},
	{
		inputs: [],
		name: "owner",
		outputs: [{ internalType: "address", name: "", type: "address" }],
		stateMutability: "view",
		type: "function",
	},
	{ inputs: [], name: "renounceOwnership", outputs: [], stateMutability: "nonpayable", type: "function" },
	{
		inputs: [
			{ internalType: "uint256", name: "redisFeeOnBuy", type: "uint256" },
			{ internalType: "uint256", name: "redisFeeOnSell", type: "uint256" },
			{ internalType: "uint256", name: "taxFeeOnBuy", type: "uint256" },
			{ internalType: "uint256", name: "taxFeeOnSell", type: "uint256" },
		],
		name: "setFee",
		outputs: [],
		stateMutability: "nonpayable",
		type: "function",
	},
	{
		inputs: [{ internalType: "uint256", name: "maxTxAmount", type: "uint256" }],
		name: "setMaxTxnAmount",
		outputs: [],
		stateMutability: "nonpayable",
		type: "function",
	},
	{
		inputs: [{ internalType: "uint256", name: "maxWalletSize", type: "uint256" }],
		name: "setMaxWalletSize",
		outputs: [],
		stateMutability: "nonpayable",
		type: "function",
	},
	{
		inputs: [{ internalType: "uint256", name: "swapTokensAtAmount", type: "uint256" }],
		name: "setMinSwapTokensThreshold",
		outputs: [],
		stateMutability: "nonpayable",
		type: "function",
	},
	{
		inputs: [{ internalType: "bool", name: "_tradingOpen", type: "bool" }],
		name: "setTrading",
		outputs: [],
		stateMutability: "nonpayable",
		type: "function",
	},
	{
		inputs: [],
		name: "symbol",
		outputs: [{ internalType: "string", name: "", type: "string" }],
		stateMutability: "pure",
		type: "function",
	},
	{
		inputs: [{ internalType: "bool", name: "_swapEnabled", type: "bool" }],
		name: "toggleSwap",
		outputs: [],
		stateMutability: "nonpayable",
		type: "function",
	},
	{
		inputs: [],
		name: "totalSupply",
		outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
		stateMutability: "pure",
		type: "function",
	},
	{
		inputs: [
			{ internalType: "address", name: "recipient", type: "address" },
			{ internalType: "uint256", name: "amount", type: "uint256" },
		],
		name: "transfer",
		outputs: [{ internalType: "bool", name: "", type: "bool" }],
		stateMutability: "nonpayable",
		type: "function",
	},
	{
		inputs: [
			{ internalType: "address", name: "sender", type: "address" },
			{ internalType: "address", name: "recipient", type: "address" },
			{ internalType: "uint256", name: "amount", type: "uint256" },
		],
		name: "transferFrom",
		outputs: [{ internalType: "bool", name: "", type: "bool" }],
		stateMutability: "nonpayable",
		type: "function",
	},
	{
		inputs: [{ internalType: "address", name: "newOwner", type: "address" }],
		name: "transferOwnership",
		outputs: [],
		stateMutability: "nonpayable",
		type: "function",
	},
	{
		inputs: [{ internalType: "address", name: "notbot", type: "address" }],
		name: "unblockBot",
		outputs: [],
		stateMutability: "nonpayable",
		type: "function",
	},
	{
		inputs: [],
		name: "uniswapV2Pair",
		outputs: [{ internalType: "address", name: "", type: "address" }],
		stateMutability: "view",
		type: "function",
	},
	{
		inputs: [],
		name: "uniswapV2Router",
		outputs: [{ internalType: "contract IUniswapV2Router02", name: "", type: "address" }],
		stateMutability: "view",
		type: "function",
	},
	{ stateMutability: "payable", type: "receive" },
];

const DECIMALS = 18;

const CHAIN_ID = 1;

const HEX_CHAIN_ID = "0x1";

export { PROMETHEUS_CONTRACT_ADDRESS, PROMETHEUS_CONTRACT_ABI, DECIMALS, CHAIN_ID, HEX_CHAIN_ID };

const devUrls = {
	api_url: "http://localhost:8000/api",
	file_url: "http://localhost:8000",
	front_end: "http://localhost:3000",
};

const prodUrls = {
	// api_url: "https://dapp.prometrading.com/api",
	// file_url: "https://dapp.prometrading.com",
	// front_end: "https://dapp.prometrading.com",

	// Staging URL's
	api_url: "http://3.86.167.168/api",
	file_url: "http://3.86.167.168",
	front_end: "http://3.86.167.168",
};

export const environment = import.meta.env.MODE === "development" ? devUrls : prodUrls;
