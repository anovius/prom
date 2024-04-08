const { Web3 } = require("web3");
const Moralis = require("moralis").default;
const router = require("express").Router();
const { EvmChain } = require("@moralisweb3/common-evm-utils");

const Token = mongoose.model("Token");
const Stream = mongoose.model("Stream");
const Notification = mongoose.model("Notification");

const { emitEvent } = require("../utils/realTime");
const { getTokenMetadata } = require("../utils/web3");
const { ALCHEMY_KEY, BACKEND_URL } = require("../config");
const {
	CONTRACT_ABI,
	tradingFns,
	buyTaxFns,
	sellTaxFns,
	maxBuyFns,
	maxWalletFns,
	FUNC_MAP,
	FUNC_SIGNATURE_MAP,
	WRAPPED_ETH,
	DEAD_ADDRESSES,
	LIQUIDITY_METHOD_IDS,
	RENOUNCE_OWNERHIP_METHODS,
} = require("../constants");

const web3 = new Web3("https://eth-mainnet.g.alchemy.com/v2/" + ALCHEMY_KEY);

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

const notify = async (message, subscribers) => {
	let notification = new Notification({
		message,
		subscribers,
	});
	notification = await notification.save();
	emitEvent("notification", notification);
	emitEvent("token-updated");
};

const createToken = async (contractAddress, block, liquidity) => {
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
		emitEvent("project", token);
	});
};

const createNewStream = async (contractAddress) => {
	const options = {
		chains: [EvmChain.ETHEREUM],
		tag: "ERC20 Token Activity Tracker",
		description: "This stream monitors activity of new erc20 tokens",
		includeNativeTxs: true,
		webhookUrl: `${BACKEND_URL}/api/webhook/update-token`,
	};

	const response = await Moralis.Streams.add(options);
	const streamId = response.toJSON().id;

	await Moralis.Streams.addAddress({
		id: streamId,
		address: contractAddress,
	});

	const stream = new Stream({
		streamId,
		addresses: [contractAddress],
	});

	await stream.save();

	return streamId;
};

const addTokenToStream = async (contractAddress) => {
	if (!contractAddress) {
		console.log("No contract address provided");
		return;
	}

	try {
		const lastStream = await Stream.findOne().sort({ createdAt: -1 });

		if (!lastStream) {
			const streamId = await createNewStream(contractAddress);

			console.log("Stream Created", streamId);
		} else {
			const { streamId, addresses } = lastStream;

			if (addresses.length >= 50000) {
				const streamId = await createNewStream(contractAddress);
				console.log("New Stream created due to previous stream limit reached!", streamId);
				return true;
			}

			addresses.push(contractAddress);

			let stream = await Moralis.Streams.getById({
				id: streamId,
			});

			stream = stream.toJSON();

			if (stream.status !== "active") {
				await Moralis.Streams.updateStatus({
					id: streamId,
					status: "active",
				});
			}

			const response = await Moralis.Streams.addAddress({
				id: streamId,
				address: contractAddress,
			});

			lastStream.addresses = addresses;
			await lastStream.save();

			console.log("Stream Updated", response.toJSON());
		}
		return true;
	} catch (error) {
		console.log(error, error.message, "Stream Error");
	}
};

router.post("/api/webhook", async (req, res, next) => {
	const { confirmed, txs, block } = req.body;

	try {
		if (confirmed && txs.length > 0) {
			const parsedData = Moralis.Streams.parsedLogs(req.body);
			console.log("-----Moralis Parsed Data-----", parsedData, "--------Moralis Parsed Data-------");

			// if (Array.isArray(parsedData) && parsedData.length > 0) {
			// 	for (let pair of parsedData) {
			// 		let contractAddress = pair.token0;
			// 		contractAddress = contractAddress.toLowerCase();

			// 		let pairAddress = pair.token1;
			// 		pairAddress = pairAddress.toLowerCase();

			// 		if (contractAddress !== WRAPPED_ETH && pairAddress !== WRAPPED_ETH) {
			// 			const token = await Token.findOne({ contractAddress });

			// 			// console.log("OLD TOKEN-----", token);

			// 			if (token) {
			// 				console.log(
			// 					"-----------New Pair Created of " + token.name + " against ",
			// 					pair.token1,
			// 					"------------------"
			// 				);

			// 				token.tags.pair = {
			// 					address: pair.pair,
			// 					createdAt: new Date(block.timestamp * 1000),
			// 				};

			// 				await token.save();
			// 			}
			// 		}
			// 	}
			// }

			for (let tx of txs) {
				const METHOD_ID = tx.input.slice(0, 10);

				if (LIQUIDITY_METHOD_IDS.includes(METHOD_ID)) {
					let contractAddress =
						parsedData[0]?.token0.toLowerCase() !== WRAPPED_ETH ? parsedData[0]?.token0 : parsedData[0]?.token1;
					contractAddress = contractAddress.toLowerCase();
					const token = await Token.findOne({
						contractAddress: {
							$regex: new RegExp(contractAddress, "i"),
						},
					});
					console.log(token, "----------- Contract Address -----------", contractAddress);

					if (token) {
						console.log(
							"----------- Liquidity Added -----------",
							token.name,
							" at ",
							block.timestamp,
							"----------- Liquidity Added -----------"
						);

						token.liquidity = {
							pairAddress: parsedData[0]?.pair,
							blockNumber: block.number,
							addedAt: new Date(block.timestamp * 1000),
						};

						await token.save();
					} else {
						await createToken(contractAddress, block, {
							pairAddress: parsedData[0]?.pair,
							blockNumber: block.number,
							addedAt: new Date(block.timestamp * 1000),
						});
					}
				}

				if (tx.toAddress === null && tx.receiptContractAddress) {
					const oldToken = await Token.findOne({ contractAddress: tx.receiptContractAddress });
					if (oldToken) {
						console.log("Token already exists", oldToken.name, oldToken.contractAddress);
						continue;
					}
					// New ERC20 Token Created
					await createToken(tx.receiptContractAddress, block);

					const isTokenAdded = await addTokenToStream(tx.receiptContractAddress);

					if (isTokenAdded) {
						console.log("Token Added to Stream", tx.receiptContractAddress);
					} else {
						console.log("Token Not Added to Stream", tx.receiptContractAddress);
					}
				}
			}
		}
	} catch (error) {
		console.log(error, error.message);
	}

	return res.status(200).json();
});

