let { OkResponse, BadRequestResponse, UnauthorizedResponse } = require("express-http-response");

let mongoose = require("mongoose");
let router = require("express").Router();
let Notification = mongoose.model("Notification");
let auth = require("../auth");

router.use(auth.required);

router.get("/", async (req, res, next) => {
	try {
		let notifications = await Notification.find({ subscribers: { $in: [req.user.id] } }).sort({ createdAt: -1 });
		const unreadCount = await Notification.countDocuments({
			subscribers: { $in: [req.user.id] },
			readBy: { $nin: [req.user.id] },
		});
		console.log("------------- unreadCount --------------", unreadCount);
		return next(
			new OkResponse({
				notifications,
				unreadCount,
			})
		);
	} catch (error) {
		console.log("error in notification get", error);
		return next(new BadRequestResponse("Error in getting notifications"));
	}
});

router.post("/read", async (req, res, next) => {
	try {
		// const { notificationId } = req.body;

		// if (!notificationId) {
		// 	return next(new BadRequestResponse("Invalid request"));
		// }

		const query = {
			subscribers: { $in: [req.user.id] },
			readBy: { $nin: [req.user.id] },
		};

		await Notification.updateMany(query, { $push: { readBy: req.user.id } });
		const unreadCount = await Notification.countDocuments({
			subscribers: { $in: [req.user.id] },
			readBy: { $nin: [req.user.id] },
		});

		return next(
			new OkResponse({
				message: "Notification read",
				unreadCount,
			})
		);
	} catch (error) {
		console.log("error in notification read", error);
		return next(new BadRequestResponse("Error in reading notification"));
	}
});

module.exports = router;
