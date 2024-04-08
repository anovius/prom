import React, { useEffect, useState } from "react";
import { toast } from "react-toastify";
import Modal from "react-bootstrap/Modal";
import copy from "copy-to-clipboard";
import http from "../../api";
import Swal from "sweetalert2";
import Web3 from "web3";
import CryptoJS from "crypto-js";
import { useAccount, useSignMessage } from "wagmi";
import { useDispatch, useSelector } from "react-redux";
import { setUser, login, logout } from "../../redux/slices/User";
import ClipLoader from "react-spinners/ClipLoader";
const { VITE_SECRET_KEY } = import.meta.env;
let web3 = new Web3(window.ethereum);

export default function Wallets({ setBuyWallet }) {
	const dispatch = useDispatch();
	const user = useSelector((state) => state.user);

	const { isConnected } = useAccount();
	const { signMessageAsync } = useSignMessage();

	const [privateKey, setPrivateKey] = useState("");
	const [privateAddress, setPrivateAddress] = useState("");
	const [value, setValue] = useState("");
	const [buySettings, setBuySettings] = useState({
		amount: "",
		slippage: "",
	});
	const [isLoadingWallets, setIsLoadingWallets] = useState(false);
	const [selectedWallet, setSelectedWallet] = useState("");
	const [deleteWalletAddress, setDeleteWalletAddress] = useState("");
	const [showDeleteModal, setShowDeleteModal] = useState(false);
	const [showKeyModal, setShowKeyModal] = useState(false);
	const [showBuyModal, setShowBuyModal] = useState(false);
	const [show, setShow] = useState(false);
	const handleClose = () => {
		setPrivateKey("");
		setShow(false);
	};
	const handleCloseKey = () => {
		setPrivateAddress("");
		setShowKeyModal(false);
	};
	const handleCloseBuy = () => {
		setShowBuyModal(false);
		setBuySettings({
			amount: "",
			slippage: "",
		});
		setSelectedWallet("");
	};
	const handleCloseDelete = () => {
		setShowDeleteModal(false);
	};
	const handleShow = () => setShow(true);
	const handleShowKey = () => setShowKeyModal(true);
	const handleShowBuy = () => setShowBuyModal(true);
	const handleShowDelete = (address) => {
		setShowDeleteModal(true);
		setDeleteWalletAddress(address);
	};

	const signMessage = async (address, message) => {
		try {
			let signature;
			if (isConnected) {
				signature = await signMessageAsync(message);
			} else {
				signature = await web3.eth.personal.sign(message, address, "");
			}
			return signature;
		} catch (error) {
			console.log(error);
			toast.error("You've to sign the message to get your private key");
		}
	};

	const requestKey = async (address) => {
		try {
			const res = await http.get("wallet/request/key");
			const message = `I am requesting my private key by signing with one-time nonce: ${res.data.data}`;
			const signature = await signMessage(user.publicAddress, message);

			if (signature) {
				getPrivateKey(address, signature);
			}
		} catch (error) {
			console.log(error, "error");
		}
	};

	const getPrivateKey = async (address, signature) => {
		try {
			const res = await http.get("wallet/key/" + address + "/" + signature);

			const bytes = CryptoJS.AES.decrypt(res.data.data, VITE_SECRET_KEY);
			const key = bytes.toString(CryptoJS.enc.Utf8);

			setPrivateAddress(key);
			handleShowKey();
		} catch (error) {
			console.log(error, "error");
			toast.error("Couldn't get private key!");
		}
	};

	const changeAccIdEditable = (index, isEditable) => {
		const newWallets = [...user.extendedWallets];
		const updatedWallet = { ...newWallets[index] };

		updatedWallet.isEditable = isEditable;
		newWallets[index] = updatedWallet;

		if (isEditable) {
			setValue(updatedWallet.accountId);
		}

		dispatch(setUser({ ...user, extendedWallets: newWallets }));
	};

	const importWallet = async () => {
		if (!user) return;

		try {
			const res = await http.post("wallet/import", { privateKey });

			setIsLoadingWallets(true);
			getWallets();
			toast.success("Wallet imported successfully");
			handleClose();
		} catch (error) {
			console.log(error, "error");

			if (error.response?.data?.message === "You can't import your main wallet") {
				toast.error("You can't import your main wallet!");
				setPrivateKey("");
			}

			if (
				error.response?.data?.message ===
				"InvalidPrivateKeyError: Invalid Private Key, Not a valid string or uint8Array"
			) {
				toast.error("Invalid Private Key!");
			}
		}
	};

	const createWallet = async () => {
		if (!user) return;

		try {
			const res = await http.post("wallet/create");

			setIsLoadingWallets(true);
			getWallets();
			toast.success("Wallet created successfully");
		} catch (error) {
			console.log(error, "error");
		}
	};

	const deleteWallet = async () => {
		if (deleteWalletAddress) {
			try {
				const res = await http.delete("wallet/delete/" + deleteWalletAddress);

				dispatch(setUser({ ...user, extendedWallets: res.data.data }));
				handleCloseDelete();
				toast.success("Wallet deleted successfully!");
			} catch (error) {
				console.log(error, "error");
			}
		}
	};

	const getWallets = async () => {
		if (!user) return;

		const isWalletBeingEdited = user.extendedWallets.find((wallet) => wallet.isEditable);

		if (isWalletBeingEdited) {
			console.log("Wallet is being edited, so not refreshing wallets");
			return;
		}
		console.log("Refreshing wallets with their balances...");

		try {
			const res = await http.get("wallet");

			if (res.data.data.length > 0) {
				const selectedWallet = localStorage.getItem("selectedWallet");
				const foundWallet = res.data.data.find((wallet) => wallet.accountId === selectedWallet);

				if (!foundWallet) {
					localStorage.removeItem("selectedWallet");
					setBuyWallet(res.data.data[0].accountId);
					localStorage.setItem("selectedWallet", res.data.data[0].accountId);
				} else {
					setBuyWallet(selectedWallet);
				}
			}

			const updatedWallets = res.data.data.map((wallet) => {
				wallet.isEditable = false;
				return wallet;
			});
			dispatch(setUser({ ...user, extendedWallets: updatedWallets }));
		} catch (error) {
			console.log(error, "error");
		} finally {
			setIsLoadingWallets(false);
		}
	};

	const handleChange = (e) => {
		const inputValue = e.target.value;
		const alphanumericRegex = /^[a-zA-Z0-9 ]*$/;

		if (alphanumericRegex.test(inputValue)) {
			setValue(inputValue);
		}
	};

	const handleIdChange = async (accountId, updatedId) => {
		try {
			const res = await http.post("wallet/update/" + accountId, { updatedId });
			setIsLoadingWallets(true);
			getWallets();
			toast.success("Wallet ID updated successfully");
		} catch (error) {
			console.log(error, "error");
			if (error.response?.data?.message === "This id is already assigned to another wallet") {
				toast.error("Wallet ID already assigned!");
			} else {
				toast.error("Couldn't update Wallet ID!");
			}
		}
	};

	const saveId = (index) => {
		changeAccIdEditable(index, false);
		if (user.extendedWallets[index].accountId === value || value === "") {
			return;
		}
		handleIdChange(user.extendedWallets[index].accountId, value);
	};

	const handleKeyDown = (event, index) => {
		if (event.key === "Escape") {
			changeAccIdEditable(index, false);
		}

		if (event.key === "Enter") {
			saveId(index);
		}
	};

	const isSettingsDisabled = () => {
		if (Number(buySettings.amount) <= 0 || (buySettings.slippage !== "" && Number(buySettings.slippage) < 0.5)) {
			return true;
		}
		return false;
	};

	const setSettings = async () => {
		if (isSettingsDisabled() || !selectedWallet) return;
		try {
			const res = await http.put("wallet/settings/" + selectedWallet, { buySettings });
			toast.success("Settings saved successfully");
			handleCloseBuy();
			setIsLoadingWallets(true);
			getWallets();
		} catch (error) {
			console.log(error, "error");
			toast.error("Couldn't save settings!");
		}
	};

	return (
		<>
			{user ? (
				<div className="d-flex align-items-center flex-wrap gap-4 mb-3">
					<button type="button" className="btnBlue br-30 w-202 gap-2" disabled={!user} onClick={() => createWallet()}>
						<span className="iconify" data-icon="icons8:plus"></span>
						Create
					</button>
					<button type="button" className="btnPrimary br-30 w-202 gap-2" disabled={!user} onClick={handleShow}>
						<span className="iconify" data-icon="octicon:download-24"></span>
						Import
					</button>
					{isLoadingWallets && (
						<div className="d-flex gap-2 text-white align-items-center">
							<ClipLoader color={"#fff"} loading={isLoadingWallets} size={30} />
							<div>Refreshing wallet list...</div>
						</div>
					)}
				</div>
			) : (
				<div className="gradient-box text-center text-white">
					Connect your wallet to see your imported and created wallets
				</div>
			)}
			<div className="wallet-scroll">
				{user?.extendedWallets &&
					user.extendedWallets.map((wallet, index) => (
						<div key={index} className="gradient-box mb-3">
							<div className="d-flex align-items-md-center gap-md-0 gap-3 justify-content-between flex-column flex-md-row mb-3">
								<div className="d-flex align-items-center justify-content-md-start justify-content-between gap-3">
									<div className="fs-26 fw-700 text-white">{wallet.accountId}</div>
									<button type="button" className="btnSecondary h-40 br-30 text-blue gap-2">
										<span className="iconify" data-icon="ic:baseline-settings"></span>
										Settings
									</button>
								</div>
								<div className="d-flex align-items-center justify-content-between flex-wrap justify-content-md-start gap-3">
									<div className="fs-14 fw-500 text-white">{wallet.publicAddress}</div>
									<div className="d-flex justify-content-end gap-2 sm-100">
										<button
											onClick={() => {
												copy(wallet.publicAddress);
												toast.success("Copied to clipboard");
											}}
											className="social-icon border-0">
											<span className="iconify" data-icon="ph:copy"></span>
										</button>
										<button onClick={() => requestKey(wallet.publicAddress)} className="social-icon border-0">
											<span className="iconify" data-icon="ion:key-sharp"></span>
										</button>
										<a
											href={"https://etherscan.io/address/" + wallet.publicAddress}
											className="social-icon"
											target="_blank">
											<span className="iconify" data-icon="icon-park-outline:share"></span>
										</a>
									</div>
								</div>
							</div>
							<div className="gradient-box mb-3">
								<div className="tables-grid">
									<div>
										<div className="fs-14 fw-700 text-white mb-2 d-flex justify-content-between align-items-center">
											Wallet ID
											{wallet.isEditable && wallet.accountId !== value && value && (
												<button type="button" className="social-icon border-0 me-3" onClick={() => saveId(index)}>
													<span className="iconify" data-icon="fluent:save-24-regular"></span>
												</button>
											)}
										</div>

										{wallet.isEditable ? (
											<div className="watch-input">
												<input
													type="text"
													className="px-3"
													pattern="[a-zA-Z0-9]+"
													value={value}
													onChange={handleChange}
													onKeyDown={(e) => handleKeyDown(e, index)}
												/>
											</div>
										) : (
											<div className="fs-14 fw-400 text-grey d-flex align-items-center gap-2">
												{wallet.accountId}
												<button
													className="text-grey fs-18 bg-transparent border-0"
													onClick={() => changeAccIdEditable(index, true)}>
													<span className="iconify" data-icon="ri:pencil-line"></span>
												</button>
											</div>
										)}
									</div>
									<div>
										<div className="fs-14 fw-700 text-white mb-2">Address</div>
										<div className="fs-14 fw-400 text-grey mt-3">
											{wallet.publicAddress.slice(0, 6) + "..." + wallet.publicAddress.slice(-4)}
										</div>
									</div>
									<div>
										<div className="fs-14 fw-700 text-white mb-2">ETH Balance</div>
										<div className="fs-14 fw-400 text-grey mt-3">{wallet.balance} ETH</div>
									</div>
									<div>
										<div className="fs-14 fw-700 text-white mb-2">QuickBuy</div>
										<div className="fs-14 fw-400 text-grey">
											<button
												className="fs-18 quickbuy"
												onClick={() => {
													setSelectedWallet(wallet.accountId);
													if (wallet.buySettings) {
														setBuySettings(wallet.buySettings);
													}
													handleShowBuy();
												}}>
												<span className="iconify" data-icon="ic:baseline-settings"></span>
											</button>
										</div>
									</div>
									<div>
										<div className="fs-14 fw-700 text-white mb-2">QuickSnipe</div>
										<div className="fs-14 fw-400 text-grey">
											<a href="#" className="text-white fs-18">
												<span className="iconify" data-icon="ic:baseline-settings"></span>
											</a>
										</div>
									</div>
								</div>
							</div>
							<div className="btnGradient w-202 h-50 br-30 me-3">Withdraw</div>
							<button
								type="button"
								className="btnDanger br-30 w-202 h-50 gap-2"
								onClick={() => handleShowDelete(wallet.publicAddress)}>
								<span className="iconify" data-icon="icon-park-outline:delete"></span>
								Delete
							</button>
						</div>
					))}
			</div>
			{/* IMPORT WALLET MODAL */}
			<Modal className="filter-modal" centered show={show} onHide={handleClose}>
				<Modal.Header className="position-relative" closeButton>
					<Modal.Title>
						<div className="fs-26 fw-700 text-white text-center">Import Wallet</div>
					</Modal.Title>
				</Modal.Header>
				<Modal.Body className="h-auto">
					<div className="mb-4">
						<div className="d-flex flex-wrap align-items-center gap-3 mt-3">
							<label className="fs-14 fw-400 text-grey">Enter Private Key:</label>
							<div className="filter-input w-100">
								<input type="text" value={privateKey} onChange={(e) => setPrivateKey(e.target.value)} />
							</div>
						</div>
					</div>
					<div className="text-end">
						<button disabled={!user} onClick={() => importWallet()} className="btnPrimary h-50 br-30">
							Import
						</button>
					</div>
				</Modal.Body>
			</Modal>

			{/* DELETE WALLET MODAL */}
			<Modal className="filter-modal" centered show={showDeleteModal} onHide={handleCloseDelete}>
				<Modal.Header className="position-relative" closeButton>
					<Modal.Title>
						<div className="fs-26 fw-700 text-white text-center">Delete Wallet</div>
					</Modal.Title>
				</Modal.Header>
				<Modal.Body className="h-auto">
					<div className="mb-4">
						<div className="d-flex flex-wrap align-items-center gap-3 mt-3">
							<label className="fw-400 text-white">
								Are you sure you want to delete this wallet? This can result in loss of funds if you haven’t imported
								this wallet anywhere else!
							</label>
						</div>
					</div>
					<div className="text-end">
						<button disabled={!user} onClick={() => deleteWallet()} className="btnPrimary h-50 br-30">
							Delete
						</button>
					</div>
				</Modal.Body>
			</Modal>

			{/* QUICKBUY MODAL */}
			<Modal className="filter-modal" centered show={showBuyModal} onHide={handleCloseBuy}>
				<Modal.Header className="position-relative" closeButton>
					<Modal.Title>
						<div className="fs-26 fw-700 text-white text-center">QuickBuy Settings</div>
					</Modal.Title>
				</Modal.Header>
				<Modal.Body className="h-auto">
					<div className="mb-4">
						<div className="d-flex flex-wrap align-items-center gap-3 mt-3">
							<label className="fs-14 fw-400 text-grey">Enter Amount in ETH:</label>
							<div className="filter-input w-100">
								<input
									type="number"
									placeholder="Amount in ETH"
									value={buySettings.amount}
									onChange={(e) => setBuySettings({ ...buySettings, amount: e.target.value })}
									onKeyDown={(e) => {
										if (e.key === "-" || e.key === "e" || e.key === "E" || parseInt(e.key) < 0) {
											e.preventDefault();
										}
									}}
								/>
							</div>
							<div className="d-flex justify-content-between w-100 me-2">
								<label className="fs-14 fw-400 text-grey">Enter Slippage (%):</label>
								<div className="fs-14 fw-400 text-grey">Default: 5%</div>
							</div>
							<div className="filter-input w-100">
								<input
									type="number"
									placeholder="Min slipppage is 0.5%"
									value={buySettings.slippage}
									onChange={(e) => setBuySettings({ ...buySettings, slippage: e.target.value })}
									onKeyDown={(e) => {
										if (e.key === "-" || e.key === "e" || e.key === "E" || parseInt(e.key) < 0) {
											console.log(e.key);
											e.preventDefault();
										}
									}}
								/>
							</div>
						</div>
					</div>
					<div className="text-end">
						<button disabled={isSettingsDisabled()} onClick={() => setSettings()} className="btnPrimary h-50 br-30">
							Save Settings
						</button>
					</div>
				</Modal.Body>
			</Modal>
			{/* PRIVATE KEY MODAL */}
			<Modal className="filter-modal" centered show={showKeyModal} onHide={handleCloseKey}>
				<Modal.Header className="position-relative" closeButton>
					<Modal.Title>
						<div className="fs-26 fw-700 text-white text-center">Private Key</div>
					</Modal.Title>
				</Modal.Header>
				<Modal.Body className="h-auto">
					<div className="mb-4 gradient-box w-100 position-relative">
						<div className="text-white pe-5 overflow-wrap">{privateAddress}</div>
						<button
							onClick={() => {
								copy(privateAddress);
								toast.success("Copied to clipboard");
								handleCloseKey();
							}}
							className="social-icon border-0 copy-private">
							<span className="iconify" data-icon="ph:copy"></span>
						</button>
					</div>
				</Modal.Body>
			</Modal>
		</>
	);
}
