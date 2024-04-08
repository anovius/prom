let mongoose = require("mongoose");
let uniqueValidator = require("mongoose-unique-validator");
const mongoosePaginate = require("mongoose-paginate-v2");

let NotificationSchema = new mongoose.Schema(
	{
		message: {
			type: String,
			required: true,
		},
		subscribers: [
			{
				type: mongoose.Schema.Types.ObjectId,
				ref: "User",
			},
		],
		readBy: [
			{
				type: mongoose.Schema.Types.ObjectId,
				ref: "User",
			},
		],
		createdAt: {
			type: Date,
			default: Date.now,
		},
	},
	{ timestamps: true }
);

NotificationSchema.plugin(uniqueValidator, { message: "Taken" });
NotificationSchema.plugin(mongoosePaginate);

const autoPopulate = function (next) {
	next();
};

NotificationSchema.pre("findOne", autoPopulate);
NotificationSchema.pre("find", autoPopulate);

NotificationSchema.methods.toJSON = function () {
	return {
		id: this._id,
		message: this.message,
		createdAt: this.createdAt,
	};
};

module.exports = mongoose.model("Notification", NotificationSchema);
