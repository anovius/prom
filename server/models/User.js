let mongoose = require("mongoose");
let uniqueValidator = require("mongoose-unique-validator");
let jwt = require("jsonwebtoken");
let SECRET_KEY = require("../config").SECRET_KEY;

let UserSchema = new mongoose.Schema(
	{
		profileImage: {
			type: String,
			default: null,
		},

		username: {
			type: String,
			unique: true,
			required: [true, "can't be blank"],
		},

		publicAddress: {
			type: String,
			unique: true,
			lowercase: true,
		},

		nonce: {
			type: Number,
			default: Math.floor(Math.random() * 10000),
		},

		extendedWallets: [
			{
				type: mongoose.Schema.Types.ObjectId,
				ref: "Wallet",
			},
		],
	},
	{ timestamps: true }
);

UserSchema.plugin(uniqueValidator, { message: "Taken" });

// const autoPopulate = function (next) {
// 	this.populate("extendedWallets");
// 	next();
// };

// UserSchema.pre("findOne", autoPopulate);
// UserSchema.pre("find", autoPopulate);

UserSchema.methods.generateJWT = function () {
	return jwt.sign(
		{
			id: this.id,
			username: this.username,
			publicAddress: this.publicAddress,
		},
		SECRET_KEY,
		{ expiresIn: "2d" }
	);
};

UserSchema.methods.toAuthJSON = function () {
	return {
		id: this._id,
		username: this.username,
		profileImage: this.profileImage,
		publicAddress: this.publicAddress,
		extendedWallets: this.extendedWallets,
		token: this.generateJWT(),
	};
};

UserSchema.methods.toJSON = function () {
	return {
		id: this._id,
		username: this.username,
		profileImage: this.profileImage,
		publicAddress: this.publicAddress,
		extendedWallets: this.extendedWallets,
	};
};

UserSchema.methods.toWebJSON = function () {
	return {
		publicAddress: this.publicAddress,
		nonce: this.nonce,
	};
};

module.exports = mongoose.model("User", UserSchema);
