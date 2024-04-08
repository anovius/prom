import { useEffect, useState } from "react";
import { Route, Routes } from "react-router-dom";
import { ToastContainer } from "react-toastify";
import { Feed, Wallets, WatchList, Scraper, Positions } from "./pages";
import { PROMETHEUS_CONTRACT_ADDRESS, PROMETHEUS_CONTRACT_ABI, DECIMALS, CHAIN_ID, HEX_CHAIN_ID } from "./constants";
import Web3 from "web3";
import http from "./api";
import Layout from "./components/layout";
import "react-toastify/dist/ReactToastify.css";
import { useSelector, useDispatch } from "react-redux";
import { login, setUser } from "./redux/slices/User";
import { connectSocket, disconnectSocket, socket } from "./socket";
const ALCHEMY_KEY = import.meta.env.VITE_ALCHEMY_KEY;
let web3 = new Web3(window.ethereum || "https://eth-mainnet.g.alchemy.com/v2/" + ALCHEMY_KEY);

function App() {
	const dispatch = useDispatch();
	const user = useSelector((state) => state.user);

	const filtersBody = {
		deployedAt: {
			isApplied: false,
			days: {
				min: 0,
				max: 0,
			},
			hours: {
				min: 0,
				max: 0,
			},
			minutes: {
				min: 0,
				max: 0,
			},
		},
		burntSupply: {
			isApplied: false,
			min: 0,
			max: 0,
		},
		totalSupply: {
			isApplied: false,
			min: 0,
			max: 0,
		},
		circulatingSupply: {
			isApplied: false,
			min: 0,
			max: 0,
		},
		lockedTime: {
			isApplied: false,
			weeks: {
				min: 0,
				max: 0,
			},
			days: {
				min: 0,
				max: 0,
			},
		},
		maxWallet: {
			isApplied: false,
			min: 0,
			max: 0,
		},
		maxBuy: {
			isApplied: false,
			maxTx: {
				min: 0,
				max: 0,
			},
			buyTax: {
				min: 0,
				max: 0,
			},
		},
	};
	const [loggedInUser, setLoggedInUser] = useState();
	const [userAddress, setUserAddress] = useState("");
	const [balance, setBalance] = useState("");
	const [tokenBalance, setTokenBalance] = useState("");
	const [connector, setConnector] = useState({});
	const [chain, setChain] = useState("");
	const [show1, setShow1] = useState(false);
	const [disableSignup, setDisableSignup] = useState(false);
	const [filters, setFilters] = useState(filtersBody);
	const [isFilterChanged, setIsFilterChanged] = useState(false);
	const [selectedWallet, setSelectedWallet] = useState();

	const handleReset = () => {
		setFilters(filtersBody);
		setIsFilterChanged(!isFilterChanged);
	};

	const handleApply = () => {
		setIsFilterChanged(!isFilterChanged);
	};

	const initContract = async (abi, address) => {
		let res = new web3.eth.Contract(abi, address);
		return res;
	};

	const getTokenBalances = async (userAddress) => {
		try {
			const contract = await initContract(PROMETHEUS_CONTRACT_ABI, PROMETHEUS_CONTRACT_ADDRESS);
			const balance = await contract.methods.balanceOf(userAddress).call();
			const promeBalance = balance / 10 ** DECIMALS;

			let ethBalance = await web3.eth.getBalance(userAddress);
			ethBalance = (Number(ethBalance) / 10 ** 18).toFixed(4);

			setTokenBalance(promeBalance);
			setBalance(ethBalance);

			return {
				ethBalance,
				promeBalance,
			};
		} catch (error) {
			console.log(error, "error while fetching token balances!");
		}
	};

	const getUser = async () => {
		try {
			const res = await http.get("user/context");

			if (res.data.data) {
				const user = res.data.data;
				setQuickbuyWallet(user.extendedWallets);
				const tokenBalances = await getTokenBalances(user.publicAddress);

				if (tokenBalances) {
					dispatch(login({ ...res.data.data, ...tokenBalances }));
				} else {
					dispatch(login({ ...res.data.data }));
				}

				connectSocket(res.data.data.token);
			}
		} catch (error) {
			console.log(error, "error");
		}
	};

	const setQuickbuyWallet = async (wallets) => {
		try {
			if (wallets && wallets.length > 0) {
				const selectedWallet = localStorage.getItem("selectedWallet");
				const foundWallet = wallets.find((wallet) => wallet.accountId === selectedWallet);

				if (!foundWallet) {
					localStorage.removeItem("selectedWallet");
					setSelectedWallet(wallets[0].accountId);
					localStorage.setItem("selectedWallet", wallets[0].accountId);
				} else {
					setSelectedWallet(selectedWallet);
				}
			}
		} catch (error) {
			console.log(error, "error");
		}
	};

	const walletHandler = async (wallets) => {
		if (!user) return;

		const isWalletBeingEdited = user.extendedWallets.find((wallet) => wallet.isEditable);

		if (isWalletBeingEdited) {
			// console.log(
			// 	"\n\n---------- ✍️ ✍️ ✍️ ---------- \n Wallet is being edited, so not refreshing wallets \n---------- ✍️ ✍️ ✍️ ----------"
			// );
			return;
		}

		// console.log(
		// 	"\n\n---------- 🤝🤝🤝 ---------- \n Wallet has been updated \n---------- 🤝🤝🤝 ----------",
		// 	wallets,
		// 	"\n\n"
		// );

		const tokenBalances = await getTokenBalances(user.publicAddress);

		dispatch(setUser({ ...user, ...tokenBalances, extendedWallets: wallets }));
	};

	useEffect(() => {
		if (user && socket) {
			socket.on("connect_error", (err) => {
				console.log(err.message, "Error connection while conencting to socket"); // not authorized
			});

			socket.on("update_wallets", walletHandler);

			return () => {
				socket.off("connect_error");
				socket.off("update_wallets");
			};
		}
	}, [socket.connected, user?.publicAddress]);

	useEffect(() => {
		const token = localStorage.getItem("token");

		if (token) {
			getUser();
		}
	}, []);

	return (
		<>
			<Routes>
				<Route
					path=""
					element={
						<Layout
							filters={filters}
							setFilters={setFilters}
							handleApply={handleApply}
							handleReset={handleReset}
							setUserAddress={setUserAddress}
							userAddress={userAddress}
							connector={connector}
							setConnector={setConnector}
							setChain={setChain}
							show1={show1}
							setShow1={setShow1}
							disableSignup={disableSignup}
							setDisableSignup={setDisableSignup}
							balance={balance}
							setBalance={setBalance}
							tokenBalance={tokenBalance}
							getTokenBalances={getTokenBalances}
							selectedWallet={selectedWallet}
							setSelectedWallet={setSelectedWallet}
							setLoggedInUser={setLoggedInUser}
							loggedInUser={loggedInUser}
							setQuickbuyWallet={setQuickbuyWallet}
						/>
					}>
					<Route
						path="/"
						element={<Feed filters={filters} isFilterChanged={isFilterChanged} selectedWallet={selectedWallet} />}
					/>
					<Route path="/watchlist" element={<WatchList selectedWallet={selectedWallet} />} />
					<Route path="/wallets" element={<Wallets setBuyWallet={setSelectedWallet} />} />
					<Route path="/positions" element={<Positions />} />
					<Route path="/scraper" element={<Scraper />} />
				</Route>
			</Routes>
			<ToastContainer
				position="bottom-center"
				autoClose={1500}
				hideProgressBar={false}
				pauseOnFocusLoss={false}
				pauseOnHover={false}
				newestOnTop={false}
				closeOnClick
				rtl={false}
				draggable
				theme="light"
				limit={3}
			/>
		</>
	);
}

export default App;
