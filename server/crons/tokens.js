const cron = require("node-cron");
const Token = require("../models/Token");
const Notification = require("../models/Notification");
const { getTokenTransfers, getTokenLinks, getTopTokenHolders } = require("../utils/web3");
const { Web3 } = require("web3");
const { CONTRACT_ABI, UNCX_CONTRACT_ABI, UNCX_CONTRACT_ADDRESS } = require("../constants");
let { ALCHEMY_KEY } = require("../config");
const { emitEvent } = require("../utils/realTime");

const web3 = new Web3("https://eth-mainnet.g.alchemy.com/v2/" + ALCHEMY_KEY);

const DEAD_ADDRESSES = [
	"0x0000000000000000000000000000000000000000",
	"0x000000000000000000000000000000000000dEaD",
	"0x000000000000000000000000000000000000dead",
];

const checkFnExists = async (fnNames, contract) => {
	for (const fnName of fnNames) {
		try {
			await contract.methods[fnName]().call();
			console.log(fnName, " exists");
			return fnName;
		} catch (error) {
			// console.log(`error in ${fnName}`);
		}
	}
};

const getLocksLength = async (contract, address) => {
	try {
		const locksLength = await contract.methods.getTokenLocksLength(address).call();
		return Number(locksLength);
	} catch (error) {
		console.log("error in getLocksLength", error);
	}
};

const getLockedData = async (contract, address, decimals, locksLength) => {
	let totalLocked = 0;
	const today = new Date();
	let lockedDate = new Date(today);
	lockedDate.setFullYear(today.getFullYear() + 1000);
	lockedDate = lockedDate.getTime();

	try {
		if (locksLength > 0) {
			for (let i = 0; i < locksLength; i++) {
				let lockID = await contract.methods.getTokenLockIDAtIndex(address, i).call();
				lockID = Number(lockID);

				let lock = await contract.methods.LOCKS(lockID).call();

				// console.log("---------lock-------", bigIntToNumber(lock.sharesDeposited, decimals), typeof lock);

				const amount = bigIntToNumber(lock.sharesDeposited, decimals) - bigIntToNumber(lock.sharesWithdrawn, decimals);
				totalLocked += amount;

				const lockDate = Number(lock.endEmission);
				if (lockDate < lockedDate) {
					lockedDate = lockDate;
				}
			}
			return { totalLocked, lockedDate };
		} else {
			return { totalLocked, lockedDate: Date.now() };
		}
	} catch (error) {
		console.log("error in getLockedData", error);
	}
};

const bigIntToNumber = (num, decimals) => {
	try {
		return Number(BigInt(num)) / 10 ** decimals;
	} catch (error) {
		console.log("error in bigIntToNumber", error);
	}
};

const customToFixed = (num) => {
	if (num > 1) return num.toFixed(2);
	if (num % 1 === 0) return Math.floor(num);
	return num.toFixed(6);
};

