const { Web3 } = require("web3");
const ethers = require("ethers");
const { ONE_INCH_API_KEY } = require("../config/index");
const {
	limitOrderProtocolAddresses,
	seriesNonceManagerContractAddresses,
	ChainId,
	Erc20Facade,
	LimitOrderBuilder,
	LimitOrderProtocolFacade,
	LimitOrderPredicateBuilder,
	NonceSeriesV2,
	SeriesNonceManagerFacade,
	SeriesNonceManagerPredicateBuilder,
	Web3ProviderConnector, // used for interfaces
	PrivateKeyProviderConnector,
} = require("@1inch/limit-order-protocol-utils");
const { WETH_CONTRACT_ABI } = require("../constants");

const chainId = 1; // suggested, or use your own number

async function getSignatureAndHash(walletAddress, pKey, sellDetails, buyDetails) {
	const provider = new Web3("https://rpc.mevblocker.io");
	const connector = new PrivateKeyProviderConnector(pKey, provider);
	const contractAddress = limitOrderProtocolAddresses[chainId];
	const seriesContractAddress = seriesNonceManagerContractAddresses[chainId];

	const fromToken = sellDetails.address;
	const toToken = buyDetails.address;
	const fromAmount = sellDetails.amount;
	const toAmount = buyDetails.amount;

	const limitOrderProtocolFacade = new LimitOrderProtocolFacade(contractAddress, chainId, connector);
	const seriesNonceManagerFacade = new SeriesNonceManagerFacade(seriesContractAddress, chainId, connector);
	const seriesNonceManagerPredicateBuilder = new SeriesNonceManagerPredicateBuilder(seriesNonceManagerFacade);
	const limitOrderPredicateBuilder = new LimitOrderPredicateBuilder(limitOrderProtocolFacade);
	// const erc20Facade = new Erc20Facade(connector);
	// const limitOrderBuilder = new LimitOrderBuilder(limitOrderProtocolFacade, erc20Facade);
	const limitOrderBuilder = new LimitOrderBuilder(contractAddress, chainId, connector);

	const expiration = Math.floor(Date.now() / 1000) + 10 * 365.25 * 24 * 60 * 60; // 10 years from now
	const nonce = await seriesNonceManagerFacade.getNonce(NonceSeriesV2.LimitOrderV3, walletAddress).then((nonce) => {
		// console.log("nonce: ", );
		return Number(nonce);
	});

	console.log("Nonce ++++++>>>>", nonce, typeof nonce);
	const simpleLimitOrderPredicate = limitOrderPredicateBuilder.arbitraryStaticCall(
		seriesNonceManagerPredicateBuilder.facade,
		seriesNonceManagerPredicateBuilder.timestampBelowAndNonceEquals(
			NonceSeriesV2.LimitOrderV3,
			expiration,
			nonce,
			walletAddress
		)
	);

	const limitOrder = limitOrderBuilder.buildLimitOrder({
		makerAssetAddress: fromToken,
		takerAssetAddress: toToken,
		makerAddress: walletAddress,
		makingAmount: fromAmount,
		takingAmount: toAmount,
		predicate: simpleLimitOrderPredicate,
		salt: "" + Math.floor(Math.random() * 100000000),
	});

	console.log("Limit Order ====>>>>>>>>>", limitOrder);

	const limitOrderTypedData = limitOrderBuilder.buildLimitOrderTypedData(limitOrder);
	const limitOrderSignature = await limitOrderBuilder.buildOrderSignature(connector, limitOrderTypedData);

	const limitOrderHash = await limitOrderBuilder.buildLimitOrderHash(limitOrderTypedData);

	return [limitOrderSignature, limitOrderHash, limitOrder];
}

async function placeOrder(publicAddress, pKey, sellDetails, buyDetails) {
	await approveERC20(sellDetails.address, limitOrderProtocolAddresses[chainId], pKey);

	const [limitOrderSignature, limitOrderHash, limitOrder] = await getSignatureAndHash(
		publicAddress,
		pKey,
		sellDetails,
		buyDetails
	);

	const signature = limitOrderSignature;
	const data = {
		orderHash: limitOrderHash,
		signature: signature,
		data: limitOrder,
	};
	console.log(JSON.stringify(data, null, 2));

	let orderData = await fetch("https://api.1inch.dev/orderbook/v3.0/" + chainId, {
		headers: {
			accept: "application/json, text/plain, */*",
			"content-type": "application/json",
			Authorization: "Bearer " + ONE_INCH_API_KEY,
		},
		body: JSON.stringify(data),
		method: "POST",
	}).then((res) => {
		console.log(res.status);
		return res.json();
	});

	try {
		console.log("\n\n" + orderData, null, 2);
		return data;
	} catch (e) {
		console.log(e);
		throw new Error(e);
	}
}

async function approveERC20(tokenAddress, operator, privateKey) {
	const provider = new ethers.providers.JsonRpcProvider("https://rpc.mevblocker.io");

	const wallet = new ethers.Wallet(privateKey, provider);

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

module.exports = { placeOrder };
