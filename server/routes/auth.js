const { BadRequestResponse, UnauthorizedResponse } = require("express-http-response");
const jwt = require("jsonwebtoken");
const User = require("../models/User.js");
const { SECRET_KEY } = require("../config");

const verifyToken = function (req, res, next) {
	const { authorization } = req.headers;
	if (
		(authorization && authorization.split(" ")[0] === "Token") ||
		(authorization && authorization.split(" ")[0] === "Bearer")
	) {
		const token = authorization.split(" ")[1];
		jwt.verify(token, SECRET_KEY, (error, data) => {
			if (error) {
				return next(new UnauthorizedResponse("Invalid Token"));
			} else {
				User.findById(data.id)
					.populate("extendedWallets")
					.then((user) => {
						req.user = user;
						next();
					})
					.catch((err) => next(new UnauthorizedResponse("Something went wrong while authenticating user!")));
			}
		});
	} else {
		next(new BadRequestResponse("Token not found!"));
	}
};

const isAdmin = function (req, res, next) {
	if (req.user.role === "admin") {
		next();
	} else {
		return next(new UnauthorizedResponse("You are not authorized to perform this action!"));
	}
};

const auth = {
	required: verifyToken,
	user: verifyToken,
	admin: isAdmin,
};

module.exports = auth;
