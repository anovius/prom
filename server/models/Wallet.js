let mongoose = require("mongoose");
let uniqueValidator = require("mongoose-unique-validator");
const CryptoJS = require("crypto-js");
let { ALCHEMY_KEY, SECRET_KEY } = require("../config");
const { Web3 } = require("web3");

const web3 = new Web3("https://eth-mainnet.g.alchemy.com/v2/" + ALCHEMY_KEY);

let WalletSchema = new mongoose.Schema(
	{
		accountId: {
			type: String,
			unique: true,
			required: true,
		},

		publicAddress: {
			type: String,
			unique: true,
			lowercase: true,
		},

		buySettings: {
			amount: {
				type: Number,
				default: 0,
			},
			slippage: {
				type: Number,
				default: 5,
			},
		},

		keystore: {},

		owner: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "User",
		},

		balance: {
			type: Number,
			default: 0,
		},

		tokens: [
			{
				name: String,
				symbol: String,
				amount: String,
				contractAddress: String,
				price: Number,
				buyPrice: Number,
				profit: Number,
				decimals: Number,
				limitOrders: [
					{
						type: mongoose.Schema.Types.ObjectId,
						ref: "Order",
					},
				],
			},
		],

		lastChecked: {
			type: Date,
			default: null,
		},
	},
	{ timestamps: true }
);

WalletSchema.plugin(uniqueValidator, { message: "Taken" });

const autoPopulate = function (next) {
	this.populate("tokens.limitOrders");
	next();
};

WalletSchema.pre("findOne", autoPopulate);
WalletSchema.pre("find", autoPopulate);

WalletSchema.methods.getPrivateKey = async function () {
	const account = await web3.eth.accounts.decrypt(this.keystore, SECRET_KEY);
	const key = CryptoJS.AES.encrypt(account.privateKey, SECRET_KEY).toString();
	return key;
};

WalletSchema.methods.toJSON = function () {
	return {
		id: this._id,
		accountId: this.accountId,
		publicAddress: this.publicAddress,
		buySettings: this.buySettings,
		balance: this.balance,
		owner: this.owner,
		tokens: this.tokens,
		lastChecked: this.lastChecked,
	};
};

module.exports = mongoose.model("Wallet", WalletSchema);
