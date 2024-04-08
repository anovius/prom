let { OkResponse, BadRequestResponse, UnauthorizedResponse } = require("express-http-response");
const { Token: TOKEN, WETH } = require("@uniswap/sdk");
const router = require("express").Router();
const CryptoJS = require("crypto-js");
const { Web3 } = require("web3");

const auth = require("../auth");

const mongoose = require("mongoose");
const Token = mongoose.model("Token");
const Order = mongoose.model("Order");
const Wallet = mongoose.model("Wallet");
const { ALCHEMY_KEY, SECRET_KEY, ONE_INCH_API_KEY } = require("../../config");
const { getWalletTokenBalances, getTokenPrice } = require("../../utils/web3");
const { buyTokens, sellTokens, quickBuyTokens } = require("../../utils/swap");
// const { placeOrder } = require("../../utils/trade");

router.param("id", async (req, res, next, id) => {
	try {
		const order = await Order.findById(id);

		if (!order) return next(new BadRequestResponse("Order not found!"));

		req.order = order;

		return next();
	} catch (error) {
		console.log(error);
		return next(new BadRequestResponse(error));
	}
});

router.param("wallet", async (req, res, next, accountId) => {
	try {
		const wallet = await Wallet.findOne({ accountId });
		if (!wallet) {
			return next(new BadRequestResponse("Wallet not found"));
		}
		req.wallet = wallet;
		return next();
	} catch (err) {
		return next(new BadRequestResponse(err));
	}
});

router.param("token", async (req, res, next, address) => {
	try {
		const token = await Token.findOne({ contractAddress: address });

		if (!token) {
			return next(new BadRequestResponse("Token not found"));
		}

		req.token = token;

		return next();
	} catch (err) {
		return next(new BadRequestResponse(err));
	}
});

router.use(auth.user);

router.get("/", async (req, res, next) => {
	try {
		const aggregationResults = await Order.aggregate([
			{
				$group: {
					_id: "$wallet", // Group by wallet field
					orders: {
						$push: {
							id: "$_id",
							placedBy: "$placedBy",
							sellToken: "$sellToken",
							sellAmount: "$sellAmount",
							sellTokenDecimals: "$sellTokenDecimals",
							sellTokenSymbol: "$sellTokenSymbol",
							buyToken: "$buyToken",
							buyAmount: "$buyAmount",
							type: "$type",
							slippage: "$slippage",
							executedTrades: "$executedTrades",
							status: "$status",
						},
					},
				},
			},
		]);

		// Convert the result to the desired format
		const formattedResults = {};
		aggregationResults.forEach((result) => {
			formattedResults[result._id] = result.orders;
		});

		// console.log(formattedResults, "---------- Formatted format results ----------");

		return next(new OkResponse(formattedResults));
	} catch (error) {
		console.log(error);
		return next(new BadRequestResponse(error));
	}
});

router.post("/:wallet/:address", async (req, res, next) => {
	const { wallet } = req;
	const { address } = req.params;
	const { type, decimals } = req.query;
	const { sellAmount, buyAmount } = req.body;

	if (!type) {
		return next(new BadRequestResponse("Order type not specified!"));
	}

	try {
		const walletToken = wallet.tokens.find((t) => t.contractAddress === address);

		if (!walletToken) {
			return next(new BadRequestResponse("Token not found in wallet!"));
		}

		const tokenBalances = await getWalletTokenBalances(wallet.publicAddress, [address]);

		const tokenBalance = tokenBalances.find((t) => t.token_address === address);

		if (!tokenBalance || tokenBalance.balance < sellAmount) {
			return next(new BadRequestResponse("Insufficient balance!"));
		}

		const order = new Order({
			placedBy: req.user.id,
			wallet: wallet.id,
			sellAmount,
			buyAmount: buyAmount,
			buyToken: WETH[1].address,
			sellToken: address,
			sellTokenDecimals: decimals,
			sellTokenSymbol: walletToken.symbol,
		});

		if (["sl", "tp", "market"].includes(type)) {
			order.type = type;
		}
		walletToken.limitOrders.push(order._id);
		await wallet.save();

		await order.save();

		return next(new OkResponse("Order placed!"));
	} catch (error) {
		console.log(error);
		return next(new BadRequestResponse("Failed to place order!"));
	}
});

router.put("/cancel/:id", async (req, res, next) => {
	const { order } = req;

	try {
		order.status = "cancelled";
		await order.save();

		return next(new OkResponse("Order cancelled!"));
	} catch (error) {
		console.log(error);
		return next(new BadRequestResponse(error));
	}
});

module.exports = router;
