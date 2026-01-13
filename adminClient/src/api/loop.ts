import axios from "axios";
import { API_URL } from "@/config";

export const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
  timeout: 10000,
});

console.log(API_URL);
