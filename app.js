require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const Moralis = require("moralis").default;
const tokenCronManager = require("./server/crons/tokens");
const ordersCron = require("./server/crons/orders");
const walletCron = require("./server/crons/wallets");
const quoteCron = require("./server/crons/quote");
const io = require("socket.io");
const jwt = require("jsonwebtoken");
const User = require("./server/models/User.js");
const { SECRET_KEY } = require("./server/config");

const MORALIS_API_KEY = require("./server/config").MORALIS_API_KEY;
const allowedOrigins = [
	"http://localhost:8000",
	"http://localhost:3000",
	"http://localhost:5000",
	"http://localhost:5173",
	"http://54.161.78.203",
	"http://3.86.167.168",
	"https://dapp.prometrading.com",
];

const app = express();

require("./server/app-config")(app);

const server = app.listen(process.env.PORT || 8000, function () {
	Moralis.start({
		apiKey: MORALIS_API_KEY,
	})
		.then((res) => {
			console.log("Moralis has been initialized");
			walletCron.start();
			ordersCron.start();
			quoteCron.start();
			tokenCronManager.start();
		})
		.catch((err) => console.log(err));
	console.log("Listening on port " + server.address().port);
});

global.prometheusSocket = io(server, {
	cors: {
		credentials: true,
		origin: function (origin, callback) {
			// allow requests with no origin
			// (like mobile apps or curl requests)
			// console.log("ORIGIN", origin);
			if (!origin) return callback(null, true);
			if (allowedOrigins.indexOf(origin) === -1) {
				var msg = "The CORS policy for this site does not " + "allow access from the specified Origin.";
				return callback(new Error(msg), false);
			}
			return callback(null, true);
		},
	},
});

prometheusSocket.use((socket, next) => {
	const token = socket.handshake.auth.token;

	if (token) {
		jwt.verify(token, SECRET_KEY, (error, data) => {
			if (error) {
				return next(new Error("Invalid Socket Token"));
			} else {
				return User.findById(data.id)
					.populate("extendedWallets")
					.then((user) => {
						socket.user = user;
						return next();
					})
					.catch((err) => next(new Error("Failed to authenticate socket authorization token!")));
			}
		});
	}

	next();
});

prometheusSocket.on("connection", async (socket) => {
	// console.log(
	// 	"\n\n---------- 🔌🔌🔌 ---------- \n     a user connected \n---------- 🔌🔌🔌 ----------",
	// 	socket.id,
	// 	"\n\n"
	// 	// socket.user
	// );

	const sockets = await prometheusSocket.allSockets();
	console.log(
		"\n\n----------------------------------------------------------- 🔌🔌🔌 ----------------------------------------------------------- \n",
		"     Total Set of sockets connected to our server (both authorized & unauthorized) ",
		sockets,
		" \n----------------------------------------------------------- 🔌🔌🔌 -----------------------------------------------------------",
		"\n\n"
	);

	socket.on("disconnect", () => {
		console.log("+++++ user disconnected +++++++");
	});
});

process.on("SIGTERM", () => {
	console.info("SIGTERM signal received.");
	console.log("Closing http server.");

	server.close(() => {
		console.log("Http server closed.");
		// boolean means [force], see in mongoose doc
		mongoose.connection.close(false, () => {
			console.log("MongoDb connection closed.");
			process.kill(process.pid, "SIGTERM");
			process.exit(0);
		});
	});
});
process.once("SIGUSR2", function () {
	server.close(() => {
		console.log("Http server closed.");
		// boolean means [force], see in mongoose doc
		mongoose.connection.close(false, () => {
			console.log("MongoDb connection closed.");
			process.kill(process.pid, "SIGUSR2");
			process.exit(0);
		});
	});
});

process.on("SIGINT", function () {
	// this is only called on ctrl+c, not restart
	server.close(() => {
		console.log("Http server closed.");
		// boolean means [force], see in mongoose doc
		mongoose.connection.close(false, () => {
			console.log("MongoDb connection closed.");
			process.kill(process.pid, "SIGINT");

			process.exit(0);
		});
	});
});
