let mongoose = require("mongoose");
let uniqueValidator = require("mongoose-unique-validator");
const mongoosePaginate = require("mongoose-paginate-v2");

let TokenSchema = new mongoose.Schema(
	{
		name: {
			type: String,
			required: true,
		},
		symbol: {
			type: String,
			required: true,
		},
		contractAddress: {
			type: String,
			required: true,
			unique: true,
		},
		decimals: {
			type: Number,
			required: true,
		},
		addedBy: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "User",
		},
		totalSupply: {
			type: Number,
			required: true,
		},
		circulatingSupply: {
			type: Number,
		},
		burntSupply: {
			type: Number,
			default: 0,
		},
		buyTax: {
			type: Number,
		},
		buyTaxFn: {
			type: String,
		},
		sellTax: {
			type: Number,
		},
		sellTaxFn: {
			type: String,
		},
		maxTx: {
			type: Number,
		},
		maxTxFn: {
			type: String,
		},
		maxWallet: {
			type: Number,
		},
		maxWalletFn: {
			type: String,
		},
		socialLinks: {
			type: Array,
		},
		topHolders: {
			type: Array,
		},
		website: {
			type: String,
		},
		deployedAt: {
			type: Date,
			required: true,
		},
		isRenounced: {
			type: Boolean,
			default: false,
		},
		renouncedAt: {
			type: Date,
		},
		isTradeable: {
			type: Boolean,
		},
		isTradeableFn: {
			type: String,
		},
		startTradingAt: {
			type: Date,
		},
		ownerShare: {
			type: Number,
		},
		lockedAmount: {
			type: Number,
		},
		lockedTime: {
			type: Date,
		},
		watchlist: {
			type: Array,
		},
		tags: {
			pair: {
				address: String,
				createdAt: Date,
			},
			hotLaunch: {
				type: Boolean,
				default: false,
			},
		},
		sniperBots: [
			{
				type: String,
			},
		],
		liquidity: {
			pairAddress: {
				type: String,
			},
			blockNumber: {
				type: Number,
			},
			addedAt: {
				type: Date,
			},
		},
	},
	{ timestamps: true }
);

TokenSchema.plugin(uniqueValidator, { message: "Taken" });
TokenSchema.plugin(mongoosePaginate);

const autoPopulate = function (next) {
	next();
};

TokenSchema.pre("findOne", autoPopulate);
TokenSchema.pre("find", autoPopulate);

TokenSchema.methods.toJSON = function () {
	return {
		id: this._id,
		name: this.name,
		symbol: this.symbol,
		contractAddress: this.contractAddress,
		decimals: this.decimals,
		totalSupply: this.totalSupply,
		addedBy: this.addedBy,
		circulatingSupply: this.circulatingSupply,
		buyTax: this.buyTax,
		sellTax: this.sellTax,
		socialLinks: this.socialLinks,
		topHolders: this.topHolders,
		website: this.website,
		deployedAt: this.deployedAt,
		isRenounced: this.isRenounced,
		renouncedAt: this.renouncedAt,
		isTradeable: this.isTradeable,
		startTradingAt: this.startTradingAt,
		ownerShare: this.ownerShare,
		burntSupply: this.burntSupply,
		maxTx: this.maxTx,
		maxWallet: this.maxWallet,
		lockedAmount: this.lockedAmount,
		lockedTime: this.lockedTime,
		watchlist: this.watchlist,
		tags: this.tags,
		liquidity: this.liquidity,
		sniperBots: this.sniperBots,
	};
};

module.exports = mongoose.model("Token", TokenSchema);
