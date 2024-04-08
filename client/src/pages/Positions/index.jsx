import { toast } from "react-toastify";
import React, { useEffect, useState } from "react";
import http from "../../api";
import ClipLoader from "react-spinners/ClipLoader";
import Modal from "react-bootstrap/Modal";
import Swal from "sweetalert2";
import { useDispatch, useSelector } from "react-redux";
import { setUser } from "../../redux/slices/User";
import Button from "react-bootstrap/Button";
import OverlayTrigger from "react-bootstrap/OverlayTrigger";
import SyncLoader from "react-spinners/SyncLoader";
import Tooltip from "react-bootstrap/Tooltip";
import Tab from "react-bootstrap/Tab";
import Tabs from "react-bootstrap/Tabs";
import { socket } from "../../socket";

export default function Positions() {
	const dispatch = useDispatch();
	const user = useSelector((state) => state.user);

	const [isLoading, setIsLoading] = useState(false);
	const [isTxInProgress, setIsTxInProgress] = useState(false);
	const [isPlacingOrder, setIsPlacingOrder] = useState(false);
	const [cancelOrderIndex, setCancelOrderIndex] = useState();

	const [selectedToken, setSelectedToken] = useState(null);
	const [selectedWallet, setSelectedWallet] = useState(null);
	const [selectedWallets, setSelectedWallets] = useState([]);
	const [quote, setQuote] = useState({
		isFetching: false,
		oneEthHoldsAmount: "",
		buyAmount: "",
	});
	const [ordersPlaced, setOrdersPlaced] = useState({});
	const [orderRates, setOrderRates] = useState();
	const [inputETH, setInputETH] = useState("");
	const [isTermsChecked, setIsTermsChecked] = useState(false);
	const [isInputChanged, setIsInputChanged] = useState(false);
	const [selectedPercent, setSelectedPercent] = useState(100);
	const [sellAmount, setSellAmount] = useState("");

	const [showSettingModal, setShowSettingModal] = useState(false);
	const [showPositionModal, setShowPositionModal] = useState(false);
	const [show, setShow] = useState(false);

	const setModalValues = (token, wallet) => {
		setSelectedWallet(wallet);
		setSelectedToken(token);
		setSellAmount(token.amount);
	};

	const resetModalValues = () => {
		setSelectedWallet(null);
		setSelectedToken(null);
		setSellAmount("");
		setSelectedPercent(100);
		setIsTxInProgress(false);
	};

	const handleClose = () => {
		setShow(false);
		resetModalValues();
	};
	const handleShow = (token, wallet) => {
		setModalValues(token, wallet);
		setShow(true);
	};
	const handleShowSettingModal = (token, wallet) => {
		setModalValues(token, wallet);
		setShowSettingModal(true);
	};
	const handleCloseSettingModal = () => {
		setShowSettingModal(false);
		setIsInputChanged(false);
		setIsTermsChecked(false);
		setInputETH("");
		resetModalValues();
	};

	const handleShowPositionModal = (wallet) => {
		setSelectedWallet(wallet);
		setShowPositionModal(true);
	};

	const handleClosePositionModal = () => {
		setSelectedWallet(null);
		setShowPositionModal(false);
	};

	const activeOrders =
		(selectedWallet && ordersPlaced && ordersPlaced[selectedWallet.id]?.filter((order) => order.status === "active")) ||
		[];
	const filledOrders =
		(selectedWallet && ordersPlaced && ordersPlaced[selectedWallet.id]?.filter((order) => order.status === "filled")) ||
		[];
	const cancelledOrders =
		(selectedWallet &&
			ordersPlaced &&
			ordersPlaced[selectedWallet.id]?.filter((order) => order.status === "cancelled")) ||
		[];
	const isAllWalletsSelected = selectedWallets.length === user?.extendedWallets?.length;

	const handleCheckboxChange = (event, wallet) => {
		if (event.target.checked) {
			setSelectedWallets([...selectedWallets, wallet]);
		} else {
			setSelectedWallets(selectedWallets.filter((selectedWallet) => selectedWallet.accountId !== wallet.accountId));
		}
	};

	const formatNumber = (scientificString, decimal) => {
		if (scientificString === undefined || scientificString === "" || isNaN(scientificString)) return "--";

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

	const getTransactions = async (refresh = true, message) => {
		if (refresh) setIsLoading(true);
		try {
			const res = await http.get("wallet/transfers");

			// console.log(res.data.data, "res.data");
			dispatch(setUser({ ...user, extendedWallets: res.data.data }));
			setSelectedWallets(res.data.data);

			const walletSelected = res.data.data.find((wallet) => wallet.accountId === selectedWallet?.accountId);
			if (selectedWallet && walletSelected) setSelectedWallet(walletSelected);

			if (message) toast.success(message);
		} catch (error) {
			console.log(error, "error");
			toast.error("Error while fetching wallets positions!");
		}
		if (refresh) setIsLoading(false);
	};

	const sellTokens = async () => {
		if (!selectedToken) {
			toast.error("Please choose token to sell!");
			return;
		}
		if (!selectedWallet) {
			toast.error("Please choose wallet to sell from!");
			return;
		}
		if (!sellAmount || sellAmount <= 0) {
			toast.error("Please enter valid amount to sell!");
			return;
		}

		let loaderId;
		try {
			loaderId = toast.loading("Sending transaction...");
			setIsTxInProgress(true);

			const res = await http.post(
				`wallet/sell/${selectedWallet.accountId}` +
					(sellAmount ? `?sellAmount=${sellAmount}` : "") +
					(selectedToken?.contractAddress ? `&contractAddress=${selectedToken?.contractAddress}` : "") +
					(selectedToken?.decimals ? `&decimals=${selectedToken?.decimals}` : "")
			);

			console.log(res, "res");

			handleClose();

			toast.update(loaderId, {
				render: "Token sold successfully!\n Your token balance will be updated shortly!",
				type: "success",
				isLoading: false,
				autoClose: 5000,
				closeOnClick: true,
				pauseOnHover: true,
			});

			// getTransactions();

			// if (showBuyModal) {
			// 	handleCloseBuy();
			// }
			// toast.success("Token bought successfully!\n Your token balance will be updated shortly!");
		} catch (error) {
			console.log(error, "error");
			let errMessage;
			if (error.response.data.message === "Insufficient liquidity for this trade!") {
				errMessage = "Insufficient liquidity for this trade!";
			} else if (error.response.data.message === "Insufficient funds for paying gas fee!") {
				errMessage = "Insufficient ETH balance for paying gas fee!";
			} else if (error.response.data.message === "Insufficient liquidity for this trade!") {
				errMessage = "Insufficient liquidity for this trade!";
			} else if (
				error.response.data.message === "Insufficient funds!" ||
				error.response.data.message === "Insufficient balance!"
			) {
				errMessage = "Insufficient funds!";
			} else if (error.response.data.message === "Insufficient funds for paying gas fee for token approval!") {
				errMessage = "Insufficient funds for paying gas fee for token approval!";
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

	const sellAllTokens = async (wallet) => {
		if (!wallet) {
			toast.error("Please choose wallet to sell from!");
			return;
		}

		if (!wallet.tokens || wallet.tokens.length === 0) {
			toast.error("Wallet doesn't hold any token!");
			return;
		}

		let loaderId;
		try {
			loaderId = toast.loading("Sending transaction...");
			setIsTxInProgress(true);

			const res = await http.post(`wallet/sell/all/${wallet.accountId}`);

			console.log(res, "res");

			toast.update(loaderId, {
				render: "Tokens sold successfully!\n Your tokens balance will be updated shortly!",
				type: "success",
				isLoading: false,
				autoClose: 5000,
				closeOnClick: true,
				pauseOnHover: true,
			});

			// getTransactions();
		} catch (error) {
			console.log(error, "error");
			let errMessage;
			if (error.response.data.message === "Insufficient liquidity for this trade!") {
				errMessage = "Insufficient liquidity for this trade!";
			} else if (error.response.data.message === "Insufficient funds for paying gas fee!") {
				errMessage = "Insufficient ETH balance for paying gas fee!";
			} else if (error.response.data.message === "Insufficient liquidity for this trade!") {
				errMessage = "Insufficient liquidity for this trade!";
			} else if (
				error.response.data.message === "Insufficient funds!" ||
				error.response.data.message === "Insufficient balance!"
			) {
				errMessage = "Insufficient funds!";
			} else if (error.response.data.message === "Insufficient funds for paying gas fee for token approval!") {
				errMessage = "Insufficient funds for paying gas fee for token approval!";
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

	const getConfirmation = async (wallet) => {
		Swal.fire({
			title: "Are you sure to sell all your tokens?",
			text: "You won't be able to revert this!",
			icon: "warning",
			showCancelButton: true,
			confirmButtonColor: "#3085d6",
			cancelButtonColor: "#d33",
			confirmButtonText: "Yes, sell them!",
		}).then((result) => {
			if (result.isConfirmed) {
				sellAllTokens(wallet);
			}
		});
	};

	const getPercent = () => {
		if (!selectedToken || !isInputChanged || !quote.buyAmount) return null;

		const newValue = inputETH;

		const oldValue = quote.buyAmount / 10 ** 18;

		// console.log("New Value ==>", newValue, "Old Value ==>", oldValue);

		const percentChange = (newValue / oldValue - 1) * 100;

		return formatNumber(percentChange, 2);
	};

	const getOrders = async () => {
		try {
			const res = await http.get("order");

			setOrdersPlaced(res.data.data);
		} catch (error) {
			console.log(error, "error while fetching orders!");
		}
	};

	const getQuote = async () => {
		if (!selectedToken) return;

		setQuote({ ...quote, isFetching: true });
		try {
			const res = await http.get(
				`token/price-quote/${selectedToken?.contractAddress}/${selectedWallet?.accountId}?amount=${sellAmount}&decimal=${selectedToken?.decimals}`
			);

			const { amountOut } = res.data.data;

			const nativePrice = sellAmount / 10 ** selectedToken?.decimals / (amountOut / 10 ** 18);

			setQuote({
				isFetching: false,
				oneEthHoldsAmount: nativePrice,
				buyAmount: amountOut,
			});
		} catch (error) {
			console.log(error, "error");
			setQuote({ ...quote, isFetching: false });
		}
	};

	const placeOrder = async () => {
		if (!selectedToken) {
			toast.error("Please choose token to sell!");
			return;
		}

		setIsPlacingOrder(true);

		const percentage = getPercent();
		const orderType = percentage === null ? "market" : percentage > 0 ? "tp" : "sl";
		// console.log(orderType, "Placing order...", getPercent());
		// return;

		try {
			const res = await http.post(
				`order/${selectedWallet.accountId}/${selectedToken.contractAddress}?type=${orderType}&decimals=${selectedToken.decimals}`,
				{
					sellAmount: sellAmount,
					buyAmount: isInputChanged ? inputETH * 10 ** 18 : quote.buyAmount,
				}
			);

			getOrders();
			toast.success("Placed order successfully!");
			console.log(res, "res");
		} catch (error) {
			console.log(error, "error");
			toast.error("Failed to place order. Please try again!");
		} finally {
			setIsPlacingOrder(false);
		}
	};

	const cancelOrder = async (orderId, index) => {
		if (!orderId) return;

		setCancelOrderIndex(index);
		try {
			const res = await http.put("/order/cancel/" + orderId);

			getOrders();
			toast.success("Order cancelled!");
		} catch (error) {
			console.log(error);
			toast.error("Failed to cancel an order!");
		} finally {
			setCancelOrderIndex();
		}
	};

	useEffect(() => {
		if (showSettingModal && selectedToken) {
			getQuote();
		}
	}, [sellAmount]);

	const orderHandler = async (orders) => {
		if (!user) return;

		// console.log("\n\n---------- ✍️ ✍️ ✍️ ---------- \n      Orders Received \n---------- ✍️ ✍️ ✍️ ----------", orders);

		setOrderRates(orders);
	};

	useEffect(() => {
		if (user && socket) {
			getOrders();

			socket.on("order_rates", orderHandler);

			return () => {
				socket.off("order_rates");
			};
		}
	}, [socket.connected, user?.publicAddress]);

	useEffect(() => {
		if (user) {
			// console.log("Users wallets has changed so updating position wallets too!");
			setSelectedWallets(user.extendedWallets);

			const walletSelected = user.extendedWallets.find((wallet) => wallet.accountId === selectedWallet?.accountId);
			if (selectedWallet && walletSelected) setSelectedWallet(walletSelected);
		}
	}, [user?.extendedWallets]);

	return (
		<>
			{!user ? (
				<div className="gradient-box text-center text-white">
					Connect your wallet to see your imported and created wallets positions
				</div>
			) : (
				<>
					{isLoading ? (
						<div className="position-page">
							<div className="d-flex justify-content-center align-items-center h-100">
								<ClipLoader color="#6c7582" size={70} />
							</div>
						</div>
					) : (
						<>
							{user?.extendedWallets && user?.extendedWallets.length === 0 ? (
								<div className="position-page">
									<div className="gradient-box text-center text-white">
										You've not created or imported any wallet yet.
									</div>
								</div>
							) : (
								<div className="position-page">
									<div className="gradient-box mb-4 pb-0 wallets-header">
										<div className="row align-items-center">
											{user?.extendedWallets.map((wallet) => (
												<div className="col-md-2 col-6 mb-4">
													<label className="CheckBox d-flex align-items-center gap-3">
														<input type="checkbox" defaultChecked onChange={(e) => handleCheckboxChange(e, wallet)} />
														<span className="checkmark"></span>
														<span className="fs-13 fw-400 text-white">{wallet.accountId}</span>
													</label>
												</div>
											))}
										</div>
									</div>
									<div className="position-scroll">
										{isAllWalletsSelected
											? user?.extendedWallets.map((wallet) => (
													<div className="gradient-box mb-4">
														<div className="d-flex justify-content-between">
															<div className="fs-26 fw-700 text-white mb-3">{wallet.accountId}</div>
															<div className="fs-26 fw-700 text-white mb-3 d-flex gap-2">
																{ordersPlaced && ordersPlaced?.[wallet.id] && ordersPlaced[wallet.id]?.length > 0 && (
																	<button
																		onClick={() => handleShowPositionModal(wallet)}
																		className="btnPrimary br-30 gap-2">
																		Positions {ordersPlaced[wallet.id]?.length}
																	</button>
																)}
																{wallet.tokens?.length > 0 && (
																	<button
																		disabled={isTxInProgress}
																		onClick={() => getConfirmation(wallet)}
																		className="btnDanger br-30 gap-2">
																		Sell All
																	</button>
																)}
															</div>
														</div>
														<div className="gradient-box mb4">
															{wallet.tokens?.length > 0 ? (
																<>
																	<div className=" mb-4">
																		<div>
																			<div className="table-responsive">
																				<table className="table table-borderless ">
																					<thead>
																						<tr>
																							<th className="text-center fs-14 fw-700 text-white"> Name</th>
																							<th className="text-center fs-14 fw-700 text-white">Contract</th>
																							<th className="text-center fs-14 fw-700 text-white">Buy Price</th>
																							<th className="text-center fs-14 fw-700 text-white">Buy Amount</th>
																							<th className="text-center fs-14 fw-700 text-white">Current Price</th>
																							<th className="text-center fs-14 fw-700 text-white">Profit</th>
																							<th className="text-center fs-14 fw-700 text-white">Action</th>
																							<th className="text-center fs-14 fw-700 text-white">Settings</th>
																						</tr>
																					</thead>
																					<tbody>
																						{wallet.tokens.map((token) => (
																							<tr>
																								<td className="text-center fs-14 fw-400 text-grey"> {token.name}</td>
																								<td className="text-center fs-14 fw-400 text-grey">
																									{token.contractAddress.slice(0, 6) +
																										"..." +
																										token.contractAddress.slice(-4)}
																								</td>
																								<td className="text-center fs-14 fw-400 text-grey">
																									{token.buyPrice?.toFixed(7) ?? "Calculating"}
																								</td>
																								<td className="text-center fs-14 fw-400 text-grey">
																									{(token.amount / 10 ** token.decimals).toFixed(4)}
																								</td>
																								<td className="text-center fs-14 fw-400 text-grey">
																									{token.price ? `$${token.price.toFixed(7)}` : "Unavailable"}
																								</td>
																								<td
																									className={
																										"text-center fs-14 fw-400 " +
																										(token.profit !== undefined && token.profit > 0
																											? "text-green"
																											: token.profit !== undefined && token.profit < 0
																											? "text-red"
																											: "text-grey")
																									}>
																									{/* {token.profit !== undefined ? "$" + token.profit.toFixed(2) : "Calculating"} */}
																									{token.profit !== undefined
																										? token.profit >= 0
																											? "$" + token.profit.toFixed(2)
																											: "-$" + Math.abs(token.profit).toFixed(2)
																										: "Calculating"}
																								</td>
																								<td className="text-center fs-14 fw-400 text-grey">
																									<button
																										className="btnDanger br-30 gap-2 py-1 px-3"
																										onClick={() => handleShow(token, wallet)}>
																										Sell
																									</button>
																								</td>
																								<td className="text-center fs-14 fw-400 text-grey">
																									<button
																										className="border-0 bg-transparent text-white fs-20"
																										onClick={() => handleShowSettingModal(token, wallet)}>
																										<span class="iconify" data-icon="tabler:settings"></span>
																									</button>
																								</td>
																							</tr>
																						))}
																					</tbody>
																				</table>
																			</div>
																		</div>
																	</div>
																</>
															) : (
																<div className="text-center text-white">Wallet doesn't hold any token yet.</div>
															)}
														</div>
													</div>
											  ))
											: selectedWallets.map((wallet) => (
													<div className="gradient-box mb-4">
														<div className="d-flex justify-content-between">
															<div className="fs-26 fw-700 text-white mb-3">{wallet.accountId}</div>
															{wallet.tokens?.length > 0 && (
																<div className="fs-26 fw-700 text-white mb-3 d-flex gap-2">
																	{ordersPlaced && ordersPlaced?.[wallet.id] && ordersPlaced[wallet.id]?.length > 0 && (
																		<button
																			onClick={() => handleShowPositionModal(wallet)}
																			className="btnPrimary br-30 gap-2">
																			Positions {ordersPlaced[wallet.id]?.length}
																		</button>
																	)}
																	<button
																		disabled={isTxInProgress}
																		onClick={() => getConfirmation(wallet)}
																		className="btnDanger br-30 gap-2">
																		Sell All
																	</button>
																</div>
															)}
														</div>
														<div className="gradient-box mb4">
															{wallet.tokens?.length > 0 ? (
																<>
																	<div className=" mb-4">
																		<div>
																			<div className="table-responsive">
																				<table className="table table-borderless ">
																					<thead>
																						<tr>
																							<th className="text-center fs-14 fw-700 text-white"> Name</th>
																							<th className="text-center fs-14 fw-700 text-white">Contract</th>
																							<th className="text-center fs-14 fw-700 text-white">Buy Price</th>
																							<th className="text-center fs-14 fw-700 text-white">Buy Amount</th>
																							<th className="text-center fs-14 fw-700 text-white">Current Price</th>
																							<th className="text-center fs-14 fw-700 text-white">Profit</th>
																							<th className="text-center fs-14 fw-700 text-white">Action</th>
																							<th className="text-center fs-14 fw-700 text-white">Settings</th>
																						</tr>
																					</thead>
																					<tbody>
																						{wallet.tokens.map((token) => (
																							<tr>
																								<td className="text-center fs-14 fw-400 text-grey"> {token.name}</td>
																								<td className="text-center fs-14 fw-400 text-grey">
																									{token.contractAddress.slice(0, 6) +
																										"..." +
																										token.contractAddress.slice(-4)}
																								</td>
																								<td className="text-center fs-14 fw-400 text-grey">
																									{token.buyPrice?.toFixed(7) ?? "Calculating"}
																								</td>
																								<td className="text-center fs-14 fw-400 text-grey">
																									{(token.amount / 10 ** token.decimals).toFixed(4)}
																								</td>
																								<td className="text-center fs-14 fw-400 text-grey">
																									{token.price ? `$${token.price.toFixed(7)}` : "Unavailable"}
																								</td>
																								<td
																									className={
																										"text-center fs-14 fw-400 " +
																										(token.profit !== undefined && token.profit > 0
																											? "text-green"
																											: token.profit !== undefined && token.profit < 0
																											? "text-red"
																											: "text-grey")
																									}>
																									{/* {token.profit !== undefined ? "$" + token.profit.toFixed(2) : "Calculating"} */}
																									{token.profit !== undefined
																										? token.profit >= 0
																											? "$" + token.profit.toFixed(2)
																											: "-$" + Math.abs(token.profit).toFixed(2)
																										: "Calculating"}
																								</td>
																								<td className="text-center fs-14 fw-400 text-grey">
																									<button
																										className="btnDanger br-30 gap-2 py-1 px-3"
																										onClick={() => handleShow(token, wallet)}>
																										Sell
																									</button>
																								</td>
																								<td className="text-center fs-14 fw-400 text-grey">
																									<button
																										className="border-0 bg-transparent text-white fs-20"
																										onClick={() => handleShowSettingModal(token, wallet)}>
																										<span class="iconify" data-icon="tabler:settings"></span>
																									</button>
																								</td>
																							</tr>
																						))}
																					</tbody>
																				</table>
																			</div>
																		</div>
																	</div>
																</>
															) : (
																<div className="text-center text-white">Wallet doesn't hold any token yet.</div>
															)}
														</div>
													</div>
											  ))}
									</div>
								</div>
							)}
						</>
					)}
				</>
			)}

			{/* Modal for Selling Tokens */}
			<Modal className="filter-modal" centered show={show} onHide={handleClose} backdrop="static" keyboard={false}>
				<Modal.Header className="position-relative" closeButton>
					<Modal.Title>
						<div className="fs-26 fw-700 text-white text-center">Sell Tokens</div>
					</Modal.Title>
				</Modal.Header>
				<Modal.Body className="h-auto">
					<div className="gradient-box p-3 mb-3">
						<div className="fs-14 text-white mb-2">You sell</div>
						<div class="watch-input position-relative mb-3">
							<input
								type="number"
								disabled
								value={sellAmount ? formatNumber(sellAmount / 10 ** selectedToken?.decimals, 2) : ""}
								className="br-5 ps-3"
							/>
							<div class="btnGradient h-50 w-202 text-truncate br-5">{selectedToken?.symbol}</div>
						</div>
						<div class="d-flex justify-content-end mb-3">
							<div className="fs-14 text-white">
								Balance: {sellAmount ? formatNumber(selectedToken?.amount / 10 ** selectedToken?.decimals, 2) : ""}
							</div>
						</div>
						<div className="d-flex justify-content-center align-items-center gap-2">
							<button
								type="button"
								onClick={() => {
									setSelectedPercent(25);
									setSellAmount(BigInt(selectedToken?.amount * 0.25).toString());
								}}
								className={"percent-btn" + (selectedPercent === 25 ? " selected" : "")}>
								25%
							</button>
							<button
								type="button"
								onClick={() => {
									setSelectedPercent(50);
									setSellAmount(BigInt(selectedToken?.amount * 0.5).toString());
								}}
								className={"percent-btn" + (selectedPercent === 50 ? " selected" : "")}>
								50%
							</button>
							<button
								type="button"
								onClick={() => {
									setSelectedPercent(75);
									setSellAmount(BigInt(selectedToken?.amount * 0.75).toString());
								}}
								className={"percent-btn" + (selectedPercent === 75 ? " selected" : "")}>
								75%
							</button>
							<button
								type="button"
								onClick={() => {
									setSelectedPercent(100);
									setSellAmount(selectedToken?.amount);
								}}
								className={"percent-btn" + (selectedPercent === 100 ? " selected" : "")}>
								100%
							</button>
						</div>
					</div>
					<div className="text-end">
						<button disabled={isTxInProgress} onClick={sellTokens} className="btnPrimary h-50 br-30 w-100">
							Sell
						</button>
					</div>
				</Modal.Body>
			</Modal>

			{/* Modal for Placing Limit Order */}
			<Modal
				className="filter-modal"
				centered
				show={showSettingModal}
				onHide={handleCloseSettingModal}
				backdrop="static"
				keyboard={false}>
				<Modal.Header className="position-relative" closeButton>
					<Modal.Title>
						<div className="fs-26 fw-700 text-white text-center">Set Limit Order</div>
					</Modal.Title>
				</Modal.Header>
				<Modal.Body className="h-auto">
					<div className="gradient-box p-3 mb-3">
						<div className="fs-14 text-white mb-2">You sell</div>
						<div class="watch-input position-relative mb-3">
							<input
								type="number"
								disabled
								value={sellAmount ? formatNumber(sellAmount / 10 ** selectedToken?.decimals, 2) : ""}
								className="br-5 ps-3"
							/>
							<div class="btnGradient h-50 w-202 text-truncate br-5">{selectedToken?.symbol}</div>
						</div>
						<div class="d-flex justify-content-end">
							<div className="fs-14 text-white">
								Balance: {sellAmount ? formatNumber(selectedToken?.amount / 10 ** selectedToken?.decimals, 2) : ""}
							</div>
						</div>
						<div className="fs-14 text-white mb-2">You buy</div>
						<div class="watch-input position-relative mb-3">
							<input
								type="number"
								onChange={(e) => {
									setIsInputChanged(true);
									setInputETH(e.target.value);
								}}
								value={
									quote.buyAmount && !isInputChanged
										? formatNumber(quote.buyAmount / 10 ** 18, 5)
										: isInputChanged
										? inputETH
										: ""
								}
								className="br-5 ps-3"
							/>
							<div class="btnGradient h-50 w-202 text-truncate br-5">ETH</div>
						</div>
						<div class="d-flex justify-content-between mb-3">
							<div className="fs-14 text-white">
								1 ETH = {formatNumber(quote?.oneEthHoldsAmount, 2)} {selectedToken?.symbol}
							</div>
							<div className="fs-14 text-white">Balance: {selectedWallet?.balance} </div>
						</div>
						<div className="d-flex justify-content-between align-items-center gap-2">
							<button
								type="button"
								onClick={() => {
									setIsInputChanged(false);
									setSelectedPercent(25);
									setSellAmount(BigInt(selectedToken?.amount * 0.25).toString());
								}}
								className={"percent-btn" + (selectedPercent === 25 ? " selected" : "")}>
								25%
							</button>
							<button
								type="button"
								onClick={() => {
									setIsInputChanged(false);
									setSelectedPercent(50);
									setSellAmount(BigInt(selectedToken?.amount * 0.5).toString());
								}}
								className={"percent-btn" + (selectedPercent === 50 ? " selected" : "")}>
								50%
							</button>
							<button
								type="button"
								onClick={() => {
									setIsInputChanged(false);
									setSelectedPercent(75);
									setSellAmount(BigInt(selectedToken?.amount * 0.75).toString());
								}}
								className={"percent-btn" + (selectedPercent === 75 ? " selected" : "")}>
								75%
							</button>
							<button
								type="button"
								onClick={() => {
									setIsInputChanged(false);
									setSelectedPercent(100);
									setSellAmount(selectedToken?.amount);
								}}
								className={"percent-btn" + (selectedPercent === 100 ? " selected" : "")}>
								100%
							</button>
						</div>

						<div className="d-flex align-items-baseline gap-2 text-white mt-3">
							<input type="checkbox" onChange={(e) => setIsTermsChecked(e.target.checked)} name="" id="order-check" />
							<label htmlFor="order-check">
								By selecting this, I agree that even if the price reaches the specified limit, there is no guarantee
								that my order will be fulfilled.{" "}
								<a
									className="ps-2 text-blue"
									href="https://help.1inch.io/en/articles/4656415-how-to-place-a-limit-order-on-1inch#h_f072c0b9ed"
									target="_blank">
									Learn More..
								</a>
							</label>
						</div>
					</div>
					<div className="text-end">
						<button
							disabled={quote.isFetching || isPlacingOrder || !isTermsChecked}
							onClick={placeOrder}
							className={
								"d-flex align-items-center gap-2 h-50 br-30 w-100 " +
								(isInputChanged && quote.buyAmount > inputETH * 10 ** 18 ? "btnDanger" : "btnPrimary")
							}>
							{isPlacingOrder && <ClipLoader color="#fff" size={20} />}
							Sell SAND at rate ({getPercent() || 0}%)
						</button>
					</div>
				</Modal.Body>
			</Modal>

			{/* Modal for Open Positions */}
			<Modal
				className="position-modal"
				centered
				show={showPositionModal}
				onHide={handleClosePositionModal}
				backdrop="static"
				keyboard={false}>
				<Modal.Header className="position-relative" closeButton>
					<Modal.Title>
						<div className="fs-26 fw-700 text-white text-center">Positions</div>
					</Modal.Title>
				</Modal.Header>
				<Modal.Body className="h-auto">
					<Tabs defaultActiveKey="open" id="uncontrolled-tab-example" className="mb-3 tabs-mains">
						<Tab eventKey="open" title="Open">
							<div className="gradient-box table-sc p-3 mb-3">
								{activeOrders.length === 0 ? (
									<div className="text-center text-white">No active orders found!</div>
								) : (
									<div class="table-responsive ">
										<table class="table table-borderless ">
											<thead>
												<tr>
													<th class="text-center fs-14 fw-700 text-white"> You Sell</th>
													<th class="text-center fs-14 fw-700 text-white">You Buy</th>
													<th class="text-center fs-14 fw-700 text-white">Sell Rate</th>
													<th class="text-center fs-14 fw-700 text-white">Current Rate</th>
													<th class="text-center fs-14 fw-700 text-white">Action</th>
												</tr>
											</thead>
											<tbody>
												{activeOrders?.map((order, index) => (
													<tr>
														<td class="text-center fs-14 fw-400 text-grey">
															{" "}
															{formatNumber(order.sellAmount / 10 ** order.sellTokenDecimals, 2)}{" "}
															{order.sellTokenSymbol}
														</td>
														<td class="text-center fs-14 fw-400 text-grey">
															{formatNumber(order.buyAmount / 10 ** order.sellTokenDecimals, 4)} ETH
														</td>
														<td class="text-center fs-14 fw-400 text-grey">
															1 {order.sellTokenSymbol} = {formatNumber(order.buyAmount / order.sellAmount, 4)} ETH
														</td>
														<td class="text-center fs-14 fw-400 text-grey">
															{orderRates?.[order.id]
																? `1 ${order.sellTokenSymbol} = ${formatNumber(
																		orderRates[order.id] / order.sellAmount,
																		4
																  )} ETH`
																: "--"}
														</td>
														<td class="text-center fs-14 fw-400 text-grey">
															{cancelOrderIndex === index ? (
																<div>
																	<SyncLoader color="#36d7b7" size={8} speedMultiplier={0.5} />
																</div>
															) : (
																<OverlayTrigger overlay={<Tooltip id="tooltip-disabled">Cancel</Tooltip>}>
																	<span className="d-inline-block">
																		<button onClick={() => cancelOrder(order.id, index)} className="position-action">
																			<span class="iconify" data-icon="basil:cross-outline"></span>
																		</button>
																	</span>
																</OverlayTrigger>
															)}
														</td>
													</tr>
												))}
											</tbody>
										</table>
									</div>
								)}
							</div>
						</Tab>
						<Tab eventKey="closed" title="Cancelled">
							<div className="gradient-box table-sc p-3 mb-3">
								{cancelledOrders.length === 0 ? (
									<div className="text-center text-white">No cancelled orders found!</div>
								) : (
									<div class="table-responsive ">
										<table class="table table-borderless ">
											<thead>
												<tr>
													<th class="text-center fs-14 fw-700 text-white"> You Sell</th>
													<th class="text-center fs-14 fw-700 text-white">You Buy</th>
													<th class="text-center fs-14 fw-700 text-white">Sell Rate</th>
													{/* <th class="text-center fs-14 fw-700 text-white">Filled</th> */}
													<th class="text-center fs-14 fw-700 text-white">Action</th>
												</tr>
											</thead>
											<tbody>
												{cancelledOrders?.map(
													(order, index) =>
														order.status === "cancelled" && (
															<tr>
																<td class="text-center fs-14 fw-400 text-grey">
																	{" "}
																	{formatNumber(order.sellAmount / 10 ** order.sellTokenDecimals, 2)}{" "}
																	{order.sellTokenSymbol}
																</td>
																<td class="text-center fs-14 fw-400 text-grey">
																	{formatNumber(order.buyAmount / 10 ** order.sellTokenDecimals, 7)} ETH
																</td>
																<td class="text-center fs-14 fw-400 text-grey">
																	1 {order.sellTokenSymbol} = {formatNumber(order.buyAmount / order.sellAmount, 3)} ETH
																</td>
																{/* <td class="text-center fs-14 fw-400 text-grey">{order.orderFilled} %</td> */}
																<td class="text-center fs-14 fw-400 text-grey">Cancelled</td>
															</tr>
														)
												)}
											</tbody>
										</table>
									</div>
								)}
							</div>
						</Tab>
						<Tab eventKey="filled" title="Filled">
							<div className="gradient-box table-sc p-3 mb-3">
								{filledOrders.length === 0 ? (
									<div className="text-center text-white">No filled orders found!</div>
								) : (
									<div class="table-responsive ">
										<table class="table table-borderless ">
											<thead>
												<tr>
													<th class="text-center fs-14 fw-700 text-white"> You Sell</th>
													<th class="text-center fs-14 fw-700 text-white">You Buy</th>
													<th class="text-center fs-14 fw-700 text-white">Sell Rate</th>
													{/* <th class="text-center fs-14 fw-700 text-white">Filled</th> */}
													<th class="text-center fs-14 fw-700 text-white">Action</th>
												</tr>
											</thead>
											<tbody>
												{filledOrders?.map(
													(order, index) =>
														order.status === "filled" && (
															<tr>
																<td class="text-center fs-14 fw-400 text-grey">
																	{" "}
																	{formatNumber(order.sellAmount / 10 ** order.sellTokenDecimals, 2)}{" "}
																	{order.sellTokenSymbol}
																</td>
																<td class="text-center fs-14 fw-400 text-grey">
																	{formatNumber(order.buyAmount / 10 ** order.sellTokenDecimals, 7)} ETH
																</td>
																<td class="text-center fs-14 fw-400 text-grey">
																	1 {order.sellTokenSymbol} = {formatNumber(order.buyAmount / order.sellAmount, 3)} ETH
																</td>
																{/* <td class="text-center fs-14 fw-400 text-grey">{order.orderFilled} %</td> */}
																<td class="d-flex gap-1 justify-content-center align-items-center fs-14 fw-400">
																	<a
																		className="text-blue d-flex align-items-center gap-1"
																		href={"https://etherscan.io/tx/" + order.executedTrades[0]?.hash}
																		target="_blank">
																		Filled<span class="iconify" data-icon="iconoir:arrow-tr"></span>
																	</a>
																</td>
															</tr>
														)
												)}
											</tbody>
										</table>
									</div>
								)}
							</div>
						</Tab>
					</Tabs>
				</Modal.Body>
			</Modal>
		</>
	);
}
