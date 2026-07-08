import axios from "axios";

const API = axios.create({ baseURL: import.meta.env.VITE_API_URL || "http://localhost:5000/api" });

export const getSignals = () => API.get("/signal");
export const getViolations = () => API.get("/violations");
export const getConfig = () => API.get("/config");
export const updateConfig = (cameraSource) => API.post("/config", { cameraSource });
