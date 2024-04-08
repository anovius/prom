import React from "react";
import Header from "./Header";
import Sidebar from "./Sidebar";
import { Outlet } from "react-router-dom";

export default function Layout({
	handleReset,
	handleApply,
	filters,
	setFilters,
	setUserAddress,
	userAddress,
	connector,
	setConnector,
	setChain,
	show1,
	setShow1,
	disableSignup,
	setDisableSignup,
	balance,
	setBalance,
	tokenBalance,
	getTokenBalances,
	selectedWallet,
	setSelectedWallet,
	setQuickbuyWallet,
}) {
	return (
		<>
			<div className="d-flex layout">
				<Sidebar
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
				/>
				<div className="flex-1 w-100 px-4 vh-100 overflow-hidden">
					<Header
						filters={filters}
						setFilters={setFilters}
						handleApply={handleApply}
						handleReset={handleReset}
						getTokenBalances={getTokenBalances}
						selectedWallet={selectedWallet}
						setSelectedWallet={setSelectedWallet}
						setQuickbuyWallet={setQuickbuyWallet}
					/>
					<div>
						<Outlet />
					</div>
				</div>
			</div>
		</>
	);
}
