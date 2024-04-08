const { ethers } = require("ethers");
const { Fetcher, Route, Trade, TokenAmount, TradeType, Percent, Pair } = require("@uniswap/sdk");
const { UNISWAP_ROUTER_ABI, WETH_CONTRACT_ABI } = require("../constants");
let { ALCHEMY_SWAP_KEY } = require("../config");

async function buyTokens(privateKey, token1, token2, amount, slippage = "5", outputAmount) {
	// console.log("===============swapTokens==============", amount, slippage, outputAmount);
	// return;
	// const provider = new ethers.providers.AlchemyProvider("homestead", ALCHEMY_SWAP_KEY);
	const provider = new ethers.providers.JsonRpcProvider("https://rpc.mevblocker.io");

	const wallet = new ethers.Wallet(privateKey, provider);

	// Uniswap Router V2 Address Reference: https://docs.uniswap.org/contracts/v2/reference/smart-contracts/router-02
	let UNISWAP_ROUTER_ADDRESS = "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D";
	let UNISWAP_ROUTER_CONTRACT = new ethers.Contract(UNISWAP_ROUTER_ADDRESS, UNISWAP_ROUTER_ABI, provider);

	try {
		// Pair Liquidity Pool to calculate the price & prepare the swap
		const pair = await Fetcher.fetchPairData(token1, token2, wallet.provider);

		const route = await new Route([pair], token2); // a fully specified path from input token to output token

		// Helper to convert Ether to Wei
		let amountIn = ethers.utils.parseEther(amount.toString());
		amountIn = amountIn.toString();

		const slippageTolerance = new Percent(
			slippage && !isNaN(Number(slippage)) && Number(slippage) >= 0.5 ? (Number(slippage) * 100).toString() : "50",
			"10000"
		);

		const trade = new Trade(route, new TokenAmount(token2, amountIn), TradeType.EXACT_INPUT); //information necessary to create a swap transaction.

		const amountOutMin = trade.minimumAmountOut(slippageTolerance).raw;
		const amountOutMinHex = await BigInt(amountOutMin.toString());
		// return amountOutMinHex;

		// Pair token addresses like [WETH_ADDRESS, TOKEN_ADDRESS_TO_SWAP]
		const path = [token2.address, token1.address];
		const to = wallet.address;
		// 20 minutes from the current Unix time
		const deadline = Math.floor(Date.now() / 1000) + 60 * 20;
		const value = trade.inputAmount.raw; // needs to be converted to e.g. hex
		const valueHex = await BigInt(value.toString()); //convert to hex string

		//Return a copy of transactionRequest, The default implementation calls checkTransaction and resolves to if it is an ENS name, adds gasPrice, nonce, gasLimit and chainId based on the related operations on Signer.

		const params = {
			amountOutMin: amountOutMinHex,
			path: path,
			to: to,
			deadline: deadline,
		};

		const data = UNISWAP_ROUTER_CONTRACT.interface.encodeFunctionData(
			outputAmount ? "swapETHForExactTokens" : "swapExactETHForTokens",
			[outputAmount ? outputAmount : params.amountOutMin, params.path, params.to, params.deadline]
		);

		// console.log("===============swapTokens==============", amount, slippage, outputAmount);
		// return;

		const FEE_DATA = await provider.getFeeData();
		const { gasPrice: GAS_UNIT_PRICE } = { ...FEE_DATA };

		const txArgs = {
			to: UNISWAP_ROUTER_ADDRESS,
			from: wallet.address,
			data: data,
			value: valueHex,
			gasPrice: GAS_UNIT_PRICE,
		};

		const GAS_UNITS = await provider.estimateGas(txArgs);

		const TRANSACTION_FEE_IN_WEI = GAS_UNIT_PRICE * GAS_UNITS;
		const TRANSACTION_FEE_IN_ETH = ethers.utils.formatEther(TRANSACTION_FEE_IN_WEI);

		console.log(
			"PARAMS:\n" +
				params +
				"\n-------------------PARAMS-------------------\n" +
				"TXARGS:\n" +
				txArgs +
				"\n-------------------TXARGS-------------------\n" +
				"TRANSACTION_FEE_IN_ETH:\n" +
				TRANSACTION_FEE_IN_ETH +
				"\n-------------------TRANSACTION_FEE_IN_ETH-------------------\n"
		);

		let tx;
		let receipt;

		tx = await wallet.sendTransaction(txArgs);
		receipt = await tx.wait();

		if (receipt) {
			console.log(
				" -------- Transaction is mined -------- " + "\n" + "Transaction Hash:",
				tx.hash + "\n" + "Block Number: " + receipt.blockNumber
			);
			return receipt;
		} else {
			throw new Error("Error submitting transaction");
		}
	} catch (e) {
		throw new Error(e);
	}
}

