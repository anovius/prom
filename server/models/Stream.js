let mongoose = require("mongoose");

let StreamSchema = new mongoose.Schema(
	{
		streamId: {
			type: String,
			required: true,
		},
		addresses: [
			{
				type: String,
			},
		],
		createdAt: {
			type: Date,
			default: Date.now,
		},
	},
	{ timestamps: true }
);

StreamSchema.methods.toJSON = function () {
	return {
		id: this._id,
		streamId: this.streamId,
		addresses: this.addresses,
		createdAt: this.createdAt,
	};
};

module.exports = mongoose.model("Stream", StreamSchema);
