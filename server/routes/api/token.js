let { OkResponse, BadRequestResponse, UnauthorizedResponse } = require("express-http-response");
const { getTokenPrice } = require("../../utils/web3");

const { ethers } = require("ethers");
const CryptoJS = require("crypto-js");
const { Token: TOKEN, WETH } = require("@uniswap/sdk");
const { Fetcher, Route, Trade, TokenAmount, TradeType, Percent, Pair } = require("@uniswap/sdk");
const { SECRET_KEY } = require("../../config");
const { UNISWAP_ROUTER_ABI, WETH_CONTRACT_ABI } = require("../../constants");

let mongoose = require("mongoose");
let router = require("express").Router();
let auth = require("../auth");

const Token = mongoose.model("Token");
const Wallet = mongoose.model("Wallet");

const UNISWAP_V2_ROUTER_ADDRESS = "0x7a250d5630b4cf539739df2c5dacb4c659f2488d";

// router.use(auth.required);

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

router.get("/price/:contract", async (req, res, next) => {
	try {
		const { contract } = { ...req.params };

		if (!contract) {
			return next(new BadRequestResponse("Contract address missing!"));
		}

		const data = await getTokenPrice(contract, null, "uniswapv2");

		if (data) {
			return next(new OkResponse({ price: data.nativePrice.value.toString() }));
		} else {
			return next(new BadRequestResponse("Failed to fetch price"));
		}
	} catch (error) {
		console.log("error in transaction", error);
		return next(new BadRequestResponse("Error in transaction"));
	}
});

router.get("/price-quote/:token/:wallet", async (req, res, next) => {
	try {
		const { wallet } = req;
		const { token: sellToken } = req.params;
		const { amount: sellAmount, decimal: sellTokenDecimals } = req.query;

		let privateKey = await wallet.getPrivateKey();
		const bytes = CryptoJS.AES.decrypt(privateKey, SECRET_KEY);
		privateKey = bytes.toString(CryptoJS.enc.Utf8);

		const provider = new ethers.providers.JsonRpcProvider("https://rpc.mevblocker.io");
		const ethersWallet = new ethers.Wallet(privateKey, provider);

		const TOKEN_TO_SELL = new TOKEN(1, sellToken, sellTokenDecimals);
		const TOKEN_TO_BUY = WETH[1];

		const pair = await Fetcher.fetchPairData(TOKEN_TO_BUY, TOKEN_TO_SELL, ethersWallet.provider);
		const route = await new Route([pair], TOKEN_TO_SELL);

		let amountIn = sellAmount;

		const trade = new Trade(route, new TokenAmount(TOKEN_TO_SELL, amountIn), TradeType.EXACT_INPUT);
		const tradeAmountOut = trade.outputAmount.raw.toString();

		// console.log("------------ Trade ------------", trade.priceImpact.toSignificant(6), tradeAmountOut);

		return next(new OkResponse({ amountOut: tradeAmountOut }));
	} catch (error) {
		console.log(error, "Error while getting price quote");
		return next(new BadRequestResponse("Error while getting price quote"));
	}
});

module.exports = router;