async function quickBuyTokens(privateKey, token1, token2, amount, slippage) {
	// const provider = new ethers.providers.AlchemyProvider("homestead", ALCHEMY_SWAP_KEY);
	const provider = new ethers.providers.JsonRpcProvider("https://rpc.mevblocker.io");

	const wallet = new ethers.Wallet(privateKey, provider);

	let UNISWAP_ROUTER_ADDRESS = "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D";
	let UNISWAP_ROUTER_CONTRACT = new ethers.Contract(UNISWAP_ROUTER_ADDRESS, UNISWAP_ROUTER_ABI, provider);

	try {
		const pair = await Fetcher.fetchPairData(token1, token2, wallet.provider);

		const route = await new Route([pair], token2);

		let amountIn = ethers.utils.parseEther(amount.toString());
		amountIn = amountIn.toString();

		const slippageTolerance = new Percent((Number(slippage) * 100).toString(), "10000");

		const trade = new Trade(route, new TokenAmount(token2, amountIn), TradeType.EXACT_INPUT);

		const amountOutMin = trade.minimumAmountOut(slippageTolerance).raw;
		const amountOutMinHex = await BigInt(amountOutMin.toString());

		const path = [token2.address, token1.address];
		const to = wallet.address;
		const deadline = Math.floor(Date.now() / 1000) + 60 * 20;
		const value = trade.inputAmount.raw;
		const valueHex = await BigInt(value.toString());

		const params = {
			amountOutMin: amountOutMinHex,
			path: path,
			to: to,
			deadline: deadline,
		};

		const data = UNISWAP_ROUTER_CONTRACT.interface.encodeFunctionData("swapExactETHForTokens", [
			params.amountOutMin,
			params.path,
			params.to,
			params.deadline,
		]);

		const { gasPrice: GAS_UNIT_PRICE } = await provider.getFeeData();

		const txArgs = {
			from: wallet.address,
			to: UNISWAP_ROUTER_ADDRESS,
			data: data,
			value: valueHex,
			gasPrice: GAS_UNIT_PRICE,
		};

		const GAS_UNITS = await provider.estimateGas(txArgs);
		txArgs.gasLimit = parseInt(Number(GAS_UNITS) + GAS_UNITS * 0.3);

		// const TRANSACTION_FEE_IN_WEI = GAS_UNIT_PRICE * GAS_UNITS;
		// const TRANSACTION_FEE_IN_ETH = ethers.utils.formatEther(TRANSACTION_FEE_IN_WEI);

		// console.log(
		// 	"PARAMS:\n" +
		// 		params +
		// 		"\n-------------------PARAMS-------------------\n" +
		// 		"TXARGS:\n" +
		// 		txArgs +
		// 		"\n-------------------TXARGS-------------------\n" +
		// 		"TRANSACTION_FEE_IN_ETH:\n" +
		// 		TRANSACTION_FEE_IN_ETH +
		// 		"\n-------------------TRANSACTION_FEE_IN_ETH-------------------\n"
		// );
		// throw new Error("test");

		let tx;
		let receipt;

		tx = await wallet.sendTransaction(txArgs);
		receipt = await tx.wait();

		if (receipt) {
			console.log(
				" -------- Transaction is mined -------- " + "\n" + "Transaction Hash:",
				tx.hash + "\n" + "Block Number: " + receipt.blockNumber
			);
			return receipt;
		} else {
			throw new Error("Error submitting transaction");
		}
	} catch (e) {
		if (
			e.reason === "execution reverted: UniswapV2: TRANSFER_FAILED" &&
			e.code === "UNPREDICTABLE_GAS_LIMIT" &&
			e.method === "estimateGas"
		) {
			throw new Error("Insufficient funds for paying gas fee!");
		}
		throw new Error(e);
	}
}

