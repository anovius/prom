import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import copy from "copy-to-clipboard";
import Modal from "react-bootstrap/Modal";
import Dropdown from "react-bootstrap/Dropdown";
import http from "../../api";
import { toast } from "react-toastify";
import { environment } from "../../constants";
import CustomPagination from "../../components/layout/CustomPagination";
import { useDebounce } from "use-debounce";
import { useDispatch, useSelector } from "react-redux";
import { setUser } from "../../redux/slices/User";
import { socket } from "../../socket/globalSocket";

export default function Feed({ filters, isFilterChanged, selectedWallet }) {
	const dispatch = useDispatch();
	const user = useSelector((state) => state.user);

	const navigate = useNavigate();
	const [tags, setTags] = useState([]);
	const [projects, setProjects] = useState([]);
	const [pages, setPages] = useState([1]);
	const [activePage, setActivePage] = useState(1);
	const [selectedToken, setSelectedToken] = useState();
	const [slippage, setSlippage] = useState(0.5);
	const [errors, setErrors] = useState({
		slippage: "",
	});
	const [selectedTokenBalance, setSelectedTokenBalance] = useState(0);
	const [tx, setTx] = useState();

	// Swap States
	const [isTxInProgress, setIsTxInProgress] = useState(false);
	const [isMaxTxActive, setIsMaxTxActive] = useState(false);
	const [isMaxWalletActive, setIsMaxWalletActive] = useState(false);
	const [ethPrice, setEthPrice] = useState(null);
	const [networkFee, setNetworkFee] = useState();
	const [isInputChanged, setIsInputChanged] = useState(false);
	const [inputEtherAmount, setInputEtherAmount] = useState();
	const [outputTokenAmount, setOutputTokenAmount] = useState();
	const [selectedTokenDetails, setSelectedTokenDetails] = useState({
		ether: undefined,
		networkFee: undefined,
		minimumOutput: undefined,
		expectedOutput: undefined,
	});
	const [units, setUnits] = useState({
		ONE_ETH_TO_TOKENS: 0,
		ONE_TOKEN_TO_ETH: 0,
	});
	const [debouncedEther] = useDebounce(inputEtherAmount, 1000);
	const [buyDetails, setBuyDetails] = useState({
		wallet: "",
		token: "",
	});
	const [showBuyModal, setShowBuyModal] = useState(false);
	const [txModal, setTxModal] = useState(false);

	const resetAllSwapStates = () => {
		setIsMaxTxActive(false);
		setIsMaxWalletActive(false);
		setInputEtherAmount();
		setOutputTokenAmount();
		setSelectedToken();
		setIsInputChanged(false);
		setSlippage(0.5);
		setSelectedTokenBalance(0);
		setSelectedTokenDetails({
			ether: undefined,
			networkFee: undefined,
			minimumOutput: undefined,
			expectedOutput: undefined,
		});
	};

	const handleCloseTx = () => {
		setTxModal(false);
		setTx();
	};
	const handleShowTx = () => {
		setTxModal(true);
	};
	const handleCloseBuy = () => {
		resetAllSwapStates();
		setShowBuyModal(false);
	};
	const handleShowBuy = (token) => {
		const fToken = buyDetails.wallet?.tokens?.find((wToken) => wToken.contractAddress === token.contractAddress);
		setSelectedToken(token);
		setSelectedTokenBalance(fToken?.amount?.toFixed(4) || 0);
		setSelectedTokenDetails({
			...selectedTokenDetails,
			ether: buyDetails.wallet?.buySettings?.amount ?? 0.0001,
		});
		getEthPrice();
		setShowBuyModal(true);
		getEthPrice();
		fetchPreTxDetails(
			token.contractAddress,
			buyDetails.wallet?.buySettings?.amount && buyDetails.wallet?.buySettings?.amount > 0
				? buyDetails.wallet?.buySettings?.amount
				: 0.0001,
			slippage
		);
	};

	const handleCheckboxChange = (event, tag) => {
		if (event.target.checked) {
			setTags([...tags, tag]);
		} else {
			setTags(tags.filter((t) => t !== tag));
		}
	};

	const changeSlippage = (e) => {
		const { value } = e.target;
		if (value < 0 || value > 100) {
			setErrors({
				...errors,
				slippage: "Slippage must be between 0 and 100",
			});
		} else {
			setErrors({
				...errors,
				slippage: "",
			});
		}
		setSlippage(value);
	};

	const customToFixed = (num) => {
		if (num % 1 === 0) return Math.floor(num);
		return num.toFixed(2);
	};

	const formatNumber = (scientificString, decimal) => {
		if (scientificString === undefined || scientificString === "") return "--";

		// console.log(scientificString, "scientificString");
		const num = parseFloat(scientificString);

		// Convert the number to its "full" decimal string representation
		const numString = num.toFixed(50);

		// Count how many zeros there are after the decimal point and before the first non-zero digit
		const zeroCount = numString.split(".")[1].match(/^0*/)[0].length;

		// Calculate the number of digits to keep after the decimal point
		const significantDigits = zeroCount + decimal;

		// Round to the calculated number of significant digits
		const roundedString = num.toFixed(significantDigits);

		let trimmedString;

		if (decimal) {
			trimmedString = roundedString.replace(/0+$/, "");
		} else {
			trimmedString = numString.replace(/0+$/, "");
		}

		// Remove trailing decimal point
		const finalString = trimmedString.endsWith(".") ? trimmedString.slice(0, -1) : trimmedString;

		return finalString;
	};

	const getMaxAmount = (fee, totalSupply) => {
		return `${customToFixed((fee / totalSupply) * 100)}% (${customToFixed(fee)})`;
	};

	const getHoldersTxt = (holders) => {
		return `${holders[0]?.percent + "%" || ""}${holders[1]?.percent ? "-" + holders[1]?.percent + "%" : ""}${
			holders[2]?.percent ? "-" + holders[2]?.percent + "%" : ""
		}`;
	};

	const isNewPair = (mongooseDate) => {
		const time = mongooseDate instanceof Date ? mongooseDate : new Date(mongooseDate);
		const currentDate = new Date();
		const oneDayAgo = new Date(currentDate);
		oneDayAgo.setDate(currentDate.getDate() - 1);

		return time >= oneDayAgo;
	};

	const getProjects = async (page, filters) => {
		if (filters.deployedAt && filters.deployedAt.isApplied) {
			const { days, hours, minutes } = filters.deployedAt;
			const now = new Date();

			const millisecondsInADay = 24 * 60 * 60 * 1000;
			const millisecondsInAnHour = 60 * 60 * 1000;
			const millisecondsInAMinute = 60 * 1000;

			const totalMilliseconds =
				days.min * millisecondsInADay + hours.min * millisecondsInAnHour + minutes.min * millisecondsInAMinute;

			const minDate = new Date(now.getTime() - totalMilliseconds);
			filters.deployedAt.minDate = minDate;

			if (days.max !== 0 || hours.max !== 0 || minutes.max !== 0) {
				const maxMilliseconds =
					days.max * millisecondsInADay + hours.max * millisecondsInAnHour + minutes.max * millisecondsInAMinute;

				const maxDate = new Date(now.getTime() - maxMilliseconds);
				filters.deployedAt.maxDate = maxDate;
			}
		}

		if (filters.lockedTime && filters.lockedTime.isApplied) {
			const { weeks, days } = filters.lockedTime;
			const now = new Date();

			const millisecondsInAWeek = 7 * 24 * 60 * 60 * 1000;
			const millisecondsInADay = 24 * 60 * 60 * 1000;

			const totalMilliseconds = weeks.min * millisecondsInAWeek + days.min * millisecondsInADay;

			const minLockDate = new Date(now.getTime() - totalMilliseconds);
			filters.lockedTime.minLockDate = minLockDate;

			if (weeks.max !== 0 || days.max !== 0) {
				const maxMilliseconds = weeks.max * millisecondsInAWeek + days.max * millisecondsInADay;

				const maxLockDate = new Date(now.getTime() - maxMilliseconds);
				filters.lockedTime.maxLockDate = maxLockDate;
			}
		}

		let url = "feed" + (page && tags.length === 0 ? "?page=" + page : "?page=1");

		tags.forEach((tag) => {
			url += `&${tag}=true`;
		});

		try {
			const res = await http.post(url, filters);
			// console.log(res.data.data, "res.data");
			setProjects(res.data.data.tokens);
			setPages(Array.from({ length: res.data.data.totalPages }, (_, i) => i + 1));
		} catch (error) {
			console.log(error, "error");
			toast.error("Error while fetching projects!");
		}
	};

	function getTimeLeft(date, lang = "en") {
		// console.log(date, "date");
		const timeMs = typeof date === "number" ? date : new Date(date).getTime();

		const deltaSeconds = Math.round((timeMs * 1000 - Date.now()) / 1000);

		const cutoffs = [60, 3600, 86400, 86400 * 7, 86400 * 30, 86400 * 365, Infinity];

		const units = ["second", "minute", "hour", "day", "week", "month", "year"];

		const unitIndex = cutoffs.findIndex((cutoff) => cutoff > Math.abs(deltaSeconds));

		const divisor = unitIndex ? cutoffs[unitIndex - 1] : 1;

		const rtf = new Intl.RelativeTimeFormat(lang, { numeric: "auto" });
		const relativeTime = rtf.format(Math.round(deltaSeconds / divisor), units[unitIndex]);
		return relativeTime.charAt(0).toUpperCase() + relativeTime.slice(1);
	}

	const formatDate = (date) => {
		const now = new Date();
		const timeDifference = now - date;
		const oneMinuteInMilliseconds = 60 * 1000;
		const oneHourInMilliseconds = 60 * oneMinuteInMilliseconds;
		const oneDayInMilliseconds = 24 * oneHourInMilliseconds;

		if (timeDifference >= oneDayInMilliseconds) {
			const daysAgo = Math.floor(timeDifference / oneDayInMilliseconds);
			return `${daysAgo} day${daysAgo !== 1 ? "s" : ""} ago`;
		} else if (timeDifference >= oneHourInMilliseconds) {
			const hoursAgo = Math.floor(timeDifference / oneHourInMilliseconds);
			const remainingMinutes = Math.floor((timeDifference % oneHourInMilliseconds) / oneMinuteInMilliseconds);
			return `${hoursAgo}h ${remainingMinutes ? remainingMinutes + "min" : ""} ago`;
		} else if (timeDifference >= oneMinuteInMilliseconds) {
			const minutesAgo = Math.floor(timeDifference / oneMinuteInMilliseconds);
			const remainingSeconds = Math.floor((timeDifference % oneMinuteInMilliseconds) / 1000);
			return `${minutesAgo}min ${remainingSeconds ? remainingSeconds + "s" : ""} ago`;
		} else {
			const secondsAgo = Math.floor(timeDifference / 1000);
			return `${secondsAgo}s ago`;
		}
	};

	const getName = (name) => {
		try {
			const cleanedName = name.replace(/[^\x20-\x7E]/g, "");
			if (cleanedName.length > 15) {
				const newName = cleanedName.slice(0, 15);
				return newName[0]?.toUpperCase() + newName.slice(1)?.toLowerCase() + "...";
			} else {
				return cleanedName[0]?.toUpperCase() + cleanedName.slice(1)?.toLowerCase();
			}
		} catch (error) {
			console.log(error, "Not a valid contract name");
		}
	};

	const onPageChange = (page) => {
		if (page < 1 || page > pages.length || activePage === page) return;
		setActivePage(page);
		getProjects(page, filters);
	};

	const addToWatchlist = async (address) => {
		try {
			await http.post("watchlist", { contractAddress: address });
			getProjects(activePage, filters);
			toast.success("Added to watchlist!");
		} catch (error) {
			console.log(error, "error");
			toast.error("Error while adding to watchlist!");
		}
	};

	const removeFromWatchlist = async (address) => {
		try {
			await http.delete("watchlist", { data: { contractAddress: address } });
			getProjects(activePage, filters);
			toast.success("Removed from watchlist!");
		} catch (error) {
			console.log(error, "error");
			toast.error("Error while removing from watchlist!");
		}
	};

	const quickBuyToken = async (contractAddress) => {
		if (!buyDetails.wallet) {
			toast.error("Please choose wallet to buy token!");
			setTx();
			return;
		}
		if (!contractAddress) {
			toast.error("Please choose token to buy!");
			setTx();
			return;
		}
		if (!showBuyModal && buyDetails.wallet?.buySettings?.amount <= 0) {
			toast.error("QuickBuy settings for selected wallet hasn't been configured yet!");
			setTx();
			return;
		}

		let loaderId;
		try {
			loaderId = toast.loading("Sending transaction...");
			setIsTxInProgress(true);

			const res = await http.post(`wallet/quick-buy/${buyDetails.wallet.accountId}/${contractAddress}`);

			console.log(res, "----------- res from quickbuy -----------");

			handleShowTx();
			setTx({ ...tx, hash: res.data.data.transactionHash });

			toast.update(loaderId, {
				render: "Token bought successfully!\n Your token balance will be updated shortly!",
				type: "success",
				isLoading: false,
				autoClose: 5000,
				closeOnClick: true,
				pauseOnHover: true,
			});

			if (showBuyModal) {
				handleCloseBuy();
			}
			// toast.success("Token bought successfully!\n Your token balance will be updated shortly!");
		} catch (error) {
			console.log(error, "error");
			let errMessage;
			if (error.response.data.message === "Insufficient liquidity for this trade!") {
				errMessage = "Insufficient liquidity for this trade!";
			} else if (
				error.response.data.message === "Insufficient funds!" ||
				error.response.data.message === "Insufficient balance!"
			) {
				errMessage = "Insufficient funds!";
			} else {
				errMessage = "Transaction failed!";
			}
			toast.update(loaderId, {
				render: errMessage ?? "Transaction Failed!",
				type: "error",
				isLoading: false,
				autoClose: 5000,
				closeOnClick: true,
				pauseOnHover: true,
			});
		} finally {
			setIsTxInProgress(false);
		}
	};

	const buyToken = async (contractAddress, slippage, amount, quickBuy = true) => {
		// console.log(contractAddress, "contractAddress", slippage, "slippage", amount, "amount");
		// return;
		// console.log(buyDetails, "buyDetails");
		if (!buyDetails.wallet) {
			toast.error("Please choose wallet to buy token!");
			return;
		}
		if (!contractAddress) {
			toast.error("Please choose token to buy!");
			return;
		}
		if (!showBuyModal && quickBuy && buyDetails.wallet?.buySettings?.amount <= 0) {
			toast.error("QuickBuy settings for selected wallet hasn't been configured yet!");
			return;
		}

		let loaderId;
		try {
			loaderId = toast.loading("Sending transaction...");
			setIsTxInProgress(true);

			const res = await http.post(
				`wallet/quick-buy/${buyDetails.wallet.accountId}/${contractAddress}` +
					(slippage ? `?slippage=${slippage}` : "") +
					(quickBuy ? `&quickBuy=${quickBuy}` : "") +
					(!quickBuy ? `&amount=${amount}` : ``) +
					(selectedToken?.maxWallet ? `&maxWallet=${selectedToken.maxWallet}` : ``) +
					(selectedToken?.maxTx ? `&maxTx=${selectedToken.maxTx}` : ``)
			);

			console.log(res, "res");

			toast.update(loaderId, {
				render: "Token bought successfully!\n Your token balance will be updated shortly!",
				type: "success",
				isLoading: false,
				autoClose: 5000,
				closeOnClick: true,
				pauseOnHover: true,
			});

			if (showBuyModal) {
				handleCloseBuy();
			}
			// toast.success("Token bought successfully!\n Your token balance will be updated shortly!");
		} catch (error) {
			console.log(error, "error");
			let errMessage;
			if (error.response.data.message === "Insufficient liquidity for this trade!") {
				errMessage = "Insufficient liquidity for this trade!";
			} else if (
				error.response.data.message === "Insufficient funds!" ||
				error.response.data.message === "Insufficient balance!"
			) {
				errMessage = "Insufficient funds!";
			} else {
				errMessage = "Transaction failed!";
			}
			toast.update(loaderId, {
				render: errMessage ?? "Transaction Failed!",
				type: "error",
				isLoading: false,
				autoClose: 5000,
				closeOnClick: true,
				pauseOnHover: true,
			});
		} finally {
			setIsTxInProgress(false);
		}
		// 	}
		// });
	};

	const fetchPreTxDetails = async (contractAddress, inputAmount, slippage) => {
		console.log(buyDetails.wallet, " ------------ buyDetails.wallet -------------");

		if (!buyDetails.wallet) {
			toast.error("Please choose wallet to buy token!");
			return;
		}
		if (!contractAddress) {
			toast.error("Please choose token to buy!");
			return;
		}
		// if (inputAmount <= 0) {
		// 	toast.error("Input eth amou!");
		// 	return;
		// }

		try {
			const res = await http.get(
				`transaction/details/pre-buy/${buyDetails.wallet?.accountId}/${contractAddress}?slippage=${slippage}&amount=${inputAmount}`
			);

			// console.log(res.data.data, "--------------- PRE TX DETAILS ------------------");

			setSelectedTokenDetails({
				...selectedTokenDetails,
				ether: inputAmount,
				networkFee: res.data.data.networkFee,
				minimumOutput: res.data.data.minimumOutput,
				expectedOutput: res.data.data.expectedOutput,
			});

			setNetworkFee(res.data.data.networkFee);

			if (!isInputChanged) {
				setUnits({
					ONE_ETH_TO_TOKENS: res.data.data.expectedOutput / inputAmount,
					ONE_TOKEN_TO_ETH: inputAmount / res.data.data.expectedOutput,
				});
			}

			return res.data.data;
		} catch (error) {
			console.log(error, "error");
		}
	};

	const getEthPrice = async () => {
		try {
			const res = await http.get("token/price/0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2");

			setEthPrice(res.data.data.price);
			// return res.data.data;
		} catch (error) {
			console.log(error, "error");
		}
	};

	const checkBuyDisabled = () => {
		if (!isInputChanged) {
			console.log(selectedTokenDetails, "selectedTokenDetails");
			if (
				!selectedTokenDetails.ether ||
				!selectedTokenDetails.networkFee ||
				!selectedTokenDetails.minimumOutput ||
				!selectedTokenDetails.expectedOutput ||
				!selectedToken ||
				!selectedWallet ||
				!networkFee ||
				!slippage ||
				selectedTokenDetails.ether <= buyDetails.wallet?.buySettings?.amount
			) {
				return true;
			}
		} else {
			if (
				!inputEtherAmount ||
				inputEtherAmount <= 0 ||
				!outputTokenAmount ||
				outputTokenAmount <= 0 ||
				!selectedToken ||
				!selectedWallet ||
				!networkFee ||
				!slippage ||
				inputEtherAmount <= buyDetails.wallet?.buySettings?.amount
			) {
				return true;
			}
		}

		return false;
	};

	useEffect(() => {
		if (selectedToken && Number(slippage) >= 0.5) {
			const intervalId = setInterval(() => {
				fetchPreTxDetails(
					selectedToken.contractAddress,
					buyDetails.wallet?.buySettings?.amount && buyDetails.wallet?.buySettings?.amount > 0
						? buyDetails.wallet?.buySettings?.amount
						: 0.0001,
					slippage
				);
			}, 10000);

			return () => clearInterval(intervalId);
		}
	}, [selectedToken, selectedWallet]);

	useEffect(() => {
		const newTokenHandler = (project) => {
			// if (activePage === 1) {
			getProjects(activePage, filters);
			// }
			console.log(project, "New token created just now!");
		};
		socket.on("project", newTokenHandler);
		socket.on("token-updated", newTokenHandler);

		return () => {
			socket.off("project", newTokenHandler);
			socket.off("token-updated", newTokenHandler);
		};
	}, [activePage]);

	useEffect(() => {
		if (user) {
			const wallet = user.extendedWallets.find((wallet) => wallet.accountId === selectedWallet);
			setBuyDetails({
				...buyDetails,
				wallet,
			});
		}
	}, [user?.publicAddress, selectedWallet]);

	useEffect(() => {
		console.log("Filters changed so fetching tokens again!");
		getProjects(1, filters);
	}, [isFilterChanged, tags]);

	return (
		<div className="feed-page">
			<div className="gradient-box mb-4">
				<div className="row">
					<div className="col-md-2 col-6 mb-4">
						<label className="CheckBox d-flex align-items-center gap-3">
							<input
								type="checkbox"
								checked={tags.includes("new_pair")}
								onChange={(e) => handleCheckboxChange(e, "new_pair")}
							/>
							<span className="checkmark"></span>
							<span className="fs-13 fw-400 text-white">New Pairs</span>
						</label>
					</div>
					<div className="col-md-2 col-6 mb-4">
						<label className="CheckBox d-flex align-items-center gap-3">
							<input
								type="checkbox"
								checked={tags.includes("scraped_pair")}
								onChange={(e) => handleCheckboxChange(e, "scraped_pair")}
							/>
							<span className="checkmark"></span>
							<span className="fs-13 fw-400 text-white">Scraped Pairs</span>
						</label>
					</div>
					<div className="col-md-2 col-6 mb-4">
						<label className="CheckBox d-flex align-items-center gap-3">
							<input
								type="checkbox"
								checked={tags.includes("momentum_pair")}
								onChange={(e) => handleCheckboxChange(e, "momentum_pair")}
							/>
							<span className="checkmark"></span>
							<span className="fs-13 fw-400 text-white">Momentum Pairs</span>
						</label>
					</div>
					<div className="col-md-2 col-6  mb-4">
						<label className="CheckBox d-flex align-items-center gap-3">
							<input
								type="checkbox"
								checked={tags.includes("trending_pair")}
								onChange={(e) => handleCheckboxChange(e, "trending_pair")}
							/>
							<span className="checkmark"></span>
							<span className="fs-13 fw-400 text-white">Trending Pairs</span>
						</label>
					</div>
					<div className="col-md-2 col-6 mb-4">
						<label className="CheckBox d-flex align-items-center gap-3">
							<input
								type="checkbox"
								checked={tags.includes("hot_launch")}
								onChange={(e) => handleCheckboxChange(e, "hot_launch")}
							/>
							<span className="checkmark"></span>
							<span className="fs-13 fw-400 text-white">Hot Launches</span>
						</label>
					</div>
					<div className="col-md-2 col-6 mb-4">
						<label className="CheckBox d-flex align-items-center gap-3">
							<input
								type="checkbox"
								checked={tags.includes("anticipated_launch")}
								onChange={(e) => handleCheckboxChange(e, "anticipated_launch")}
							/>
							<span className="checkmark"></span>
							<span className="fs-13 fw-400 text-white">Anticipated Launches</span>
						</label>
					</div>
					<div className="col-md-2 col-6 mb-md-0 mb-4">
						<label className="CheckBox d-flex align-items-center gap-3">
							<input
								type="checkbox"
								checked={tags.includes("recently_renounced")}
								onChange={(e) => handleCheckboxChange(e, "recently_renounced")}
							/>
							<span className="checkmark"></span>
							<span className="fs-13 fw-400 text-white">Recently Renounced</span>
						</label>
					</div>
					<div className="col-md-2 col-6 mb-md-0 mb-4">
						<label className="CheckBox d-flex align-items-center gap-3">
							<input
								type="checkbox"
								checked={tags.includes("recently_began_trading")}
								onChange={(e) => handleCheckboxChange(e, "recently_began_trading")}
							/>
							<span className="checkmark"></span>
							<span className="fs-13 fw-400 text-white">Recently Began Trading</span>
						</label>
					</div>
				</div>
			</div>

			<div className="scroll-feed">
				{projects.length > 0 &&
					projects.map((project, index) => {
						return (
							<div key={`Token-${index}`} className="gradient-box mb-4">
								<div className="d-flex  align-items-md-center flex-md-row flex-column gap-md-0 gap-4 justify-content-between mb-4">
									<div className="d-flex flex-wrap align-items-center justify-content-md-start justify-content-between gap-3">
										<div className="fs-26 fw-700 text-white">{getName(project.name)}</div>
										<div className="text-white">$ {project.symbol}</div>
										<div className="d-flex align-items-center gap-3">
											<button type="button" className="btnSecondary text-red gap-2 br-30 h-40">
												<img src="/assets/images/fire.svg" alt="" />
												Hot Launch
											</button>
											{isNewPair(project?.deployedAt) && (
												<button type="button" className="btnSecondary text-blue gap-2 br-30 h-40">
													<img src="/assets/images/info.svg" alt="" />
													New Pair
												</button>
											)}
											{project?.isTradeable && (
												<button type="button" className="btnSecondary text-blue gap-2 br-30 h-40">
													<img src="/assets/images/info.svg" alt="" />
													Tradeable
												</button>
											)}
											{project?.isRenounced && (
												<button type="button" className="btnSecondary text-blue gap-2 br-30 h-40">
													<img src="/assets/images/info.svg" alt="" />
													Renounced
												</button>
											)}
										</div>
									</div>
									<div className="d-flex align-items-center justify-content-md-start justify-content-center gap-2">
										<button
											onClick={() => {
												copy(project.contractAddress);
												toast.success("Address copied to clipboard!");
											}}
											className="social-icon border-0">
											<span className="iconify" data-icon="ph:copy"></span>
										</button>
										<a
											href={"https://etherscan.io/address/" + project.contractAddress}
											className="social-icon"
											target="_blank">
											<span className="iconify" data-icon="icon-park-outline:share"></span>
										</a>
										<a href="javascript:void(0)" className="social-icon">
											<span className="iconify" data-icon="clarity:eye-line"></span>
										</a>
										{project.socialLinks?.length > 0 &&
											project.socialLinks.map((link) => {
												return (
													<a href={link.url} className="social-icon" target="_blank">
														<span
															className="iconify"
															data-icon={
																link.name === "website"
																	? "ph:globe-light"
																	: link.name === "telegram"
																	? "guidance:send"
																	: "basil:twitter-outline"
															}></span>
													</a>
												);
											})}
									</div>
								</div>
								<div className="gradient-box mb-3">
									<div className="tables-grid">
										<div>
											<div className="fs-14 fw-700 text-white mb-2">Deployed</div>
											<div className="fs-14 fw-400 text-grey">{formatDate(new Date(project.deployedAt))}</div>
										</div>
										<div>
											<div className="fs-14 fw-700 text-white mb-2">Buy Tax</div>
											<div className="fs-14 fw-400 text-grey">
												{project.buyTax !== undefined ? project.buyTax + "%" : "N/A"}
											</div>
										</div>
										<div>
											<div className="fs-14 fw-700 text-white mb-2">Sell Tax</div>
											<div className="fs-14 fw-400 text-grey">
												{project.sellTax !== undefined ? project.sellTax + "%" : "N/A"}
											</div>
										</div>
										<div>
											<div className="fs-14 fw-700 text-white mb-2">Total Supply</div>
											<div className="fs-14 fw-400 text-grey">{project.totalSupply ?? "N/A"}</div>
										</div>
										<div>
											<div className="fs-14 fw-700 text-white mb-2">Burnt Supply</div>
											<div className="fs-14 fw-400 text-grey">0</div>
										</div>
										<div>
											<div className="fs-14 fw-700 text-white mb-2">Holder Distribution</div>
											<div
												className={`fs-14 fw-400 text-grey ${
													getHoldersTxt(project.topHolders).length > 20 ? "w-90px" : "w-150px"
												}`}>
												{!project.topHolders
													? "N/A"
													: project.topHolders.length === 0
													? "N/A"
													: getHoldersTxt(project.topHolders)}
											</div>
										</div>
										<div>
											<div className="fs-14 fw-700 text-white mb-2">Block Snipers</div>
											<div className="fs-14 fw-400 text-grey">
												{project.liquidity?.pairAddress ? project.sniperBots?.length : "N/A"}
											</div>
										</div>
									</div>
								</div>
								<div className="gradient-box mb-3">
									<div className="tables-grid">
										<div>
											<div className="fs-14 fw-700 text-white mb-2">Locked</div>
											<div className="fs-14 fw-400 text-grey">
												{project.lockedAmount === undefined
													? "N/A"
													: project.lockedAmount === 0
													? "No Locked Amount!"
													: `UNCX (${
															project.lockedTime ? getTimeLeft(project.lockedTime) : "Unknown Unlock Time"
													  })`}{" "}
												{/* UNCS (6 months) */}
											</div>
										</div>
										<div>
											<div className="fs-14 fw-700 text-white mb-2">Circ. Supply</div>
											<div className="fs-14 fw-400 text-grey">{project.circulatingSupply ?? "N/A"}</div>
										</div>
										<div>
											<div className="fs-14 fw-700 text-white mb-2">Max Buy</div>
											<div className="fs-14 fw-400 text-grey">
												{project.maxTx !== undefined ? getMaxAmount(project.maxTx, project.totalSupply) : "N/A"}
											</div>
										</div>
										<div>
											<div className="fs-14 fw-700 text-white mb-2">Max Wallet</div>
											<div className="fs-14 fw-400 text-grey">
												{project.maxWallet !== undefined ? getMaxAmount(project.maxWallet, project.totalSupply) : "N/A"}
											</div>
										</div>
										<div>
											<div className="fs-14 fw-700 text-white mb-2">Renounced</div>
											<div className={`fs-14 fw-400 ${project.isRenounced ? "text-green" : "text-red"}`}>
												{project.isRenounced ? "TRUE" : "FALSE"}
											</div>
										</div>
										<div>
											<div className="fs-14 fw-700 text-white mb-2">Honey Pot</div>
											<div
												className={`fs-14 fw-400 ${
													project.sellTax === undefined ? "text-grey" : project.sellTax < 50 ? "text-green" : "text-red"
												}`}>
												{project.sellTax === undefined ? "N/A" : project.sellTax >= 50 ? "TRUE" : "FALSE"}
											</div>
										</div>
										<div>
											<div className="fs-14 fw-700 text-white mb-2">Trading</div>
											<div
												className={`fs-14 fw-400 ${
													project.isTradeable === undefined
														? "text-grey"
														: project.isTradeable
														? "text-green"
														: "text-red"
												}`}>
												{project.isTradeable === undefined ? "N/A" : project.isTradeable ? "Enabled" : "Disabled"}
											</div>
										</div>
									</div>
								</div>
								{(project.sellTax >= 50 || project.ownerShare > 5) && (
									<div className="gradient-box mb-3">
										<div className="fs-14 fw-700 text-white mb-3">Red Flags</div>
										<div className="d-flex align-items-center flex-wrap gap-md-5 gap-4">
											{project.sellTax >= 50 && (
												<button className="bg-transparent border-0 text-blue fs-14 fw-400 d-flex align-items-center gap-2">
													<img src="/assets/images/info.svg" alt="" />
													High sell tax
												</button>
											)}
											{project.ownerShare > 5 && (
												<button className="bg-transparent border-0 text-blue fs-14 fw-400 d-flex align-items-center gap-2">
													<img src="/assets/images/info.svg" alt="" />
													Owner holds {">"}5% supply
												</button>
											)}
											{/* <button className="bg-transparent border-0 text-blue fs-14 fw-400 d-flex align-items-center gap-2">
											<img src="/assets/images/info.svg" alt="" />
											Linked to previous scams
										</button> */}
										</div>
									</div>
								)}

								<div className="d-flex align-items-center gap-3 flex-wrap justify-content-md-start justify-content-center">
									<button
										disabled={!user}
										className={
											"btnLightGradient h-50 br-30" +
											(user ? "" : " disabled") +
											(project.watchlist.includes(user?.id) ? " w-235" : " w-202")
										}
										onClick={() => {
											if (project.watchlist.includes(user?.id)) {
												removeFromWatchlist(project.contractAddress);
											} else {
												addToWatchlist(project.contractAddress);
											}
										}}>
										{project.watchlist.includes(user?.id) ? "Remove from Watchlist" : "Add to Watchlist"}
									</button>
									<button
										disabled={!user || !project.isTradeable || !selectedWallet}
										onClick={() => {
											quickBuyToken(project.contractAddress);
											setTx({
												token: project,
											});
										}}
										className={"btnPrimary h-50 br-30 w-202" + (user ? "" : " disabled")}>
										QuickBuy
									</button>
									<button
										disabled={!user || !project.isTradeable || !selectedWallet}
										onClick={() => handleShowBuy(project)}
										className={"btnGradient h-50 br-30 w-202" + (user ? "" : " disabled")}>
										Buy
									</button>
								</div>
							</div>
						);
					})}
			</div>

			{pages.length > 1 && (
				<CustomPagination projects={projects} pages={pages} activePage={activePage} onPageChange={onPageChange} />
			)}

			<Modal className="filter-modal" centered show={txModal} onHide={handleCloseTx}>
				<Modal.Header className="position-relative" closeButton>
					<Modal.Title>
						<div className="fs-26 fw-700 text-white text-center">Buy Receipt</div>
					</Modal.Title>
				</Modal.Header>
				<Modal.Body className="h-auto">
					<div className="mb-4">
						<div className="d-flex flex-wrap align-items-center gap-3 fw-400 text-white">
							<label>
								Successfully bought {buyDetails.wallet?.buySettings?.amount} ETH worth of ${tx?.token?.name}!
							</label>
							<div className="break-word">Tx Hash: {tx?.hash}</div>
						</div>
					</div>
					<div className="text-center">
						<a href={`https://etherscan.io/tx/${tx?.hash}`} target="_blank" className="btnPrimary h-50 br-30 gap-3">
							View on Etherscan <span class="iconify" data-icon="iconoir:arrow-tr"></span>
						</a>
					</div>
				</Modal.Body>
			</Modal>

			{/* BUY MODAL */}
			<Modal className="filter-modal" centered show={showBuyModal} onHide={handleCloseBuy}>
				<Modal.Header className="position-relative" closeButton>
					<Dropdown className="node-dropdown settings noti-drpdown">
						<Dropdown.Toggle id="dropdown-basic">
							<span class="iconify" data-icon="ic:baseline-settings"></span>
						</Dropdown.Toggle>

						<div className="d-flex flex-column align-items-start">
							<Dropdown.Menu className={`${errors.slippage ? "" : "h-200"}`}>
								<div className="d-flex flex-column gap-3 px-2">
									<label className={`text-white fs-18`}>Slippage</label>
									<div className="filter-input w-100 position-relative">
										<div className="fs-14 fw-400 text-white percent-icon">%</div>
										<input
											type="number"
											name="slippage"
											placeholder="0.5"
											className="fs-16 ps-3"
											value={slippage}
											onChange={(e) => changeSlippage(e)}
										/>
									</div>
								</div>
								{errors.slippage && <div className="text-danger px-2 mt-3 fs-12">{errors.slippage}</div>}
								<div className="d-flex px-2 justify-content-end mt-4">
									<button
										disabled={!slippage || Number(slippage) < 0.5 || Number(slippage) > 100}
										onClick={() => {
											fetchPreTxDetails(
												selectedToken.contractAddress,
												isInputChanged
													? inputEtherAmount
													: buyDetails.wallet?.buySettings?.amount && buyDetails.wallet?.buySettings?.amount > 0
													? buyDetails.wallet?.buySettings?.amount
													: 0.0001,
												slippage
											);
											toast.success("Slippage changed!");
										}}
										className={"btnGradient br-30 fs-14 " + (errors.slippage ? "disabled" : "")}>
										OK
									</button>
								</div>
							</Dropdown.Menu>
						</div>
					</Dropdown>
					<Modal.Title className="position-relative">
						<div className="fs-26 fw-700 text-white text-center">Swap Token</div>
					</Modal.Title>
				</Modal.Header>
				<Modal.Body className="h-auto">
					<div className="gradient-box p-3 mb-3">
						<div className="fs-14 text-white mb-2">You pay</div>
						<div class="watch-input position-relative mb-3">
							{/* {console.log(selectedTokenDetails, units, isInputChanged, networkFee)} */}
							<input
								type="number"
								value={isInputChanged ? inputEtherAmount : formatNumber(selectedTokenDetails?.ether, 2)}
								onChange={(e) => {
									setInputEtherAmount(e.target.value);
									setOutputTokenAmount(units.ONE_ETH_TO_TOKENS * Number(e.target.value));
									if (!isInputChanged) {
										setIsInputChanged(true);
									}
								}}
								className="br-5 ps-3"
							/>
							<div class="btnGradient h-50 w-202 text-truncate br-5">ETH</div>
						</div>
						<div class="d-flex justify-content-between">
							<div className="fs-14 text-white">
								{ethPrice && selectedTokenDetails?.ether
									? isInputChanged
										? "$" + (inputEtherAmount * ethPrice).toFixed(4)
										: "$" + (selectedTokenDetails.ether * ethPrice).toFixed(4)
									: "--"}
							</div>
							<div className="fs-14 text-white">Balance: {buyDetails.wallet?.balance}</div>
						</div>
					</div>
					<div className="gradient-box p-3 mb-3">
						<div className="d-flex justify-content-between mb-2">
							<div className="fs-14 text-white mb-2">You receive</div>
							<div className="blue-badge d-flex gap-3">
								<span
									onClick={() => {
										if (!selectedToken?.maxWallet) return;
										if (isMaxTxActive) {
											setIsMaxTxActive(false);
										}
										if (isMaxWalletActive) {
											setIsMaxWalletActive(false);
											console.log(selectedToken);
										} else {
											if (!isInputChanged) {
												setIsInputChanged(true);
											}
											setIsMaxWalletActive(true);
											setOutputTokenAmount(selectedToken?.maxWallet);
											setInputEtherAmount(units.ONE_TOKEN_TO_ETH * selectedToken?.maxWallet);
										}
									}}
									className={
										"badge rounded-pill px-3 py-2" +
										(isMaxWalletActive ? " active" : "") +
										(!selectedToken?.maxWallet ? " disabled" : "")
									}>
									Max Wallet
								</span>
								<span
									onClick={() => {
										if (!selectedToken?.maxTx) return;
										if (isMaxWalletActive) {
											setIsMaxWalletActive(false);
										}
										if (isMaxTxActive) {
											setIsMaxTxActive(false);
											console.log(selectedToken);
										} else {
											if (!isInputChanged) {
												setIsInputChanged(true);
											}
											setIsMaxTxActive(true);
											setOutputTokenAmount(selectedToken?.maxTx);
											setInputEtherAmount(units.ONE_TOKEN_TO_ETH * selectedToken?.maxTx);
										}
									}}
									className={
										"badge rounded-pill px-3 py-2" +
										(isMaxTxActive ? " active" : "") +
										(!selectedToken?.maxTx ? " disabled" : "")
									}>
									Max Transaction
								</span>
							</div>
						</div>
						<div class="watch-input position-relative mb-3">
							<input
								type="number"
								value={isInputChanged ? outputTokenAmount : formatNumber(selectedTokenDetails?.expectedOutput, 2)}
								onChange={(e) => {
									setOutputTokenAmount(e.target.value);
									setInputEtherAmount(units.ONE_TOKEN_TO_ETH * Number(e.target.value));
									if (!isInputChanged) {
										setIsInputChanged(true);
									}
								}}
								className="br-5 ps-3"
							/>
							<div class="btnGradient h-50 w-202 text-truncate br-5">{selectedToken?.symbol}</div>
						</div>
						<div class="d-flex justify-content-end">
							{/* <div className="fs-14 text-white">$0.163</div> */}
							<div className="fs-14 text-white">Balance: {selectedTokenBalance}</div>
						</div>
					</div>

					<div class="accordion accordion-flush mb-3 gradient-box p-0 " id="accordionFlushExample">
						<div class="accordion-item br-5 text-white bg-transparent">
							<h2 class="accordion-header br-5" id="flush-headingOne">
								<button
									class="accordion-button collapsed text-white bg-transparent"
									type="button"
									data-bs-toggle="collapse"
									data-bs-target="#flush-collapseOne"
									aria-expanded="false"
									aria-controls="flush-collapseOne">
									1 {selectedToken?.symbol} ={" "}
									{selectedTokenDetails?.ether / selectedTokenDetails?.expectedOutput > 0.00001
										? formatNumber(selectedTokenDetails?.ether / selectedTokenDetails.expectedOutput, 2)
										: "<0.00001"}{" "}
									ETH
								</button>
							</h2>
							<div
								id="flush-collapseOne"
								class="accordion-collapse collapse"
								aria-labelledby="flush-headingOne"
								data-bs-parent="#accordionFlushExample">
								<div class="accordion-body">
									<div class="d-flex justify-content-between mb-2">
										<div className="fs-14 text-white">Network fees</div>
										<div className="fs-14 text-white">
											{ethPrice && networkFee ? "~$" + (networkFee * ethPrice).toFixed(3) : "--"}
										</div>
									</div>
									<div class="d-flex justify-content-between mb-2">
										<div className="fs-14 text-white">Minimum output</div>
										<div className="fs-14 text-white">
											{isInputChanged
												? outputTokenAmount - outputTokenAmount * (slippage / 100)
												: formatNumber(selectedTokenDetails?.minimumOutput, 2)}{" "}
											{selectedToken?.symbol}
										</div>
									</div>
								</div>
							</div>
						</div>
					</div>

					<div className="text-end">
						{(isInputChanged && inputEtherAmount > buyDetails?.wallet?.balance) ||
						(!isInputChanged && buyDetails.wallet?.buySettings?.amount > buyDetails?.wallet?.balance) ? (
							<button disabled className="btnPrimary h-50 br-30 w-100">
								Insufficient Balance
							</button>
						) : (
							<button
								disabled={checkBuyDisabled() || isTxInProgress}
								onClick={() =>
									quickBuyToken(
										selectedToken?.contractAddress,
										slippage,
										isInputChanged ? inputEtherAmount : buyDetails.wallet?.buySettings?.amount ?? 0.0001,
										false
									)
								}
								className="btnPrimary h-50 br-30 w-100">
								Buy
							</button>
						)}
					</div>
				</Modal.Body>
			</Modal>
		</div>
	);
}
