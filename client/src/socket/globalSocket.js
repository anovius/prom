// This is an unauthorized socket connection
import io from "socket.io-client";
import { environment } from "../constants";

export const socket = io(environment.file_url);

export const disconnectSocket = () => {
	socket.disconnect();
};
