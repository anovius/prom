const Token = require("../models/Token");
const Moralis = require("moralis").default;
const { Web3 } = require("web3");
const { CONTRACT_ABI, tradingFns, buyTaxFns, sellTaxFns, maxBuyFns, maxWalletFns } = require("../constants");
const { default: mongoose } = require("mongoose");

const DEAD_ADDRESSES = ["0x0000000000000000000000000000000000000000", "0x000000000000000000000000000000000000dEaD"];

const web3 = new Web3("https://eth-goerli.g.alchemy.com/v2/ZWzGdHvXpZlTCgTcgz699bUKvOwMqOxx");

const checkFnExists = async (fnNames, contract) => {
	for (const fnName of fnNames) {
		try {
			await contract.methods[fnName]().call();
			console.log(fnName, " exists");
			return fnName;
		} catch (error) {
			// console.log(`error in ${fnName}`);
		}
	}
};

const bigIntToNumber = (num, decimals) => {
	try {
		return Number(BigInt(num)) / 10 ** decimals;
	} catch (error) {
		console.log("error in bigIntToNumber", error);
	}
};

const getTokenMetadata = async (address) => {
	const response = await Moralis.EvmApi.token.getTokenMetadata({
		chain: "0x5",
		addresses: [address],
	});

	return response.raw[0];
};

