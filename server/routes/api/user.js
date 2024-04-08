let { OkResponse, BadRequestResponse, UnauthorizedResponse } = require("express-http-response");

let mongoose = require("mongoose");
let router = require("express").Router();
let User = mongoose.model("User");
let { FRONTEND_URL, BACKEND_URL, ALCHEMY_KEY } = require("../../config");
let auth = require("../auth");
const { Web3 } = require("web3");

router.param("address", async (req, res, next, publicAddress) => {
	try {
		const user = await User.findOne({ publicAddress }).populate("extendedWallets");
		if (!user) {
			return next(
				new OkResponse({
					isRegistered: false,
				})
			);
		}
		req.userToUpdate = user.toWebJSON();
		req.userToUpdate.isRegistered = true;
		return next();
	} catch (err) {
		return next(new BadRequestResponse(err));
	}
});

router.post("/signup", async (req, res, next) => {
	if (!req.body.publicAddress) {
		return next(new BadRequestResponse("publicAddress is required"));
	}
	const usr = await User.findOne({ publicAddress: req.body.publicAddress }).populate("extendedWallets");
	if (usr) {
		return next(new BadRequestResponse("User already registered!"));
	} else {
		let user = new User({
			username: req.body.publicAddress,
		});
		user.publicAddress = req.body.publicAddress;
		return user
			.save()
			.then((sUser) => {
				return next(new OkResponse(sUser.toAuthJSON()));
			})
			.catch((err) => {
				return next(new BadRequestResponse(err));
			});
	}
});

router.post("/login", (req, res, next) => {
	const { publicAddress, signature } = req.body;

	if (!publicAddress || !signature) {
		return next(new BadRequestResponse("publicAddress and signature are required"));
	}

	User.findOne({ publicAddress })
		.populate("extendedWallets")
		.then((user) => {
			if (!user) {
				return next(new BadRequestResponse("User not found"));
			}

			const web3 = new Web3("https://eth-mainnet.g.alchemy.com/v2/" + ALCHEMY_KEY);
			const address = web3.eth.accounts.recover(
				`Logging in to Prometheus Dapp with my one-time nonce: ${user.nonce}`,
				signature
			);

			if (address.toLowerCase() !== user.publicAddress) {
				return next(new UnauthorizedResponse("Unauthortized user"));
			}

			user.nonce = Math.floor(Math.random() * 10000);

			if (!user.username) {
				user.username = user.publicAddress;
			}

			return user
				.save()
				.then((usr) => next(new OkResponse(usr.toAuthJSON())))
				.catch((err) => {
					console.log(err);
					next(new BadRequestResponse(err));
				});
		})
		.catch((err) => {
			console.log(err);
			return next(new BadRequestResponse(err));
		});
});

router.put("/", auth.required, async (req, res, next) => {
	try {
		const { username, profileImage } = req.body;

		if (!username && !profileImage) {
			return next(new BadRequestResponse("Nothing to update!"));
		}

		const existedUser = await User.findOne({
			username,
		});

		if (existedUser) {
			return next(new BadRequestResponse("Username taken!"));
		}

		if (username) {
			req.user.username = username;
		}

		if (profileImage) {
			req.user.profileImage = profileImage;
		}

		const user = await req.user.save();

		return next(new OkResponse(user));
	} catch (error) {
		console.log(error);
		return next(new BadRequestResponse("Failed to update user!"));
	}
});

router.get("/context", auth.user, (req, res, next) => {
	try {
		if (req.user) {
			return next(new OkResponse(req.user.toAuthJSON()));
		} else {
			return next(new UnauthorizedResponse("Unauthorized user!"));
		}
	} catch (error) {
		return next(new UnauthorizedResponse("Unauthorized user!"));
	}
});

router.get("/address/:address", (req, res, next) => {
	return next(new OkResponse(req.userToUpdate));
});

module.exports = router;
