let { OkResponse, BadRequestResponse, UnauthorizedResponse } = require("express-http-response");

let mongoose = require("mongoose");
let router = require("express").Router();
let Token = mongoose.model("Token");
// let auth = require("../auth");

router.post("/", async (req, res, next) => {
	const { page, new_pair, recently_renounced, recently_began_trading } = req.query;
	// console.log(req.query);
	const filters = req.body;
	// console.log(req.body);

	try {
		const limit = 10;
		const offset = page ? (parseInt(page) - 1) * limit : 0;

		const query = {
			$or: [{ addedBy: null }, { addedBy: { $exists: false } }],
		};

		if (new_pair) {
			query.deployedAt = { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) };
		}

		if (recently_renounced) {
			query.isRenounced = true;
			query.renouncedAt = { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) };
		}

		if (recently_began_trading) {
			query.isTradeable = true;
			query.startTradingAt = { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) };
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

module.exports = router;
