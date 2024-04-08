let { OkResponse, BadRequestResponse, UnauthorizedResponse } = require("express-http-response");

let mongoose = require("mongoose");
let router = require("express").Router();
let Token = mongoose.model("Token");
let auth = require("../auth");
const { Web3 } = require("web3");
const ethers = require("ethers");
const { CONTRACT_ABI, tradingFns, buyTaxFns, sellTaxFns, maxBuyFns, maxWalletFns } = require("../../constants");
let { ALCHEMY_KEY } = require("../../config");
const { getTokenMetadata } = require("../../utils/web3");

const DEAD_ADDRESSES = ["0x0000000000000000000000000000000000000000", "0x000000000000000000000000000000000000dEaD"];
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

router.use(auth.required);

router.get("/", async (req, res, next) => {
	const { page, search } = req.query;
	const filters = req.body;
	// console.log(req.body);

	try {
		const limit = 10;
		const offset = page ? (parseInt(page) - 1) * limit : 0;

		const query = {
			// Tokens added by the user
			watchlist: { $in: [req.user.id] },
		};

		if (search && search.trim() !== "") {
			query.name = { $regex: new RegExp(search.trim(), "i") };
		}

		if (filters) {
			if (filters.deployedAt && filters.deployedAt.isApplied) {
				if (filters.deployedAt.minDate) {
					query.deployedAt = { ...query.deployedAt, $lte: filters.deployedAt.minDate };
				}
				if (filters.deployedAt.maxDate) {
					query.deployedAt = { ...query.deployedAt, $gte: filters.deployedAt.maxDate };
				}
			}
			if (filters.lockedTime && filters.lockedTime.isApplied) {
				if (filters.lockedTime.minLockDate) {
					query.lockedTime = { ...query.lockedTime, $lte: filters.lockedTime.minLockDate };
				}
				if (filters.lockedTime.maxLockDate) {
					query.lockedTime = { ...query.lockedTime, $gte: filters.lockedTime.maxLockDate };
				}
			}
			if (filters.burntSupply && filters.burntSupply.isApplied) {
				const { min, max } = filters.burntSupply;
				if (min !== 0) {
					query.burntSupply = { ...query.burntSupply, $gte: min };
				}
				if (max !== 0) {
					query.burntSupply = { ...query.burntSupply, $lte: max };
				}
			}
			if (filters.totalSupply && filters.totalSupply.isApplied) {
				const { min, max } = filters.totalSupply;
				if (min !== 0) {
					query.totalSupply = { ...query.totalSupply, $gte: min };
				}
				if (max !== 0) {
					query.totalSupply = { ...query.totalSupply, $lte: max };
				}
			}
			if (filters.circulatingSupply && filters.circulatingSupply.isApplied) {
				const { min, max } = filters.circulatingSupply;
				if (min !== 0) {
					query.circulatingSupply = { ...query.circulatingSupply, $gte: min };
				}
				if (max !== 0) {
					query.circulatingSupply = { ...query.circulatingSupply, $lte: max };
				}
			}
			if (filters.maxWallet && filters.maxWallet.isApplied) {
				const { min, max } = filters.maxWallet;
				if (min !== 0) {
					query.maxWallet = { ...query.maxWallet, $gte: min };
				}
				if (max !== 0) {
					query.maxWallet = { ...query.maxWallet, $lte: max };
				}
			}
			if (filters.maxBuy && filters.maxBuy.isApplied) {
				const { maxTx, buyTax } = filters.maxBuy;
				if (maxTx.min !== 0) {
					query.maxTx = { ...query.maxTx, $gte: maxTx.min };
				}
				if (maxTx.max !== 0) {
					query.maxTx = { ...query.maxTx, $lte: maxTx.max };
				}
				if (buyTax.min !== 0) {
					query.buyTax = { ...query.buyTax, $gte: buyTax.min };
				}
				if (buyTax.max !== 0) {
					query.buyTax = { ...query.buyTax, $lte: buyTax.max };
				}
			}
		}

		// console.log(query);

		const options = {
			sort: { createdAt: -1 },
			offset,
			limit,
		};

		const tokens = await Token.paginate(query, options);

		return next(
			new OkResponse({
				totalItems: tokens.totalDocs > 150 ? 150 : tokens.totalDocs,
				tokens: tokens.docs,
				totalPages: tokens.totalPages > 15 ? 15 : tokens.totalPages,
				currentPage: tokens.page - 1,
			})
		);
	} catch (error) {
		console.log(error);
		return next(new BadRequestResponse(error));
	}
});

router.post("/", async (req, res, next) => {
	const { contractAddress } = req.body;
	const { newToken } = req.query;
	try {
		if (!contractAddress) {
			return next(new BadRequestResponse("Required fields not provided"));
		}

		if (!newToken) {
			const token = await Token.findOne({ contractAddress });

			if (!token) {
				return next(new BadRequestResponse("Token not found"));
			}

			if (token.watchlist.includes(req.user.id)) {
				return next(new BadRequestResponse("Token already in watchlist"));
			}

			token.watchlist.push(req.user.id);

			await token.save().then((token) => {
				return next(new OkResponse("Token added to watchlist"));
			});
		} else {
			const oldToken = await Token.findOne({ contractAddress: contractAddress.toLowerCase() });
			if (oldToken) {
				if (!oldToken.watchlist.includes(req.user.id)) {
					oldToken.watchlist.push(req.user.id);
				}
				await oldToken.save();
				return next(new OkResponse("Token added to watchlist"));
			}

			const isAddress = ethers.utils.isAddress(contractAddress);

			if (!isAddress) {
				throw new Error("Invalid Address");
			}

			// console.log("Adding new token to watchlist");
			const tokenMD = await getTokenMetadata(contractAddress);

			const token = new Token({
				name: tokenMD.name,
				symbol: tokenMD.symbol,
				contractAddress: tokenMD.address,
				decimals: tokenMD.decimals,
				deployedAt: new Date(),
			});
			token.addedBy = req.user.id;
			token.watchlist.push(req.user.id);

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

			console.log("maxTxAmountFn", maxTxAmountFn);

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

			console.log("buyFeeFn", buyFeeFn);

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
			}
			if (burntSupply > 0) {
				token.burntSupply = burntSupply;
			}
			if (burntSupply2 > 0) {
				token.burntSupply = burntSupply2;
			}

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
			}

			await token.save().then((token) => {
				return next(new OkResponse(token));
			});
		}
	} catch (error) {
		console.log(error);
		if (error.message === "Invalid Address") {
			return next(new BadRequestResponse("Invalid Address"));
		}
		return next(new BadRequestResponse("Failed to add token to watchlist"));
	}
});

router.delete("/", async (req, res, next) => {
	const { contractAddress } = req.body;
	try {
		if (!contractAddress) {
			return next(new BadRequestResponse("Required fields not provided"));
		}

		const token = await Token.findOne({ contractAddress });

		if (!token) {
			return next(new BadRequestResponse("Token not found"));
		}

		token.watchlist = token.watchlist.filter((id) => id !== req.user.id);

		await token.save().then((token) => {
			return next(new OkResponse("Token removed from watchlist"));
		});
	} catch (error) {
		console.log(error);
		return next(new BadRequestResponse("Failed to remove token from watchlist"));
	}
});

module.exports = router;
