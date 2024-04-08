// This is an authorized socket connection
import io from "socket.io-client";
import { environment } from "../constants";

export const socket = io(environment.file_url, {
	autoConnect: false,
});

export const connectSocket = (token) => {
	socket.auth = { token };
	socket.connect();
};

export const disconnectSocket = () => {
	socket.disconnect();
};
