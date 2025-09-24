import { useSessionStore } from "@/stores/session";
import axios from "axios";

export const api = axios.create({
  baseURL: process.env.EXPO_PUBLIC_API_URL,
  withCredentials: true,
  timeout: 10000,
});
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      useSessionStore.getState().logout();
    }
    return Promise.reject(error);
  },
);