router.post("/api/webhook/update-token", async (req, res, next) => {
	const { confirmed, txs, block } = req.body;

	try {
		if (confirmed && txs.length > 0) {
			for (let tx of txs) {
				if (tx.toAddress) {
					const token = await Token.findOne({
						contractAddress: {
							$regex: new RegExp(tx.toAddress, "i"),
						},
					});
					if (!token) {
						continue;
					}
					console.log("Token found 👉👉👉👉", token.name, token.contractAddress);

					const METHOD_ID = tx.input.slice(0, 10);

					console.log("Method ID 👉👉👉👉", METHOD_ID);

					if (FUNC_SIGNATURE_MAP[METHOD_ID]) {
						const data = FUNC_MAP[FUNC_SIGNATURE_MAP[METHOD_ID]];

						console.log(
							"----- Function Signature Matched in webhook ----- 👇👇👇👇👇 \n",
							FUNC_SIGNATURE_MAP[METHOD_ID],
							data,
							token[data.callFn],
							typeof data.callFn
						);
						const contract = new web3.eth.Contract(CONTRACT_ABI, token.contractAddress);

						if (RENOUNCE_OWNERHIP_METHODS.includes(METHOD_ID) && !token.isRenounced) {
							token.isRenounced = true;
							token.renouncedAt = new Date(block.timestamp * 1000);
						} else {
							const type = typeof data.callFn;

							// if all of data.valuesToUpdate array value are not nullish then skip
							// let skip = true;
							// for (let fieldToUpdate of data.valuesToUpdate) {
							// 	if (token[fieldToUpdate] === undefined || token[fieldToUpdate] === null) {
							// 		skip = false;
							// 	}
							// }

							// if (skip) {
							// 	continue;
							// }

							if (type === "string") {
								console.log("++++ Only one value to update ++++");
								const functionToCall = token[data.callFn];
								if (!functionToCall) {
									console.log("Function not found", data.callFn, token.name, token.contractAddress, "😢😢😢😢");
									continue;
								}
								const fieldToUpdate = data.valuesToUpdate[0];
								const value = await contract.methods[functionToCall]().call();
								let message = `${token.name}: `;
								const subscribers = token.watchlist;

								switch (fieldToUpdate) {
									case "buyTax":
										token.buyTax = Number(value);
										message += data.message;
										console.log(data.message, token.buyTax, token.name, "++++++++++++++++");
										break;
									case "sellTax":
										token.sellTax = Number(value);
										message += data.message;
										console.log(data.message, token.sellTax, token.name, "++++++++++++++++");
										break;
									case "maxTx":
										token.maxTx = bigIntToNumber(value, token.decimals);
										message += data.message;
										console.log(data.message, token.maxTx, token.name, "++++++++++++++++");
										break;
									case "maxWallet":
										token.maxWallet = bigIntToNumber(value, token.decimals);
										message += data.message;
										console.log(data.message, token.maxWallet, token.name, "++++++++++++++++");
										break;
									case "isTradeable":
										token.isTradeable = value;
										message += data.message;
										console.log(data.message, token.isTradeable, token.name, "++++++++++++++++");
										break;
									default:
										console.log("No case matched", fieldToUpdate, "😢😢😢😢");
										break;
								}

								await notify(message, subscribers);
							}

							if (type === "object") {
								console.log("++++ Multiple values to update ++++");

								for (let [index, fieldToUpdate] of data.valuesToUpdate.entries()) {
									const functionToCall = token[data.callFn[index]];
									if (!functionToCall) {
										console.log(
											"Function not found",
											data.callFn[index],
											token.name,
											token.contractAddress,
											"😢😢😢😢"
										);
										continue;
									}
									const value = await contract.methods[functionToCall]().call();
									let message = `${token.name}: `;
									const subscribers = token.watchlist;

									switch (fieldToUpdate) {
										case "buyTax":
											token.buyTax = Number(value);
											message += data.message;
											console.log(data.message, token.buyTax, token.name, "++++++++++++++++");
											break;
										case "sellTax":
											token.sellTax = Number(value);
											message += data.message;
											console.log(data.message, token.sellTax, token.name, "++++++++++++++++");
											break;
										case "maxTx":
											token.maxTx = bigIntToNumber(value, token.decimals);
											message += data.message;
											console.log(data.message, token.maxTx, token.name, "++++++++++++++++");
											break;
										case "maxWallet":
											token.maxWallet = bigIntToNumber(value, token.decimals);
											message += data.message;
											console.log(data.message, token.maxWallet, token.name, "++++++++++++++++");
											break;
										case "isTradeable":
											token.isTradeable = value;
											message += data.message;
											console.log(data.message, token.isTradeable, token.name, "++++++++++++++++");
											break;
										default:
											console.log("No case matched", fieldToUpdate, "😢😢😢😢");
											break;
									}

									await notify(message, subscribers);
								}
							}
						}

						await token.save();
						console.log("Successfully Updated 🥳🥳🥳🥳🥳", token.name, token.contractAddress);
					}
				}
			}
		}
	} catch (error) {
		console.log(error, error.message);
	}

	return res.status(200).json();
});

module.exports = router;
