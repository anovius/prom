const Moralis = require("moralis").default;
const DEAD_ADDRESSES = [
	"0x0000000000000000000000000000000000000000",
	"0x000000000000000000000000000000000000dEaD",
	"0x000000000000000000000000000000000000dead",
];
const EXCHANGE_ADDRESSES = [];
const { PROMETHEUS_ENDPOINT, PROMETHEUS_API_KEY, ONE_INCH_API_KEY } = require("../config");

const getWalletTokenBalances = async (address, tokenAddresses) => {
	const payload = {
		chain: "0x1",
		address,
	};

	if (tokenAddresses) payload.tokenAddresses = tokenAddresses;
	const response = await Moralis.EvmApi.token.getWalletTokenBalances(payload);

	// console.log(response.raw);
	return response.raw;
};

const getWalletTxs = async (address) => {
	const response = await Moralis.EvmApi.transaction.getWalletTransactionsVerbose({
		chain: "0x1",
		address,
	});

	const txs = [...response.result];
	let haveMoreTxs = response.hasNext();

	while (haveMoreTxs && txs.length < 1000) {
		const next = await response.next();
		txs.push(...next.result);
		haveMoreTxs = next.hasNext();
	}

	return txs;
};

const getTokenPrice = async (address, block, exchange) => {
	const payload = {
		chain: "0x1",
		address,
	};
	if (exchange) payload.exchange = exchange;

	if (block !== undefined && block !== null) {
		let start = block - 50;
		let end = block + 30;
		for (let i = start; i < end; i += 10) {
			payload.toBlock = i;
			const response = await Moralis.EvmApi.token.getTokenPrice(payload);
			if (response?.result) {
				return response.result;
			}
		}
	} else {
		const response = await Moralis.EvmApi.token.getTokenPrice(payload);

		return response.toJSON();
	}
};

const getTokenTransfers = async (address, block) => {
	if (address && block) {
		const response = await Moralis.EvmApi.token.getTokenTransfers({
			chain: "0x1",
			address,
			fromBlock: block,
			toBlock: block + 1,
		});

		// console.log(response.raw, "-------------- response.raw --------------");
		return response.raw.result;
	}
};

const getTokenMetadata = async (address) => {
	const response = await Moralis.EvmApi.token.getTokenMetadata({
		chain: "0x1",
		addresses: [address],
	});

	return response.raw[0];
};

const getTokenHolders = async (address) => {
	try {
		const response = await fetch(
			`https://api.etherscan.io/api?module=token&action=tokenholderlist&contractaddress=${address}&apikey=${process.env.ETHERSCAN_API_KEY}`
		);
		const data = await response.json();

		const tokenHolders = data.result;

		if (tokenHolders.length > 1000) {
			const topHolders = [];
			for (let i = 0; i < tokenHolders.length; i++) {
				if (
					DEAD_ADDRESSES.includes(tokenHolders[i].TokenHolderAddress.toLowerCase()) ||
					EXCHANGE_ADDRESSES.includes(tokenHolders[i].TokenHolderAddress.toLowerCase())
				) {
					continue;
				} else {
					topHolders.push(tokenHolders[i]);
				}

				if (topHolders.length === 5) {
					break;
				}
			}
			topHolders.sort((a, b) => b.TokenHolderQuantity - a.TokenHolderQuantity);

			return topHolders;
		} else {
			tokenHolders.sort((a, b) => b.TokenHolderQuantity - a.TokenHolderQuantity);

			const topHolders = [];

			for (let i = 0; i < tokenHolders.length; i++) {
				if (
					DEAD_ADDRESSES.includes(tokenHolders[i].TokenHolderAddress.toLowerCase()) ||
					EXCHANGE_ADDRESSES.includes(tokenHolders[i].TokenHolderAddress.toLowerCase())
				) {
					continue;
				} else {
					topHolders.push(tokenHolders[i]);
				}

				if (topHolders.length === 5) {
					break;
				}
			}

			return topHolders;
		}
	} catch (error) {
		console.log("error in getTokenHolders", error);
		return [];
	}
};

const getTopTokenHolders = async (address) => {
	const options = { method: "GET", headers: { accept: "application/json", "x-api-key": PROMETHEUS_API_KEY } };
	try {
		const response = await fetch(
			`${PROMETHEUS_ENDPOINT}?chain_id=1&contract_address=${address}&page=1&limit=20`,
			options
		);
		const result = await response.json();

		return result.data;
	} catch (error) {
		console.log("error in getTokenHolders", error);
		return [];
	}
};

const getTokenLinks = async (address) => {
	try {
		const response = await fetch(
			`https://api.etherscan.io/api?module=token&action=tokeninfo&contractaddress=${address}&apikey=${process.env.ETHERSCAN_API_KEY}`
		);
		const data = await response.json();
		const result = data.result[0];

		const links = [];

		if (result.website) {
			links.push({
				name: "website",
				url: result.website,
			});
		}
		if (result.telegram) {
			links.push({
				name: "telegram",
				url: result.telegram,
			});
		}
		if (result.twitter) {
			links.push({
				name: "twitter",
				url: result.twitter,
			});
		}

		return links;
	} catch (error) {
		console.log("error in getTokenInfo", error);
		return [];
	}
};

const getPastOrders = async (address, chainId = 1) => {
	if (!address) return;

	try {
		const url = "https://api.1inch.dev/orderbook/v3.0/" + chainId + "/address/" + address + "?limit=500";
		const Authorization = `Bearer ${ONE_INCH_API_KEY}`;

		const response = await fetch(url, {
			method: "GET",
			headers: {
				Authorization,
			},
		});

		if (response.status === 200) {
			const data = await response.json();
			return data;
		} else {
			return [];
		}
	} catch (error) {
		console.log(error, "---------------------ERROR---------------------");
		return [];
	}
};

module.exports = {
	getWalletTxs,
	getTokenPrice,
	getWalletTokenBalances,
	getTokenMetadata,
	getTokenHolders,
	getTopTokenHolders,
	getTokenLinks,
	getTokenTransfers,
	getPastOrders,
};
