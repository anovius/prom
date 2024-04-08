const cron = require("node-cron");
const { ethers } = require("ethers");
const CryptoJS = require("crypto-js");
const Order = require("../models/Order");
const { Token: TOKEN, WETH } = require("@uniswap/sdk");
const { Fetcher, Route, Trade, TokenAmount, TradeType, Percent } = require("@uniswap/sdk");

const { SECRET_KEY } = require("../config");
const { UNISWAP_ROUTER_ABI, WETH_CONTRACT_ABI } = require("../constants");

const UNISWAP_V2_ROUTER_ADDRESS = "0x7a250d5630b4cf539739df2c5dacb4c659f2488d";

const activeCrons = [];

const task = (ordersList) => {
	return cron.schedule("* * * * * *", async () => {
		// console.log("Cron running for: \n", ordersList);
		const orders = ordersList;

		for (let i = 0; i < orders.length; i++) {
			const order = orders[i];

			try {
				let privateKey = await order.wallet.getPrivateKey();
				const bytes = CryptoJS.AES.decrypt(privateKey, SECRET_KEY);
				privateKey = bytes.toString(CryptoJS.enc.Utf8);

				const provider = new ethers.providers.JsonRpcProvider("https://rpc.mevblocker.io");
				const wallet = new ethers.Wallet(privateKey, provider);
				let UNISWAP_ROUTER_CONTRACT = new ethers.Contract(UNISWAP_V2_ROUTER_ADDRESS, UNISWAP_ROUTER_ABI, provider);

				const TOKEN_TO_SELL = new TOKEN(1, order.sellToken, 18);
				const TOKEN_TO_BUY = WETH[1];

				const pair = await Fetcher.fetchPairData(TOKEN_TO_BUY, TOKEN_TO_SELL, wallet.provider);
				const route = await new Route([pair], TOKEN_TO_SELL);

				let amountIn = order.sellAmount;
				let amountOut = order.buyAmount;
				const slippageTolerance = new Percent((Number(order.slippage) * 100).toString(), "10000");

				const trade = new Trade(route, new TokenAmount(TOKEN_TO_SELL, amountIn), TradeType.EXACT_INPUT);
				const amountOutMin = trade.minimumAmountOut(slippageTolerance).raw.toString();
				const tradeAmountOut = trade.outputAmount.raw.toString();

				// percentage change between amountOutMin and amountOut
				// const percentageChange = (amountOut - tradeAmountOut) / tradeAmountOut - 1;
				const percentageChange = ((tradeAmountOut - amountOut) / amountOut) * 100;
				// console.log(percentageChange, "percentageChange");

				// console.log(
				// 	"------------ Trade ------------",
				// 	trade.priceImpact.toSignificant(6),
				// 	amountOutMin,
				// 	tradeAmountOut,
				// 	amountOut
				// );

				await approveERC20(TOKEN_TO_SELL.address, UNISWAP_V2_ROUTER_ADDRESS, wallet);

				const path = [TOKEN_TO_SELL.address, TOKEN_TO_BUY.address];
				const to = wallet.address;
				const deadline = Math.floor(Date.now() / 1000) + 60 * 20;
				const value = trade.inputAmount.raw;

				const params = {
					amountIn: await BigInt(amountIn.toString()),
					amountOutMin: await BigInt(amountOutMin.toString()),
					path: path,
					to: to,
					deadline: deadline,
				};

				const data = UNISWAP_ROUTER_CONTRACT.interface.encodeFunctionData("swapExactTokensForETH", [
					params.amountIn,
					params.amountOutMin,
					params.path,
					params.to,
					params.deadline,
				]);

				const { gasPrice: GAS_UNIT_PRICE } = await provider.getFeeData();

				const txArgs = {
					from: wallet.address,
					to: UNISWAP_V2_ROUTER_ADDRESS,
					data: data,
					gasPrice: GAS_UNIT_PRICE,
				};

				const GAS_UNITS = await provider.estimateGas(txArgs);
				txArgs.gasLimit = parseInt(Number(GAS_UNITS) + GAS_UNITS * 0.3);

				// const TOTAL_FEE_IN_GWEI = ethers.utils.formatUnits(txArgs.gasPrice.mul(txArgs.gasLimit), "gwei");
				const TOTAL_FEE_IN_GWEI = ethers.utils.formatUnits(txArgs.gasPrice.mul(txArgs.gasLimit), "wei");

				// console.log("GAS_UNITS", GAS_UNITS, "GAS_UNIT_PRICE", GAS_UNIT_PRICE, "GAS_LIMIT", TOTAL_FEE_IN_GWEI);

				// console.log(txArgs, "txArgs \n", params);

				let tx;
				let receipt;

				if (order.type === "market" && percentageChange < 0.05 && percentageChange > -0.05) {
					console.log("Market value reached, executing trade");
					tx = await wallet.sendTransaction(txArgs);
					receipt = await tx.wait();
				} else if (order.type === "sl" && percentageChange > -0.05 && percentageChange < 0) {
					console.log("Stop loss value reached, executing trade");
					tx = await wallet.sendTransaction(txArgs);
					receipt = await tx.wait();
				} else if (order.type === "tp" && percentageChange < 0.05 && percentageChange > 0) {
					console.log("Take profit value reached, executing trade");
					tx = await wallet.sendTransaction(txArgs);
					receipt = await tx.wait();
				}

				if (receipt) {
					order.status = "filled";
					order.executedTrades.push({
						hash: tx.hash,
						executionTime: new Date(),
					});
					await order.save();

					console.log(
						" -------- Transaction is mined -------- " + "\n" + "Transaction Hash:",
						tx.hash + "\n" + "Block Number: " + receipt.blockNumber
					);
					return receipt;
				}
			} catch (e) {
				const insufficientBalanceForApproval =
					e?.message === "Insufficient funds for paying gas fee for token approval!";

				if (insufficientBalanceForApproval) {
					console.log(
						"\n\n-------------- ♢♢♢♢♢♢♢♢♢♢♢♢♢♢♢♢ -------------- \n Insufficient ETH balance for token approval! \n-------------- ♢♢♢♢♢♢♢♢♢♢♢♢♢♢♢♢ --------------\n\n"
					);
					continue;
				}

				const insufficientLiquidityError = new Error(e).message.startsWith("InsufficientInputAmountError");

				if (insufficientLiquidityError) {
					console.log("Insufficient liquidity for this trade!");
					continue;
				}

				const insufficientFundsError = JSON.parse(e.error?.body)?.error?.message?.startsWith(
					"gas required exceeds allowance"
				);
				const insufficientFundsError2 =
					e.reason === "execution reverted: UniswapV2: TRANSFER_FAILED" &&
					e.code === "UNPREDICTABLE_GAS_LIMIT" &&
					e.method === "estimateGas";

				if (insufficientFundsError || insufficientFundsError2) {
					console.log(
						"\n\n-------------- ⛽⛽⛽⛽⛽⛽ -------------- \n Insufficient funds for paying gas fee! \n-------------- ⛽⛽⛽⛽⛽⛽ --------------\n\n"
					);
					continue;
					// order.status = "failed";
				}

				console.log(e, "err in running Orders cron");
			}
		}
	});
};

