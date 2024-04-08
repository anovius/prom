"use strict";
module.exports = {
	BACKEND_URL: "http://localhost:8000",
	FRONTEND_URL: "http://localhost:3000",
	publicPics: `http://localhost:8000/uploads/publicPics`,

	// BACKEND_URL: "https://dapp.prometrading.com",
	// FRONTEND_URL: "https://dapp.prometrading.com",
	// publicPics: `https://dapp.prometrading.com/uploads/publicPics`,

	// Staging URL's
	// BACKEND_URL: "http://3.86.167.168",
	// FRONTEND_URL: "http://3.86.167.168",
	// publicPics: `http://3.86.167.168/uploads/publicPics`,

	PORT: 3000,
	MONGODB_URI: "mongodb://127.0.0.1:27017/prometheus",
	SECRET_KEY: process.env.SECRET_KEY,
	ALCHEMY_KEY: process.env.ALCHEMY_KEY,
	ALCHEMY_SWAP_KEY: process.env.ALCHEMY_SWAP_KEY,
	MORALIS_API_KEY: process.env.MORALIS_API_KEY,
	ONE_INCH_API_KEY: process.env.ONE_INCH_API_KEY,
	PROMETHEUS_ENDPOINT: process.env.PROMETHEUS_ENDPOINT,
	PROMETHEUS_API_KEY: process.env.PROMETHEUS_API_KEY,
};
