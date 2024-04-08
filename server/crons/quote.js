const cron = require("node-cron");
const { ethers } = require("ethers");
const CryptoJS = require("crypto-js");
const Order = require("../models/Order");
const { Token: TOKEN, WETH } = require("@uniswap/sdk");
const { Fetcher, Route, Trade, TokenAmount, TradeType } = require("@uniswap/sdk");

const { SECRET_KEY } = require("../config");

const task = cron.schedule("*/10 * * * * *", async () => {
	const orders = await Order.find({ status: "active" }).populate("wallet");
	const sockets = await prometheusSocket.fetchSockets();
	const usersOrders = {};

	for (let i = 0; i < orders.length; i++) {
		const order = orders[i];

		try {
			let privateKey = await order.wallet.getPrivateKey();
			const bytes = CryptoJS.AES.decrypt(privateKey, SECRET_KEY);
			privateKey = bytes.toString(CryptoJS.enc.Utf8);

			const provider = new ethers.providers.JsonRpcProvider("https://rpc.mevblocker.io");
			const wallet = new ethers.Wallet(privateKey, provider);

			const TOKEN_TO_SELL = new TOKEN(1, order.sellToken, 18);
			const TOKEN_TO_BUY = WETH[1];

			const pair = await Fetcher.fetchPairData(TOKEN_TO_BUY, TOKEN_TO_SELL, wallet.provider);
			const route = await new Route([pair], TOKEN_TO_SELL);

			let amountIn = order.sellAmount;
			let amountOut = order.buyAmount;

			const trade = new Trade(route, new TokenAmount(TOKEN_TO_SELL, amountIn), TradeType.EXACT_INPUT);
			const tradeAmountOut = trade.outputAmount.raw.toString();

			usersOrders[order.placedBy.toString()] = {
				...usersOrders[order.placedBy.toString()],
				[order._id.toString()]: tradeAmountOut,
			};

			// console.log("📈📈📈 =================>>>>> tradeAmountOut <<<<=============== 📈📈📈", usersOrders);
		} catch (e) {
			console.log(e, "err in running Quote cron");
		}
	}

	if (sockets && Array.isArray(sockets)) {
		sockets.forEach((socket) => {
			const isSocketAuthorized = socket.user && socket.user._id.toString();

			if (isSocketAuthorized) {
				const ownerId = socket.user._id.toString();
				const ownerOrders = usersOrders[ownerId];

				if (Object.keys(ownerOrders).length > 0) {
					socket.emit("order_rates", ownerOrders);
				}
			}
		});
	}
});

module.exports = task;
