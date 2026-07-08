import { useEffect, useState } from "react";
import { getSignals, getViolations } from "./api";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { 
  Activity, 
  AlertTriangle, 
  Car, 
  Clock, 
  ShieldAlert, 
  TrafficCone, 
  TrendingUp, 
  Video,
  FileText,
  CheckCircle,
  Download,
  Eye,
  DollarSign,
  MapPin,
  Lock,
  User,
  ShieldCheck,
  LogOut
} from "lucide-react";

export default function App() {
  const [signals, setSignals] = useState([]);
  const [violations, setViolations] = useState([]);
  const [isConnected, setIsConnected] = useState(false);
  const [activeTab, setActiveTab] = useState("all");
  const [selectedViolation, setSelectedViolation] = useState(null);
  
  // Login State
  const [isLoggedIn, setIsLoggedIn] = useState(() => {
    return sessionStorage.getItem("isLoggedIn") === "true";
  });
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");

  const handleLogin = (e) => {
    e.preventDefault();
    if (username === "admin" && password === "admin") {
      setIsLoggedIn(true);
      sessionStorage.setItem("isLoggedIn", "true");
      setLoginError("");
    } else {
      setLoginError("Invalid Administrator Credentials");
    }
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    sessionStorage.removeItem("isLoggedIn");
  };

  const defaultLanes = ["north", "south", "east", "west"];

  const poll = async () => {
    try {
      const [s, v] = await Promise.all([getSignals(), getViolations()]);
      
      const fetchedSignals = s.data || [];
      const updatedSignals = defaultLanes.map(laneName => {
        const found = fetchedSignals.find(x => x.lane === laneName);
        return found || { lane: laneName, signal: "RED", duration: 10, count: 0 };
      });
      
      setSignals(updatedSignals);
      setViolations(v.data || []);
      setIsConnected(true);
    } catch (err) {
      console.error("Polling error:", err);
      setIsConnected(false);
    }
  };

  useEffect(() => {
    if (isLoggedIn) {
      poll();
      const interval = setInterval(poll, 1500);
      return () => clearInterval(interval);
    }
  }, [isLoggedIn]);

  // Compute metrics
  const totalVehicles = signals.reduce((sum, s) => sum + (s.count || 0), 0);
  const activeSignal = signals.find(s => s.signal === "GREEN" || s.signal === "ORANGE");
  const activeLane = activeSignal ? activeSignal.lane : "None";
  
  const ocrSuccessCount = violations.filter(v => v.plate && v.plate !== "UNREADABLE").length;
  const ocrRate = violations.length > 0 
    ? Math.round((ocrSuccessCount / violations.length) * 100) 
    : 100;

  // Chart data format
  const chartData = signals.map(s => ({
    name: s.lane.toUpperCase(),
    Vehicles: s.count || 0,
    Duration: s.duration || 0
  }));

  const filteredViolations = violations.filter(v => {
    if (activeTab === "all") return true;
    if (activeTab === "readable") return v.plate && v.plate !== "UNREADABLE";
    return true;
  });

  // RENDER LOGIN SCREEN
  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-800 flex items-center justify-center p-6 cyber-grid selection:bg-emerald-500 selection:text-white">
        <div className="w-full max-w-md bg-white border border-slate-200/80 rounded-2xl shadow-xl overflow-hidden relative">
          
          {/* Top Green Accent Bar */}
          <div className="h-2 bg-emerald-500 w-full" />
          
          <div className="p-8">
            <div className="flex flex-col items-center text-center mb-6">
              <div className="bg-emerald-500/10 p-3.5 rounded-full border border-emerald-500/20 mb-3 shadow-[0_0_15px_rgba(16,185,129,0.15)]">
                <ShieldCheck className="w-7 h-7 text-emerald-600 animate-pulse" />
              </div>
              <h2 className="text-xl font-hud font-extrabold tracking-wider text-slate-900 uppercase">
                Aegis <span className="text-emerald-600">Traffic-AI</span>
              </h2>
              <p className="text-[10px] uppercase font-bold tracking-widest text-slate-400 mt-1">Administrator Portal</p>
            </div>

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="text-[10px] uppercase font-bold text-slate-500 tracking-wider block mb-1">Username</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400">
                    <User className="w-4 h-4" />
                  </span>
                  <input 
                    type="text" 
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="admin"
                    required
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 pl-10 pr-4 text-xs font-semibold text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-emerald-500 focus:bg-white focus:ring-1 focus:ring-emerald-500/30 transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] uppercase font-bold text-slate-500 tracking-wider block mb-1">Password</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400">
                    <Lock className="w-4 h-4" />
                  </span>
                  <input 
                    type="password" 
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 pl-10 pr-4 text-xs font-semibold text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-emerald-500 focus:bg-white focus:ring-1 focus:ring-emerald-500/30 transition-all"
                  />
                </div>
              </div>

              {loginError && (
                <div className="bg-rose-50 border border-rose-100 text-rose-600 rounded-xl p-3 text-[10px] font-bold uppercase tracking-wide flex items-center gap-1.5 animate-pulse">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  {loginError}
                </div>
              )}

              <button 
                type="submit" 
                className="w-full bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white font-hud text-[11px] font-extrabold uppercase tracking-widest py-3 rounded-xl cursor-pointer transition-all shadow-[0_4px_12px_rgba(16,185,129,0.18)]"
              >
                Sign In
              </button>
            </form>
          </div>

          {/* Footer inside login card */}
          <div className="bg-slate-50 border-t border-slate-100 py-3.5 text-center text-[9px] font-hud text-slate-400 uppercase tracking-widest">
            Aegis Security Guard Engine v1.0
          </div>
        </div>
      </div>
    );
  }

  // RENDER MAIN DASHBOARD
  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col font-sans selection:bg-emerald-500 selection:text-white cyber-grid pb-8">
      
      {/* Top Banner / Navigation */}
      <header className="border-b border-slate-200/80 bg-white/70 backdrop-blur-md sticky top-0 z-40 px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="bg-emerald-500/10 p-2 rounded-lg border border-emerald-500/20 shadow-[0_0_15px_rgba(16,185,129,0.08)]">
            <Video className="w-6 h-6 text-emerald-600 animate-pulse" />
          </div>
          <div>
            <h1 className="text-xl font-hud font-extrabold tracking-wider text-slate-900 uppercase flex items-center gap-2">
              Aegis <span className="text-emerald-600">Traffic-AI</span>
            </h1>
            <p className="text-[10px] uppercase font-bold text-slate-400 tracking-widest mt-0.5">Control Center Dashboard</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Connection Status indicator */}
          <div className="flex items-center gap-2 bg-white border border-slate-200 px-3.5 py-1.5 rounded-full shadow-[inset_0_1px_2px_rgba(0,0,0,0.02)]">
            <span className={`w-2 h-2 rounded-full ${isConnected ? "bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]" : "bg-rose-500"}`} />
            <span className="text-[9px] font-hud font-bold tracking-widest text-slate-500 uppercase">
              {isConnected ? "ONLINE" : "OFFLINE"}
            </span>
          </div>

          {/* Logout button */}
          <button 
            onClick={handleLogout}
            className="bg-slate-100 hover:bg-slate-200/80 border border-slate-200 p-2 rounded-full text-slate-500 hover:text-slate-800 cursor-pointer transition-all"
            title="Log Out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Live System Alerts Ticker */}
      <div className="bg-white border-b border-slate-200 py-1.5 px-6 overflow-hidden hidden md:block">
        <div className="flex items-center justify-between text-[10px] font-hud text-slate-400 tracking-wider">
          <div className="flex items-center gap-6">
            <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> ENGINE: YOLOv8n</span>
            <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> OCR: EASYOCR_READER</span>
            <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> TIMING: ACTIVE DETECT</span>
          </div>
          <div className="flex items-center gap-2 font-mono text-[9px] text-slate-400">
            <span>LOCATION: ST-JUNCTION-01</span>
            <span>•</span>
            <span className="text-emerald-600 animate-pulse font-hud">LATENCY: 12MS</span>
          </div>
        </div>
      </div>

      {/* Main Container */}
      <main className="flex-1 p-6 max-w-7xl mx-auto w-full grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left column (2/3 width) */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          
          {/* Key Metrics Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            
            {/* Total Cars */}
            <div className="glass-panel border border-slate-200/80 rounded-xl p-4 flex flex-col justify-between hover:border-emerald-500/30 hover:shadow-[0_0_20px_rgba(16,185,129,0.06)] transition-all duration-300">
              <div className="flex justify-between items-center mb-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Total Cars</span>
                <div className="bg-emerald-500/10 p-1.5 rounded-lg border border-emerald-500/20">
                  <Car className="w-4 h-4 text-emerald-600" />
                </div>
              </div>
              <div className="mt-2">
                <p className="text-3xl font-hud font-extrabold text-slate-900 tracking-wider">{totalVehicles}</p>
                <p className="text-[10px] text-slate-400 uppercase font-bold mt-1 tracking-wide">Junction Traffic Count</p>
              </div>
            </div>

            {/* Active Green */}
            <div className="glass-panel border border-slate-200/80 rounded-xl p-4 flex flex-col justify-between hover:border-emerald-500/30 hover:shadow-[0_0_20px_rgba(16,185,129,0.06)] transition-all duration-300">
              <div className="flex justify-between items-center mb-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Active Green</span>
                <div className="bg-emerald-500/10 p-1.5 rounded-lg border border-emerald-500/20">
                  <Activity className="w-4 h-4 text-emerald-600" />
                </div>
              </div>
              <div className="mt-2">
                <p className="text-3xl font-hud font-extrabold text-emerald-600 capitalize tracking-wider">{activeLane}</p>
                <p className="text-[10px] text-slate-400 uppercase font-bold mt-1 tracking-wide">
                  {activeSignal ? `${activeSignal.duration}s remaining` : "Standby"}
                </p>
              </div>
            </div>

            {/* Violations */}
            <div className="glass-panel border border-slate-200/80 rounded-xl p-4 flex flex-col justify-between hover:border-rose-500/30 hover:shadow-[0_0_20px_rgba(244,63,94,0.06)] transition-all duration-300">
              <div className="flex justify-between items-center mb-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Violations</span>
                <div className="bg-rose-500/10 p-1.5 rounded-lg border border-rose-500/20">
                  <AlertTriangle className="w-4 h-4 text-rose-500" />
                </div>
              </div>
              <div className="mt-2">
                <p className="text-3xl font-hud font-extrabold text-rose-500 tracking-wider">{violations.length}</p>
                <p className="text-[10px] text-slate-400 uppercase font-bold mt-1 tracking-wide">Red Light Crossings</p>
              </div>
            </div>

            {/* OCR Read Rate */}
            <div className="glass-panel border border-slate-200/80 rounded-xl p-4 flex flex-col justify-between hover:border-emerald-500/30 hover:shadow-[0_0_20px_rgba(16,185,129,0.06)] transition-all duration-300">
              <div className="flex justify-between items-center mb-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">OCR rate</span>
                <div className="bg-emerald-500/10 p-1.5 rounded-lg border border-emerald-500/20">
                  <ShieldAlert className="w-4 h-4 text-emerald-600" />
                </div>
              </div>
              <div className="mt-2">
                <p className="text-3xl font-hud font-extrabold text-slate-900 tracking-wider">{ocrRate}%</p>
                <p className="text-[10px] text-slate-400 uppercase font-bold mt-1 tracking-wide">{ocrSuccessCount} plates read</p>
              </div>
            </div>
          </div>

          {/* Junction Camera Feed & Intersection Map Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Live Camera Feed */}
            <div className="glass-panel border border-slate-200/80 rounded-2xl p-5 flex flex-col min-h-[360px] relative overflow-hidden group">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Video className="w-4.5 h-4.5 text-emerald-600" />
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-widest font-hud">Junction Camera</h3>
                </div>
                <div className="flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-0.5 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_6px_rgba(16,185,129,0.6)]" />
                  <span className="text-[9px] font-bold text-emerald-600 uppercase tracking-wide font-mono">LIVE FEED</span>
                </div>
              </div>

              {/* Sci-Fi Target corner brackets (Green) */}
              <div className="absolute top-12 left-5 w-4 h-4 border-t-2 border-l-2 border-emerald-500/30" />
              <div className="absolute top-12 right-5 w-4 h-4 border-t-2 border-r-2 border-emerald-500/30" />
              <div className="absolute bottom-5 left-5 w-4 h-4 border-b-2 border-l-2 border-emerald-500/30" />
              <div className="absolute bottom-5 right-5 w-4 h-4 border-b-2 border-r-2 border-emerald-500/30" />

              <div className="flex-1 bg-slate-100 rounded-xl overflow-hidden border border-slate-200/60 flex items-center justify-center relative aspect-video shadow-md">
                <img 
                  src="http://localhost:5001/video_feed" 
                  alt="Live Traffic Stream" 
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    e.target.style.display = "none";
                    document.getElementById("camera-offline").style.display = "flex";
                  }}
                  onLoad={(e) => {
                    e.target.style.display = "block";
                    document.getElementById("camera-offline").style.display = "none";
                  }}
                />
                <div id="camera-offline" className="absolute inset-0 flex flex-col items-center justify-center text-center p-6 text-slate-400 bg-slate-100">
                  <Video className="w-8 h-8 mb-2 stroke-1 text-slate-350 animate-pulse" />
                  <p className="text-sm font-hud font-bold tracking-wider text-slate-500">Camera Offline</p>
                  <p className="text-[10px] text-slate-400 mt-1 uppercase font-bold font-hud">python main.py not running</p>
                </div>
              </div>
            </div>

            {/* Graphical Intersection Map */}
            <div className="glass-panel border border-slate-200/80 rounded-2xl p-5 flex flex-col items-center justify-center min-h-[360px] relative overflow-hidden">
              
              {/* Radar sweep animation background (Green) */}
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(16,185,129,0.02)_0%,transparent_70%)] animate-glow pointer-events-none" />

              <div className="w-full flex justify-between items-center mb-4 z-10">
                <div className="flex items-center gap-2">
                  <TrafficCone className="w-4.5 h-4.5 text-emerald-600" />
                  <h2 className="text-xs font-bold text-slate-900 uppercase tracking-widest font-hud">Junction Visualizer</h2>
                </div>
              </div>

              {/* Junction Grid Graphic */}
              <div className="relative w-64 h-64 bg-white rounded-full border border-slate-200/80 flex items-center justify-center overflow-hidden shadow-lg z-10">
                
                {/* Radar Grid Lines */}
                <div className="absolute inset-0 border border-slate-100 rounded-full scale-75 border-dashed" />
                <div className="absolute inset-0 border border-slate-100 rounded-full scale-50" />
                <div className="absolute inset-0 border border-slate-100 rounded-full scale-25 border-dashed" />
                
                {/* Radar Sweeper (Green) */}
                <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-emerald-500/5 to-transparent origin-center animate-radar pointer-events-none rounded-full" />

                {/* Roads */}
                <div className="absolute w-20 h-full bg-slate-100/90 border-l border-r border-dashed border-slate-200" />
                <div className="absolute h-20 w-full bg-slate-100/90 border-t border-b border-dashed border-slate-200" />

                {/* Center box */}
                <div className="absolute w-20 h-20 bg-slate-50 border border-slate-200 z-10 flex items-center justify-center text-[9px] text-slate-400 font-hud font-bold uppercase tracking-wider shadow">
                  Junction
                </div>

                {/* Lanes Signals mapping */}
                {signals.map((s) => {
                  const lane = s.lane;
                  const sig = s.signal;
                  
                  const positionClasses = {
                    north: "top-2 left-1/2 -translate-x-1/2 flex-col",
                    south: "bottom-2 left-1/2 -translate-x-1/2 flex-col-reverse",
                    east: "right-2 top-1/2 -translate-y-1/2 flex-row-reverse",
                    west: "left-2 top-1/2 -translate-y-1/2 flex-row"
                  };

                  return (
                    <div 
                      key={lane} 
                      className={`absolute flex items-center gap-1.5 z-20 bg-white border border-slate-200 p-1.5 rounded-lg shadow ${positionClasses[lane]}`}
                    >
                      {/* Traffic Light circle */}
                      <div className="flex flex-col gap-0.5 bg-slate-50 p-0.5 rounded border border-slate-100">
                        <div className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${sig === "RED" ? "bg-rose-500 shadow-[0_0_6px_rgba(239,68,68,0.5)]" : "bg-rose-100"}`} />
                        <div className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${sig === "ORANGE" ? "bg-amber-500 shadow-[0_0_6px_rgba(245,158,11,0.5)]" : "bg-amber-100"}`} />
                        <div className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${sig === "GREEN" ? "bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.5)]" : "bg-emerald-100"}`} />
                      </div>

                      <div className="text-center min-w-[42px]">
                        <p className="text-[8px] font-bold text-slate-400 uppercase tracking-wider">{lane}</p>
                        <p className="text-[10px] font-hud text-slate-800 font-extrabold mt-0.5">{s.count}</p>
                        { (sig === "GREEN" || sig === "ORANGE") && (
                          <p className="text-[9px] font-hud text-amber-500 flex items-center justify-center gap-0.5 font-bold mt-0.5">
                            <Clock className="w-2 h-2 text-amber-450" /> {s.duration}s
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

          </div>

          {/* Chart Component */}
          <div className="glass-panel border border-slate-200/80 rounded-2xl p-6 shadow-md">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-widest font-hud flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-600" /> Lane Density Analytics
              </h3>
              <span className="text-[9px] font-hud text-slate-400 uppercase font-bold tracking-widest">METRIC CHART</span>
            </div>
            <div className="h-44 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                  <defs>
                    <linearGradient id="barEmerald" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10b981" stopOpacity={0.8}/>
                      <stop offset="100%" stopColor="#10b981" stopOpacity={0.1}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} opacity={0.5} />
                  <XAxis dataKey="name" stroke="#94a3b8" fontSize={9} tickLine={false} axisLine={false} />
                  <YAxis stroke="#94a3b8" fontSize={9} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: "#ffffff", borderColor: "rgba(16,185,129,0.3)", borderRadius: "8px", color: "#0f172a" }}
                    labelStyle={{ color: "#10b981", fontWeight: "bold", fontSize: 10, fontFamily: "Orbitron" }}
                  />
                  <Bar dataKey="Vehicles" fill="url(#barEmerald)" stroke="#10b981" strokeWidth={1} radius={[4, 4, 0, 0]} maxBarSize={32} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

        </div>

        {/* Right column (1/3 width) — Violations Panel */}
        <div className="glass-panel border border-slate-200/80 rounded-2xl flex flex-col h-[calc(100vh-140px)] min-h-[500px] shadow-md">
          
          {/* Header */}
          <div className="p-5 border-b border-slate-200/60 flex items-center justify-between">
            <div>
              <h2 className="text-xs font-bold text-slate-900 uppercase tracking-widest font-hud flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-500" /> Violations Log
              </h2>
              <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider mt-0.5">Surveillance list</p>
            </div>
            <div className="w-2.5 h-2.5 rounded-full bg-rose-500/10 border border-rose-500/30 flex items-center justify-center animate-pulse">
              <span className="w-1 h-1 rounded-full bg-rose-500" />
            </div>
          </div>

          {/* Tabs */}
          <div className="px-4 py-2.5 border-b border-slate-200 bg-slate-50 flex gap-2">
            <button 
              onClick={() => setActiveTab("all")}
              className={`text-[9px] font-hud tracking-widest uppercase font-bold px-3 py-1.5 rounded-md border transition-all ${activeTab === "all" ? "bg-white border-slate-200 text-slate-800 shadow-sm" : "border-transparent text-slate-400 hover:text-slate-600"}`}
            >
              All ({violations.length})
            </button>
            <button 
              onClick={() => setActiveTab("readable")}
              className={`text-[9px] font-hud tracking-widest uppercase font-bold px-3 py-1.5 rounded-md border transition-all ${activeTab === "readable" ? "bg-emerald-50 border-emerald-100 text-emerald-700 shadow-sm" : "border-transparent text-slate-400 hover:text-slate-600"}`}
            >
              OCR Resolved ({ocrSuccessCount})
            </button>
          </div>

          {/* Feed List */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {filteredViolations.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400">
                <ShieldAlert className="w-8 h-8 mb-2 stroke-1 text-slate-350" />
                <p className="text-xs font-hud font-bold tracking-wider uppercase text-slate-450">Log Empty</p>
                <p className="text-[9px] text-slate-400 mt-1 uppercase">No red light violations</p>
              </div>
            ) : (
              filteredViolations.map((v) => (
                <div 
                  key={v._id} 
                  className="bg-white border border-slate-200 hover:border-slate-300 rounded-xl p-3 hover:shadow-[0_2px_8px_rgba(0,0,0,0.03)] transition-all flex gap-3 group"
                >
                  {/* Image with zoom cursor to open full screenshot */}
                  <div 
                    onClick={() => setSelectedViolation(v)}
                    className="w-20 h-15 bg-slate-100 rounded-lg overflow-hidden border border-slate-200 flex-shrink-0 relative cursor-zoom-in group-hover:border-emerald-500/30 transition-all shadow-inner"
                  >
                    {v.imageUrl ? (
                      <img 
                        src={`http://localhost:5000${v.imageUrl}`} 
                        alt="Violation Proof"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-[8px] text-slate-400 font-bold uppercase">No Image</div>
                    )}
                  </div>

                  {/* Detail Panel */}
                  <div className="flex-1 min-w-0 flex flex-col justify-between">
                    <div className="flex items-start justify-between gap-1">
                      {/* Stylized license plate */}
                      <span className="font-hud text-[10px] font-bold bg-amber-500/10 border border-amber-500/30 text-amber-600 px-2 py-0.5 rounded leading-none">
                        {v.plate || "UNREADABLE"}
                      </span>
                      <span className="text-[8px] font-hud font-bold text-slate-400 uppercase tracking-widest bg-slate-50 border border-slate-200 px-1.5 py-0.5 rounded">
                        {v.lane}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[9px] text-slate-500 mt-2">
                      <span className="flex items-center gap-1 font-mono text-slate-400">
                        <Clock className="w-3 h-3 text-slate-400" />
                        {new Date(v.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </span>
                      <span className="text-[8px] font-bold text-rose-500 uppercase tracking-widest bg-rose-50 border border-rose-200 px-1.5 py-0.5 rounded animate-pulse">
                        CROSSING
                      </span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

        </div>

      </main>
      
      {/* Bottom Footer bar */}
      <footer className="border-t border-slate-200 bg-white/40 text-center py-3 text-[9px] text-slate-450 uppercase tracking-widest font-hud">
        Aegis Traffic Intelligence System • Secured
      </footer>

      {/* Violation Detail Proof Modal */}
      {selectedViolation && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-2xl w-full overflow-hidden shadow-2xl relative animate-in fade-in zoom-in duration-150">
            <button 
              onClick={() => setSelectedViolation(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 text-md font-bold bg-slate-50 border border-slate-200 w-8 h-8 rounded-full flex items-center justify-center cursor-pointer transition-all hover:bg-slate-100 shadow-sm"
            >
              &times;
            </button>
            
            <div className="p-6">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4">
                <div>
                  <h3 className="text-xs font-hud font-bold uppercase tracking-widest text-rose-600 flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-rose-500 animate-pulse" /> Traffic Violation Proof
                  </h3>
                  <p className="text-[9px] text-slate-400 uppercase font-bold tracking-wider mt-1 font-hud">
                    Citation ID: CH-26-{selectedViolation._id ? selectedViolation._id.substring(5, 12).toUpperCase() : "MOCK"}
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-[8px] font-hud font-bold text-slate-400 uppercase tracking-widest block">Status</span>
                  <span className="text-[9px] font-hud font-bold text-rose-500 uppercase bg-rose-50 border border-rose-200 px-2.5 py-0.5 rounded mt-1 inline-block">
                    FINE ISSUED
                  </span>
                </div>
              </div>

              {/* Full Screenshot Proof */}
              <div className="w-full bg-slate-900 rounded-xl overflow-hidden border border-slate-150 aspect-video mb-4 flex items-center justify-center relative shadow-inner">
                <img 
                  src={`http://localhost:5000${selectedViolation.imageUrl}`} 
                  alt="Violation Screenshot" 
                  className="w-full h-full object-contain"
                />
              </div>

              {/* Invoice Fine Details Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
                
                {/* Vehicle telemetry card */}
                <div className="bg-slate-50 border border-slate-200/60 p-3.5 rounded-xl">
                  <h4 className="text-[9px] font-hud font-bold text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1">
                    <Car className="w-3.5 h-3.5 text-emerald-600" /> Vehicle Details
                  </h4>
                  <div className="space-y-2 text-[10px] text-slate-700">
                    <div className="flex justify-between">
                      <span className="text-slate-450 uppercase font-bold">Plate Code:</span>
                      <span className="font-hud font-bold text-amber-600">{selectedViolation.plate || "UNREADABLE"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-450 uppercase font-bold">Track ID:</span>
                      <span className="font-mono font-bold text-slate-650">
                        {selectedViolation.vehicleId !== -1 ? `#${selectedViolation.vehicleId}` : "STATIC_DETECTION"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-450 uppercase font-bold">Junction Lane:</span>
                      <span className="font-bold text-slate-600 capitalize">{selectedViolation.lane}</span>
                    </div>
                  </div>
                </div>

                {/* Citation invoice details */}
                <div className="bg-slate-50 border border-slate-200/60 p-3.5 rounded-xl">
                  <h4 className="text-[9px] font-hud font-bold text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1">
                    <FileText className="w-3.5 h-3.5 text-emerald-600" /> Citation Invoice
                  </h4>
                  <div className="space-y-2 text-[10px] text-slate-700">
                    <div className="flex justify-between">
                      <span className="text-slate-450 uppercase font-bold">Timestamp:</span>
                      <span className="font-mono text-slate-600">{new Date(selectedViolation.timestamp).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-450 uppercase font-bold">Violation:</span>
                      <span className="font-bold text-rose-500 uppercase">RED LIGHT SIGNAL JUMP</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-450 uppercase font-bold">Penalty fine:</span>
                      <span className="font-hud font-bold text-slate-800">₹500 INR</span>
                    </div>
                  </div>
                </div>

              </div>

              {/* Modal action buttons */}
              <div className="flex items-center gap-3 border-t border-slate-100 pt-4">
                <button
                  onClick={() => alert("Challan receipt download started.")}
                  className="flex-1 bg-white border border-slate-200 hover:border-slate-350 font-hud text-[10px] font-bold text-slate-750 uppercase tracking-widest py-2.5 rounded-xl flex items-center justify-center gap-1.5 cursor-pointer transition-all"
                >
                  <Download className="w-3.5 h-3.5" /> Download Invoice
                </button>
                <button
                  onClick={() => alert("Challan printed. Dispatch notification sent.")}
                  className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white font-hud text-[10px] font-bold uppercase tracking-widest py-2.5 rounded-xl flex items-center justify-center gap-1.5 cursor-pointer transition-all shadow-[0_3px_10px_rgba(16,185,129,0.15)]"
                >
                  <CheckCircle className="w-3.5 h-3.5" /> Dispatch Citation
                </button>
              </div>

            </div>
          </div>
        </div>
      )}
    </div>
  );
}