const task = cron.schedule("0 */30 * * * *", async () => {
	const tokens = await Token.find({}).sort({ createdAt: -1 }).limit(150);

	for (let token of tokens) {
		try {
			const uncxContract = new web3.eth.Contract(UNCX_CONTRACT_ABI, UNCX_CONTRACT_ADDRESS);

			const locksLength = await getLocksLength(uncxContract, token.contractAddress);

			if (locksLength !== undefined) {
				const lockedData = await getLockedData(uncxContract, token.contractAddress, token.decimals, locksLength);
				if (lockedData !== undefined) {
					token.lockedAmount = lockedData.totalLocked;
					token.lockedTime = lockedData.lockedDate;
				}
			}

			const contract = new web3.eth.Contract(CONTRACT_ABI, token.contractAddress);

			if (token.liquidity?.blockNumber) {
				let transfers = await getTokenTransfers(token.contractAddress, token.liquidity.blockNumber);
				// console.log(transfers, "---------- TRANSFERS ----------", token.liquidity);

				const sniperBots = [];
				if (transfers && Array.isArray(transfers) && transfers.length > 0) {
					for (let transfer of transfers) {
						if (
							transfer?.from_address.toLowerCase() === token.liquidity.pairAddress.toLowerCase() &&
							transfer?.to_address
						) {
							sniperBots.push(transfer.to_address);
						}
					}

					token.sniperBots = sniperBots;
				}
			}
			let holders = await getTopTokenHolders(token.contractAddress);
			let links = await getTokenLinks(token.contractAddress);

			if (links?.length > 0) {
				token.socialLinks = links;
			}

			// Calculate total supply
			let totalSupply = await contract.methods.totalSupply().call();
			totalSupply = bigIntToNumber(totalSupply, token.decimals);

			if (holders?.length > 0) {
				holders = holders.map((holder) => {
					const percentage = (holder.amount / totalSupply) * 100;
					return {
						percent: customToFixed(percentage),
						amount: holder.amount,
						address: holder.wallet_address,
					};
				});
				token.topHolders = holders;
			}

			// Calculate Buy Fee
			let buyFee;
			if (token.buyTaxFn) {
				buyFee = await contract.methods[token.buyTaxFn]().call();
				buyFee = Number(buyFee);
			}

			// Calculate Sell Fee
			let sellFee;
			if (token.sellTaxFn) {
				sellFee = await contract.methods[token.sellTaxFn]().call();
				sellFee = Number(sellFee);
			}

			// Calculate Max Transaction Amount
			let maxTxAmount;
			if (token.maxTxFn) {
				maxTxAmount = await contract.methods[token.maxTxFn]().call();
				maxTxAmount = bigIntToNumber(maxTxAmount, token.decimals);
			}

			// Calculate Max Wallet Amount
			let maxWalletAmount;
			if (token.maxWalletFn) {
				maxWalletAmount = await contract.methods[token.maxWalletFn]().call();
				maxWalletAmount = bigIntToNumber(maxWalletAmount, token.decimals);
			}

			// Check if trading is enabled
			let isTradingEnabled;
			if (token.isTradeableFn) {
				isTradingEnabled = await contract.methods[token.isTradeableFn]().call();
			}

			// Calculate the burnt supply
			let burntSupply = await contract.methods.balanceOf(DEAD_ADDRESSES[0]).call();
			burntSupply = bigIntToNumber(burntSupply, token.decimals);
			let burntSupply2 = await contract.methods.balanceOf(DEAD_ADDRESSES[1]).call();
			burntSupply2 = bigIntToNumber(burntSupply2, token.decimals);

			let owner;
			let ownerFn = await checkFnExists(["owner"], contract);
			if (ownerFn) {
				owner = await contract.methods[ownerFn]().call();
			}

			// Checking if the token is renounced
			let isRenounced;
			if (owner) {
				isRenounced = owner === DEAD_ADDRESSES[0] || owner === DEAD_ADDRESSES[1];
			}

			// Checking if the owner is holding 5% of the total supply
			let ownerShare = 0;
			if (!isRenounced && owner) {
				let ownerBalance = await contract.methods.balanceOf(owner).call();
				ownerBalance = bigIntToNumber(ownerBalance, token.decimals);

				ownerShare = (ownerBalance / totalSupply) * 100; // in percentage
			}

			// Creating & emmiting notification
			if (token.watchlist && token.watchlist.length > 0) {
				// Check if the token is renounced
				if (!token.isRenounced && isRenounced) {
					// console.log(`--------------------- ${token.name} has been renounced ---------------------`);
					const notification = new Notification({
						message: `${token.name}: Ownership has been renounced`,
						subscribers: token.watchlist,
					});
					await notification.save().then((notification) => {
						emitEvent("notification", notification);
					});
				}

				// Check if trading is enabled
				if (token.isTradeableFn && !token.isTradeable && isTradingEnabled) {
					// console.log(`--------------------- ${token.name} trading has been enabled ---------------------`);
					const notification = new Notification({
						message: `${token.name}: Trading has been started`,
						subscribers: token.watchlist,
					});
					await notification.save().then((notification) => {
						emitEvent("notification", notification);
					});
				}
			}

			// Known Values for Every ERC20 Token
			token.totalSupply = totalSupply;
			token.ownerShare = ownerShare;
			if (isRenounced !== undefined) {
				token.isRenounced = isRenounced;
				token.renouncedAt = new Date();
			}
			if (burntSupply > 0) {
				token.burntSupply = burntSupply;
			}
			if (burntSupply2 > 0) {
				token.burntSupply = burntSupply2;
			}

			// Optional Values for ERC20 Token
			if (buyFee !== undefined) {
				token.buyTax = buyFee;
			}
			if (sellFee !== undefined) {
				token.sellTax = sellFee;
			}
			if (maxTxAmount !== undefined) {
				token.maxTx = maxTxAmount;
			}
			if (maxWalletAmount !== undefined) {
				token.maxWallet = maxWalletAmount;
			}
			if (isTradingEnabled !== undefined) {
				token.isTradeable = isTradingEnabled;
				token.startTradingAt = new Date();
			}

			await token.save().then((token) => {
				console.log("Token Saved", token.name);
			});
		} catch (error) {
			console.log("Error in updating token metadata", error);
		}
	}
});

module.exports = task;
