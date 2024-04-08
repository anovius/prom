// window.global ||= window;
import React, { useEffect, useRef, useState } from "react";
import Dropdown from "react-bootstrap/Dropdown";
import Form from "react-bootstrap/Form";
import { useLocation, useNavigate } from "react-router-dom";
import Modal from "react-bootstrap/Modal";
import Web3 from "web3";
import Swal from "sweetalert2";
import { useWeb3Modal } from "@web3modal/react";
import { useAccount, useDisconnect, useBalance, useSignMessage } from "wagmi";
import http from "../../api";
import { environment } from "../../constants";
let web3 = new Web3(window.ethereum);
import io from "socket.io-client";
import { toast } from "react-toastify";
import ClipLoader from "react-spinners/ClipLoader";
import { useDispatch, useSelector } from "react-redux";
import { setUser, login, logout } from "../../redux/slices/User";
import { connectSocket, disconnectSocket, socket } from "../../socket";

export default function Header({
	handleApply,
	handleReset,
	filters,
	setFilters,
	getTokenBalances,
	selectedWallet,
	setSelectedWallet,
	setQuickbuyWallet,
}) {
	const navigate = useNavigate();
	const endMessageRef = useRef();

	const dispatch = useDispatch();
	const user = useSelector((state) => state.user);

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
			disconnectWallet();
		},
	});

	const [notifications, setNotifications] = useState([]);
	const [unreadCount, setUnreadCount] = useState(0);

	const [editProfileForm, setEditProfileForm] = useState({
		username: "",
		profileImage: "",
		file: "",
	});
	const [isProfileUpdating, setIsProfileUpdating] = useState(false);

	const [chat, setChat] = useState([]);
	const [message, setMessage] = useState("");

	const toggleRef = useRef(null);

	const signupWithMobile = async (address) => {
		const nonce = Math.floor(Math.random() * 10000);
		const message = `Signing up to Prometheus Dapp with my one-time nonce: ${nonce}`;

		try {
			const signature = await signWithMobile({ message });

			if (signature) {
				const res = await http.post("user/signup", { publicAddress: address, nonce, signature });
				const tokenBalances = await getTokenBalances(address);

				if (tokenBalances) {
					dispatch(login({ ...res.data.data, ...tokenBalances }));
				} else {
					dispatch(login({ ...res.data.data }));
				}

				connectSocket(res.data.data.token);

				setQuickbuyWallet(res.data.data.extendedWallets);
				handleClose1();
			} else {
				disconnectWallet();
			}
		} catch (err) {
			disconnectWallet();
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
				const tokenBalances = await getTokenBalances(address);

				if (tokenBalances) {
					dispatch(login({ ...res.data.data, ...tokenBalances }));
				} else {
					dispatch(login({ ...res.data.data }));
				}

				connectSocket(res.data.data.token);

				setQuickbuyWallet(res.data.data.extendedWallets);
				handleClose1();
			} else {
				disconnectWallet();
			}
		} catch (err) {
			disconnectWallet();
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

	const location = useLocation();
	const [path, setPath] = useState("");

	const [show, setShow] = useState(false);
	const [show1, setShow1] = useState(false);
	const [show2, setShow2] = useState(false);
	const [show3, setShow3] = useState(false);

	const handleClose = () => setShow(false);
	const handleShow = () => setShow(true);
	const handleClose1 = () => setShow1(false);
	const handleShow1 = () => setShow1(true);
	const handleClose2 = () => setShow2(false);
	const handleShow2 = () => {
		setShow2(true);
		setTimeout(() => {
			endMessageRef.current?.scrollIntoView({ behavior: "smooth" });
		}, 500);
	};
	const handleClose3 = () => {
		setShow3(false);
		setEditProfileForm({
			username: "",
			profileImage: "",
			file: "",
		});
	};
	const handleShow3 = () => {
		setShow3(true);
		setEditProfileForm({
			username: user.username,
			profileImage: user.profileImage,
			file: "",
		});
	};

	const handleCheckedFilter = (filter, checked) => {
		// console.log(filters[filter], [filter], { ...filters, [filter]: { ...filters[filter], isApplied: checked } });
		// console.log(filters);
		setFilters({ ...filters, [filter]: { ...filters[filter], isApplied: checked } });
	};

	const handleMinMax = (filter, field, value) => {
		setFilters({ ...filters, [filter]: { ...filters[filter], [field]: value } });
	};

	const handleNestedFilter = (filter, nestedFilter, field, value) => {
		setFilters({
			...filters,
			[filter]: {
				...filters[filter],
				[nestedFilter]: {
					...filters[filter][nestedFilter],
					[field]: value,
				},
			},
		});
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
				const tokenBalances = await getTokenBalances(address);

				if (tokenBalances) {
					dispatch(login({ ...res.data.data, ...tokenBalances }));
				} else {
					dispatch(login({ ...res.data.data }));
				}

				connectSocket(res.data.data.token);

				setQuickbuyWallet(res.data.data.extendedWallets);
				handleClose1();
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

	const loginWeb = async (address, nonce) => {
		const message = `Logging in to Prometheus Dapp with my one-time nonce: ${nonce}`;

		try {
			const signature = await signMessage(address, message);

			if (signature) {
				const res = await http.post("user/login", { publicAddress: address, signature });
				const tokenBalances = await getTokenBalances(address);

				if (tokenBalances) {
					dispatch(login({ ...res.data.data, ...tokenBalances }));
				} else {
					dispatch(login({ ...res.data.data }));
				}

				connectSocket(res.data.data.token);

				setQuickbuyWallet(res.data.data.extendedWallets);
				handleClose1();
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
			// console.log(user, "user");
			if (user.isRegistered) {
				loginWeb(publicAddress, user.nonce);
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

	const disconnectWallet = async () => {
		dispatch(logout());
		disconnectSocket();
		if (address) {
			disconnect();
		}
		localStorage.removeItem("userAddress");
		localStorage.removeItem("walletconnect");
		navigate("/");
	};

	const homeNav = () => {
		if (document.body.classList.contains("home-sm")) {
			document.body.classList.remove("home-sm");
		} else {
			document.body.classList.add("home-sm");
		}
	};

	const handleImageChange = (e) => {
		const file = e.target.files[0];

		if (file) {
			const reader = new FileReader();

			reader.onloadend = () => {
				setEditProfileForm({
					...editProfileForm,
					profileImage: reader.result,
					file,
				});
			};

			reader.readAsDataURL(file);
		}
	};

	const updateProfile = async () => {
		try {
			let file = editProfileForm.file;
			let formData = new FormData();
			formData.append("file", file);

			setIsProfileUpdating(true);
			let imgData;
			if (editProfileForm.profileImage !== user.profileImage) {
				imgData = await http.post("upload", formData, { headers: { "Content-Type": "multipart/form-data" } });
			}

			const res = await http.put("user", {
				profileImage: editProfileForm.profileImage !== user.profileImage ? imgData.data.data.url : "",
				username: editProfileForm.username !== user.username ? editProfileForm.username : "",
			});

			dispatch(setUser({ ...user, ...res.data.data }));
			getChat();
			toast.success("Profile updated successfully!");
			handleClose3();
		} catch (error) {
			console.log(error, "error");

			if (error.response.data.message) {
				toast.error(error.response.data.message);
			} else {
				toast.error("Something went wrong!");
			}
		} finally {
			setIsProfileUpdating(false);
		}
	};

	const getChat = async () => {
		try {
			const res = await http.get("chat");

			setChat(res.data.data);
		} catch (error) {
			console.log(error, "error");
		}
	};

	const sendMessage = async (e) => {
		e?.preventDefault();

		const messageToSend = message.trim();
		setMessage("");

		try {
			const res = await http.post("chat", { message: messageToSend });
		} catch (error) {
			console.log(error, "error");
		}
	};

	const formatMsgDate = (mongooseDate) => {
		// Convert Mongoose date to JavaScript Date object in local time
		const dateObject = new Date(mongooseDate);

		// Get the current date in local time
		const currentDate = new Date();

		// Check if the given date is today
		const isToday = dateObject.toDateString() === currentDate.toDateString();

		// Format time
		let hours = dateObject.getHours();
		let minutes = dateObject.getMinutes();
		const ampm = hours >= 12 ? "pm" : "am";
		hours = hours % 12;
		hours = hours ? hours : 12; // If the hour is 0, convert it to 12
		minutes = minutes < 10 ? `0${minutes}` : minutes;
		const strTime = `${hours}:${minutes} ${ampm}`;

		if (isToday) {
			return strTime;
		} else {
			const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
			const dayName = days[dateObject.getDay()];
			return `${dayName} ${strTime}`;
		}
	};

	const handleWalletChange = (e) => {
		setSelectedWallet(e.target.value);
		localStorage.setItem("selectedWallet", e.target.value);
	};

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

	const getNotifications = async () => {
		try {
			const res = await http.get("notification");

			setNotifications(res.data.data.notifications);
			setUnreadCount(res.data.data.unreadCount);

			// console.log(res.data.data, "--------------- Notifications -----------------");
		} catch (error) {
			console.log(error, "error");
		}
	};

	const updateReadStatus = async () => {
		try {
			const res = await http.post("notification/read");

			setUnreadCount(res.data.data.unreadCount);

			// console.log(res.data.data, "--------------- Update Read Status -----------------");
		} catch (error) {
			console.log(error, "error");
		}
	};

	useEffect(() => {
		getChat();
		if (user) {
			console.log("--------- Running useEffect --------------");
			getNotifications();

			const notificationHandler = (notification) => {
				getNotifications();
				toast.success(notification.message, {
					position: "top-right",
				});
			};
			socket.on("notification", notificationHandler);

			const chatHandler = (message) => {
				getChat();
			};
			socket.on("chat", chatHandler);

			return () => {
				socket.off("notification", notificationHandler);
				socket.off("chat", chatHandler);
			};
		}
	}, [user?.publicAddress]);

	useEffect(() => {
		if (endMessageRef.current) endMessageRef.current.scrollIntoView({ behavior: "smooth" });
	}, [chat]);

	useEffect(() => {
		setPath(location.pathname.slice(1));
	}, [location]);

	return (
		<>
			<div className="header">
				<div className="d-md-none w-100 d-flex align-items-center justify-content-between">
					<a href="#" className="logo">
						<img src="/assets/images/logo.gif" height="60px" alt="" />
					</a>
					<button type="button" onClick={() => homeNav()} className="bg-transparent border-0 fs-20 text-white">
						<span className="iconify" data-icon="uil:bars"></span>
					</button>
				</div>
				<div className="d-flex align-items-center w-100 justify-content-between">
					<div className="fs-30 fw-700 text-white">
						{path === "wallets"
							? "Wallets"
							: path === "watchlist"
							? "Watchlist"
							: path === "positions"
							? "Positions"
							: path === "scraper"
							? "Scraper"
							: "Live Feed"}
					</div>
					<div className="d-md-none d-flex align-items-center gap-3">
						<button type="button" className="btnSecondary h-50 br-30 gap-2" onClick={handleShow}>
							<span className="iconify" data-icon="heroicons-solid:filter"></span>
							Filter
						</button>

						{/* Mobile Notifications */}
						<Dropdown className="node-dropdown noti-drpdown">
							<Dropdown.Toggle id="dropdown-basic" className="position-relative">
								{user && unreadCount > 0 && <div className="num-circle">{unreadCount}</div>}
								<span className="fs-20">
									<span className="iconify" data-icon="akar-icons:bell"></span>
								</span>
							</Dropdown.Toggle>

							<Dropdown.Menu className=" px-2 py-2">
								<div className="noti-list">
									{!user ? (
										<Dropdown.Item className="d-inline-block pb-4">
											Connect your wallet to receive notifications!
										</Dropdown.Item>
									) : notifications && notifications.length > 0 ? (
										notifications.map((notification, index) => (
											<Dropdown.Item key={`notification-${index}`} className="d-inline-block">
												{notification.message}
												<div className="text-end text-grey fs-12 fw-500 mt-2">
													{formatDate(new Date(notification.createdAt))}
												</div>
											</Dropdown.Item>
										))
									) : (
										<div className="text-center text-grey fs-12 fw-500 mt-1">No new notifications!</div>
									)}
								</div>
							</Dropdown.Menu>
						</Dropdown>
					</div>
				</div>

				<div className="d-flex justify-content-md-end justify-content-between w-100 align-items-center flex-md-nowrap flex-wrap gap-md-3 gap-2">
					<button type="button" className="btnSecondary d-md-inline-flex d-none h-50 br-30 gap-2" onClick={handleShow}>
						<span className="iconify" data-icon="heroicons-solid:filter"></span>
						Filter
					</button>

					{/* Desktop Notifications */}
					<Dropdown
						className="node-dropdown noti-drpdown d-md-block d-none"
						onClick={(e) => {
							// console.log("clicked", toggleRef.current.getAttribute("aria-expanded"));
							if (toggleRef.current.getAttribute("aria-expanded") === "false") {
								updateReadStatus();
							}
						}}>
						<Dropdown.Toggle id="dropdown-basic" className="position-relative" ref={toggleRef}>
							{user && unreadCount > 0 && <div className="num-circle">{unreadCount}</div>}
							<span className="fs-20">
								<span className="iconify" data-icon="akar-icons:bell"></span>
							</span>
						</Dropdown.Toggle>

						<Dropdown.Menu className=" px-2 py-2">
							<div className="noti-list">
								{!user ? (
									<Dropdown.Item className="d-inline-block pb-4">
										Connect your wallet to receive notifications!
									</Dropdown.Item>
								) : notifications && notifications.length > 0 ? (
									notifications.map((notification, index) => (
										<Dropdown.Item
											key={`notification-${index}`}
											className="d-inline-block notification-item"
											data-notification-id={notification.id}>
											{notification.message}
											<div className="text-end text-grey fs-12 fw-500 mt-2">
												{formatDate(new Date(notification.createdAt))}
											</div>
										</Dropdown.Item>
									))
								) : (
									<div className="text-center text-grey fs-12 fw-500 mt-1">No new notifications!</div>
								)}
							</div>
						</Dropdown.Menu>
					</Dropdown>
					{user && user.extendedWallets && user.extendedWallets.length > 0 && (
						<Dropdown className="node-dropdown">
							<Dropdown.Toggle id="dropdown-basic">
								<div>
									QuickBuy: <span className="fw-700">{selectedWallet}</span>
								</div>
							</Dropdown.Toggle>

							<div className="d-flex flex-column align-items-start">
								<Dropdown.Menu>
									{user.extendedWallets.map((wallet, index) => (
										<div key={`wallet-${index}`}>
											<input
												type="radio"
												id={`wallet-${index}`}
												name="wallet"
												value={wallet.accountId}
												defaultChecked={selectedWallet === wallet.accountId}
												onChange={handleWalletChange}
												disabled={!wallet.buySettings.amount}
											/>
											<label
												htmlFor={`wallet-${index}`}
												className={`text-white ms-2 ${!wallet.buySettings.amount ? "text-grey" : "pointer"}`}>
												{wallet.accountId}
											</label>
										</div>
									))}
								</Dropdown.Menu>
							</div>
						</Dropdown>
					)}
					{!user && (
						<button
							type="button"
							className="btnSecondary d-none d-md-inline-flex nowrap br-30 h-50"
							onClick={handleShow1}>
							<span className="size-24">
								<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="currentColor">
									<path d="M27 5.7h-7.6C19 4.1 17.6 3 16 3c-1.6 0-3 1.1-3.4 2.7H5c-2.8 0-5 2.2-5 5V24c0 2.8 2.2 5 5 5h22c2.8 0 5-2.2 5-5V10.7c0-2.8-2.2-5-5-5zM16 4.6c1 0 1.9.8 1.9 1.9 0 .5-.2 1-.5 1.3-.7.7-1.9.7-2.7 0-.3-.3-.5-.8-.5-1.3-.1-1.1.8-1.9 1.8-1.9zm11 22.8H9.2v-.3c0-.4-.4-.8-.8-.8s-.8.4-.8.8v.3H6v-.3c0-.4-.4-.8-.8-.8s-.8.4-.8.8v.2C2.8 27 1.6 25.6 1.6 24V10.7c0-1.6 1.1-3 2.7-3.3v.2c0 .5.4.8.8.8.5 0 .9-.4.9-.8v-.3h1.6v.3c0 .4.4.8.8.8s.8-.4.8-.8v-.3h3.4c.3 1.2 1.2 2.2 2.5 2.6 1.2.3 2.5 0 3.4-.9.5-.5.8-1 .9-1.7H27c1.9 0 3.4 1.5 3.4 3.4v3.1h-6.2c-1.9 0-3.5 1.6-3.5 3.5s1.6 3.5 3.5 3.5h6.2V24c0 1.9-1.5 3.4-3.4 3.4zm3.4-8.2h-6.2c-1 0-1.9-.8-1.9-1.9 0-1 .8-1.9 1.9-1.9h6.2v3.8zm0 0"></path>
									<path d="M5.2 17.6c-.4 0-.8.4-.8.8v2.2c0 .4.4.8.8.8s.8-.4.8-.8v-2.2c0-.4-.4-.8-.8-.8zm0-4.3c-.4 0-.8.4-.8.8v2.2c0 .4.4.8.8.8s.8-.4.8-.8v-2.2c0-.5-.4-.8-.8-.8zm0-4.4c-.4 0-.8.4-.8.8v2.2c0 .4.4.8.8.8s.8-.4.8-.8V9.8c0-.5-.4-.9-.8-.9zm0 13.1c-.4 0-.8.4-.8.8V25c0 .4.4.8.8.8s.8-.4.8-.8v-2.2c0-.5-.4-.8-.8-.8zM8.4 8.9c-.4 0-.8.4-.8.9V12c0 .4.4.8.8.8s.8-.4.8-.8V9.8c0-.5-.3-.9-.8-.9zm0 13.1c-.4 0-.8.4-.8.8V25c0 .4.4.8.8.8s.8-.4.8-.8v-2.2c0-.5-.3-.8-.8-.8zm0-8.7c-.4 0-.8.4-.8.8v2.2c0 .4.4.8.8.8s.8-.4.8-.8v-2.2c0-.5-.3-.8-.8-.8zm0 4.3c-.4 0-.8.4-.8.8v2.2c0 .4.4.8.8.8s.8-.4.8-.8v-2.2c0-.4-.3-.8-.8-.8zm0 0"></path>
								</svg>
							</span>{" "}
							Connect Wallet
						</button>
					)}

					{/* WALLETCONNECT CONNECTED */}
					{user && userBalance && (
						<button type="button" className="btnSecondary  d-md-inline-flex nowrap br-30 h-50">
							{Number(userBalance.formatted).toFixed(4)} ETH
						</button>
					)}

					{/* METAMASK CONNECTED */}
					{user && !userBalance && user.ethBalance !== "" && (
						<button type="button" className="btnSecondary d-md-inline-flex nowrap br-30 h-50">
							{user.ethBalance} ETH
						</button>
					)}
					{user && user.promeBalance !== "" && (
						<>
							<button type="button" className="btnSecondary w-48 d-inline-flex d-md-none nowrap br-30 h-50">
								{user.promeBalance} PROME
							</button>
							<button type="button" className="btnSecondary w-48 d-inline-flex d-md-none nowrap br-30 h-50">
								{Number(user.promeBalance) <= 4999
									? "Tier 1"
									: Number(user.promeBalance) <= 9999
									? "Tier 2"
									: Number(user.promeBalance) <= 14999
									? "Tier 3"
									: "Tier 4"}
							</button>
						</>
					)}
					{user && (
						<Dropdown className="node-dropdown d-md-block d-none">
							<Dropdown.Toggle id="dropdown-basic">
								{user.publicAddress.slice(0, 6) +
									"....." +
									user.publicAddress.slice(user.publicAddress.length - 5, user.publicAddress.length)}
							</Dropdown.Toggle>

							<Dropdown.Menu className=" px-2 py-2">
								<Dropdown.Item onClick={() => disconnectWallet()}>Disconnect Wallet</Dropdown.Item>
							</Dropdown.Menu>
						</Dropdown>
					)}
					<button
						type="button"
						className="btnSecondary d-md-inline-flex nowrap px-4 fs-24 br-30 h-50"
						onClick={handleShow2}>
						<span className="iconify" data-icon="bi:chat-fill"></span>
					</button>
				</div>
			</div>
			<Modal className="filter-modal" centered show={show} onHide={handleClose}>
				<Modal.Header className="position-relative" closeButton>
					<Modal.Title>
						<div className="fs-26 fw-700 text-white text-center">Filter</div>
					</Modal.Title>
				</Modal.Header>
				<Modal.Body>
					<div className="mb-4">
						<label className="CheckBox d-flex align-items-center gap-3">
							<input
								type="checkbox"
								defaultChecked={filters.deployedAt.isApplied}
								onChange={(e) => handleCheckedFilter("deployedAt", e.target.checked)}
							/>
							<span className="checkmark"></span>
							<span className="fs-16 fw-700 text-white">Deployed</span>
						</label>
						<div className="d-flex flex-wrap align-items-center gap-3 mt-3">
							<div className="d-flex align-items-center gap-3">
								<label className="fs-14 fw-400 text-grey">Min:</label>
								<div className="d-flex align-items-center gap-2">
									<div className="filter-input">
										<input
											type="number"
											value={filters.deployedAt.days.min !== 0 ? Number(filters.deployedAt.days.min) : ""}
											onChange={(e) => handleNestedFilter("deployedAt", "days", "min", Number(e.target.value))}
										/>
									</div>
									<label className="fs-14 fw-400 text-grey">Days</label>
								</div>
								<div className="d-flex align-items-center gap-2">
									<div className="filter-input">
										<input
											type="number"
											value={filters.deployedAt.hours.min !== 0 ? Number(filters.deployedAt.hours.min) : ""}
											onChange={(e) => handleNestedFilter("deployedAt", "hours", "min", Number(e.target.value))}
										/>
									</div>
									<label className="fs-14 fw-400 text-grey">Hours</label>
								</div>
								<div className="d-flex align-items-center gap-2">
									<div className="filter-input">
										<input
											type="number"
											value={filters.deployedAt.minutes.min !== 0 ? Number(filters.deployedAt.minutes.min) : ""}
											onChange={(e) => handleNestedFilter("deployedAt", "minutes", "min", Number(e.target.value))}
										/>
									</div>
									<label className="fs-14 fw-400 text-grey">Mins</label>
								</div>
							</div>
							<div className="d-flex align-items-center gap-3">
								<label className="fs-14 fw-400 text-grey">Max:</label>
								<div className="d-flex align-items-center gap-2">
									<div className="filter-input">
										<input
											type="number"
											value={filters.deployedAt.days.max !== 0 ? Number(filters.deployedAt.days.max) : ""}
											onChange={(e) => handleNestedFilter("deployedAt", "days", "max", Number(e.target.value))}
										/>
									</div>
									<label className="fs-14 fw-400 text-grey">Days</label>
								</div>
								<div className="d-flex align-items-center gap-2">
									<div className="filter-input">
										<input
											type="number"
											value={filters.deployedAt.hours.max !== 0 ? Number(filters.deployedAt.hours.max) : ""}
											onChange={(e) => handleNestedFilter("deployedAt", "hours", "max", Number(e.target.value))}
										/>
									</div>
									<label className="fs-14 fw-400 text-grey">Hours</label>
								</div>
								<div className="d-flex align-items-center gap-2">
									<div className="filter-input">
										<input
											type="number"
											value={filters.deployedAt.minutes.max !== 0 ? Number(filters.deployedAt.minutes.max) : ""}
											onChange={(e) => handleNestedFilter("deployedAt", "minutes", "max", Number(e.target.value))}
										/>
									</div>
									<label className="fs-14 fw-400 text-grey">Mins</label>
								</div>
							</div>
						</div>
					</div>
					<div className="mb-4">
						<label className="CheckBox d-flex align-items-center gap-3">
							<input
								type="checkbox"
								defaultChecked={filters.totalSupply.isApplied}
								onChange={(e) => handleCheckedFilter("totalSupply", e.target.checked)}
							/>
							<span className="checkmark"></span>
							<span className="fs-16 fw-700 text-white">Total Supply</span>
						</label>
						<div className="d-flex justify-content-between gap-3 mt-3">
							<div className="d-flex align-items-center gap-3">
								<label className="fs-14 fw-400 text-grey">Min:</label>
								<div className="d-flex align-items-center gap-2">
									<div className="filter-input">
										<input
											type="number"
											value={filters.totalSupply.min !== 0 ? Number(filters.totalSupply.min) : ""}
											onChange={(e) => handleMinMax("totalSupply", "min", Number(e.target.value))}
										/>
									</div>
								</div>
							</div>
							<div className="d-flex align-items-center gap-3">
								<label className="fs-14 fw-400 text-grey">Max:</label>
								<div className="d-flex align-items-center gap-2">
									<div className="filter-input">
										<input
											type="number"
											value={filters.totalSupply.max !== 0 ? Number(filters.totalSupply.max) : ""}
											onChange={(e) => handleMinMax("totalSupply", "max", Number(e.target.value))}
										/>
									</div>
								</div>
							</div>
						</div>
					</div>
					<div className="mb-4">
						<label className="CheckBox d-flex align-items-center gap-3">
							<input
								type="checkbox"
								defaultChecked={filters.burntSupply.isApplied}
								onChange={(e) => handleCheckedFilter("burntSupply", e.target.checked)}
							/>
							<span className="checkmark"></span>
							<span className="fs-16 fw-700 text-white">Burnt Supply</span>
						</label>
						<div className="d-flex justify-content-between gap-3 mt-3">
							<div className="d-flex align-items-center gap-3">
								<label className="fs-14 fw-400 text-grey">Min:</label>
								<div className="d-flex align-items-center gap-2">
									<div className="filter-input">
										<input
											type="number"
											value={filters.burntSupply.min !== 0 ? Number(filters.burntSupply.min) : ""}
											onChange={(e) => handleMinMax("burntSupply", "min", Number(e.target.value))}
										/>
									</div>
									{/* <label className="fs-14 fw-400 text-grey">%</label> */}
								</div>
							</div>
							<div className="d-flex align-items-center gap-3">
								<label className="fs-14 fw-400 text-grey">Max:</label>
								<div className="d-flex align-items-center gap-2">
									<div className="filter-input">
										<input
											type="number"
											value={filters.burntSupply.max !== 0 ? Number(filters.burntSupply.max) : ""}
											onChange={(e) => handleMinMax("burntSupply", "max", Number(e.target.value))}
										/>
									</div>
									{/* <label className="fs-14 fw-400 text-grey">%</label> */}
								</div>
							</div>
						</div>
					</div>
					<div className="mb-4">
						<label className="CheckBox d-flex align-items-center gap-3">
							<input
								type="checkbox"
								defaultChecked={filters.circulatingSupply.isApplied}
								onChange={(e) => handleCheckedFilter("circulatingSupply", e.target.checked)}
							/>
							<span className="checkmark"></span>
							<span className="fs-16 fw-700 text-white">Circ. Supply</span>
						</label>
						<div className="d-flex justify-content-between gap-3 mt-3">
							<div className="d-flex align-items-center gap-3">
								<label className="fs-14 fw-400 text-grey">Min:</label>
								<div className="d-flex align-items-center gap-2">
									<div className="filter-input">
										<input
											type="number"
											value={filters.circulatingSupply.min !== 0 ? Number(filters.circulatingSupply.min) : ""}
											onChange={(e) => handleMinMax("circulatingSupply", "min", Number(e.target.value))}
										/>
									</div>
									{/* <label className="fs-14 fw-400 text-grey">%</label> */}
								</div>
							</div>
							<div className="d-flex align-items-center gap-3">
								<label className="fs-14 fw-400 text-grey">Max:</label>
								<div className="d-flex align-items-center gap-2">
									<div className="filter-input">
										<input
											type="number"
											value={filters.circulatingSupply.max !== 0 ? Number(filters.circulatingSupply.max) : ""}
											onChange={(e) => handleMinMax("circulatingSupply", "max", Number(e.target.value))}
										/>
									</div>
									{/* <label className="fs-14 fw-400 text-grey">%</label> */}
								</div>
							</div>
						</div>
					</div>

					<div className="mb-4">
						<label className="CheckBox d-flex align-items-center gap-3">
							<input type="checkbox" />
							<span className="checkmark"></span>
							<span className="fs-16 fw-700 text-white">Holder Distribution</span>
						</label>
						<div className="d-flex align-items-center gap-3 mt-3">
							<div className="d-flex align-items-center gap-2">
								<label className="fs-14 fw-400 text-grey">Top 5 wallets must hold</label>
								<div className="filter-input">
									<input type="text" />
								</div>
								<label className="fs-14 fw-400 text-grey">% of the supply</label>
							</div>
						</div>
					</div>
					<div className="mb-4">
						<label className="CheckBox d-flex align-items-center gap-3">
							<input type="checkbox" />
							<span className="checkmark"></span>
							<span className="fs-16 fw-700 text-white">Block 0 snipers</span>
						</label>
						<div className="d-flex align-items-center gap-3 mt-3">
							<div className="d-flex align-items-center gap-2">
								<div className="filter-input">
									<input type="text" />
								</div>
							</div>
						</div>
					</div>

					<div className="mb-4">
						<label className="CheckBox d-flex align-items-center gap-3">
							<input
								type="checkbox"
								defaultChecked={filters.lockedTime.isApplied}
								onChange={(e) => handleCheckedFilter("lockedTime", e.target.checked)}
							/>
							<span className="checkmark"></span>
							<span className="fs-16 fw-700 text-white">Locked LP</span>
						</label>
						<div className="d-flex flex-column gap-4 mt-3">
							<div className="d-flex align-items-center gap-3">
								<label className="fs-14 fw-400 text-grey">Min:</label>
								<div className="d-flex align-items-center gap-2">
									<div className="filter-input">
										<input
											type="number"
											value={filters.lockedTime.weeks.min !== 0 ? Number(filters.lockedTime.weeks.min) : ""}
											onChange={(e) => handleNestedFilter("lockedTime", "weeks", "min", Number(e.target.value))}
										/>
									</div>
									<label className="fs-14 fw-400 text-grey">Weeks</label>
								</div>
								<div className="d-flex align-items-center gap-2">
									<div className="filter-input">
										<input
											type="number"
											value={filters.lockedTime.days.min !== 0 ? Number(filters.lockedTime.days.min) : ""}
											onChange={(e) => handleNestedFilter("lockedTime", "days", "min", Number(e.target.value))}
										/>
									</div>
									<label className="fs-14 fw-400 text-grey">Days</label>
								</div>
							</div>
							<div className="d-flex align-items-center gap-3">
								<label className="fs-14 fw-400 text-grey">Max:</label>
								<div className="d-flex align-items-center gap-2">
									<div className="filter-input">
										<input
											type="number"
											value={filters.lockedTime.weeks.max !== 0 ? Number(filters.lockedTime.weeks.max) : ""}
											onChange={(e) => handleNestedFilter("lockedTime", "weeks", "max", Number(e.target.value))}
										/>
									</div>
									<label className="fs-14 fw-400 text-grey">Weeks</label>
								</div>
								<div className="d-flex align-items-center gap-2">
									<div className="filter-input">
										<input
											type="number"
											value={filters.lockedTime.days.max !== 0 ? Number(filters.lockedTime.days.max) : ""}
											onChange={(e) => handleNestedFilter("lockedTime", "days", "max", Number(e.target.value))}
										/>
									</div>
									<label className="fs-14 fw-400 text-grey">Days</label>
								</div>
							</div>
						</div>
					</div>
					<div className="mb-4">
						<label className="CheckBox d-flex align-items-center gap-3">
							<input
								type="checkbox"
								defaultChecked={filters.maxBuy.isApplied}
								onChange={(e) => handleCheckedFilter("maxBuy", e.target.checked)}
							/>
							<span className="checkmark"></span>
							<span className="fs-16 fw-700 text-white">Max Buy</span>
						</label>
						<div className="d-flex flex-column gap-4 mt-3">
							<div className="d-flex align-items-center gap-3">
								<label className="fs-14 fw-400 text-grey">Min:</label>
								<div className="d-flex align-items-center gap-2">
									<div className="filter-input">
										<input
											type="number"
											value={filters.maxBuy.maxTx.min !== 0 ? Number(filters.maxBuy.maxTx.min) : ""}
											onChange={(e) => handleNestedFilter("maxBuy", "maxTx", "min", Number(e.target.value))}
										/>
									</div>
									<label className="fs-14 fw-400 text-grey">&</label>
								</div>
								<div className="d-flex align-items-center gap-2">
									<label className="fs-14 fw-700 text-grey">Buy tax</label>
									<div className="filter-input">
										<input
											type="number"
											value={filters.maxBuy.buyTax.min !== 0 ? Number(filters.maxBuy.buyTax.min) : ""}
											onChange={(e) => handleNestedFilter("maxBuy", "buyTax", "min", Number(e.target.value))}
										/>
									</div>
									<label className="fs-14 fw-400 text-grey">%</label>
								</div>
							</div>
							<div className="d-flex align-items-center gap-3">
								<label className="fs-14 fw-400 text-grey">Max:</label>
								<div className="d-flex align-items-center gap-2">
									<div className="filter-input">
										<input
											type="number"
											value={filters.maxBuy.maxTx.max !== 0 ? Number(filters.maxBuy.maxTx.max) : ""}
											onChange={(e) => handleNestedFilter("maxBuy", "maxTx", "max", Number(e.target.value))}
										/>
									</div>
									<label className="fs-14 fw-400 text-grey">&</label>
								</div>
								<div className="d-flex align-items-center gap-2">
									<label className="fs-14 fw-700 text-grey">Buy tax</label>
									<div className="filter-input">
										<input
											type="number"
											value={filters.maxBuy.buyTax.max !== 0 ? Number(filters.maxBuy.buyTax.max) : ""}
											onChange={(e) => handleNestedFilter("maxBuy", "buyTax", "max", Number(e.target.value))}
										/>
									</div>
									<label className="fs-14 fw-400 text-grey">%</label>
								</div>
							</div>
						</div>
					</div>
					<div className="mb-4">
						<label className="CheckBox d-flex align-items-center gap-3">
							<input
								type="checkbox"
								defaultChecked={filters.maxWallet.isApplied}
								onChange={(e) => handleCheckedFilter("maxWallet", e.target.checked)}
							/>
							<span className="checkmark"></span>
							<span className="fs-16 fw-700 text-white">Max Wallet</span>
						</label>
						<div className="d-flex justify-content-between mt-3">
							<div className="d-flex align-items-center gap-3">
								<label className="fs-14 fw-400 text-grey">Min:</label>
								<div className="d-flex align-items-center gap-2">
									<div className="filter-input">
										<input
											type="number"
											value={filters.maxWallet.min !== 0 ? Number(filters.maxWallet.min) : ""}
											onChange={(e) => handleMinMax("maxWallet", "min", Number(e.target.value))}
										/>
									</div>
									{/* <label className="fs-14 fw-400 text-grey">%</label> */}
								</div>
							</div>
							<div className="d-flex align-items-center gap-3">
								<label className="fs-14 fw-400 text-grey">Max:</label>
								<div className="d-flex align-items-center gap-2">
									<div className="filter-input">
										<input
											type="number"
											value={filters.maxWallet.max !== 0 ? Number(filters.maxWallet.max) : ""}
											onChange={(e) => handleMinMax("maxWallet", "max", Number(e.target.value))}
										/>
									</div>
									{/* <label className="fs-14 fw-400 text-grey">%</label> */}
								</div>
							</div>
						</div>
					</div>
				</Modal.Body>
				<Modal.Footer className="border-0 gap-4">
					<button type="button" className="btnPrimary br-30 px-4" onClick={handleReset}>
						Reset
					</button>
					<button
						type="button"
						className="btnPrimary br-30 px-4"
						onClick={() => {
							handleApply();
							handleClose();
						}}>
						Apply
					</button>
				</Modal.Footer>
			</Modal>

			{/* Modal for Wallet Connection */}
			<Modal show={show1} animation={false} onHide={handleClose1} centered className="filter-modal">
				<Modal.Header className="position-relative" closeButton>
					<Modal.Title>
						<div className="fs-26 fw-700 text-white text-center">Connect Wallet</div>
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

			{/* Modal for Live Chat */}
			<Modal className="filter-modal chat-modal" centered show={show2} onHide={handleClose2}>
				<Modal.Header className="position-relative justify-content-between px-md-5 px-3" closeButton>
					<Modal.Title>
						<div className="fs-26 fw-700 text-white text-center">Live Chats</div>
					</Modal.Title>
					{user && (
						<button type="button" className="bg-transparent border-0 fs-20 text-white" onClick={handleShow3}>
							<span className="iconify" data-icon="material-symbols:settings-outline"></span>
						</button>
					)}
				</Modal.Header>
				<Modal.Body>
					<div className="messages-list">
						{chat && Array.isArray(chat) && chat.length > 0 ? (
							chat.map((chatMessage, index) => {
								return (
									<>
										{chatMessage.sentBy?.id === user?.id ? (
											<div className="text-end">
												<div className="message-box reciever">
													<div className="message-profile me-2">
														<div className="image-user me-2">
															<img
																src={chatMessage.sentBy?.profileImage ?? "/assets/images/dummy-user.png"}
																alt="Platinum 1"
																className="css-10qm6dq"
															/>
														</div>
														<div className="user-name text-blue fw-700 fs-16">{chatMessage.sentBy?.username}</div>
													</div>
													<span className="message-text">{chatMessage.message}</span>
													<div className="text-end fs-12 fw-500 text-lightGrey">
														{formatMsgDate(chatMessage.sentAt)}
													</div>
												</div>
											</div>
										) : (
											<div>
												<div className="message-box">
													<div className="message-profile me-2">
														<div className="image-user me-2">
															<img
																src={chatMessage.sentBy?.profileImage ?? "/assets/images/dummy-user.png"}
																alt="Platinum 1"
																className="css-10qm6dq"
															/>
														</div>
														<div className="user-name text-blue fw-700 fs-16">{chatMessage.sentBy?.username}</div>
													</div>
													<span className="message-text">{chatMessage.message}</span>
													<div className="text-end fs-12 fw-500 text-lightGrey">
														{formatMsgDate(chatMessage.sentAt)}
													</div>
												</div>
											</div>
										)}
									</>
								);
							})
						) : (
							<div className="d-flex justify-content-center align-items-center">
								<div className="message-profile me-2">
									<div className="user-name text-blue fw-700 fs-16">No messages yet!</div>
								</div>
							</div>
						)}
						<div ref={endMessageRef}></div>
					</div>
					<div className="d-flex align-items-center gap-3 pt-4">
						<div className="watch-input w-100">
							<input
								type="text"
								placeholder="Enter Message"
								value={message}
								className="px-3"
								onChange={(e) => setMessage(e.target.value)}
								onKeyDown={(e) => {
									if (e.key === "Enter" && user && message.trim()) {
										sendMessage();
									}
								}}
							/>
						</div>
						<button disabled={!user || !message.trim()} onClick={sendMessage} className="btnPrimary br-30 h-50 fs-22">
							<span class="iconify" data-icon="carbon:send-filled"></span>
						</button>
					</div>
				</Modal.Body>
				<Modal.Footer className="border-0 gap-4"></Modal.Footer>
			</Modal>

			{/* Modal for Edit Profile */}
			<Modal className="filter-modal settings-modal" centered show={show3} onHide={handleClose3}>
				<Modal.Header className="position-relative" closeButton>
					<Modal.Title className="justify-content-between">
						<div className="fs-26 fw-700 text-white text-center">Edit Profile</div>
					</Modal.Title>
				</Modal.Header>
				<Modal.Body>
					<div className="d-flex align-items-center gap-3 mb-4">
						<div className="uploadPhoto position-relative">
							{editProfileForm?.profileImage && (
								<button
									type="btn"
									className="cancel-profile fs-24"
									onClick={() =>
										setEditProfileForm({
											...editProfileForm,
											profileImage: "",
											file: null,
										})
									}>
									<span class="iconify" data-icon="entypo:circle-with-cross"></span>
								</button>
							)}
							<img
								src={editProfileForm?.profileImage ? editProfileForm?.profileImage : "/assets/images/dummy-user.png"}
								alt=""
							/>
						</div>
						<div className="uploadBox h-56 ">
							<div className="icon">
								<span className="iconify " data-icon="akar-icons:cloud-upload"></span>
							</div>
							<div className="fs-14 fw-500 text-800">
								Update Photo
								<input
									type="file"
									accept="image/*"
									onClick={(event) => {
										event.target.value = null;
									}}
									onChange={handleImageChange}
								/>
							</div>
						</div>
					</div>
					<div>
						<label htmlFor="" className="fs-14 fw-500 text-white mb-2">
							Edit User Name
						</label>
						<div class="watch-input">
							<input
								type="text"
								placeholder="Only alphanumeric characters are allowed"
								value={editProfileForm?.username}
								onChange={(e) => setEditProfileForm({ ...editProfileForm, username: e.target.value })}
								onKeyDown={(e) => {
									if (!/[a-zA-Z0-9]/.test(e.key)) {
										e.preventDefault();
									}
								}}
								class="px-3"
							/>
						</div>
					</div>
				</Modal.Body>
				<Modal.Footer className="border-0 gap-4">
					{isProfileUpdating && (
						<div className="d-flex justify-content-center">
							<ClipLoader color="#6c7582" />
						</div>
					)}
					<button
						type="button"
						disabled={
							!editProfileForm?.username ||
							!user ||
							(editProfileForm?.username.trim() === user?.username &&
								editProfileForm?.profileImage === user?.profileImage) ||
							(editProfileForm?.username.trim() === user?.username &&
								!editProfileForm?.profileImage &&
								!user?.profileImage) ||
							isProfileUpdating
						}
						onClick={() => updateProfile()}
						className="btnPrimary br-30 px-4">
						Save
					</button>
				</Modal.Footer>
			</Modal>
		</>
	);
}
