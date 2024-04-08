const cron = require("node-cron");
const Wallet = require("../models/Wallet");
const { getWalletTokenBalances, getWalletTxs, getTokenPrice, getPastOrders } = require("../utils/web3");
const calAvgPrice = require("../utils/calAverage");
const UNISWAP_ROUTER_ADDRESS = "0x3fC91A3afd70395Cd496C647d5a6CC9D4B2b7FAD".toLowerCase();
const UNISWAP_V2_ROUTER_ADDRESS = "0xDef1C0ded9bec7F1a1670819833240f027b25EfF".toLowerCase();
const UNISWAP_V2_ROUTER_ADDRESS_2 = "0x7a250d5630b4cf539739df2c5dacb4c659f2488d";
const { Web3 } = require("web3");
const { ALCHEMY_KEY } = require("../config");

const task = cron.schedule("*/10 * * * * *", async () => {
	const wallets = await Wallet.find({});
	const sockets = await prometheusSocket.fetchSockets();

	for (let wallet of wallets) {
		try {
			const web3 = new Web3("https://eth-mainnet.g.alchemy.com/v2/" + ALCHEMY_KEY);

			// Fetching wallet balance
			const balance = await web3.eth.getBalance(wallet.publicAddress);
			const userBalance = (Number(balance) / 10 ** 18).toFixed(5);

			wallet.balance = userBalance;
			await wallet.save();

			const tokenBalances = await getWalletTokenBalances(wallet.publicAddress);
			let updatedTokens = [];
			const tokenAddresses = [];
			let tokenPrices = {};

			// Checking if wallet has new tokens
			for (let token of tokenBalances) {
				tokenAddresses.push(token.token_address);
				tokenPrices[token.token_address] = [];

				const res = await getTokenPrice(token.token_address).catch((err) => {
					// console.log(err, "=============== err in getting token price ==============");
				});

				let oldToken = wallet.tokens.find((t) => t.contractAddress === token.token_address);

				if (oldToken) {
					updatedTokens.push({
						...oldToken,
						amount: token.balance,
						price: res?.usdPriceFormatted,
						decimals: token.decimals,
					});
				} else {
					updatedTokens.push({
						name: token.name,
						symbol: token.symbol,
						contractAddress: token.token_address,
						amount: token.balance,
						price: res?.usdPriceFormatted,
						decimals: token.decimals,
					});
				}
			}
			wallet.tokens = updatedTokens;
			await wallet.save();

			// Fetching wallet all transactions & scanning for buy transactions
			const txs = await getWalletTxs(wallet.publicAddress);
			for (let tx of txs) {
				if (
					String(tx.to._value).toLowerCase() === UNISWAP_ROUTER_ADDRESS ||
					String(tx.to._value).toLowerCase() === UNISWAP_V2_ROUTER_ADDRESS ||
					String(tx.to._value).toLowerCase() === UNISWAP_V2_ROUTER_ADDRESS_2
				) {
					if (Array.isArray(tx.logs) && tx.logs.length > 0) {
						for (let log of tx.logs) {
							const tokenAddress = String(log.address._value).toLowerCase();
							const token = wallet.tokens.find((t) => t.contractAddress.toLowerCase() === tokenAddress);
							const isTransferEvent =
								String(log.topics[0]).toLowerCase() ===
								"0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

							const isTransferredToWallet =
								String(log.topics[2]).toLowerCase() ===
								"0x" + wallet.publicAddress.toLowerCase().slice(2).padStart(64, "0");

							// console.log(log, log.topics, token, tokenAddress, isTransferEvent, isTransferredToWallet);

							if (token && isTransferEvent && isTransferredToWallet) {
								const buyAmount = parseInt(log.data, 16) / 10 ** token.decimals;
								// console.log(buyAmount, tokenAddress, log.blockNumber);
								const price = await getTokenPrice(tokenAddress, log.blockNumber).catch((err) => {
									// console.log(err, "=============== err in getting token price ==============");
								});
								tokenPrices[tokenAddress].push({
									price: price?.usdPriceFormatted,
									amount: buyAmount,
								});
							}
						}
					}
				}
			}

			// Calculating tokens average buy price & their profit
			tokenPrices = calAvgPrice(tokenPrices);
			for (let token of wallet.tokens) {
				console.log(tokenPrices[token.contractAddress], typeof tokenPrices[token.contractAddress]);
				if (typeof tokenPrices[token.contractAddress] !== "number" || isNaN(tokenPrices[token.contractAddress])) {
					console.log(
						"buy price not found",
						token.name,
						token.contractAddress,
						typeof tokenPrices[token.contractAddress]
					);
					continue;
				}
				token.buyPrice = tokenPrices[token.contractAddress];
				token.profit =
					(token.amount / 10 ** token.decimals) * token.price - (token.amount / 10 ** token.decimals) * token.buyPrice;
			}
			wallet.lastChecked = new Date();

			await wallet.save();
			console.log("wallet saved");
		} catch (err) {
			console.log(err, "err in running Wallets cron");
		}
	}

	if (sockets && Array.isArray(sockets)) {
		sockets.forEach((socket) => {
			const isSocketAuthorized = socket.user && socket.user._id.toString();

			if (isSocketAuthorized) {
				const ownerId = socket.user._id.toString();
				const ownerWallets = wallets.filter((wallet) => wallet.owner.toString() === ownerId);

				if (ownerWallets.length > 0) {
					socket.emit("update_wallets", ownerWallets);
				}
			}
		});
	}
});

module.exports = task;
