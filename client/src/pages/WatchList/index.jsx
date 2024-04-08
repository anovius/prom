import React, { useState, useEffect } from "react";

import copy from "copy-to-clipboard";
import { toast } from "react-toastify";
import Badge from "react-bootstrap/Badge";
import Modal from "react-bootstrap/Modal";
import ClipLoader from "react-spinners/ClipLoader";
import { useDispatch, useSelector } from "react-redux";

import http from "../../api";
import { socket } from "../../socket/globalSocket";
import { environment } from "../../constants";
import CustomPagination from "../../components/layout/CustomPagination";

export default function WatchList({ selectedWallet }) {
	const dispatch = useDispatch();
	const user = useSelector((state) => state.user);

	const [watchList, setWatchList] = useState([]);
	const [isAdding, setIsAdding] = useState(false);
	const [address, setAddress] = useState("");
	const [search, setSearch] = useState("");
	const [searchText, setSearchText] = useState("");
	const [pages, setPages] = useState([1]);
	const [activePage, setActivePage] = useState(1);
	const [wallets, setWallets] = useState([]);
	const [buyDetails, setBuyDetails] = useState({
		wallet: "",
		token: "",
	});
	const [tx, setTx] = useState();
	const [txModal, setTxModal] = useState(false);
	const [isTxInProgress, setIsTxInProgress] = useState(false);

	const handleCloseTx = () => {
		setTxModal(false);
		setTx();
	};
	const handleShowTx = () => {
		setTxModal(true);
	};

	const customToFixed = (num) => {
		if (num % 1 === 0) return Math.floor(num);
		return num.toFixed(2);
	};

	const getMaxAmount = (fee, totalSupply) => {
		return `${customToFixed((fee / totalSupply) * 100)}% (${customToFixed(fee)})`;
	};

	const getHoldersTxt = (holders) => {
		return `${holders[0]?.percent + "%" || ""}${holders[1]?.percent ? "-" + holders[1]?.percent + "%" : ""}${
			holders[2]?.percent ? "-" + holders[2]?.percent + "%" : ""
		}`;
	};

	const isNewPair = (time) => {
		const currentDate = new Date();
		const twoDaysAgo = new Date(currentDate);
		twoDaysAgo.setDate(currentDate.getDate() - 2);

		return time > twoDaysAgo;
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
		// getWatchlist(page);
	};

	const addToWatchlist = async (address) => {
		if (!isAdding) {
			setIsAdding(true);
			try {
				await http.post("watchlist?newToken=true", { contractAddress: address });
				getWatchlist(activePage);
				setAddress("");
				toast.success("Token added to watchlist!");
			} catch (error) {
				console.log(error, "error");
				const invalidAddressMsg = "Invalid Address";
				if (error.response.data.message === invalidAddressMsg) {
					toast.error(invalidAddressMsg);
					return;
				}
				toast.error("Error while adding to watchlist!");
			} finally {
				setIsAdding(false);
			}
		}
	};

	const removeFromWatchlist = async (address) => {
		try {
			await http.delete("watchlist", { data: { contractAddress: address } });
			getWatchlist(activePage);
			toast.success("Removed from watchlist!");
		} catch (error) {
			console.log(error, "error");
			toast.error("Error while removing from watchlist!");
		}
	};

	const getWatchlist = async (page, isSearchRemoved) => {
		try {
			if (isSearchRemoved) {
				setSearchText("");
				setSearch("");
			} else {
				setSearchText(search);
			}
			let url = "/watchlist" + (page ? "?page=" + page : "");
			if (!isSearchRemoved) {
				url = url + (search ? "&search=" + search : "");
			}
			const { data } = await http.get(url);
			setWatchList(data.data.tokens);
			setPages(Array.from({ length: data.data.totalPages }, (_, i) => i + 1));
		} catch (error) {
			console.log(error);
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
		if (buyDetails.wallet?.buySettings?.amount <= 0) {
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

	const buyToken = async (contractAddress) => {
		// console.log(buyDetails, "buyDetails");
		if (!buyDetails.wallet) {
			toast.error("Please choose wallet to buy token!");
			return;
		}
		if (!contractAddress) {
			toast.error("Please choose token to buy!");
			return;
		}
		if (buyDetails.wallet?.buySettings?.amount <= 0) {
			toast.error("QuickBuy settings for selected wallet hasn't been configured yet!");
			return;
		}

		try {
			const res = await http.post(`wallet/buy/${buyDetails.wallet.accountId}/${contractAddress}`);

			console.log(res, "res");

			toast.success("Token bought successfully!\n Your token balance will be updated shortly!");
		} catch (error) {
			console.log(error, "error");
			if (error.response.data.message === "Insufficient liquidity for this trade!") {
				toast.error("Insufficient liquidity for this trade!");
			} else if (
				error.response.data.message === "Insufficient funds!" ||
				error.response.data.message === "Insufficient balance!"
			) {
				toast.error("Insufficient funds!");
			} else {
				toast.error("Transaction failed!");
			}
		}
	};

	const getWallets = async () => {
		try {
			const res = await http.get("wallet");

			setWallets(res.data.data);

			const wallet = res.data.data.find((wallet) => wallet.accountId === selectedWallet);
			setBuyDetails({
				...buyDetails,
				wallet,
			});
		} catch (error) {
			console.log(error, "error");
		}
	};

	useEffect(() => {
		if (selectedWallet) {
			getWallets();
		}
	}, [selectedWallet]);

	useEffect(() => {
		if (user) {
			getWatchlist(activePage);

			const tokenHandler = () => {
				getWatchlist(activePage);
				console.log("Token updated just now!");
			};
			socket.on("token-updated", tokenHandler);

			return () => {
				socket.off("token-updated", tokenHandler);
			};
		}
	}, [user?.publicAddress, activePage]);

	return (
		<div className="watch-list-page">
			{!user && <div className="gradient-box text-center text-white">Connect your wallet to see your watchlist</div>}
			{user && (
				<>
					<div className="watch-input position-relative mb-3">
						<input
							type="text"
							placeholder="Enter contract address"
							value={address}
							onChange={(e) => setAddress(e.target.value)}
						/>
						<button
							disabled={!address || isAdding}
							className={"btnGradient h-50 w-202 br-30" + (address ? "" : " disabled")}
							onClick={() => addToWatchlist(address)}>
							{isAdding ? <ClipLoader color="#fff" size={20} /> : "Add"}
						</button>
					</div>

					<div className="watch-input position-relative mb-4">
						<input
							type="text"
							placeholder="Enter keyword"
							className="seacrh-input"
							value={search}
							onChange={(e) => setSearch(e.target.value)}
						/>
						{searchText?.trim().length > 0 && (
							<Badge pill bg="primary" className="search-badge">
								<span className="pe-3 text-hidden">{searchText}</span>

								<button className="cross-profile pointer outline-none border-0" onClick={() => getWatchlist(1, true)}>
									<span className="iconify" data-icon="gridicons:cross-circle"></span>
								</button>
							</Badge>
						)}
						<button
							disabled={search?.trim() === ""}
							className={"btnGradient h-50 w-202 br-30" + (search?.trim() !== "" ? "" : " disabled")}
							onClick={() => getWatchlist(1)}>
							Search
						</button>
					</div>
				</>
			)}
			{user && watchList?.length > 0 && (
				<>
					<div className="watchlist-scroll">
						{watchList.map((project) => {
							return (
								<div className="gradient-box mb-4">
									<div className="d-flex  align-items-md-center flex-md-row flex-column gap-md-0 gap-4 justify-content-between mb-4">
										<div className="d-flex flex-wrap align-items-center justify-content-md-start justify-content-between gap-3">
											<div className="fs-26 fw-700 text-white">{getName(project.name)}</div>
											<div className="text-white">$ {project.symbol}</div>
											<div className="d-flex align-items-center gap-3">
												<button type="button" className="btnSecondary text-red gap-2 br-30 h-40">
													<img src="/assets/images/fire.svg" alt="" />
													Hot Launch
												</button>
												{project?.tags?.pair && isNewPair(project.tags.pair.createdAt) && (
													<button type="button" className="btnSecondary text-blue gap-2 br-30 h-40">
														<img src="/assets/images/info.svg" alt="" />
														New Pair
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
													{project.maxWallet !== undefined
														? getMaxAmount(project.maxWallet, project.totalSupply)
														: "N/A"}
												</div>
											</div>
											<div>
												<div className="fs-14 fw-700 text-white mb-2">Renounced</div>
												<div
													className={`fs-14 fw-400 ${
														project.isRenounced === undefined
															? "text-grey"
															: project.isRenounced
															? "text-green"
															: "text-red"
													}`}>
													{project.isRenounced === undefined ? "N/A" : project.isRenounced ? "TRUE" : "FALSE"}
												</div>
											</div>
											<div>
												<div className="fs-14 fw-700 text-white mb-2">Honey Pot</div>
												<div
													className={`fs-14 fw-400 ${
														project.sellTax === undefined
															? "text-grey"
															: project.sellTax < 50
															? "text-green"
															: "text-red"
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
											disabled={!user || !project.isTradeable || isTxInProgress}
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
											disabled={!user || !project.isTradeable || isTxInProgress}
											className={"btnGradient h-50 br-30 w-202" + (user ? "" : " disabled")}>
											Buy
										</button>
									</div>
								</div>
							);
						})}
					</div>

					{pages.length > 1 && <CustomPagination pages={pages} activePage={activePage} onPageChange={onPageChange} />}
				</>
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
							<label>You've successfully bought ${tx?.token?.name} tokens of amount 0.1 ETH!</label>
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
		</div>
	);
}
