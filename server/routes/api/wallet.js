let { OkResponse, BadRequestResponse, UnauthorizedResponse } = require("express-http-response");
const { Token: TOKEN, WETH } = require("@uniswap/sdk");

const CryptoJS = require("crypto-js");
let mongoose = require("mongoose");
let router = require("express").Router();
let Wallet = mongoose.model("Wallet");
let Token = mongoose.model("Token");
let { ALCHEMY_KEY, SECRET_KEY, ONE_INCH_API_KEY } = require("../../config");
let auth = require("../auth");
const { Web3 } = require("web3");
const { getWalletTokenBalances, getTokenPrice } = require("../../utils/web3");
const { buyTokens, sellTokens, quickBuyTokens } = require("../../utils/swap");
const { placeOrder } = require("../../utils/trade");

router.param("id", async (req, res, next, accountId) => {
	try {
		const wallet = await Wallet.findOne({ accountId });
		if (!wallet) {
			return next(new BadRequestResponse("Wallet not found"));
		}
		req.wallet = wallet;
		return next();
	} catch (err) {
		return next(new BadRequestResponse(err));
	}
});

router.param("contract", async (req, res, next, address) => {
	try {
		const token = await Token.findOne({ contractAddress: address });

		if (!token) {
			return next(new BadRequestResponse("Token not found"));
		}

		req.token = token;

		return next();
	} catch (err) {
		return next(new BadRequestResponse(err));
	}
});

router.get("/", auth.user, async (req, res, next) => {
	try {
		const wallets = await Wallet.find({ owner: req.user.id });
		const web3 = new Web3("https://eth-mainnet.g.alchemy.com/v2/" + ALCHEMY_KEY);

		for (let wallet of wallets) {
			const balance = await web3.eth.getBalance(wallet.publicAddress);
			const userBalance = (Number(balance) / 10 ** 18).toFixed(4);

			wallet.balance = userBalance;

			await wallet.save();
		}

		return next(new OkResponse(wallets));
	} catch (error) {
		console.log(error);
		return next(new BadRequestResponse(error));
	}
});

router.get("/request/key", auth.user, async (req, res, next) => {
	try {
		const user = req.user.toWebJSON();

		return next(new OkResponse(user.nonce));
	} catch (error) {
		console.log(error);
		return next(new BadRequestResponse(error));
	}
});

router.get("/key/:address/:signature", auth.user, async (req, res, next) => {
	const { address, signature } = req.params;

	if (!address || !signature) {
		return next(new BadRequestResponse("Address and signature are required"));
	}

	try {
		const web3 = new Web3("https://eth-mainnet.g.alchemy.com/v2/" + ALCHEMY_KEY);
		const recoveredAddr = web3.eth.accounts.recover(
			`I am requesting my private key by signing with one-time nonce: ${req.user.nonce}`,
			signature
		);

		if (recoveredAddr.toLowerCase() !== req.user.publicAddress) {
			return next(new UnauthorizedResponse("Unauthortized user"));
		}

		req.user.nonce = Math.floor(Math.random() * 10000);

		await req.user.save();

		const wallet = await Wallet.findOne({ publicAddress: address });

		if (!wallet) {
			return next(new BadRequestResponse("Wallet not found"));
		}

		const privateKey = await wallet.getPrivateKey();

		return next(new OkResponse(privateKey));
	} catch (error) {
		console.log(error);
		return next(new BadRequestResponse(error));
	}
});

router.get("/transfers", auth.user, async (req, res, next) => {
	try {
		const wallets = await Wallet.find({ owner: req.user.id });
		const web3 = new Web3("https://eth-mainnet.g.alchemy.com/v2/" + ALCHEMY_KEY);

		for (let wallet of wallets) {
			const balance = await web3.eth.getBalance(wallet.publicAddress);
			const userBalance = (Number(balance) / 10 ** 18).toFixed(4);

			wallet.balance = userBalance;

			const tokenBalances = await getWalletTokenBalances(wallet.publicAddress);
			let updatedTokens = [];

			for (let token of tokenBalances) {
				let oldToken = wallet.tokens.find((t) => t.contractAddress === token.token_address);
				const res = await getTokenPrice(token.token_address).catch((err) => {
					console.log(err, "---------------------ERROR IN GETTING TOKEN PRICE---------------------");
					return;
				});

				if (oldToken) {
					updatedTokens.push({
						...oldToken,
						amount: token.balance,
						decimals: token.decimals,
						price: res?.usdPriceFormatted,
					});
				} else {
					updatedTokens.push({
						name: token.name,
						symbol: token.symbol,
						contractAddress: token.token_address,
						amount: token.balance,
						decimals: token.decimals,
						price: res?.usdPriceFormatted,
					});
				}
			}

			wallet.tokens = updatedTokens;

			await wallet.save();
		}

		return next(new OkResponse(wallets));
	} catch (error) {
		console.log(error);
		return next(new BadRequestResponse(error));
	}
});

