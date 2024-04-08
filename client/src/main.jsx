import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";
import { BrowserRouter } from "react-router-dom";
import { ethereumClient, wagmiConfig, projectId } from "./wagmi";
import { WagmiConfig } from "wagmi";
import { Web3Modal } from "@web3modal/react";
import { store } from "./redux/store";
import { Provider } from "react-redux";

ReactDOM.createRoot(document.getElementById("root")).render(
	// <React.StrictMode>
	<Provider store={store}>
		<BrowserRouter>
			<WagmiConfig config={wagmiConfig}>
				<App />
				<Web3Modal projectId={projectId} ethereumClient={ethereumClient} />
			</WagmiConfig>
		</BrowserRouter>
	</Provider>
	// </React.StrictMode>
);
