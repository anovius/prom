import { createSlice } from "@reduxjs/toolkit";
import http from "../../api";

const initialState = null;

export const UserSlice = createSlice({
	name: "user",
	initialState,
	reducers: {
		login: (state, action) => {
			const { token, ...details } = action.payload;
			localStorage.setItem("token", token);
			http.refreshToken();
			return { ...details };
		},
		logout: (state) => {
			localStorage.removeItem("token");
			http.refreshToken();
			return null;
		},
		setUser: (state, action) => {
			return action.payload;
		},
	},
});

export const { login, logout, setUser } = UserSlice.actions;

export default UserSlice.reducer;