router.post("/create", auth.user, async (req, res, next) => {
	try {
		const web3 = new Web3("https://eth-mainnet.g.alchemy.com/v2/" + ALCHEMY_KEY);

		const account = web3.eth.accounts.create();

		const publicAddress = account.address;
		const privateKey = account.privateKey;

		const keystore = await web3.eth.accounts.encrypt(privateKey, SECRET_KEY);

		const nonce = Math.floor(Math.random() * 10000);

		const wallet = new Wallet({
			accountId: `account${nonce}`,
			publicAddress,
			keystore,
			owner: req.user.id,
		});

		const sWallet = await wallet.save();
		req.user.extendedWallets.push(wallet._id);
		await req.user.save();

		return next(new OkResponse(sWallet));
	} catch (error) {
		console.log(error);
		return next(new BadRequestResponse(error));
	}
});

router.post("/import", auth.user, async (req, res, next) => {
	try {
		let { privateKey } = req.body;

		if (!privateKey) {
			return next(new BadRequestResponse("Private key is required"));
		}

		if (privateKey.startsWith("0x")) {
			privateKey = privateKey.slice(2);
		}

		const web3 = new Web3("https://eth-mainnet.g.alchemy.com/v2/" + ALCHEMY_KEY);
		// const web3 = new Web3("https://eth-goerli.g.alchemy.com/v2/" + "ZWzGdHvXpZlTCgTcgz699bUKvOwMqOxx");

		const account = web3.eth.accounts.privateKeyToAccount("0x" + privateKey);

		const publicAddress = account.address;

		const balance = await web3.eth.getBalance(publicAddress);
		const userBalance = (Number(balance) / 10 ** 18).toFixed(4);

		if (publicAddress.toLowerCase() === req.user.publicAddress) {
			return next(new BadRequestResponse("You can't import your main wallet"));
		}

		const keystore = await web3.eth.accounts.encrypt("0x" + privateKey, SECRET_KEY);

		const nonce = Math.floor(Math.random() * 10000);

		const wallet = new Wallet({
			accountId: `account${nonce}`,
			publicAddress,
			keystore,
			balance: userBalance,
			owner: req.user.id,
		});

		const sWallet = await wallet.save();
		req.user.extendedWallets.push(wallet._id);
		await req.user.save();

		return next(new OkResponse(sWallet));
	} catch (error) {
		console.log(error);
		return next(new BadRequestResponse(error));
	}
});

router.post("/update/:id", auth.user, async (req, res, next) => {
	try {
		const { updatedId } = req.body;

		const isIdAssigned = await Wallet.findOne({ accountId: updatedId });

		if (isIdAssigned) {
			return next(new BadRequestResponse("This id is already assigned to another wallet"));
		}

		req.wallet.accountId = updatedId;
		await req.wallet.save();

		return next(new OkResponse("Wallet id updated successfully"));
	} catch (error) {
		console.log(error);
		return next(new BadRequestResponse(error));
	}
});

router.put("/settings/:id", auth.user, async (req, res, next) => {
	try {
		const { buySettings } = req.body;

		if (!buySettings) {
			return next(new BadRequestResponse("Buy settings are required"));
		}

		if (buySettings.slippage && Number(buySettings.slippage) < 0.5) {
			return next(new BadRequestResponse("Slippage tolerance must be equal or greater than 0.5"));
		}

		req.wallet.buySettings.amount = buySettings.amount;
		req.wallet.buySettings.slippage = 5;

		if (buySettings.slippage && Number(buySettings.slippage) >= 0.5) {
			req.wallet.buySettings.slippage = buySettings.slippage;
		}

		await req.wallet.save();

		return next(new OkResponse("Wallet settings updated successfully"));
	} catch (error) {
		console.log(error);
		return next(new BadRequestResponse("Couldn't update wallet settings"));
	}
});

