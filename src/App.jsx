import React, { useState, useEffect } from 'react';
import { 
  PenLine, Calendar as CalIcon, Trash2, Star, LogOut, 
  Zap, Cpu, Radio, Activity, Clock, LayoutGrid, Save, Wifi, Battery, 
  ShieldCheck, Play, Pause, X, Wind, RotateCw, Minus, Plus,
  CircleDollarSign, ExternalLink, AlertTriangle, ChevronLeft, ChevronRight,
  Maximize2, Minimize2 
} from 'lucide-react';
import { db, auth } from './firebase'; 
import { collection, getDocs, setDoc, doc, deleteDoc, query, where, onSnapshot } from 'firebase/firestore';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import Login from './Login';

export default function JournalApp() {
  const [user, setUser] = useState(null);
  const [loadingAuth, setLoadingAuth] = useState(true);

  // --- APP STATE ---
  const [entries, setEntries] = useState([]);
  const [currentEntry, setCurrentEntry] = useState({ 
    title: '', content: '', date: new Date().toISOString().split('T')[0],
    mood: null, tags: [], favorite: false, images: []
  });
  const [editingId, setEditingId] = useState(null);
  const [view, setView] = useState('dashboard'); 
  const [accent, setAccent] = useState('cyan'); 
  
  // --- ZEN MODE STATE ---
  const [zenMode, setZenMode] = useState(false);

  // --- WIDGET STATES ---
  const [time, setTime] = useState(new Date());
  const [memo, setMemo] = useState(localStorage.getItem('lumina_memo') || '');
  
  // Weather
  const [weather, setWeather] = useState(null);
  const [locationName, setLocationName] = useState('SCANNING...');

  // Pomodoro
  const [pomoTime, setPomoTime] = useState(25 * 60); 
  const [pomoActive, setPomoActive] = useState(false);
  const [totalPomoTime, setTotalPomoTime] = useState(25 * 60); 
  
  // Habits
  const [newHabit, setNewHabit] = useState('');
  const [habits, setHabits] = useState(() => {
    const saved = localStorage.getItem('lumina_habits');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed.date === new Date().toISOString().split('T')[0]) {
        return parsed.items;
      }
    }
    return [
      { id: 1, label: 'HYDRATION', completed: false },
      { id: 2, label: 'READING_DATA', completed: false },
      { id: 3, label: 'EXERCISE', completed: false }
    ];
  });

  // --- LIVE FINANCE STATE ---
  const [selectedFinMonth, setSelectedFinMonth] = useState(new Date().toISOString().slice(0, 7));
  const [financeData, setFinanceData] = useState({
    income: 0, planned: 0, remaining: 0, currency: '$', loaded: false
  });

  const moods = [
    { id: 'happy', icon: Zap, label: 'Super', color: 'text-cyber-yellow' },
    { id: 'good', icon: Activity, label: 'Active', color: 'text-cyber-cyan' },
    { id: 'neutral', icon: Radio, label: 'Stable', color: 'text-white' },
    { id: 'sad', icon: Cpu, label: 'Low Bat', color: 'text-cyber-purple' },
  ];

  // --- INITIALIZATION ---
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoadingAuth(false);
      if (currentUser) loadEntries(currentUser.uid);
    });

    const timer = setInterval(() => setTime(new Date()), 1000);

    // Weather Scan
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(async (position) => {
        try {
          const { latitude, longitude } = position.coords;
          const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true`);
          const data = await res.json();
          setWeather(data.current_weather);
          setLocationName(`${latitude.toFixed(2)}N, ${longitude.toFixed(2)}E`);
        } catch (e) {
          console.error("Weather Scan Failed");
          setLocationName("OFFLINE");
        }
      });
    }

    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && zenMode) {
        setZenMode(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      unsubscribe();
      clearInterval(timer);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [zenMode]);

  // --- FINANCE DATA LISTENER ---
  useEffect(() => {
    if (!user) return;
    setFinanceData(prev => ({ ...prev, loaded: false }));

    const appId = 'default-503020-app'; 
    const budgetDocRef = doc(db, "artifacts", appId, "users", user.uid, "budget", selectedFinMonth);
    const itemsColRef = collection(budgetDocRef, "items");

    const unsubDoc = onSnapshot(budgetDocRef, (docSnap) => {
      const data = docSnap.data();
      const income = data?.income || 0;
      
      const unsubItems = onSnapshot(itemsColRef, (itemsSnap) => {
        let totalPlanned = 0;
        itemsSnap.forEach(item => totalPlanned += (item.data().amount || 0));
        setFinanceData({
          income: income,
          planned: totalPlanned,
          remaining: income - totalPlanned,
          currency: '$', 
          loaded: true
        });
      });
      return () => unsubItems();
    }, (error) => {
      console.error("Finance Sync Error:", error);
      setFinanceData(prev => ({ ...prev, loaded: true, error: true }));
    });

    return () => unsubDoc();
  }, [user, selectedFinMonth]);

  // --- OTHER EFFECTS ---
  useEffect(() => {
    let interval = null;
    if (pomoActive && pomoTime > 0) {
      interval = setInterval(() => setPomoTime((prev) => prev - 1), 1000);
    } else if (pomoTime === 0) {
      setPomoActive(false);
      alert("NEURAL FOCUS SESSION COMPLETE.");
    }
    return () => clearInterval(interval);
  }, [pomoActive, pomoTime]);

  useEffect(() => { localStorage.setItem('lumina_memo', memo); }, [memo]);
  useEffect(() => {
    localStorage.setItem('lumina_habits', JSON.stringify({
      date: new Date().toISOString().split('T')[0],
      items: habits
    }));
  }, [habits]);

  // --- ACTIONS ---
  const addHabit = (e) => {
    if (e.key === 'Enter' && newHabit.trim()) {
      setHabits([...habits, { id: Date.now(), label: newHabit.toUpperCase(), completed: false }]);
      setNewHabit('');
    }
  };

  const deleteHabit = (id) => setHabits(habits.filter(h => h.id !== id));
  const toggleHabit = (id) => setHabits(habits.map(h => h.id === id ? { ...h, completed: !h.completed } : h));

  const adjustPomoTime = (minutes) => {
    setPomoActive(false); 
    const currentMins = Math.floor(pomoTime / 60);
    const newMins = currentMins + minutes;
    if (newMins >= 1 && newMins <= 90) {
      const newSeconds = newMins * 60;
      setPomoTime(newSeconds);
      setTotalPomoTime(newSeconds); 
    }
  };

  const changeFinanceMonth = (delta) => {
    const date = new Date(selectedFinMonth + "-01");
    date.setMonth(date.getMonth() + delta);
    setSelectedFinMonth(date.toISOString().slice(0, 7));
  };

  const formatPomoTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // --- DATABASE ---
  const loadEntries = async (uid) => {
    if (!uid) return;
    try {
      const q = query(collection(db, "entries"), where("userId", "==", uid));
      const querySnapshot = await getDocs(q);
      const loadedEntries = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setEntries(loadedEntries.sort((a, b) => new Date(b.date) - new Date(a.date)));
    } catch (error) { console.error("Error loading", error); }
  };

  const saveEntry = async () => {
    if (!currentEntry.title.trim() || !user) return;
    const entryId = editingId || Date.now().toString();
    const entry = { ...currentEntry, id: entryId, userId: user.uid, wordCount: currentEntry.content.split(/\s+/).length };
    try {
      await setDoc(doc(db, "entries", entryId), entry);
      await loadEntries(user.uid);
      setCurrentEntry({ title: '', content: '', date: new Date().toISOString().split('T')[0], mood: null, tags: [], favorite: false, images: [] });
      setEditingId(null);
      if (zenMode) {
        alert("LOG SAVED. REMAINING IN FOCUS CHAMBER.");
      } else {
        setView('entries');
      }
    } catch (e) { alert("ERROR SAVING DATA."); }
  };

  const deleteEntry = async (id) => {
    if(confirm("CONFIRM DELETION PROTOCOL?")) {
      await deleteDoc(doc(db, "entries", id));
      loadEntries(user.uid);
    }
  };

  const editEntry = (entry) => { setCurrentEntry(entry); setEditingId(entry.id); setView('write'); };

  const getStats = () => ({
    total: entries.length,
    words: entries.reduce((s, e) => s + (e.wordCount || 0), 0),
    favs: entries.filter(e => e.favorite).length
  });

  const getLevel = () => {
    const words = entries.reduce((s, e) => s + (e.wordCount || 0), 0);
    const level = Math.floor(words / 500) + 1;
    const progress = (words % 500) / 500 * 100;
    return { level, progress };
  };

  const getActivityHeatmap = () => {
    const today = new Date();
    const days = [];
    const weeksToShow = 20; 
    const startDate = new Date(today);
    startDate.setDate(today.getDate() - (weeksToShow * 7));
    while (startDate.getDay() !== 0) { startDate.setDate(startDate.getDate() - 1); }
    let currentDate = new Date(startDate);
    while (currentDate <= today) {
      const dateStr = currentDate.toISOString().split('T')[0];
      const entry = entries.find(e => e.date === dateStr);
      let intensity = 0;
      if (entry) {
        const words = (entry.wordCount || 0);
        if (words > 500) intensity = 3; else if (words > 200) intensity = 2; else intensity = 1;
      }
      days.push({ date: dateStr, intensity });
      currentDate.setDate(currentDate.getDate() + 1);
    }
    return days;
  };

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

  // --- RENDER ---
  if (loadingAuth) return <div className="min-h-screen bg-cyber-dark text-cyber-cyan font-display flex items-center justify-center text-xl tracking-widest animate-pulse">INITIALIZING SYSTEM...</div>;
  if (!user || !user.emailVerified) return <Login />;

  const accentColor = accent === 'pink' ? 'text-cyber-pink border-cyber-pink shadow-neon-pink' : 
                      accent === 'yellow' ? 'text-cyber-yellow border-cyber-yellow shadow-none' : 
                      'text-cyber-cyan border-cyber-cyan shadow-neon-cyan';
  const accentBg = accent === 'pink' ? 'bg-cyber-pink' : accent === 'yellow' ? 'bg-cyber-yellow' : 'bg-cyber-cyan';
  const accentText = accent === 'pink' ? 'text-cyber-pink' : accent === 'yellow' ? 'text-cyber-yellow' : 'text-cyber-cyan';

  return (
    <div className={`h-screen w-full bg-cyber-dark bg-grid-pattern text-gray-300 font-body selection:bg-cyber-pink selection:text-white flex flex-col ${zenMode ? 'p-0' : ''}`}>
      
      {/* Top HUD Bar */}
      {!zenMode && (
        <div className="h-16 border-b border-white/10 bg-cyber-dark/90 backdrop-blur-md z-50 shadow-2xl shrink-0">
          <div className="w-full px-6 h-full flex justify-between items-center">
            <div className="flex items-center gap-3 group cursor-pointer" onClick={() => setView('dashboard')}>
              <div className={`p-1.5 border ${accentColor} transition-transform group-hover:rotate-45`}>
                <Cpu className={`w-5 h-5 ${accentText}`} />
              </div>
              <h1 className="text-xl md:text-2xl font-display font-bold tracking-widest text-white uppercase group-hover:text-cyber-cyan transition-colors">
                Lumina <span className={`text-[10px] align-top ${accentText}`}>OS</span>
              </h1>
            </div>
            
            <div className="flex gap-6 items-center">
              <div className="hidden lg:flex flex-col items-end mr-4">
                <span className="text-[10px] font-mono text-gray-500">USER_LEVEL_0{getLevel().level}</span>
                <div className="w-24 h-1 bg-gray-800 mt-1">
                  <div className={`h-full ${accentBg} transition-all duration-1000`} style={{ width: `${getLevel().progress}%` }}></div>
                </div>
              </div>
              <div className="hidden md:flex gap-4 text-[10px] font-mono text-gray-500">
                <span className="flex items-center gap-1"><Wifi className="w-3 h-3 text-green-500" /> ONLINE</span>
              </div>
              <button onClick={() => signOut(auth)} className="hover:text-red-500 transition-colors" title="TERMINATE SESSION">
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Area - Scrollable on small screens */}
      <div className={`flex-1 w-full overflow-hidden flex flex-col ${zenMode ? 'p-0 bg-cyber-dark' : 'px-6 py-4'}`}>
        
        {/* Navigation Tabs */}
        {!zenMode && (
          <div className="grid grid-cols-4 gap-2 mb-4 shrink-0">
            {[
              { id: 'dashboard', icon: LayoutGrid, label: 'HUD' },
              { id: 'write', icon: PenLine, label: 'LOG' },
              { id: 'entries', icon: CalIcon, label: 'DATA' },
              { id: 'stats', icon: Activity, label: 'STAT' }
            ].map((item) => (
              <button 
                key={item.id}
                onClick={() => setView(item.id)}
                className={`
                  relative h-10 flex items-center justify-center gap-2 uppercase font-display font-bold tracking-wider transition-all clip-path-slant border-b-2
                  ${view === item.id 
                    ? `${accentBg} text-cyber-dark border-white` 
                    : 'bg-cyber-slate/50 border-white/10 hover:bg-cyber-slate hover:border-white/30 text-gray-500'}
                `}
              >
                <item.icon className="w-4 h-4" />
                <span className="text-xs md:text-sm">{item.label}</span>
              </button>
            ))}
          </div>
        )}

        {/* ================= DASHBOARD VIEW (Responsive Fixes) ================= */}
        {view === 'dashboard' && !zenMode && (
          // CHANGED: overflow-y-auto enables scrolling if height < content
          <div className="flex-1 grid grid-cols-1 md:grid-cols-4 gap-4 animate-fadeIn overflow-y-auto pb-4 custom-scrollbar">
            
            {/* WIDGET 1: CHRONOMETER & WEATHER (Height controlled) */}
            <div className="md:col-span-2 min-h-[220px] border border-white/10 bg-cyber-slate/30 p-6 relative overflow-hidden flex flex-col justify-between group">
              <div className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-${accent}-500/10 to-transparent`}></div>
              <div className="flex justify-between items-start relative z-10">
                <h3 className="text-xs font-mono text-gray-500 flex items-center gap-2"><Clock className="w-3 h-3" /> // TEMPORAL_LOCATOR</h3>
                {weather && (
                  <div className="text-right">
                    <div className="flex items-center justify-end gap-3"><span className="text-3xl font-display font-bold text-white">{weather.temperature}°C</span><div className={`p-1 border border-white/20 rounded ${accentText}`}><Wind className="w-4 h-4" /></div></div>
                    <div className="text-[10px] font-mono text-gray-500 text-right mt-1">LAT: {locationName}</div>
                  </div>
                )}
              </div>
              <div className="flex flex-col md:flex-row md:items-end gap-4 relative z-10">
                <div className={`text-6xl lg:text-8xl font-display font-bold text-white tracking-tighter ${accentText} drop-shadow-[0_0_15px_rgba(255,255,255,0.1)]`}>{time.toLocaleTimeString('en-US', { hour12: false })}</div>
                <div className="text-xl font-mono text-gray-400 mb-4 uppercase">{time.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</div>
              </div>
            </div>

            {/* WIDGET 2: NEURAL FOCUS */}
            <div className="md:col-span-2 min-h-[220px] border border-white/10 bg-cyber-slate/30 p-4 flex items-center justify-around relative">
              <h3 className="absolute top-4 left-4 text-xs font-mono text-gray-500 flex items-center gap-2"><Radio className="w-3 h-3" /> // NEURAL_FOCUS</h3>
              <div className="relative w-48 h-48 flex items-center justify-center">
                <svg className="w-full h-full transform -rotate-90">
                  <circle cx="96" cy="96" r="80" stroke="currentColor" strokeWidth="2" fill="transparent" className="text-gray-800" />
                  <circle cx="96" cy="96" r="80" stroke="currentColor" strokeWidth="6" fill="transparent" strokeDasharray={502} strokeDashoffset={502 - (502 * pomoTime) / totalPomoTime} className={`${accentText} transition-all duration-1000`} style={{ filter: pomoTime < 60 ? 'drop-shadow(0 0 10px currentColor)' : 'none' }} />
                </svg>
                <div className="absolute flex items-center gap-2">
                   <button onClick={() => adjustPomoTime(-5)} className="p-1 hover:text-white text-gray-500 transition-colors"><Minus className="w-4 h-4" /></button>
                   <div className="text-4xl font-display font-bold text-white w-32 text-center">{formatPomoTime(pomoTime)}</div>
                   <button onClick={() => adjustPomoTime(5)} className="p-1 hover:text-white text-gray-500 transition-colors"><Plus className="w-4 h-4" /></button>
                </div>
              </div>
              <div className="flex flex-col gap-4">
                <button onClick={() => setPomoActive(!pomoActive)} className={`p-4 border border-white/20 rounded-full hover:bg-white/10 transition-all ${pomoActive ? accentText : 'text-gray-400'}`}>{pomoActive ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6" />}</button>
                <button onClick={() => { setPomoActive(false); setPomoTime(25 * 60); setTotalPomoTime(25 * 60); }} className="p-4 border border-white/20 rounded-full hover:bg-white/10 text-gray-400 transition-all"><RotateCw className="w-6 h-6" /></button>
              </div>
            </div>

            {/* WIDGET 3: HOLO CALENDAR (Responsive Height) */}
            <div className="md:col-span-1 min-h-[300px] border border-white/10 bg-cyber-slate/30 p-6 flex flex-col relative overflow-hidden">
               <h3 className="text-xs font-mono text-gray-500 mb-4 flex items-center gap-2 shrink-0"><CalIcon className="w-3 h-3" /> // MONTH_VISUALIZER</h3>
              <div className="flex-1 grid grid-cols-7 gap-1 text-center content-start">
                {['S','M','T','W','T','F','S'].map(d => <span key={d} className="text-[10px] text-gray-600 font-bold">{d}</span>)}
                {getCalendarDays().map((day, idx) => {
                  if (!day) return <div key={`empty-${idx}`} className="aspect-square border border-transparent"></div>;
                  const hasData = hasEntryOnDay(day);
                  const isToday = day === new Date().getDate();
                  return (<div key={day} className={`aspect-square flex items-center justify-center text-xs font-mono border transition-all cursor-default ${isToday ? `${accentBg} text-cyber-dark font-bold` : 'border-white/5 text-gray-400'} ${hasData ? `border-${accent}-500 shadow-[0_0_5px_rgba(0,240,255,0.2)]` : ''}`}>{day}</div>)
                })}
              </div>
            </div>

            {/* WIDGET 4: PROTOCOLS (Responsive Height) */}
            <div className="md:col-span-1 min-h-[300px] border border-white/10 bg-cyber-slate/30 p-6 flex flex-col relative overflow-hidden">
              <div className="flex justify-between items-center mb-4 shrink-0"><h3 className="text-xs font-mono text-gray-500 flex items-center gap-2"><ShieldCheck className="w-3 h-3" /> // PROTOCOLS</h3><span className="text-[10px] font-mono text-gray-600">{habits.filter(h => h.completed).length}/{habits.length}</span></div>
              <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 flex flex-col gap-2">
                {habits.map(habit => (
                  <div key={habit.id} className="group flex items-center gap-2 shrink-0">
                    <div onClick={() => toggleHabit(habit.id)} className={`flex-1 flex items-center justify-between p-3 border cursor-pointer transition-all duration-300 ${habit.completed ? `border-${accent}-500 bg-${accent}-500/10` : 'border-white/10 hover:border-white/30 bg-black/20'}`}><span className={`font-mono text-xs uppercase tracking-wider ${habit.completed ? 'text-white' : 'text-gray-500'}`}>{habit.label}</span><div className={`w-3 h-3 border transition-all duration-300 ${habit.completed ? `bg-${accent}-500 border-${accent}-500` : 'border-gray-600'}`}></div></div>
                    <button onClick={() => deleteHabit(habit.id)} className="text-gray-700 hover:text-red-500"><X className="w-4 h-4" /></button>
                  </div>
                ))}
              </div>
              <div className="mt-4 shrink-0"><input type="text" value={newHabit} onChange={(e) => setNewHabit(e.target.value)} onKeyPress={addHabit} placeholder="+ NEW_PROTOCOL" className="w-full bg-black/40 border border-white/10 text-xs font-mono p-3 text-cyber-cyan focus:outline-none focus:border-white/30 uppercase" /></div>
            </div>

            {/* WIDGET 5: RESOURCE MONITOR (Responsive Height) */}
            <div className="md:col-span-2 min-h-[250px] border border-white/10 bg-cyber-slate/30 p-6 flex flex-col relative overflow-hidden">
              <div className="flex justify-between items-start mb-4 shrink-0">
                <div className="flex items-center gap-4">
                   <h3 className="text-xs font-mono text-gray-500 flex items-center gap-2"><CircleDollarSign className="w-3 h-3" /> // CREDITS_ALLOCATION</h3>
                   <div className="flex items-center gap-2 border border-white/10 rounded px-2 py-1 bg-black/20">
                      <button onClick={() => changeFinanceMonth(-1)} className="hover:text-white text-gray-500"><ChevronLeft className="w-3 h-3" /></button>
                      <span className="text-xs font-mono text-white min-w-[60px] text-center">{selectedFinMonth}</span>
                      <button onClick={() => changeFinanceMonth(1)} className="hover:text-white text-gray-500"><ChevronRight className="w-3 h-3" /></button>
                   </div>
                </div>
                <button onClick={() => window.open('https://budget.infinityfree.me/?i=1', '_blank')} className={`flex items-center gap-2 px-3 py-1.5 border border-white/20 rounded hover:bg-white/10 transition-all text-[10px] font-mono uppercase ${accentText}`}><ExternalLink className="w-3 h-3" /> Mainframe</button>
              </div>
              {!financeData.loaded ? ( <div className="flex-1 flex items-center justify-center text-xs font-mono text-gray-500 animate-pulse">ESTABLISHING_DATALINK...</div> ) : financeData.error ? ( <div className="flex-1 flex items-center justify-center gap-2 text-xs font-mono text-red-500"><AlertTriangle className="w-4 h-4" /> NO_DATA_STREAM</div> ) : (
                 <div className="flex-1 flex flex-col justify-center gap-4">
                    <div className="flex justify-between items-center border-b border-white/5 pb-2"><span className="text-xs font-mono text-gray-500">MONTHLY_INCOME</span><span className="text-xl font-display font-bold text-white">{financeData.currency}{financeData.income.toLocaleString()}</span></div>
                    <div className="flex justify-between items-center border-b border-white/5 pb-2"><span className="text-xs font-mono text-gray-500">ALLOCATED_FUNDS</span><span className="text-xl font-display font-bold text-gray-400">{financeData.currency}{financeData.planned.toLocaleString()}</span></div>
                    <div className="mt-2"><span className="text-xs font-mono text-gray-500 block mb-1">AVAILABLE_RESOURCES</span><div className={`text-4xl font-display font-bold tracking-tight ${financeData.remaining < 0 ? 'text-red-500' : 'text-green-400'}`}>{financeData.currency}{financeData.remaining.toLocaleString()}</div><div className="w-full h-1 bg-gray-800 mt-3 relative overflow-hidden"><div className={`h-full transition-all duration-1000 ${financeData.remaining < 0 ? 'bg-red-500' : 'bg-green-500'}`} style={{ width: `${Math.min((financeData.planned / (financeData.income || 1)) * 100, 100)}%` }}></div></div></div>
                 </div>
              )}
            </div>

            {/* WIDGET 6: NET-MEMO (Responsive Height) */}
            <div className="md:col-span-4 min-h-[200px] border border-white/10 bg-cyber-slate/30 p-6 relative flex flex-col">
              <h3 className="text-xs font-mono text-gray-500 mb-2 flex items-center gap-2 shrink-0"><Save className="w-3 h-3" /> // PERSONAL_MEMORANDA</h3>
              <textarea value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="INITIATE DATA ENTRY..." className="flex-1 w-full bg-transparent text-cyber-cyan font-mono text-sm focus:outline-none resize-none placeholder-gray-700 p-2 border-l border-white/5 focus:border-cyber-cyan/50 transition-colors" />
              <div className="absolute bottom-4 right-4 text-[10px] text-gray-600 uppercase">SYSTEM_AUTO_SAVE_ACTIVE</div>
            </div>
          </div>
        )}

        {/* ================= WRITE VIEW (Zen Mode Compatible) ================= */}
        {(view === 'write' || zenMode) && (
          <div className={`flex-1 border border-white/10 bg-cyber-slate/50 animate-fadeIn relative flex flex-col overflow-hidden ${zenMode ? 'fixed inset-0 z-[100] bg-cyber-dark p-8 md:p-20 border-none' : 'p-6 md:p-8'}`}>
            {/* Zen Decor (Only in normal write mode) */}
            {!zenMode && (
              <>
                <div className={`absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 ${accentColor.split(' ')[0]}`}></div>
                <div className={`absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 ${accentColor.split(' ')[0]}`}></div>
              </>
            )}
            
            {/* Zen Toggle Button */}
            <div className={`absolute top-6 right-6 z-50`}>
               <button 
                 onClick={() => setZenMode(!zenMode)} 
                 className={`p-2 rounded-full border border-white/20 hover:bg-white/10 transition-all text-gray-400 hover:text-white`}
                 title={zenMode ? "Exit Focus Chamber (Esc)" : "Enter Focus Chamber"}
               >
                 {zenMode ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
               </button>
            </div>

            <div className={`flex flex-wrap justify-between items-end gap-4 border-b border-white/10 pb-6 shrink-0 ${zenMode ? 'max-w-4xl mx-auto w-full' : ''}`}>
              <input type="text" value={currentEntry.title} onChange={(e) => setCurrentEntry({...currentEntry, title: e.target.value})} placeholder="ENTRY_TITLE_Required" className="bg-transparent text-3xl md:text-4xl font-display font-bold text-white placeholder-gray-700 focus:outline-none w-full md:w-auto flex-1 uppercase" />
              <div className="flex gap-2">
                  {moods.map(m => ( <button key={m.id} onClick={() => setCurrentEntry({...currentEntry, mood: m.id})} className={`p-2 border transition-all ${currentEntry.mood === m.id ? `${m.color} border-current shadow-[0_0_10px_currentColor]` : 'border-gray-700 text-gray-600 hover:text-gray-400'}`}><m.icon className="w-5 h-5" /></button> ))}
              </div>
            </div>
            
            <textarea 
              value={currentEntry.content} 
              onChange={(e) => setCurrentEntry({...currentEntry, content: e.target.value})} 
              placeholder="INITIATE LOG SEQUENCE..." 
              className={`flex-1 w-full bg-transparent text-lg leading-relaxed p-4 focus:outline-none resize-none font-mono mt-6 mb-4 ${zenMode ? 'max-w-4xl mx-auto text-xl text-gray-300' : 'bg-black/20 border-l-2 border-transparent focus:border-l-cyber-cyan transition-all text-gray-200'}`}
            />
            
            <div className={`flex justify-between items-center pt-4 border-t border-white/10 shrink-0 ${zenMode ? 'max-w-4xl mx-auto w-full' : ''}`}>
              <div className="flex gap-2 text-xs font-mono text-gray-500">
                {currentEntry.content.split(/\s+/).length} WORDS // {new Date().toLocaleDateString()}
              </div>
              <button onClick={saveEntry} disabled={!currentEntry.title} className={`px-8 py-3 font-display font-bold tracking-widest uppercase transition-all ${!currentEntry.title ? 'bg-gray-800 text-gray-600 cursor-not-allowed' : `${accentBg} text-cyber-dark hover:shadow-[0_0_20px_rgba(0,240,255,0.4)]`}`}>{editingId ? 'OVERWRITE' : 'SAVE_DATA'}</button>
            </div>
          </div>
        )}

        {/* ================= ENTRIES & STATS ================= */}
        {(!zenMode) && (view === 'entries' || view === 'stats') && (
          <div className="flex-1 overflow-y-auto custom-scrollbar">
             {view === 'entries' && (
               <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 animate-fadeIn pb-6">
                  {entries.map(entry => (
                    <div key={entry.id} onClick={() => editEntry(entry)} className="group relative bg-cyber-slate border border-gray-800 hover:border-cyber-cyan/50 transition-all p-5 cursor-pointer overflow-hidden h-64 flex flex-col">
                      <div className="flex justify-between items-start mb-4 relative z-10 shrink-0"><span className="font-mono text-xs text-cyber-cyan">{entry.date}</span>{entry.favorite && <Star className="w-4 h-4 text-cyber-yellow fill-cyber-yellow" />}</div>
                      <h3 className="font-display font-bold text-xl text-white mb-2 uppercase truncate relative z-10 group-hover:text-cyber-cyan transition-colors shrink-0">{entry.title}</h3>
                      <p className="text-gray-400 text-sm line-clamp-4 mb-4 font-mono relative z-10 flex-1">{entry.content}</p>
                      <div className="flex justify-between items-center relative z-10 shrink-0">
                        <div className="flex gap-1">{entry.tags?.slice(0, 3).map(t => <span key={t} className="text-[10px] uppercase border border-gray-700 px-1 text-gray-500">#{t}</span>)}</div>
                        <button onClick={(e) => {e.stopPropagation(); deleteEntry(entry.id)}} className="opacity-0 group-hover:opacity-100 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
                      </div>
                      <div className="absolute bottom-0 left-0 h-1 w-0 bg-cyber-cyan group-hover:w-full transition-all duration-300"></div>
                    </div>
                  ))}
               </div>
             )}

             {view === 'stats' && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-fadeIn pb-6">
                  <div className="border border-white/10 bg-cyber-slate p-6 flex flex-col items-center justify-center gap-2"><span className={`text-4xl font-display font-bold ${accentText}`}>{getStats().total}</span><span className="text-xs font-mono text-gray-500 tracking-widest uppercase">Total Logs</span></div>
                  <div className="border border-white/10 bg-cyber-slate p-6 flex flex-col items-center justify-center gap-2"><span className={`text-4xl font-display font-bold text-white`}>{getStats().words}</span><span className="text-xs font-mono text-gray-500 tracking-widest uppercase">Word Count</span></div>
                  <div className="border border-white/10 bg-cyber-slate p-6 flex flex-col items-center justify-center gap-2"><span className="text-4xl font-display font-bold text-cyber-yellow">{getStats().favs}</span><span className="text-xs font-mono text-gray-500 tracking-widest uppercase">Starred</span></div>
                  
                  {/* Activity Heatmap Widget */}
                  <div className="md:col-span-3 border border-white/10 bg-cyber-slate p-6 flex flex-col gap-4">
                    <h3 className="text-xs font-mono text-gray-500 flex items-center gap-2">
                      <Activity className="w-3 h-3" /> // PERSISTENCE_LOG (ACTIVITY_HEATMAP)
                    </h3>
                    
                    <div className="flex flex-wrap gap-1">
                      {getActivityHeatmap().map((day, i) => (
                        <div 
                          key={i}
                          title={`${day.date}: ${day.intensity === 0 ? 'No Data' : 'Log Entry Found'}`}
                          className={`
                            w-3 h-3 rounded-[1px] transition-all duration-300
                            ${day.intensity === 0 ? 'bg-white/5' : ''}
                            ${day.intensity === 1 ? `bg-${accent}-500/30` : ''}
                            ${day.intensity === 2 ? `bg-${accent}-500/60` : ''}
                            ${day.intensity === 3 ? `bg-${accent}-500 shadow-[0_0_5px_currentColor]` : ''}
                          `}
                        ></div>
                      ))}
                    </div>
                    
                    <div className="flex justify-end items-center gap-2 text-[10px] font-mono text-gray-600">
                      <span>LESS</span>
                      <div className="w-3 h-3 bg-white/5"></div>
                      <div className={`w-3 h-3 bg-${accent}-500/30`}></div>
                      <div className={`w-3 h-3 bg-${accent}-500/60`}></div>
                      <div className={`w-3 h-3 bg-${accent}-500`}></div>
                      <span>MORE</span>
                    </div>
                  </div>

                  <div className="md:col-span-3 border border-white/10 bg-cyber-slate/50 p-8 flex flex-col items-center justify-center gap-4">
                      <div className="w-32 h-32 rounded-full border-4 border-white/10 flex items-center justify-center relative">
                        <span className={`text-6xl font-display font-bold ${accentText}`}>{getLevel().level}</span>
                        <div className={`absolute inset-0 rounded-full border-4 ${accentColor.split(' ')[0]} border-t-transparent animate-spin`} style={{animationDuration: '3s'}}></div>
                      </div>
                      <h2 className="text-xl font-display uppercase tracking-widest text-white">Security Clearance Level {getLevel().level}</h2>
                      <div className="w-full max-w-md h-2 bg-gray-800 rounded-full overflow-hidden">
                        <div className={`h-full ${accentBg}`} style={{ width: `${getLevel().progress}%` }}></div>
                      </div>
                      <div className="flex gap-4 mt-6">
                        <button onClick={() => setAccent('cyan')} className="w-6 h-6 bg-cyber-cyan hover:scale-125 transition-transform"></button>
                        <button onClick={() => setAccent('pink')} className="w-6 h-6 bg-cyber-pink hover:scale-125 transition-transform"></button>
                        <button onClick={() => setAccent('yellow')} className="w-6 h-6 bg-cyber-yellow hover:scale-125 transition-transform"></button>
                      </div>
                  </div>
                </div>
             )}
          </div>
        )}

      </div>
    </div>
  );
}