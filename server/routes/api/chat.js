let { OkResponse, BadRequestResponse, UnauthorizedResponse } = require("express-http-response");
const { emitEvent } = require("../../utils/realTime");

let mongoose = require("mongoose");
let router = require("express").Router();
let User = mongoose.model("User");
let Chat = mongoose.model("Chat");
let auth = require("../auth");

router.get("/", async (req, res, next) => {
	try {
		// Get only past 2 days chat
		const chats = await Chat.find({
			sentAt: {
				$gte: new Date(new Date() - 2 * 60 * 60 * 24 * 1000),
			},
		})
			.populate({ path: "sentBy", select: "username profileImage" })
			.exec();

		return next(new OkResponse(chats));
	} catch (error) {
		console.log(error);
		return next(new BadRequestResponse("Failed to get chat!"));
	}
});

router.post("/", auth.required, async (req, res, next) => {
	try {
		const { message } = req.body;

		if (!message) {
			return next(new BadRequestResponse("Message can't be empty!"));
		}

		const chat = new Chat({
			message,
			sentBy: req.user.id,
		});

		await chat.save();

		emitEvent("chat", chat);
	} catch (error) {
		console.log(error);
		return next(new BadRequestResponse("Failed to send message!"));
	}
});

module.exports = router;
