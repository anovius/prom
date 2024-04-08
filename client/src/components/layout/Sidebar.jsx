import React, { useState } from "react";
import Dropdown from "react-bootstrap/Dropdown";
import { NavLink, useNavigate } from "react-router-dom";
import Modal from "react-bootstrap/Modal";
import Web3 from "web3";
// import WalletConnect from "@walletconnect/web3-provider";
import Swal from "sweetalert2";
import { useWeb3Modal } from "@web3modal/react";
import { useAccount, useDisconnect, useBalance, useSignMessage } from "wagmi";
import http from "../../api";
let web3 = new Web3(window.ethereum);

export default function Sidebar({
	setUserAddress,
	userAddress,
	setConnector,
	setChain,
	balance,
	setBalance,
	tokenBalance,
	getTokenBalances,
	setLoggedInUser,
	loggedInUser,
}) {
	const navigate = useNavigate();
	const { isOpen, open, close, setDefaultChain } = useWeb3Modal();
	const { disconnect } = useDisconnect();
	const { signMessageAsync: signWithMobile } = useSignMessage();
	const { address, isConnected } = useAccount({
		onConnect({ address, isReconnected }) {
			try {
				if (localStorage.getItem("token")) {
				} else {
					getUser(address).then((user) => {
						if (user.isRegistered) {
							loginWithMobile(address, user.nonce);
						} else {
							signupWithMobile(address);
						}
					});
				}
			} catch (err) {
				console.log(err, "err in connectMetamask");
				disconnect();
				Swal.fire({
					icon: "error",
					title: "Oops...",
					text: "Something went wrong.",
				});
			}
		},
		onDisconnect() {
			logout();
		},
	});

	const signupWithMobile = async (address) => {
		const nonce = Math.floor(Math.random() * 10000);
		const message = `Signing up to Prometheus Dapp with my one-time nonce: ${nonce}`;

		try {
			const signature = await signWithMobile({ message });

			if (signature) {
				const res = await http.post("user/signup", { publicAddress: address, nonce, signature });

				saveAuth(address, res.data.data.token);
			} else {
				logout();
			}
		} catch (err) {
			logout();
			console.log(err, "err in signup");
			Swal.fire({
				icon: "error",
				title: "Oops...",
				text: "Something went wrong.",
			});
		}
	};

	const loginWithMobile = async (address, nonce) => {
		const message = `Logging in to Prometheus Dapp with my one-time nonce: ${nonce}`;

		try {
			const signature = await signWithMobile({ message });

			if (signature) {
				const res = await http.post("user/login", { publicAddress: address, signature });

				saveAuth(address, res.data.data.token);
			} else {
				logout();
			}
		} catch (err) {
			logout();
			console.log(err, "err in login");
			Swal.fire({
				icon: "error",
				title: "Oops...",
				text: "Something went wrong.",
			});
		}
	};

	const { data: userBalance } = useBalance({
		address,
	});

	// const [connectWallet, setConnectWallet] = useState(false)
	const [show1, setShow1] = useState(false);

	const handleClose1 = () => setShow1(false);
	const handleShow1 = () => setShow1(true);

	const saveAuth = (address, token, balance) => {
		localStorage.setItem("userAddress", address);
		localStorage.setItem("token", token);
		setUserAddress(address);
		if (balance) setBalance(balance);
		getTokenBalances(address);
		handleClose1();
		http.refreshToken();
	};

	const signMessage = async (address, message) => {
		try {
			const signature = await web3.eth.personal.sign(message, address, "");
			return signature;
		} catch (error) {
			console.log(error);
			throw error;
		}
	};

	const signup = async (address) => {
		const nonce = Math.floor(Math.random() * 10000);
		const message = `Signing up to Prometheus Dapp with my one-time nonce: ${nonce}`;

		try {
			const signature = await signMessage(address, message);

			if (signature) {
				const res = await http.post("user/signup", { publicAddress: address, nonce, signature });

				await web3.eth.getBalance(address, (err, balance) => {
					if (err) {
						console.log(err);
					} else {
						console.log(balance);
						const userBalance = (Number(balance) / 10 ** 18).toFixed(4);

						saveAuth(address, res.data.data.token, userBalance);
					}
				});
			}
		} catch (err) {
			console.log(err, "err in signup");
			Swal.fire({
				icon: "error",
				title: "Oops...",
				text: "Something went wrong.",
			});
		}
	};

	const login = async (address, nonce) => {
		const message = `Logging in to Prometheus Dapp with my one-time nonce: ${nonce}`;

		try {
			const signature = await signMessage(address, message);

			if (signature) {
				const res = await http.post("user/login", { publicAddress: address, signature });

				await web3.eth.getBalance(address, (err, balance) => {
					if (err) {
						console.log(err);
					} else {
						console.log(balance);
						const userBalance = (Number(balance) / 10 ** 18).toFixed(4);

						saveAuth(address, res.data.data.token, userBalance);
					}
				});
			}
		} catch (err) {
			console.log(err, "err in login");
			Swal.fire({
				icon: "error",
				title: "Oops...",
				text: "Something went wrong.",
			});
		}
	};

	const getUser = async (address) => {
		try {
			const res = await http.get("user/address/" + address);
			return res.data.data;
		} catch (error) {
			console.log(error);
			throw error;
		}
	};

	const connectMetamask = async () => {
		if (!window.ethereum) {
			Swal.fire({
				icon: "error",
				title: "Oops...",
				text: "Please install MetaMask first.",
			});
			return;
		}
		if (!web3) {
			try {
				await window.ethereum.enable();
				web3 = new Web3(window.ethereum);
			} catch (error) {
				Swal.fire({
					icon: "error",
					title: "Oops...",
					text: "You need to allow MetaMask.",
				});
				console.log(error, "error in connectMetamask");
				return;
			}
		}

		await window.ethereum.enable();
		let publicAddress = await web3.eth.getCoinbase();
		try {
			const user = await getUser(publicAddress);
			console.log(user, "user");
			if (user.isRegistered) {
				login(publicAddress, user.nonce);
			} else {
				signup(publicAddress);
			}
		} catch (err) {
			console.log(err, "err in connectMetamask");
			Swal.fire({
				icon: "error",
				title: "Oops...",
				text: "Something went wrong.",
			});
		}
	};

	const logout = async () => {
		setUserAddress("");
		setConnector({});
		setChain("");
		if (address) {
			disconnect();
		}
		localStorage.removeItem("userAddress");
		localStorage.removeItem("walletconnect");
		localStorage.removeItem("token");
		navigate("/");
		setLoggedInUser();
	};

	const homeNav = () => {
		if (document.body.classList.contains("home-sm")) {
			document.body.classList.remove("home-sm");
		} else {
			document.body.classList.add("home-sm");
		}
	};

	return (
		<>
			<div className="close-sidebar" onClick={() => homeNav()}></div>
			<div className="sidebar">
				<a href="#" className="logo d-block mb-5">
					<img src="/assets/images/logo.gif" height="90px" alt="" />
				</a>
				<div className="fs-12 fw-500 text-grey mb-3">Main Menu</div>
				<ul>
					<li>
						<NavLink to="/" className="side-link gap-2" onClick={() => homeNav()}>
							<img src="/assets/images/live-feed.svg " alt="" />
							Live Feed
						</NavLink>
					</li>
					<li>
						<NavLink to="/watchlist" className="side-link gap-2" onClick={() => homeNav()}>
							<img src="/assets/images/watchlist.svg " alt="" />
							Watchlist
						</NavLink>
					</li>
					<li>
						<NavLink to="wallets" className="side-link gap-2" onClick={() => homeNav()}>
							<img src="/assets/images/credit-card.svg " alt="" />
							Wallets
						</NavLink>
					</li>
					<li>
						<NavLink to="positions" className="side-link gap-2" onClick={() => homeNav()}>
							<img src="/assets/images/position.svg " alt="" />
							Positions
						</NavLink>
					</li>
					<li>
						<NavLink to="scraper" className="side-link gap-2" onClick={() => homeNav()}>
							<img src="/assets/images/scraper.svg " alt="" />
							Scraper
						</NavLink>
					</li>
				</ul>
				{userAddress && !userBalance && balance !== "" && (
					<button type="button" className="btnSecondary d-md-none mb-3 w-100 d-inline-flex nowrap br-30 h-50">
						{balance} ETH
					</button>
				)}
				{userAddress && tokenBalance !== "" && (
					<>
						<button type="button" className="btnSecondary w-100 d-md-inline-flex d-none nowrap br-30 h-50 mb-3">
							{tokenBalance} PROME
						</button>
						<button type="button" className="btnSecondary w-100 d-md-inline-flex d-none nowrap br-30 h-50 mb-3">
							{Number(tokenBalance) <= 4999
								? "Tier 1"
								: Number(tokenBalance) <= 9999
								? "Tier 2"
								: Number(tokenBalance) <= 14999
								? "Tier 3"
								: "Tier 4"}
						</button>
					</>
				)}

				{userAddress && (
					<>
						<button
							type="button"
							className="color-greenish btnSecondary w-100 d-md-inline-flex d-none nowrap br-5 h-50 mb-3">
							Active Users: 1347
						</button>
						<button
							type="button"
							className="color-greenish fs-9 btnSecondary w-100 d-md-inline-flex d-none nowrap br-5 h-50 mb-3">
							Platform Fees (Epoch 1): $341,559.56
						</button>
						<button
							type="button"
							className="color-greenish btnSecondary w-100 d-md-inline-flex d-none nowrap br-5 h-50">
							Your share: $3,123.11
						</button>
					</>
				)}

				{!userAddress && (
					<button
						type="button"
						className="btnSecondary d-inline-flex w-100 d-md-none nowrap br-30 h-50"
						onClick={() => {
							homeNav();
							handleShow1();
						}}>
						<span className="size-24">
							<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="currentColor">
								<path d="M27 5.7h-7.6C19 4.1 17.6 3 16 3c-1.6 0-3 1.1-3.4 2.7H5c-2.8 0-5 2.2-5 5V24c0 2.8 2.2 5 5 5h22c2.8 0 5-2.2 5-5V10.7c0-2.8-2.2-5-5-5zM16 4.6c1 0 1.9.8 1.9 1.9 0 .5-.2 1-.5 1.3-.7.7-1.9.7-2.7 0-.3-.3-.5-.8-.5-1.3-.1-1.1.8-1.9 1.8-1.9zm11 22.8H9.2v-.3c0-.4-.4-.8-.8-.8s-.8.4-.8.8v.3H6v-.3c0-.4-.4-.8-.8-.8s-.8.4-.8.8v.2C2.8 27 1.6 25.6 1.6 24V10.7c0-1.6 1.1-3 2.7-3.3v.2c0 .5.4.8.8.8.5 0 .9-.4.9-.8v-.3h1.6v.3c0 .4.4.8.8.8s.8-.4.8-.8v-.3h3.4c.3 1.2 1.2 2.2 2.5 2.6 1.2.3 2.5 0 3.4-.9.5-.5.8-1 .9-1.7H27c1.9 0 3.4 1.5 3.4 3.4v3.1h-6.2c-1.9 0-3.5 1.6-3.5 3.5s1.6 3.5 3.5 3.5h6.2V24c0 1.9-1.5 3.4-3.4 3.4zm3.4-8.2h-6.2c-1 0-1.9-.8-1.9-1.9 0-1 .8-1.9 1.9-1.9h6.2v3.8zm0 0"></path>
								<path d="M5.2 17.6c-.4 0-.8.4-.8.8v2.2c0 .4.4.8.8.8s.8-.4.8-.8v-2.2c0-.4-.4-.8-.8-.8zm0-4.3c-.4 0-.8.4-.8.8v2.2c0 .4.4.8.8.8s.8-.4.8-.8v-2.2c0-.5-.4-.8-.8-.8zm0-4.4c-.4 0-.8.4-.8.8v2.2c0 .4.4.8.8.8s.8-.4.8-.8V9.8c0-.5-.4-.9-.8-.9zm0 13.1c-.4 0-.8.4-.8.8V25c0 .4.4.8.8.8s.8-.4.8-.8v-2.2c0-.5-.4-.8-.8-.8zM8.4 8.9c-.4 0-.8.4-.8.9V12c0 .4.4.8.8.8s.8-.4.8-.8V9.8c0-.5-.3-.9-.8-.9zm0 13.1c-.4 0-.8.4-.8.8V25c0 .4.4.8.8.8s.8-.4.8-.8v-2.2c0-.5-.3-.8-.8-.8zm0-8.7c-.4 0-.8.4-.8.8v2.2c0 .4.4.8.8.8s.8-.4.8-.8v-2.2c0-.5-.3-.8-.8-.8zm0 4.3c-.4 0-.8.4-.8.8v2.2c0 .4.4.8.8.8s.8-.4.8-.8v-2.2c0-.4-.3-.8-.8-.8zm0 0"></path>
							</svg>
						</span>{" "}
						Connect Wallet
					</button>
				)}
				{userAddress && (
					<Dropdown className="node-dropdown d-md-none d-block">
						<Dropdown.Toggle id="dropdown-basic" className="w-100 justify-content-center">
							{userAddress.slice(0, 6) + "....." + userAddress.slice(userAddress.length - 5, userAddress.length)}
						</Dropdown.Toggle>

						<Dropdown.Menu className=" px-2 py-2">
							<Dropdown.Item href="#" onClick={() => logout()}>
								Disconnect Wallet
							</Dropdown.Item>
						</Dropdown.Menu>
					</Dropdown>
				)}
			</div>

			<Modal show={show1} animation={false} onHide={handleClose1} centered className="filter-modal">
				<Modal.Header className="position-relative" closeButton>
					<Modal.Title>
						<div className="fs-26 fw-700 text-white text-center">Wallet Connect</div>
					</Modal.Title>
				</Modal.Header>
				<div className="modal-body p-4 h-100">
					<div>
						<div className="walletLogo" onClick={() => connectMetamask()}>
							<img src="/assets/images/metamask.svg" alt="" />
						</div>
						<div className="fs-24 fw-700 mb-4 text-center text-white">MetaMask</div>
						<div className="fs-16 fw-400 mb-4 text-center text-white">Connect to your MetaMask Wallet</div>
					</div>
					<hr />
					<div>
						<div className="walletLogo" onClick={() => open()}>
							<img src="/assets/images/walletConnect.svg" alt="" />
						</div>
						<div className="fs-24 fw-700 mb-4 text-center text-white">WalletConnect</div>
						<div className="fs-16 fw-400 mb-4 text-center text-white">Connect using WalletConnect</div>
					</div>
				</div>
			</Modal>
		</>
	);
}