async function approveERC20(tokenAddress, operator, wallet) {
	try {
		const value = ethers.BigNumber.from(2).pow(256).sub(1);

		const contract = new ethers.Contract(tokenAddress, WETH_CONTRACT_ABI, wallet);

		const allowance = await contract.allowance(wallet.getAddress(), operator);

		// Just divide 2^256 by 2 to check whether allowance is enough
		// since allowance would drop by a small amount on every transaction
		// This obviously breaks if we transfer more than ((2 ^ 256) / 2) tokens
		// but that's impossible
		if (value.div(2).lte(allowance)) {
			console.log(`Allowance ${allowance} enough, not setting approval`);
			return;
		}

		console.log(`Setting approval for ${operator} to ${value} (existing ${allowance})`);

		const approveTx = await contract.approve(operator, value);
		const receipt = await approveTx.wait();

		return receipt;
	} catch (error) {
		console.log(
			"------------- Error approving ERC20 token ----------- \n",
			// JSON.stringify(error),
			JSON.stringify(error.error?.error?.body)
			// error.body?.message
		);
		let errorBody = error.error?.error?.body;

		if (errorBody) {
			errorBody = JSON.parse(errorBody);
			// console.log(JSON.stringify(errorBody));
		}
		if (errorBody?.error?.code === -32000 && errorBody?.error?.message?.startsWith("gas required exceeds allowance")) {
			throw new Error("Insufficient funds for paying gas fee for token approval!");
		}
		throw new Error("Failed to approve ERC20 token!");
	}
}

const cronManager = cron.schedule("*/5 * * * * *", async () => {
	const allOrders = await Order.find({ status: "active" }).populate("wallet");
	const numCronsRequired = Math.ceil(allOrders.length / 200);

	console.log("Number of crons required: ", numCronsRequired);

	// stop all previous crons
	activeCrons.forEach((cron) => {
		cron.stop();
	});
	activeCrons.length = 0;

	// If more crons are needed
	while (activeCrons.length < numCronsRequired) {
		const startIdx = activeCrons.length * 200;
		const endIdx = startIdx + 200;
		const ordersChunk = allOrders.slice(startIdx, endIdx);
		const newCron = task(ordersChunk);
		newCron.start();
		activeCrons.push(newCron);
	}

	// If fewer crons are needed
	while (activeCrons.length > numCronsRequired) {
		const cronToRemove = activeCrons.pop();
		cronToRemove.stop();
	}
});

module.exports = cronManager;