router.delete("/delete/:address", auth.user, async (req, res, next) => {
	try {
		const { address } = req.params;

		await Wallet.findOneAndDelete({ publicAddress: address });
		req.user.extendedWallets = req.user.extendedWallets.filter((wallet) => wallet.publicAddress !== address);
		await req.user.save();

		const wallets = await Wallet.find({ owner: req.user.id });

		return next(new OkResponse(wallets));
	} catch (error) {
		console.log(error);
		return next(new BadRequestResponse(error));
	}
});

router.post("/quick-buy/:id/:contract", auth.user, async (req, res, next) => {
	try {
		const token = req.token;
		const wallet = req.wallet;

		const TOKEN_TO_BUY = new TOKEN(1, token.contractAddress, token.decimals);

		let privateKey = await wallet.getPrivateKey();
		const bytes = CryptoJS.AES.decrypt(privateKey, SECRET_KEY);
		privateKey = bytes.toString(CryptoJS.enc.Utf8);

		if (!wallet.buySettings.amount) {
			return next(new BadRequestResponse("Quickbuy settings hasn't been configured yet!"));
		}

		if (typeof wallet.buySettings.slippage !== "number" || wallet.buySettings.slippage < 0.5) {
			return next(new BadRequestResponse("Slippage tolerance must be equal or greater than 0.5"));
		}

		const receipt = await quickBuyTokens(
			privateKey,
			TOKEN_TO_BUY, // token to buy/receive
			WETH[1], // token to sell
			wallet.buySettings.amount,
			wallet.buySettings.slippage
		);

		return next(new OkResponse(receipt));
	} catch (error) {
		console.log(error.message, "---------------------ERROR IN TRANSACTION---------------------");
		if (error.message.startsWith("Error: missing revert data")) {
			return next(new BadRequestResponse("Insufficient liquidity for this trade!"));
		}
		if (error.message.startsWith("Error: insufficient funds")) {
			return next(new BadRequestResponse("Insufficient funds!"));
		}
		if (error.message.startsWith("InsufficientInputAmountError")) {
			console.log("Insufficient liquidity for this trade!");
			return next(new BadRequestResponse("Insufficient liquidity for this trade!"));
		}
		if (error.message.startsWith("Insufficient funds for paying gas fee!")) {
			return next(new BadRequestResponse("Insufficient funds for paying gas fee!"));
		}
		return next(new BadRequestResponse("Transaction failed!"));
	}
});

router.post("/buy/:id/:contract", auth.user, async (req, res, next) => {
	const { slippage, amount, quickBuy, maxWallet, maxTx } = { ...req.query };

	// console.log({ slippage, amount, quickBuy, maxWallet, maxTx });
	if (!quickBuy && !amount) return next(new BadRequestResponse("Amount is required"));
	try {
		const token = req.token;
		const wallet = req.wallet;

		let outputAmount = null;

		if (maxWallet) {
			outputAmount = token.maxWallet;
		}
		if (maxTx) {
			outputAmount = token.maxTx;
		}

		if (outputAmount) {
			outputAmount = BigInt(outputAmount * 10 ** token.decimals);
		}

		const TOKEN_TO_BUY = new TOKEN(1, token.contractAddress, token.decimals);

		let privateKey = await wallet.getPrivateKey();
		const bytes = CryptoJS.AES.decrypt(privateKey, SECRET_KEY);
		privateKey = bytes.toString(CryptoJS.enc.Utf8);

		const receipt = await buyTokens(
			privateKey,
			TOKEN_TO_BUY,
			WETH[1],
			amount ?? wallet.buySettings.amount,
			slippage ? slippage : String(wallet.buySettings.slippage),
			outputAmount
		);

		return next(new OkResponse(receipt));
	} catch (error) {
		console.log(error.message, "---------------------ERROR IN TRANSACTION---------------------");
		if (error.message.startsWith("Error: missing revert data")) {
			return next(new BadRequestResponse("Insufficient liquidity for this trade!"));
		}
		if (error.message.startsWith("Error: insufficient funds")) {
			return next(new BadRequestResponse("Insufficient funds!"));
		}
		if (error.message.startsWith("InsufficientInputAmountError")) {
			console.log("Insufficient balance!");
			return next(new BadRequestResponse("Insufficient balance!"));
		}
		return next(new BadRequestResponse("Transaction failed!"));
	}
});

