import React, { useState, useEffect, useCallback } from 'react';
import { 
  LayoutDashboard, PenTool, BookOpen, BarChart2, // Sidebar Icons
  Clock, Cloud, Zap, Play, Pause, RotateCw, // Widget Icons
  CheckCircle, Plus, X, Save, DollarSign, Calendar,
  ChevronLeft, ChevronRight, Maximize2, Minimize2, LogOut,
  Moon, Sun, Edit3, Menu, GraduationCap, ExternalLink, Sunrise,
  Linkedin, Github, TrendingUp, Mail, Link // NEW ICONS ADDED
} from 'lucide-react';
import { db, auth } from './firebase'; 
import { collection, getDocs, setDoc, doc, deleteDoc, query, where, onSnapshot } from 'firebase/firestore';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import Login from './Login';

// Helper for debouncing writes
const debounce = (func, delay) => {
  let timeoutId;
  return (...args) => {
    if (timeoutId) clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func(...args), delay);
  };
};

export default function JournalApp() {
  const [user, setUser] = useState(null);
  const [loadingAuth, setLoadingAuth] = useState(true);

  // --- UI STATE ---
  const [view, setView] = useState('dashboard');
  const [zenMode, setZenMode] = useState(false);
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const [time, setTime] = useState(new Date());
  
  // --- DATA STATE ---
  const [entries, setEntries] = useState([]);
  const [currentEntry, setCurrentEntry] = useState({ title: '', content: '', date: new Date().toISOString().split('T')[0], mood: null });
  const [editingId, setEditingId] = useState(null);
  
  // --- WIDGET DATA ---
  const [weather, setWeather] = useState(null);
  
  // --- TIMER STATE ---
  const [pomoTime, setPomoTime] = useState(25 * 60);
  const [pomoActive, setPomoActive] = useState(false);
  const [initialPomoTime, setInitialPomoTime] = useState(25 * 60);
  const [isEditingTimer, setIsEditingTimer] = useState(false);
  const [customMinutes, setCustomMinutes] = useState('25');

  const [memo, setMemo] = useState('');
  const [habits, setHabits] = useState([]);
  const [newHabit, setNewHabit] = useState('');
  const [financeData, setFinanceData] = useState({ income: 0, planned: 0, remaining: 0, loaded: false });
  const [selectedFinMonth, setSelectedFinMonth] = useState(new Date().toISOString().slice(0, 7));

  // --- INITIALIZATION ---
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoadingAuth(false);
      if (u) {
        loadEntries(u.uid);
        subscribeToDashboard(u.uid);
      }
    });

    const timer = setInterval(() => setTime(new Date()), 1000);
    
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(async (pos) => {
        try {
          const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${pos.coords.latitude}&longitude=${pos.coords.longitude}&current_weather=true`);
          const data = await res.json();
          setWeather(data.current_weather);
        } catch(e) {}
      });
    }

    return () => { unsubscribe(); clearInterval(timer); };
  }, []);

  // --- TIMER LOGIC ---
  useEffect(() => {
    let int = null;
    if (pomoActive && pomoTime > 0) {
      int = setInterval(() => setPomoTime(t => t - 1), 1000);
    } else if (pomoTime === 0 && pomoActive) {
      setPomoActive(false);
      alert("Focus Session Complete!");
    }
    return () => clearInterval(int);
  }, [pomoActive, pomoTime]);

  const saveCustomTimer = () => {
    const mins = parseInt(customMinutes);
    if (!isNaN(mins) && mins > 0) {
      const newSeconds = mins * 60;
      setInitialPomoTime(newSeconds);
      setPomoTime(newSeconds);
      setIsEditingTimer(false);
    } else {
      setIsEditingTimer(false);
    }
  };

  // --- FINANCE SYNC ---
  useEffect(() => {
    if (!user) return;
    const appId = 'default-503020-app';
    const budgetDoc = doc(db, "artifacts", appId, "users", user.uid, "budget", selectedFinMonth);
    const itemsCol = collection(budgetDoc, "items");

    return onSnapshot(budgetDoc, (snap) => {
      const inc = snap.data()?.income || 0;
      onSnapshot(itemsCol, (iSnap) => {
        let planned = 0;
        iSnap.forEach(doc => planned += (doc.data().amount || 0));
        setFinanceData({ income: inc, planned, remaining: inc - planned, loaded: true });
      });
    });
  }, [user, selectedFinMonth]);

  // --- DASHBOARD SYNC ---
  const subscribeToDashboard = (uid) => {
    const ref = doc(db, "artifacts", "default-503020-app", "users", uid, "lumina_dashboard", "daily");
    onSnapshot(ref, (snap) => {
      if(snap.exists()) {
        const d = snap.data();
        setMemo(d.memo || '');
        const today = new Date().toISOString().split('T')[0];
        if(d.date !== today) {
           const reset = (d.habits || []).map(h => ({...h, completed: false}));
           setHabits(reset);
           saveDashboard(uid, d.memo, reset);
        } else {
           setHabits(d.habits || []);
        }
      }
    });
  };

  const saveDashboard = async (uid, m, h) => {
    await setDoc(doc(db, "artifacts", "default-503020-app", "users", uid, "lumina_dashboard", "daily"), {
      memo: m, habits: h, date: new Date().toISOString().split('T')[0]
    }, { merge: true });
  };

  const debouncedSaveMemo = useCallback(debounce((uid, m, h) => saveDashboard(uid, m, h), 1500), []);
  const handleMemo = (e) => {
    const val = e.target.value;
    setMemo(val);
    if(user) debouncedSaveMemo(user.uid, val, habits);
  };

  const toggleHabit = (id) => {
    const updated = habits.map(h => h.id === id ? {...h, completed: !h.completed} : h);
    setHabits(updated);
    if(user) saveDashboard(user.uid, memo, updated);
  };
  const addHabitAction = (e) => {
    if(e.key === 'Enter' && newHabit) {
      const updated = [...habits, {id: Date.now(), label: newHabit, completed: false}];
      setHabits(updated);
      setNewHabit('');
      if(user) saveDashboard(user.uid, memo, updated);
    }
  };
  const deleteHabit = (id) => {
    const updated = habits.filter(h => h.id !== id);
    setHabits(updated);
    if(user) saveDashboard(user.uid, memo, updated);
  };

  // --- ENTRIES ---
  const loadEntries = async (uid) => {
    const q = query(collection(db, "entries"), where("userId", "==", uid));
    const snap = await getDocs(q);
    setEntries(snap.docs.map(d => ({id: d.id, ...d.data()})).sort((a,b) => new Date(b.date) - new Date(a.date)));
  };
  const saveEntry = async () => {
    if(!currentEntry.title || !user) return;
    const id = editingId || Date.now().toString();
    await setDoc(doc(db, "entries", id), {...currentEntry, userId: user.uid, id, wordCount: currentEntry.content.split(/\s+/).length});
    loadEntries(user.uid);
    setCurrentEntry({ title: '', content: '', date: new Date().toISOString().split('T')[0], mood: null });
    setEditingId(null);
    setView('entries');
  };
  const deleteEntry = async (id) => {
    if(confirm("Delete entry?")) { await deleteDoc(doc(db, "entries", id)); loadEntries(user.uid); }
  };

  // --- ANALYTICS HELPERS ---
  const getStats = () => ({
    total: entries.length,
    words: entries.reduce((s, e) => s + (e.wordCount || 0), 0),
    level: Math.floor(entries.reduce((s, e) => s + (e.wordCount || 0), 0) / 500) + 1
  });

  const getHeatmap = () => {
    const days = [];
    const today = new Date();
    for(let i=140; i>=0; i--) {
      const d = new Date(today); d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const hasEntry = entries.some(e => e.date === dateStr);
      days.push({date: dateStr, active: hasEntry});
    }
    return days;
  };

  const getMoodTrend = () => {
    const data = [];
    const today = new Date();
    for(let i=13; i>=0; i--) {
      const d = new Date(today); d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const entry = entries.find(e => e.date === dateStr);
      let val = 0; 
      if(entry) {
        if(entry.mood === 'happy') val = 3;
        else if(entry.mood === 'neutral') val = 2;
        else if(entry.mood === 'sad') val = 1;
      }
      const label = d.toLocaleDateString('en-US', {weekday:'narrow'});
      data.push({ date: dateStr, value: val, label });
    }
    return data;
  };

  const getWeeklyActivity = () => {
    const data = [];
    const today = new Date();
    for(let i=6; i>=0; i--) {
      const d = new Date(today); d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const entry = entries.find(e => e.date === dateStr);
      const count = entry ? (entry.wordCount || 0) : 0;
      const label = d.toLocaleDateString('en-US', {weekday:'short'});
      data.push({ label, count });
    }
    return data;
  };

  // --- CALENDAR HELPERS ---
  const getCalendarDays = () => {
    const year = time.getFullYear();
    const month = time.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDay = new Date(year, month, 1).getDay(); 
    const days = [];
    for (let i = 0; i < firstDay; i++) days.push(null);
    for (let i = 1; i <= daysInMonth; i++) days.push(i);
    return days;
  };

  const hasEntryOnDay = (day) => {
    if (!day) return false;
    const currentMonth = new Date().toISOString().slice(0, 7);
    const checkDate = `${currentMonth}-${day.toString().padStart(2, '0')}`;
    return entries.some(e => e.date === checkDate);
  };

  // --- DYNAMIC GREETING ICON ---
  const getGreetingIcon = () => {
    const hour = time.getHours();
    if (hour >= 5 && hour < 12) {
      return ( <div className="p-2 bg-yellow-500/20 rounded-lg"><Sunrise className="w-6 h-6 text-yellow-400 animate-bounce" style={{ animationDuration: '3s' }} /></div> );
    }
    if (hour >= 12 && hour < 17) {
      return ( <div className="p-2 bg-orange-500/20 rounded-lg"><Sun className="w-6 h-6 text-orange-400 animate-spin" style={{ animationDuration: '10s' }} /></div> );
    }
    return ( <div className="p-2 bg-indigo-500/20 rounded-lg"><Moon className="w-6 h-6 text-indigo-400 animate-pulse" style={{ animationDuration: '4s' }} /></div> );
  };

  if (loadingAuth) return <div className="h-screen bg-pro-bg text-pro-primary flex items-center justify-center font-sans animate-pulse">Loading System...</div>;
  if (!user) return <Login />;

  return (
    <div className="flex h-screen bg-pro-bg text-pro-text font-sans overflow-hidden relative">
      
      {/* --- BACKGROUND ANIMATION --- */}
      <style>{`
        @keyframes float {
          0% { transform: translate(0px, 0px) scale(1); }
          33% { transform: translate(30px, -50px) scale(1.1); }
          66% { transform: translate(-20px, 20px) scale(0.9); }
          100% { transform: translate(0px, 0px) scale(1); }
        }
        .animate-float { animation: float 10s ease-in-out infinite; }
        .animate-float-delayed { animation: float 12s ease-in-out infinite reverse; }
      `}</style>
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-600/10 rounded-full blur-[100px] animate-float"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-600/10 rounded-full blur-[100px] animate-float-delayed"></div>
        <div className="absolute top-[20%] right-[20%] w-[20%] h-[20%] bg-purple-600/5 rounded-full blur-[80px] animate-float"></div>
      </div>

      {/* --- SIDEBAR --- */}
      {!zenMode && (
        <aside 
          className={`
            fixed inset-y-0 left-0 z-50 bg-pro-bg/80 backdrop-blur-xl border-r border-pro-border flex flex-col justify-between py-6
            transition-all duration-300 ease-in-out shadow-2xl
            ${isSidebarOpen ? 'w-64' : 'w-20'}
          `}
          onMouseEnter={() => setSidebarOpen(true)}
          onMouseLeave={() => setSidebarOpen(false)}
        >
          <div>
            <div className="flex items-center gap-3 mb-10 px-4 h-12">
              <div 
                className="w-12 h-12 shrink-0 bg-gradient-primary rounded-xl flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-indigo-500/20 cursor-pointer"
                onClick={() => setSidebarOpen(!isSidebarOpen)}
              >
                {isSidebarOpen ? 'L' : <Menu className="w-6 h-6" />}
              </div>
              <h1 className={`text-2xl font-bold text-pro-white tracking-tight transition-opacity duration-300 ${isSidebarOpen ? 'opacity-100' : 'opacity-0 hidden'}`}>
                Lumina
              </h1>
            </div>

            <nav className="space-y-2 px-2">
              {[
                { id: 'dashboard', icon: LayoutDashboard, label: 'Dashboard' },
                { id: 'write', icon: PenTool, label: 'Journal' },
                { id: 'entries', icon: BookOpen, label: 'Entries' },
                { id: 'stats', icon: BarChart2, label: 'Analytics' }
              ].map(item => (
                <button 
                  key={item.id}
                  onClick={() => setView(item.id)}
                  className={`
                    flex items-center h-12 w-full rounded-xl transition-all duration-200 group relative
                    ${view === item.id 
                      ? 'bg-pro-card text-pro-primary shadow-sm border border-pro-border' 
                      : 'text-gray-500 hover:bg-white/5 hover:text-pro-white'}
                  `}
                >
                  <div className="w-16 h-12 flex items-center justify-center shrink-0">
                    <item.icon className={`w-5 h-5 transition-colors ${view === item.id ? 'text-pro-primary' : 'group-hover:text-pro-white'}`} />
                  </div>
                  <span className={`font-medium whitespace-nowrap overflow-hidden transition-all duration-300 ${isSidebarOpen ? 'opacity-100 w-auto' : 'opacity-0 w-0'}`}>
                    {item.label}
                  </span>
                </button>
              ))}
            </nav>
          </div>

          <div className="border-t border-pro-border pt-6 px-2">
             <button onClick={() => signOut(auth)} className="flex items-center h-12 w-full rounded-xl text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors">
               <div className="w-16 h-12 flex items-center justify-center shrink-0">
                 <LogOut className="w-5 h-5" />
               </div>
               <span className={`font-medium whitespace-nowrap overflow-hidden transition-all duration-300 ${isSidebarOpen ? 'opacity-100 w-auto' : 'opacity-0 w-0'}`}>
                 Logout
               </span>
             </button>
          </div>
        </aside>
      )}

      {/* --- MAIN CONTENT --- */}
      <main className={`flex-1 overflow-y-auto relative z-10 transition-all duration-300 ${zenMode ? '' : 'ml-20'}`}>
        
        {/* Header */}
        {!zenMode && (
          <header className="sticky top-0 z-40 bg-pro-bg/80 backdrop-blur-md px-8 py-6 flex justify-between items-center">
            <div className="flex items-center gap-4">
              {getGreetingIcon()}
              <div>
                <h2 className="text-2xl font-bold text-pro-white">
                  {time.getHours() < 12 ? 'Good Morning,' : time.getHours() < 17 ? 'Good Afternoon,' : 'Good Evening,'} 
                  <span className="text-pro-primary"> Achintha</span>
                </h2>
                <p className="text-sm text-gray-500 mt-1">Ready to organize your thoughts?</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
               <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-pro-card rounded-lg border border-pro-border">
                 <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                 <span className="text-xs font-mono text-gray-400">SYS.ONLINE</span>
               </div>
            </div>
          </header>
        )}

        <div className={`mx-auto ${zenMode ? 'h-full flex items-center justify-center' : 'p-8 max-w-7xl'}`}>
          
          {/* --- DASHBOARD VIEW --- */}
          {view === 'dashboard' && !zenMode && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              
              {/* 1. Time & Weather */}
              <div className="lg:col-span-2 bg-pro-card rounded-2xl p-6 border border-pro-border shadow-sm flex flex-col justify-between relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-64 h-64 bg-pro-primary/5 rounded-full blur-3xl -mr-16 -mt-16 transition-all group-hover:bg-pro-primary/10"></div>
                <div className="flex justify-between items-start z-10">
                  <div className="p-2 bg-pro-bg rounded-lg border border-pro-border"><Clock className="w-5 h-5 text-pro-secondary" /></div>
                  <div className="text-right">
                    <span className="text-3xl font-bold text-pro-white">{weather?.temperature}°</span>
                    <p className="text-xs text-gray-500 uppercase tracking-wider">Colombo, LK</p>
                  </div>
                </div>
                <div className="mt-8 z-10">
                  <h3 className="text-6xl font-bold text-pro-white tracking-tighter font-mono">
                    {time.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                  </h3>
                  <p className="text-pro-text mt-2 font-medium">
                    {time.toLocaleDateString(undefined, {weekday:'long', month:'long', day:'numeric'})}
                  </p>
                </div>
              </div>

              {/* 2. Focus Timer */}
              <div className="lg:col-span-1 bg-gradient-primary rounded-2xl p-6 shadow-lg shadow-indigo-500/20 text-white flex flex-col justify-between relative overflow-hidden">
                <div className="absolute top-0 right-0 p-6 opacity-20"><Zap className="w-12 h-12" /></div>
                <div className="z-10 w-full">
                  <div className="flex justify-between items-center mb-1">
                     <h4 className="text-indigo-100 font-medium text-sm">Focus Session</h4>
                     {!pomoActive && !isEditingTimer && (
                       <button onClick={() => setIsEditingTimer(true)} className="text-indigo-200 hover:text-white p-1 rounded hover:bg-white/10" title="Edit Time">
                         <Edit3 className="w-4 h-4" />
                       </button>
                     )}
                  </div>
                  {isEditingTimer ? (
                    <div className="flex items-center gap-2 mb-2">
                      <input type="number" autoFocus value={customMinutes} onChange={(e) => setCustomMinutes(e.target.value)} className="w-16 bg-white/20 text-white text-2xl font-bold font-mono p-1 rounded border border-white/30 focus:outline-none focus:border-white text-center" />
                      <span className="text-sm">mins</span>
                      <button onClick={saveCustomTimer} className="ml-auto bg-white/20 hover:bg-white/30 p-1 px-3 rounded text-sm">Set</button>
                    </div>
                  ) : (
                    <span onClick={() => !pomoActive && setIsEditingTimer(true)} className={`text-5xl font-bold font-mono block cursor-pointer transition-opacity ${pomoActive ? '' : 'hover:opacity-80'}`} title="Click to edit duration">
                      {Math.floor(pomoTime/60).toString().padStart(2,'0')}:{ (pomoTime%60).toString().padStart(2,'0') }
                    </span>
                  )}
                </div>
                <div className="flex gap-3 mt-4 z-10">
                  <button onClick={() => setPomoActive(!pomoActive)} className="flex-1 bg-white/20 hover:bg-white/30 backdrop-blur-sm py-2 rounded-lg font-medium transition-colors flex items-center justify-center gap-2">
                    {pomoActive ? <Pause className="w-4 h-4"/> : <Play className="w-4 h-4"/>} {pomoActive ? 'Pause' : 'Start'}
                  </button>
                  <button onClick={() => {setPomoActive(false); setPomoTime(initialPomoTime)}} className="px-3 bg-white/20 hover:bg-white/30 backdrop-blur-sm rounded-lg" title="Reset"><RotateCw className="w-4 h-4"/></button>
                </div>
              </div>

              {/* 3. BudgetFlow Widget */}
              <div className="lg:col-span-1 bg-pro-card rounded-2xl p-6 border border-pro-border shadow-sm flex flex-col justify-between">
                <div className="flex justify-between items-center mb-4">
                  <h4 className="font-semibold text-pro-white flex items-center gap-2"><DollarSign className="w-4 h-4 text-green-500"/> Budget</h4>
                  <div className="flex gap-1 bg-pro-bg rounded-md p-1">
                    <button onClick={() => {const d = new Date(selectedFinMonth); d.setMonth(d.getMonth()-1); setSelectedFinMonth(d.toISOString().slice(0,7));}} className="p-1 hover:text-white"><ChevronLeft className="w-3 h-3"/></button>
                    <button onClick={() => {const d = new Date(selectedFinMonth); d.setMonth(d.getMonth()+1); setSelectedFinMonth(d.toISOString().slice(0,7));}} className="p-1 hover:text-white"><ChevronRight className="w-3 h-3"/></button>
                  </div>
                </div>
                {financeData.loaded ? (
                  <div className="space-y-4">
                    <div>
                      <span className="text-xs text-gray-500 uppercase">Remaining</span>
                      <div className={`text-2xl font-bold ${financeData.remaining < 0 ? 'text-red-500' : 'text-emerald-400'}`}>${financeData.remaining.toLocaleString()}</div>
                    </div>
                    <div className="w-full bg-pro-bg rounded-full h-2 overflow-hidden"><div className="h-full bg-pro-secondary rounded-full transition-all duration-1000" style={{width: `${Math.min((financeData.planned/financeData.income)*100, 100)}%`}}></div></div>
                    <button onClick={() => window.open('https://budget.infinityfree.me/?i=1', '_blank')} className="w-full py-2 text-xs font-medium bg-pro-bg hover:bg-pro-border rounded-lg text-pro-text transition-colors flex items-center justify-center gap-2 group">Open BudgetFlow <ExternalLink className="w-3 h-3 group-hover:translate-x-1 transition-transform" /></button>
                  </div>
                ) : (
                  <div className="flex-1 flex items-center justify-center text-xs text-gray-500 animate-pulse">Syncing...</div>
                )}
              </div>

              {/* 4. Habits List */}
              <div className="lg:col-span-1 bg-pro-card rounded-2xl p-6 border border-pro-border shadow-sm flex flex-col">
                <div className="flex justify-between items-center mb-4">
                  <h4 className="font-semibold text-pro-white flex items-center gap-2"><CheckCircle className="w-4 h-4 text-pro-primary"/> Habits</h4>
                  <span className="text-xs bg-pro-bg px-2 py-1 rounded text-gray-500">{habits.filter(h => h.completed).length}/{habits.length}</span>
                </div>
                <div className="flex-1 overflow-y-auto space-y-2 max-h-40 custom-scrollbar pr-2">
                  {habits.map(h => (
                    <div key={h.id} className="group flex items-center justify-between p-3 rounded-xl bg-pro-bg border border-pro-border hover:border-pro-primary/50 transition-colors cursor-pointer" onClick={() => toggleHabit(h.id)}>
                      <div className="flex items-center gap-3">
                        <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${h.completed ? 'bg-pro-primary border-pro-primary' : 'border-gray-600'}`}>
                          {h.completed && <CheckCircle className="w-3 h-3 text-white" />}
                        </div>
                        <span className={`text-xs ${h.completed ? 'text-gray-500 line-through' : 'text-gray-200'}`}>{h.label}</span>
                      </div>
                      <button onClick={(e) => {e.stopPropagation(); deleteHabit(h.id)}} className="opacity-0 group-hover:opacity-100 text-gray-500 hover:text-red-400"><X className="w-3 h-3"/></button>
                    </div>
                  ))}
                </div>
                <div className="mt-3">
                  <input type="text" value={newHabit} onChange={(e) => setNewHabit(e.target.value)} onKeyDown={addHabitAction} placeholder="Add..." className="w-full bg-pro-bg border border-pro-border rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-pro-primary" />
                </div>
              </div>

              {/* 5. Calendar */}
              <div className="lg:col-span-1 bg-pro-card rounded-2xl p-6 border border-pro-border shadow-sm flex flex-col">
                <div className="flex justify-between items-center mb-4">
                  <h4 className="font-semibold text-pro-white flex items-center gap-2"><Calendar className="w-4 h-4 text-pro-secondary"/> Calendar</h4>
                </div>
                <div className="grid grid-cols-7 gap-1 text-center text-xs mb-2">
                  {['S','M','T','W','T','F','S'].map((d, i) => (<span key={i} className="text-gray-600 font-bold">{d}</span>))}
                </div>
                <div className="grid grid-cols-7 gap-1 text-center flex-1 content-start">
                  {getCalendarDays().map((day, idx) => {
                    if (!day) return <div key={`empty-${idx}`} className="aspect-square"></div>;
                    const hasData = hasEntryOnDay(day);
                    const isToday = day === new Date().getDate();
                    return (
                      <div key={day} className={`aspect-square flex items-center justify-center text-xs font-medium rounded-full transition-colors cursor-default relative ${isToday ? 'bg-pro-primary text-white font-bold' : 'text-gray-400 hover:bg-pro-bg'}`}>
                        {day}
                        {hasData && !isToday && (<div className="absolute bottom-1 w-1 h-1 rounded-full bg-pro-secondary"></div>)}
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* 6. Recent Activity Stream */}
              <div className="lg:col-span-1 bg-pro-card rounded-2xl p-6 border border-pro-border shadow-sm flex flex-col">
                <div className="flex justify-between items-center mb-4">
                  <h4 className="font-semibold text-pro-white flex items-center gap-2"><BookOpen className="w-4 h-4 text-pink-500"/> Recent</h4>
                </div>
                <div className="flex-1 space-y-3 overflow-y-auto max-h-48 custom-scrollbar pr-1">
                  {entries.length === 0 ? (
                    <div className="text-center text-gray-600 text-xs py-4">No entries yet.</div>
                  ) : (
                    entries.slice(0, 3).map(e => (
                      <div key={e.id} onClick={() => {setCurrentEntry(e); setEditingId(e.id); setView('write')}} className="p-3 bg-pro-bg rounded-lg border border-pro-border hover:border-pink-500/50 cursor-pointer transition-all group">
                        <div className="flex justify-between items-start mb-1">
                          <span className="text-xs text-gray-500">{e.date}</span>
                          {e.mood === 'happy' && <Sun className="w-3 h-3 text-yellow-400"/>}
                          {e.mood === 'sad' && <Moon className="w-3 h-3 text-indigo-400"/>}
                        </div>
                        <h5 className="text-sm font-medium text-gray-300 truncate group-hover:text-white">{e.title}</h5>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* 7. Education Manager */}
              <div className="lg:col-span-1 bg-pro-card rounded-2xl p-6 border border-pro-border shadow-sm flex flex-col justify-between relative overflow-hidden group hover:border-blue-500/50 transition-colors">
                <div className="absolute inset-0 bg-blue-500/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <div className="relative z-10">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-blue-500/10 rounded-lg text-blue-400"><GraduationCap className="w-6 h-6" /></div>
                    <div><h4 className="font-bold text-pro-white">Education</h4><p className="text-xs text-gray-500">Course Manager</p></div>
                  </div>
                  <p className="text-sm text-gray-400 mb-4 line-clamp-2">Access your learning dashboard, track progress, and manage assignments.</p>
                </div>
                <button onClick={() => window.open('https://eduapp-chi.vercel.app/', '_blank')} className="relative z-10 w-full py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2">Launch App <ExternalLink className="w-3 h-3" /></button>
              </div>

              {/* 8. Command Center (NEW: Quick Links) */}
              <div className="lg:col-span-1 bg-pro-card rounded-2xl p-6 border border-pro-border shadow-sm flex flex-col">
                <div className="flex justify-between items-center mb-4">
                  <h4 className="font-semibold text-pro-white flex items-center gap-2"><Link className="w-4 h-4 text-purple-500"/> Command Center</h4>
                </div>
                <div className="flex-1 grid grid-cols-2 gap-2 overflow-y-auto custom-scrollbar">
                  <a href="https://outlook.live.com/mail/0/" target="_blank" rel="noreferrer" className="flex flex-col items-center justify-center p-3 bg-pro-bg border border-pro-border rounded-xl hover:border-blue-500 transition-all group">
                    <Mail className="w-5 h-5 text-blue-400 group-hover:scale-110 transition-transform mb-1" />
                    <span className="text-[10px] text-gray-400">Outlook</span>
                  </a>
                  <a href="https://mail.google.com/mail/u/0/#inbox" target="_blank" rel="noreferrer" className="flex flex-col items-center justify-center p-3 bg-pro-bg border border-pro-border rounded-xl hover:border-red-500 transition-all group">
                    <Mail className="w-5 h-5 text-red-400 group-hover:scale-110 transition-transform mb-1" />
                    <span className="text-[10px] text-gray-400">Gmail</span>
                  </a>
                  <a href="https://www.linkedin.com/feed/" target="_blank" rel="noreferrer" className="flex flex-col items-center justify-center p-3 bg-pro-bg border border-pro-border rounded-xl hover:border-blue-600 transition-all group">
                    <Linkedin className="w-5 h-5 text-blue-600 group-hover:scale-110 transition-transform mb-1" />
                    <span className="text-[10px] text-gray-400">LinkedIn</span>
                  </a>
                  <a href="https://github.com/hexcoder5394" target="_blank" rel="noreferrer" className="flex flex-col items-center justify-center p-3 bg-pro-bg border border-pro-border rounded-xl hover:border-gray-400 transition-all group">
                    <Github className="w-5 h-5 text-white group-hover:scale-110 transition-transform mb-1" />
                    <span className="text-[10px] text-gray-400">GitHub</span>
                  </a>
                  <a href="https://xapponline.ndbwealth.com/" target="_blank" rel="noreferrer" className="col-span-2 flex items-center justify-center gap-2 p-3 bg-pro-bg border border-pro-border rounded-xl hover:border-green-500 transition-all group">
                    <TrendingUp className="w-4 h-4 text-green-500 group-hover:scale-110 transition-transform" />
                    <span className="text-xs text-gray-400">NDB Wealth</span>
                  </a>
                </div>
              </div>

              {/* 9. Quick Notes (Expanded) */}
              <div className="lg:col-span-2 bg-pro-card rounded-2xl p-6 border border-pro-border shadow-sm flex flex-col">
                <div className="flex justify-between items-center mb-2">
                  <h4 className="font-semibold text-pro-white flex items-center gap-2"><Save className="w-4 h-4 text-yellow-500"/> Quick Notes</h4>
                  <span className="text-[10px] text-gray-600 uppercase">Auto-Sync</span>
                </div>
                <textarea 
                  value={memo} 
                  onChange={handleMemo} 
                  placeholder="Capture your thoughts..." 
                  className="flex-1 w-full bg-pro-bg rounded-xl border border-pro-border p-4 text-sm text-gray-300 focus:outline-none focus:border-pro-primary resize-none transition-colors"
                  style={{minHeight: '140px'}}
                />
              </div>

            </div>
          )}

          {/* --- WRITE VIEW --- */}
          {(view === 'write' || zenMode) && (
            <div className={`relative flex flex-col h-full ${zenMode ? 'max-w-3xl mx-auto w-full' : 'bg-pro-card rounded-2xl border border-pro-border p-8 shadow-sm h-[calc(100vh-140px)]'}`}>
              
              <div className="absolute top-4 right-4 z-20">
                <button onClick={() => setZenMode(!zenMode)} className="p-2 text-gray-400 hover:text-white bg-pro-bg rounded-full border border-pro-border transition-colors">
                  {zenMode ? <Minimize2 className="w-5 h-5"/> : <Maximize2 className="w-5 h-5"/>}
                </button>
              </div>

              <div className="mb-6 border-b border-pro-border pb-4">
                <input 
                  type="text" 
                  value={currentEntry.title} 
                  onChange={(e) => setCurrentEntry({...currentEntry, title: e.target.value})} 
                  placeholder="Title of your entry..." 
                  className="w-full bg-transparent text-4xl font-bold text-pro-white placeholder-gray-700 focus:outline-none"
                />
                <div className="flex gap-4 mt-4">
                   {[
                     {id:'happy', icon:Sun, color:'text-yellow-400'},
                     {id:'neutral', icon:Cloud, color:'text-gray-400'},
                     {id:'sad', icon:Moon, color:'text-indigo-400'}
                   ].map(m => (
                     <button key={m.id} onClick={() => setCurrentEntry({...currentEntry, mood: m.id})} className={`flex items-center gap-2 px-3 py-1.5 rounded-full border transition-all ${currentEntry.mood === m.id ? `bg-pro-bg border-white/20 ${m.color}` : 'border-transparent text-gray-600 hover:bg-pro-bg'}`}>
                       <m.icon className="w-4 h-4" /> <span className="text-xs capitalize">{m.id}</span>
                     </button>
                   ))}
                </div>
              </div>

              <textarea 
                value={currentEntry.content} 
                onChange={(e) => setCurrentEntry({...currentEntry, content: e.target.value})} 
                placeholder="What's on your mind today?" 
                className="flex-1 w-full bg-transparent text-lg text-gray-300 leading-relaxed resize-none focus:outline-none font-sans"
              />

              <div className="pt-4 flex justify-between items-center text-sm text-gray-500">
                <span>{currentEntry.content.split(/\s+/).filter(w => w.length > 0).length} words</span>
                <button 
                  onClick={saveEntry}
                  disabled={!currentEntry.title}
                  className="px-6 py-2 bg-pro-primary hover:bg-indigo-500 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Save Entry
                </button>
              </div>
            </div>
          )}

          {/* --- ENTRIES VIEW --- */}
          {view === 'entries' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-10">
              {entries.map(e => (
                <div key={e.id} onClick={() => {setCurrentEntry(e); setEditingId(e.id); setView('write')}} className="group bg-pro-card border border-pro-border hover:border-pro-primary/50 p-6 rounded-2xl cursor-pointer transition-all hover:shadow-lg hover:-translate-y-1">
                  <div className="flex justify-between items-start mb-3">
                    <span className="text-xs font-mono text-pro-primary bg-pro-primary/10 px-2 py-1 rounded inline-block">{e.date}</span>
                    <button onClick={(event) => { event.stopPropagation(); deleteEntry(e.id); }} className="text-gray-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"><X className="w-4 h-4"/></button>
                  </div>
                  <h3 className="text-xl font-bold text-pro-white mb-2 truncate">{e.title}</h3>
                  <p className="text-gray-500 text-sm line-clamp-3">{e.content}</p>
                </div>
              ))}
            </div>
          )}

          {/* --- STATS VIEW --- */}
          {view === 'stats' && (
            <div className="col-span-full space-y-6">
              
              {/* Top Stats Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-pro-card p-6 rounded-2xl border border-pro-border flex flex-col items-center justify-center relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-purple-500"></div>
                  <div className="text-4xl font-bold text-pro-white mb-1">{getStats().total}</div>
                  <div className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Total Entries</div>
                </div>
                <div className="bg-pro-card p-6 rounded-2xl border border-pro-border flex flex-col items-center justify-center relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-cyan-500 to-blue-500"></div>
                  <div className="text-4xl font-bold text-pro-secondary mb-1">{getStats().words}</div>
                  <div className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Words Written</div>
                </div>
                <div className="bg-pro-card p-6 rounded-2xl border border-pro-border flex flex-col items-center justify-center relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-500 to-pink-500"></div>
                  <div className="text-4xl font-bold text-pro-primary mb-1">Lvl {getStats().level}</div>
                  <div className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Writer Level</div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                
                {/* CHART 1: MOOD TREND */}
                <div className="bg-pro-card p-6 rounded-2xl border border-pro-border shadow-sm">
                  <h3 className="text-lg font-bold text-pro-white mb-6 flex items-center gap-2">
                    <Zap className="w-5 h-5 text-yellow-400"/> Mood Trends (14 Days)
                  </h3>
                  <div className="h-40 flex items-end justify-between gap-2 px-2 relative">
                    <div className="absolute inset-0 flex flex-col justify-between pointer-events-none opacity-20">
                      <div className="border-t border-gray-500 w-full h-0"></div>
                      <div className="border-t border-gray-500 w-full h-0"></div>
                      <div className="border-t border-gray-500 w-full h-0"></div>
                    </div>
                    {getMoodTrend().map((d, i) => (
                      <div key={i} className="flex flex-col items-center gap-2 flex-1 group">
                        <div className="relative w-full flex justify-center h-32 items-end">
                          {d.value > 0 && (
                            <div className={`w-2 rounded-full transition-all duration-500 ${d.value === 3 ? 'h-full bg-yellow-400 shadow-[0_0_10px_rgba(250,204,21,0.5)]' : d.value === 2 ? 'h-2/3 bg-gray-400' : 'h-1/3 bg-indigo-500'}`}></div>
                          )}
                          {d.value === 0 && <div className="w-1 h-1 rounded-full bg-gray-700 mb-1"></div>}
                        </div>
                        <span className="text-[10px] text-gray-500 uppercase font-mono">{d.label}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* CHART 2: WEEKLY WORD COUNT */}
                <div className="bg-pro-card p-6 rounded-2xl border border-pro-border shadow-sm">
                  <h3 className="text-lg font-bold text-pro-white mb-6 flex items-center gap-2">
                    <PenTool className="w-5 h-5 text-pro-secondary"/> Writing Volume (7 Days)
                  </h3>
                  <div className="h-40 flex items-end justify-between gap-3">
                    {getWeeklyActivity().map((d, i) => {
                      const heightPct = Math.min(100, (d.count / 1000) * 100); 
                      return (
                        <div key={i} className="flex-1 flex flex-col justify-end items-center gap-2 group">
                          <span className="text-[10px] text-pro-white opacity-0 group-hover:opacity-100 transition-opacity absolute -mt-6">{d.count}</span>
                          <div className="w-full bg-pro-bg rounded-t-md relative overflow-hidden group-hover:bg-opacity-80 transition-all" style={{height: `${Math.max(5, heightPct)}%`}}>
                            <div className="absolute inset-0 bg-pro-secondary opacity-20"></div>
                            <div className="absolute bottom-0 left-0 right-0 bg-pro-secondary" style={{height: '4px'}}></div>
                          </div>
                          <span className="text-xs text-gray-500 font-medium">{d.label}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>

              {/* Heatmap */}
              <div className="bg-pro-card p-8 rounded-2xl border border-pro-border">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-lg font-bold text-pro-white flex items-center gap-2"><BarChart2 className="w-5 h-5 text-pro-primary"/> Annual Consistency</h3>
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <span>Less</span>
                    <div className="w-3 h-3 bg-pro-border/30 rounded-sm"></div>
                    <div className="w-3 h-3 bg-pro-primary rounded-sm shadow-sm shadow-indigo-500/50"></div>
                    <span>More</span>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1">
                  {getHeatmap().map((d, i) => (
                    <div key={i} title={d.date} className={`w-3 h-3 rounded-sm transition-all hover:scale-125 ${d.active ? 'bg-pro-primary shadow-sm shadow-indigo-500/50' : 'bg-pro-border/30'}`}></div>
                  ))}
                </div>
              </div>
            </div>
          )}

        </div>
      </main>
    </div>
  );
}