async function sellTokens(privateKey, token1, token2, amount) {
	// const provider = new ethers.providers.AlchemyProvider("homestead", ALCHEMY_SWAP_KEY);
	const provider = new ethers.providers.JsonRpcProvider("https://rpc.mevblocker.io");

	const wallet = new ethers.Wallet(privateKey, provider);

	let UNISWAP_ROUTER_ADDRESS = "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D";
	let UNISWAP_ROUTER_CONTRACT = new ethers.Contract(UNISWAP_ROUTER_ADDRESS, UNISWAP_ROUTER_ABI, provider);

	try {
		const pair = await Fetcher.fetchPairData(token1, token2, wallet.provider);

		const route = await new Route([pair], token2);

		// let amountIn = ethers.utils.parseUnits(amount.toString(), token2.decimals);
		// amountIn = amountIn.toString();
		let amountIn = amount;
		amountIn = amountIn.toString();

		const slippageTolerance = new Percent("500", "10000");

		const trade = new Trade(route, new TokenAmount(token2, amountIn), TradeType.EXACT_INPUT);

		const amountOutMin = trade.minimumAmountOut(slippageTolerance).raw;
		const amountOutMinHex = await BigInt(amountOutMin.toString());

		await approveERC20(token2.address, UNISWAP_ROUTER_ADDRESS, wallet);

		const path = [token2.address, token1.address];
		const to = wallet.address;
		const deadline = Math.floor(Date.now() / 1000) + 60 * 20;
		const value = trade.inputAmount.raw;
		const valueHex = await BigInt(value.toString());

		const params = {
			amountIn: valueHex,
			amountOutMin: amountOutMinHex,
			path: path,
			to: to,
			deadline: deadline,
		};

		const data = UNISWAP_ROUTER_CONTRACT.interface.encodeFunctionData(
			"swapExactTokensForETHSupportingFeeOnTransferTokens",
			[params.amountIn, params.amountOutMin, params.path, params.to, params.deadline]
		);

		const { gasPrice: GAS_UNIT_PRICE } = await provider.getFeeData();

		const txArgs = {
			from: wallet.address,
			to: UNISWAP_ROUTER_ADDRESS,
			data: data,
			gasPrice: GAS_UNIT_PRICE,
		};

		const GAS_UNITS = await provider.estimateGas(txArgs);
		txArgs.gasLimit = parseInt(Number(GAS_UNITS) + GAS_UNITS * 0.3);

		let tx;
		let receipt;

		tx = await wallet.sendTransaction(txArgs);
		receipt = await tx.wait();

		if (receipt) {
			console.log(
				" -------- Transaction is mined -------- " + "\n" + "Transaction Hash:",
				tx.hash + "\n" + "Block Number: " + receipt.blockNumber
			);
			return receipt;
		} else {
			throw new Error("Error submitting transaction");
		}
	} catch (e) {
		// console.log("------------- Error selling tokens ----------- \n", e);

		const insufficientLiquidityError = new Error(e).message.startsWith("InsufficientInputAmountError");

		if (insufficientLiquidityError) {
			throw new Error("Insufficient liquidity!");
		}

		const insufficientFundsError = JSON.parse(e.error?.body)?.error?.message?.startsWith(
			"gas required exceeds allowance"
		);
		const insufficientFundsError2 =
			e.reason === "execution reverted: UniswapV2: TRANSFER_FAILED" &&
			e.code === "UNPREDICTABLE_GAS_LIMIT" &&
			e.method === "estimateGas";

		if (insufficientFundsError || insufficientFundsError2) {
			throw new Error("Insufficient funds for paying gas fee!");
		}

		throw new Error(e);
	}
}

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

module.exports = {
	buyTokens,
	sellTokens,
	quickBuyTokens,
};
