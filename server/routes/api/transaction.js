let { OkResponse, BadRequestResponse, UnauthorizedResponse } = require("express-http-response");
const { Token: TOKEN, WETH, Fetcher, Trade, Route, TokenAmount, TradeType, Percent } = require("@uniswap/sdk");
const { SECRET_KEY, ALCHEMY_SWAP_KEY } = require("../../config");
const { UNISWAP_ROUTER_ABI } = require("../../constants");
const { ethers } = require("ethers");

const provider = new ethers.providers.AlchemyProvider("homestead", ALCHEMY_SWAP_KEY);
const UNISWAP_ROUTER_ADDRESS = "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D";

const CryptoJS = require("crypto-js");
let mongoose = require("mongoose");
let router = require("express").Router();
let Token = mongoose.model("Token");
let Wallet = mongoose.model("Wallet");
let auth = require("../auth");

router.use(auth.required);

router.param("id", async (req, res, next, accountId) => {
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

router.param("contract", async (req, res, next, address) => {
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

router.get("/details/pre-buy/:id/:contract", async (req, res, next) => {
	const { slippage, amount } = { ...req.query };

	if (!amount) return next(new BadRequestResponse("Amount is required"));
	// console.log("amount", amount);

	try {
		const token = req.token;
		const wallet = req.wallet;

		const TOKEN_TO_BUY = new TOKEN(1, token.contractAddress, token.decimals);

		let privateKey = await wallet.getPrivateKey();
		const bytes = CryptoJS.AES.decrypt(privateKey, SECRET_KEY);
		privateKey = bytes.toString(CryptoJS.enc.Utf8);

		const signer = new ethers.Wallet(privateKey, provider);

		const pair = await Fetcher.fetchPairData(TOKEN_TO_BUY, WETH[TOKEN_TO_BUY.chainId], signer);
		const route = new Route([pair], WETH[TOKEN_TO_BUY.chainId]);
		let amountIn = ethers.utils.parseEther(amount.toString());
		amountIn = amountIn.toString();
		const trade = new Trade(route, new TokenAmount(WETH[TOKEN_TO_BUY.chainId], amountIn), TradeType.EXACT_INPUT);
		const slippageTolerance = new Percent(
			slippage && !isNaN(Number(slippage)) && Number(slippage) >= 0.5 ? (Number(slippage) * 100).toString() : "50",
			"10000"
		); // 0.5% slippage  0.5 * 100 = 50 bips

		const amountOutMin = trade.minimumAmountOut(slippageTolerance).raw;
		const amountOutMinHex = BigInt(amountOutMin.toString());

		let UNISWAP_ROUTER_CONTRACT = new ethers.Contract(UNISWAP_ROUTER_ADDRESS, UNISWAP_ROUTER_ABI, provider);

		const path = [WETH[TOKEN_TO_BUY.chainId].address, TOKEN_TO_BUY.address];
		const to = wallet.publicAddress;
		// 20 minutes from the current Unix time
		const deadline = Math.floor(Date.now() / 1000) + 60 * 20;
		const value = trade.inputAmount.raw; // needs to be converted to e.g. hex
		const valueHex = BigInt(value.toString());

		const expectedOutput = await UNISWAP_ROUTER_CONTRACT.getAmountsOut(valueHex, path);

		// console.log(
		// 	path,
		// 	"---------------------TRADE---------------------",
		// 	valueHex,
		// 	expectedOutput[1] / 10 ** token.decimals
		// );

		const data = UNISWAP_ROUTER_CONTRACT.interface.encodeFunctionData("swapExactETHForTokens", [
			amountOutMinHex,
			path,
			to,
			deadline,
		]);

		const FEE_DATA = await provider.getFeeData();
		const { gasPrice: GAS_UNIT_PRICE } = { ...FEE_DATA };

		const txArgs = {
			to: UNISWAP_ROUTER_ADDRESS,
			data: data,
			value: valueHex,
		};

		const GAS_UNITS = await provider.estimateGas(txArgs);

		const TRANSACTION_FEE_IN_WEI = GAS_UNIT_PRICE * GAS_UNITS;
		const TRANSACTION_FEE_IN_ETH = ethers.utils.formatEther(TRANSACTION_FEE_IN_WEI);
		// const GAS_UNIT_PRICE_IN_GWEI = ethers.utils.formatUnits(GAS_UNIT_PRICE, "gwei");

		// console.log(
		// 	GAS_UNIT_PRICE_IN_GWEI,
		// 	"----GAS_UNIT_PRICE IN GWEI -----",
		// 	GAS_UNIT_PRICE.toString(),
		// 	"----GAS_UNIT_PRICE -----",
		// 	"---------------------TRADE---------------------",
		// 	TRANSACTION_FEE_IN_ETH
		// );

		return next(
			new OkResponse({
				minimumOutput: Number(amountOutMinHex) / 10 ** token.decimals,
				// minimumOutput: (amountOutMinHex / BigInt(10 ** token.decimals)).toString(), // Pitfall:	Only outputs integer value
				// expectedOutput: Number(trade.executionPrice.toSignificant(token.decimals)),
				// expectedOutput: trade.executionPrice.toSignificant(6),
				expectedOutput: expectedOutput[1] / 10 ** token.decimals, // Calculating separately from contract
				priceImpact: trade.priceImpact.toSignificant(6),
				networkFee: TRANSACTION_FEE_IN_ETH,
			})
		);
	} catch (error) {
		console.log("---------- Error in transaction --------------", new Error(error));

		if (error.startsWith("InsufficientReservesError")) {
			return next(new BadRequestResponse("Insufficient liquidity for this trade!"));
		}
		return next(new BadRequestResponse("Error in transaction"));
	}
});

module.exports = router;