const createToken = async (contractAddress, block, liquidity) => {
	await mongoose.connect(`${"mongodb://127.0.0.1:27017/prometheus"}?retryWrites=false`);
	await Moralis.start({
		apiKey:
			"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJub25jZSI6ImVhYzIwNjZjLTZlNGEtNDc2OS05ODIwLTE2ZDgyOWYzYjNlNyIsIm9yZ0lkIjoiMjcxMjQwIiwidXNlcklkIjoiMjc2MjQ2IiwidHlwZUlkIjoiOTYwZjk1Y2EtM2Q0My00NDc5LWI5ZTItNmFlZmU5ZWY2MGVlIiwidHlwZSI6IlBST0pFQ1QiLCJpYXQiOjE2ODI0MzE0NzIsImV4cCI6NDgzODE5MTQ3Mn0.CIcWW9wpgoJpjFhONWDj8Ry1N4uhEtge1WlS34vCf0A",
	});

	const tokenMD = await getTokenMetadata(contractAddress);
	console.log(
		"\n\n🔨🔨🔨🔨🔨🔨🔨🔨🔨\n",
		tokenMD.name,
		" created at ",
		block.timestamp,
		tokenMD.address,
		"\n🔨🔨🔨🔨🔨🔨🔨🔨🔨\n\n"
	);

	const token = new Token({
		name: tokenMD.name,
		symbol: tokenMD.symbol,
		contractAddress: tokenMD.address,
		decimals: tokenMD.decimals,
		deployedAt: new Date(block.timestamp * 1000),
	});

	const contract = new web3.eth.Contract(CONTRACT_ABI, tokenMD.address);

	// Calculate total supply
	let totalSupply = await contract.methods.totalSupply().call();
	totalSupply = bigIntToNumber(totalSupply, tokenMD.decimals);

	// Calculate circulating supply
	let circulatingSupply;
	let circulatingSupplyFn = await checkFnExists(["circulatingSupply"], contract);
	if (circulatingSupplyFn) {
		circulatingSupply = await contract.methods[circulatingSupplyFn]().call();
		circulatingSupply = bigIntToNumber(circulatingSupply, tokenMD.decimals);
	}

	// Calculate Buy Fee
	let buyFee;
	let buyFeeFn = await checkFnExists(buyTaxFns, contract);
	if (buyFeeFn) {
		buyFee = await contract.methods[buyFeeFn]().call();
		// console.log("--------", buyFee, typeof buyFee, "--------");
		buyFee = Number(buyFee);
	}

	// Calculate Sell Fee
	let sellFee;
	let sellFeeFn = await checkFnExists(sellTaxFns, contract);
	if (sellFeeFn) {
		sellFee = await contract.methods[sellFeeFn]().call();
		// console.log("---------", sellFee, typeof sellFee, "---------");
		sellFee = Number(sellFee);
	}

	// Calculate Max Transaction Amount
	let maxTxAmount;
	let maxTxAmountFn = await checkFnExists(maxBuyFns, contract);
	if (maxTxAmountFn) {
		maxTxAmount = await contract.methods[maxTxAmountFn]().call();
		maxTxAmount = bigIntToNumber(maxTxAmount, tokenMD.decimals);
	}

	// Calculate Max Wallet Amount
	let maxWalletAmount;
	let maxWalletAmountFn = await checkFnExists(maxWalletFns, contract);
	if (maxWalletAmountFn) {
		maxWalletAmount = await contract.methods[maxWalletAmountFn]().call();
		maxWalletAmount = bigIntToNumber(maxWalletAmount, tokenMD.decimals);
	}

	// Check if trading is enabled
	let isTradingEnabled;
	let isTradingEnabledFn = await checkFnExists(tradingFns, contract);
	if (isTradingEnabledFn) {
		isTradingEnabled = await contract.methods[isTradingEnabledFn]().call();
	}

	// Calculate the burnt supply
	let burntSupply = await contract.methods.balanceOf(DEAD_ADDRESSES[0]).call();
	burntSupply = bigIntToNumber(burntSupply, tokenMD.decimals);
	let burntSupply2 = await contract.methods.balanceOf(DEAD_ADDRESSES[1]).call();
	burntSupply2 = bigIntToNumber(burntSupply2, tokenMD.decimals);

	let owner;
	let ownerFn = await checkFnExists(["owner"], contract);
	if (ownerFn) {
		owner = await contract.methods[ownerFn]().call();
	}

	// Checking if the token is renounced
	let isRenounced;
	if (owner) {
		isRenounced = owner === DEAD_ADDRESSES[0] || owner === DEAD_ADDRESSES[1];
	}

	// Checking if the owner is holding 5% of the total supply
	let ownerShare = 0;
	if (!isRenounced && owner) {
		let ownerBalance = await contract.methods.balanceOf(owner).call();
		ownerBalance = bigIntToNumber(ownerBalance, tokenMD.decimals);

		ownerShare = (ownerBalance / totalSupply) * 100; // in percentage
	}

	// Known Values for Every ERC20 Token
	token.totalSupply = totalSupply;
	token.ownerShare = ownerShare;
	if (isRenounced !== undefined) {
		token.isRenounced = isRenounced;
		token.renouncedAt = new Date();
	}
	if (burntSupply > 0) {
		token.burntSupply = burntSupply;
	}
	if (burntSupply2 > 0) {
		token.burntSupply = burntSupply2;
	}

	// console.log(
	// 	"---------------------------------",
	// 	circulatingSupply,
	// 	"circulatingSupply",
	// 	buyFee,
	// 	"buyFee",
	// 	sellFee,
	// 	"sellFee",
	// 	maxTxAmount,
	// 	"maxTxAmount",
	// 	maxWalletAmount,
	// 	"maxWalletAmount",
	// 	isTradingEnabled,
	// 	"isTradingEnabled",
	// 	"---------------------------------"
	// );
	// Optional Values for ERC20 Token
	if (circulatingSupply !== undefined) {
		token.circulatingSupply = circulatingSupply;
	}
	if (buyFee !== undefined) {
		token.buyTax = buyFee;
		token.buyTaxFn = buyFeeFn;
	}
	if (sellFee !== undefined) {
		token.sellTax = sellFee;
		token.sellTaxFn = sellFeeFn;
	}
	if (maxTxAmount !== undefined) {
		token.maxTx = maxTxAmount;
		token.maxTxFn = maxTxAmountFn;
	}
	if (maxWalletAmount !== undefined) {
		token.maxWallet = maxWalletAmount;
		token.maxWalletFn = maxWalletAmountFn;
	}
	if (isTradingEnabled !== undefined) {
		token.isTradeable = isTradingEnabled;
		token.isTradeableFn = isTradingEnabledFn;
		token.startTradingAt = new Date();
	}
	if (liquidity) {
		console.log("-------------- Liquidity Added -------------------", liquidity, token.name);
		token.liquidity = liquidity;
	}

	await token.save().then((token) => {
		// emitEvent("project", token);
	});
};

createToken("0xabdf8820c513d8561A042dF4c1d999AB5829482D", {
	timestamp: 9802431,
});
