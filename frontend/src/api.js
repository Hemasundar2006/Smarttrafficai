import axios from "axios";

const API = axios.create({ baseURL: import.meta.env.VITE_API_URL || "https://smart-traffic-backend-x5ke.onrender.com/api" });

export const getSignals = () => API.get("/signal");
export const getViolations = () => API.get("/violations");
export const getConfig = () => API.get("/config");
export const updateConfig = (cameraSource, manualOverride) => API.post("/config", { cameraSource, manualOverride });
export const login = (email, password) => API.post("/login", { email, password });
export const issueChallan = (id) => API.post(`/violations/${id}/challan`);
export const updateSignal = (lane, signal, duration, count) => API.post("/signal", { lane, signal, duration, count });