router.post("/sell/:id", auth.user, async (req, res, next) => {
	const { sellAmount, contractAddress, decimals } = { ...req.query };

	if (!contractAddress) return next(new BadRequestResponse("Contract address is required"));
	if (!decimals) return next(new BadRequestResponse("Decimals is required"));

	if (!sellAmount) return next(new BadRequestResponse("Amount is required"));

	if (sellAmount && Number(sellAmount) <= 0) return next(new BadRequestResponse("Amount must be greater than 0"));

	try {
		const wallet = req.wallet;

		const TOKEN_TO_SELL = new TOKEN(1, contractAddress, decimals);

		let privateKey = await wallet.getPrivateKey();
		const bytes = CryptoJS.AES.decrypt(privateKey, SECRET_KEY);
		privateKey = bytes.toString(CryptoJS.enc.Utf8);

		const receipt = await sellTokens(privateKey, WETH[1], TOKEN_TO_SELL, sellAmount);

		return next(new OkResponse(receipt));
	} catch (error) {
		console.log(error, "---------------------ERROR IN TRANSACTION---------------------");
		let errorMessage;
		if (error.message.startsWith("Error: missing revert data")) {
			errorMessage = "Insufficient liquidity for this trade!";
		}
		if (error.message.startsWith("Error: insufficient funds for intrinsic transaction cost")) {
			errorMessage = "Insufficient funds for paying gas fee!";
		}
		if (error.message.startsWith("Insufficient liquidity!")) {
			errorMessage = "Insufficient liquidity for this trade!";
		}
		if (error.message.startsWith("Error: Insufficient funds for paying gas fee for token approval!")) {
			errorMessage = "Insufficient funds for paying gas fee for token approval!";
		}
		if (error.message.startsWith("Insufficient funds for paying gas fee!")) {
			errorMessage = "Insufficient funds for paying gas fee!";
		}

		if (errorMessage) {
			return next(new BadRequestResponse(errorMessage));
		}
		return next(new BadRequestResponse("Transaction failed!"));
	}
});

router.post("/sell/all/:id", auth.user, async (req, res, next) => {
	try {
		const wallet = req.wallet;

		const sellingTokenList = wallet.tokens.filter((token) => token.amount > 0);

		for (let token of sellingTokenList) {
			const TOKEN_TO_SELL = new TOKEN(1, token.contractAddress, token.decimals);

			let privateKey = await wallet.getPrivateKey();
			const bytes = CryptoJS.AES.decrypt(privateKey, SECRET_KEY);
			privateKey = bytes.toString(CryptoJS.enc.Utf8);

			const receipt = await sellTokens(privateKey, WETH[1], TOKEN_TO_SELL, token.amount);
		}

		return next(new OkResponse("All tokens sold successfully!"));
	} catch (error) {
		console.log(error.message, "---------------------ERROR IN TRANSACTION---------------------");
		let errorMessage;
		if (error.message.startsWith("Error: missing revert data")) {
			errorMessage = "Insufficient liquidity for this trade!";
		}
		if (error.message.startsWith("Error: insufficient funds for intrinsic transaction cost")) {
			errorMessage = "Insufficient funds for paying gas fee!";
		}
		if (error.message.startsWith("InsufficientInputAmountError")) {
			errorMessage = "Insufficient liquidity for this trade!";
		}
		if (error.message.startsWith("Error: Insufficient funds for paying gas fee for token approval!")) {
			errorMessage = "Insufficient funds for paying gas fee for token approval!";
		}
		if (error.message.startsWith("Insufficient funds for paying gas fee!")) {
			errorMessage = "Insufficient funds for paying gas fee!";
		}

		if (errorMessage) {
			return next(new BadRequestResponse(errorMessage));
		}
		return next(new BadRequestResponse("Transaction failed!"));
	}
});

module.exports = router;
