let mongoose = require("mongoose");
let uniqueValidator = require("mongoose-unique-validator");

let ChatSchema = new mongoose.Schema(
	{
		message: {
			type: String,
			required: true,
		},

		sentBy: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "User",
		},

		sentAt: {
			type: Date,
			default: Date.now,
		},
	},
	{ timestamps: true }
);

ChatSchema.plugin(uniqueValidator, { message: "Taken" });

ChatSchema.methods.toJSON = function () {
	return {
		id: this._id,
		message: this.message,
		sentBy: this.sentBy,
		sentAt: this.sentAt,
	};
};

module.exports = mongoose.model("Chat", ChatSchema);
