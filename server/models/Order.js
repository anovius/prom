let mongoose = require("mongoose");
let uniqueValidator = require("mongoose-unique-validator");

let OrderSchema = new mongoose.Schema(
	{
		placedBy: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "User",
		},
		wallet: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "Wallet",
		},
		sellToken: {
			type: String,
			lowercase: true,
		},
		sellAmount: String,
		sellTokenDecimals: Number,
		sellTokenSymbol: String,
		buyToken: {
			type: String,
			lowercase: true,
		},
		buyAmount: String,
		slippage: {
			type: Number,
			default: 0.05,
		},
		executedTrades: [
			{
				hash: String,
				executionTime: Date,
				error: {
					type: String,
					default: null,
				},
			},
		],
		type: {
			type: String,
			enum: ["sl", "tp", "market"],
		},
		status: {
			type: String,
			default: "active",
			enum: ["active", "cancelled", "filled"],
		},
	},
	{ timestamps: true }
);

OrderSchema.plugin(uniqueValidator, { message: "Taken" });

OrderSchema.methods.toJSON = function () {
	return {
		id: this._id,
		placedBy: this.placedBy,
		wallet: this.wallet,
		sellToken: this.sellToken,
		sellAmount: this.sellAmount,
		sellTokenDecimals: this.sellTokenDecimals,
		sellTokenSymbol: this.sellTokenSymbol,
		buyToken: this.buyToken,
		buyAmount: this.buyAmount,
		type: this.type,
		slippage: this.slippage,
		executedTrades: this.executedTrades,
		status: this.status,
	};
};

module.exports = mongoose.model("Order", OrderSchema);
