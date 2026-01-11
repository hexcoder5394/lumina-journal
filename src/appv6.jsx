import React, { useState, useEffect, useCallback } from 'react';
import { 
  LayoutDashboard, PenTool, BookOpen, BarChart2, 
  Clock, Cloud, Zap, Play, Pause, RotateCw, 
  CheckCircle, Plus, X, Save, DollarSign, Calendar as CalendarIcon,
  ChevronLeft, ChevronRight, Maximize2, Minimize2, LogOut,
  Moon, Sun, Edit3, Menu, GraduationCap, ExternalLink, Sunrise,
  Linkedin, Github, TrendingUp, Mail, Link, Bell, CalendarCheck, Trash2,
  Lock, Unlock, Shield, KeyRound, Settings as SettingsIcon 
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
  
  // --- SECURITY STATE ---
  const [securityPin, setSecurityPin] = useState(null); 
  const [sessionExpiry, setSessionExpiry] = useState(0); 
  const [isPinPromptOpen, setIsPinPromptOpen] = useState(false); 
  const [pinInput, setPinInput] = useState(''); 
  const [targetView, setTargetView] = useState(null); 
  const [isSettingsOpen, setIsSettingsOpen] = useState(false); 
  
  // Settings Mode: 'unlock' | 'setup' | 'verify_current' | 'set_new' | 'verify_remove'
  const [pinMode, setPinMode] = useState('unlock'); 
  
  // --- EVENTS & REMINDERS STATE ---
  const [events, setEvents] = useState([]);
  const [selectedDate, setSelectedDate] = useState(null);
  const [isEventModalOpen, setEventModalOpen] = useState(false);
  const [newEvent, setNewEvent] = useState({ title: '', time: '' });
  const [dailyReminder, setDailyReminder] = useState(null);

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
        loadEvents(u.uid);
        loadSecuritySettings(u.uid);
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

  // --- SECURITY LOGIC ---
  const loadSecuritySettings = async (uid) => {
    const docRef = doc(db, "artifacts", "default-503020-app", "users", uid, "lumina_dashboard", "security");
    onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        setSecurityPin(docSnap.data().pin);
      } else {
        setSecurityPin(null);
      }
    });
  };

  const handleNavigation = (destination) => {
    const protectedViews = ['write', 'entries'];
    
    if (protectedViews.includes(destination) && securityPin) {
      if (Date.now() < sessionExpiry) {
        setView(destination);
      } else {
        setTargetView(destination);
        setPinMode('unlock');
        setPinInput('');
        setIsPinPromptOpen(true);
      }
    } else {
      setView(destination);
    }
  };

  const handlePinSubmit = useCallback(async () => {
    if (pinMode === 'unlock') {
      if (pinInput === securityPin) {
        setSessionExpiry(Date.now() + 30 * 60 * 1000);
        setIsPinPromptOpen(false);
        if (targetView) setView(targetView);
      } else {
        alert("ACCESS DENIED: Incorrect PIN");
        setPinInput('');
      }
    } 
    else if (pinMode === 'setup') {
      if (pinInput.length === 6) {
        await savePinToCloud(pinInput);
        setIsPinPromptOpen(false);
        alert("Security Protocol Engaged. PIN Set.");
      }
    }
    else if (pinMode === 'verify_current') {
      if (pinInput === securityPin) {
        setPinMode('set_new');
        setPinInput('');
      } else {
        alert("Incorrect Current PIN");
        setPinInput('');
      }
    }
    else if (pinMode === 'set_new') {
      if (pinInput.length === 6) {
        await savePinToCloud(pinInput);
        setIsPinPromptOpen(false);
        alert("PIN Updated Successfully.");
      }
    }
    else if (pinMode === 'verify_remove') {
      if (pinInput === securityPin) {
        const docRef = doc(db, "artifacts", "default-503020-app", "users", user.uid, "lumina_dashboard", "security");
        await setDoc(docRef, { pin: null });
        setSecurityPin(null);
        setIsPinPromptOpen(false);
        alert("Security Protocols Disengaged. PIN Removed.");
      } else {
        alert("ACCESS DENIED: Incorrect PIN. Cannot remove security.");
        setPinInput('');
      }
    }
  }, [pinMode, pinInput, securityPin, targetView, user]);

  const savePinToCloud = async (newPin) => {
    if (!user) return;
    const docRef = doc(db, "artifacts", "default-503020-app", "users", user.uid, "lumina_dashboard", "security");
    await setDoc(docRef, { pin: newPin }, { merge: true });
  };

  const initiateRemovePin = () => {
    setPinMode('verify_remove');
    setPinInput('');
    setIsPinPromptOpen(true);
    setIsSettingsOpen(false);
  };

  // --- KEYBOARD LISTENER FOR PIN (NEW) ---
  useEffect(() => {
    if (!isPinPromptOpen) return;

    const handleKeyDown = (e) => {
      // Numbers 0-9
      if (/^[0-9]$/.test(e.key)) {
        setPinInput(prev => (prev.length < 6 ? prev + e.key : prev));
      }
      // Backspace (Delete last char)
      else if (e.key === 'Backspace') {
        setPinInput(prev => prev.slice(0, -1));
      }
      // Delete (Clear all)
      else if (e.key === 'Delete') {
        setPinInput('');
      }
      // Enter (Submit)
      else if (e.key === 'Enter') {
        handlePinSubmit();
      }
      // Escape (Cancel)
      else if (e.key === 'Escape') {
         if (pinMode === 'unlock') setIsPinPromptOpen(false);
         else if (pinMode === 'verify_remove') { setIsPinPromptOpen(false); setIsSettingsOpen(true); }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPinPromptOpen, pinMode, handlePinSubmit]); // Re-binds when modal state changes

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

  // --- EVENTS SYSTEM ---
  const loadEvents = async (uid) => {
    const q = query(collection(db, "calendar_events"), where("userId", "==", uid));
    const snap = await getDocs(q);
    const loadedEvents = snap.docs.map(d => ({id: d.id, ...d.data()}));
    setEvents(loadedEvents);
    
    // Check for Today's Reminders
    const today = new Date().toISOString().split('T')[0];
    const todayEvents = loadedEvents.filter(e => e.date === today);
    if (todayEvents.length > 0) {
      setDailyReminder(`${todayEvents.length} event${todayEvents.length > 1 ? 's' : ''} scheduled for today.`);
    }
  };

  const handleDateClick = (day) => {
    if (!day) return;
    const currentMonth = new Date().toISOString().slice(0, 7);
    const dateStr = `${currentMonth}-${day.toString().padStart(2, '0')}`;
    setSelectedDate(dateStr);
    setEventModalOpen(true);
  };

  const saveEvent = async () => {
    if (!newEvent.title || !user || !selectedDate) return;
    const id = Date.now().toString();
    const eventData = { 
      id, 
      userId: user.uid, 
      date: selectedDate, 
      title: newEvent.title, 
      time: newEvent.time 
    };
    
    await setDoc(doc(db, "calendar_events", id), eventData);
    setEvents([...events, eventData]); 
    setNewEvent({ title: '', time: '' });
    if(selectedDate === new Date().toISOString().split('T')[0]) {
       setDailyReminder("New event added to today's schedule.");
    }
  };

  const deleteEvent = async (id) => {
    if(confirm("Remove this event?")) {
      await deleteDoc(doc(db, "calendar_events", id));
      setEvents(events.filter(e => e.id !== id));
    }
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

  const hasEventOnDay = (day) => {
    if (!day) return false;
    const currentMonth = new Date().toISOString().slice(0, 7);
    const checkDate = `${currentMonth}-${day.toString().padStart(2, '0')}`;
    return events.some(e => e.date === checkDate);
  };

  const getUpcomingEvents = () => {
    const today = new Date().toISOString().split('T')[0];
    return events
      .filter(e => e.date >= today)
      .sort((a, b) => {
        if (a.date !== b.date) return a.date.localeCompare(b.date);
        return a.time.localeCompare(b.time);
      });
  };

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
                { id: 'write', icon: PenTool, label: 'Journal' }, // Protected
                { id: 'entries', icon: BookOpen, label: 'Entries' }, // Protected
                { id: 'stats', icon: BarChart2, label: 'Analytics' }
              ].map(item => (
                <button 
                  key={item.id}
                  onClick={() => handleNavigation(item.id)}
                  className={`
                    flex items-center h-12 w-full rounded-xl transition-all duration-200 group relative
                    ${view === item.id 
                      ? 'bg-pro-card text-pro-primary shadow-sm border border-pro-border' 
                      : 'text-gray-500 hover:bg-white/5 hover:text-pro-white'}
                  `}
                >
                  <div className="w-16 h-12 flex items-center justify-center shrink-0 relative">
                    <item.icon className={`w-5 h-5 transition-colors ${view === item.id ? 'text-pro-primary' : 'group-hover:text-pro-white'}`} />
                    {/* Lock Icon Indicator */}
                    {securityPin && (item.id === 'write' || item.id === 'entries') && (
                      <div className="absolute top-2 right-4 w-2 h-2 bg-purple-500 rounded-full"></div>
                    )}
                  </div>
                  <span className={`font-medium whitespace-nowrap overflow-hidden transition-all duration-300 ${isSidebarOpen ? 'opacity-100 w-auto' : 'opacity-0 w-0'}`}>
                    {item.label}
                  </span>
                </button>
              ))}
            </nav>
          </div>

          <div className="border-t border-pro-border pt-6 px-2 space-y-2">
             {/* Settings Button */}
             <button onClick={() => setIsSettingsOpen(true)} className="flex items-center h-12 w-full rounded-xl text-gray-500 hover:bg-white/5 hover:text-pro-white transition-colors">
               <div className="w-16 h-12 flex items-center justify-center shrink-0">
                 <SettingsIcon className="w-5 h-5" />
               </div>
               <span className={`font-medium whitespace-nowrap overflow-hidden transition-all duration-300 ${isSidebarOpen ? 'opacity-100 w-auto' : 'opacity-0 w-0'}`}>
                 Settings
               </span>
             </button>

             {/* Logout Button */}
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
            
            {/* Notification Area */}
            <div className="flex items-center gap-4">
               {dailyReminder && (
                 <div className="hidden md:flex items-center gap-2 px-4 py-1.5 bg-pro-card rounded-full border border-pro-border animate-fadeIn">
                   <Bell className="w-4 h-4 text-yellow-400 animate-pulse" />
                   <span className="text-xs font-medium text-gray-300">{dailyReminder}</span>
                   <button onClick={() => setDailyReminder(null)} className="ml-2 hover:text-white"><X className="w-3 h-3"/></button>
                 </div>
               )}
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
                  <h4 className="font-semibold text-pro-white flex items-center gap-2"><CalendarIcon className="w-4 h-4 text-pro-secondary"/> Calendar</h4>
                </div>
                <div className="grid grid-cols-7 gap-1 text-center text-xs mb-2">
                  {['S','M','T','W','T','F','S'].map((d, i) => (<span key={i} className="text-gray-600 font-bold">{d}</span>))}
                </div>
                <div className="grid grid-cols-7 gap-1 text-center flex-1 content-start">
                  {getCalendarDays().map((day, idx) => {
                    if (!day) return <div key={`empty-${idx}`} className="aspect-square"></div>;
                    const hasData = hasEntryOnDay(day);
                    const hasEvent = hasEventOnDay(day);
                    const isToday = day === new Date().getDate();
                    return (
                      <div 
                        key={day} 
                        onClick={() => handleDateClick(day)}
                        className={`
                          aspect-square flex items-center justify-center text-xs font-medium rounded-full transition-all cursor-pointer relative hover:bg-pro-primary/20
                          ${isToday ? 'bg-pro-primary text-white font-bold' : 'text-gray-400'}
                        `}
                      >
                        {day}
                        {hasData && !isToday && (<div className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-pro-secondary"></div>)}
                        {hasEvent && !isToday && (<div className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-purple-500 border border-pro-card"></div>)}
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* 6. Upcoming Schedule */}
              <div className="lg:col-span-1 bg-pro-card rounded-2xl p-6 border border-pro-border shadow-sm flex flex-col">
                <div className="flex justify-between items-center mb-4">
                  <h4 className="font-semibold text-pro-white flex items-center gap-2"><CalendarCheck className="w-4 h-4 text-pink-500"/> Schedule</h4>
                  <span className="text-[10px] text-gray-500 uppercase">Upcoming</span>
                </div>
                <div className="flex-1 space-y-3 overflow-y-auto max-h-48 custom-scrollbar pr-1">
                  {getUpcomingEvents().length === 0 ? (
                    <div className="text-center text-gray-600 text-xs py-4">No upcoming events.</div>
                  ) : (
                    getUpcomingEvents().slice(0, 5).map(e => (
                      <div key={e.id} className="p-3 bg-pro-bg rounded-lg border border-pro-border hover:border-pink-500/50 transition-all group flex justify-between items-center">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-mono text-pink-400 bg-pink-500/10 px-1.5 py-0.5 rounded">{e.date.slice(5)}</span>
                            <span className="text-[10px] text-gray-500">{e.time}</span>
                          </div>
                          <h5 className="text-sm font-medium text-gray-300 truncate group-hover:text-white max-w-[120px]">{e.title}</h5>
                        </div>
                        <button onClick={() => deleteEvent(e.id)} className="text-gray-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 className="w-3 h-3"/></button>
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

              {/* 8. Command Center */}
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

              {/* 9. Quick Notes */}
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

          {/* --- EVENT MODAL --- */}
          {isEventModalOpen && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fadeIn">
              <div className="bg-pro-card border border-pro-border rounded-2xl p-6 w-full max-w-sm shadow-2xl relative">
                <button onClick={() => setEventModalOpen(false)} className="absolute top-4 right-4 text-gray-500 hover:text-white"><X className="w-5 h-5"/></button>
                <h3 className="text-xl font-bold text-pro-white mb-4 flex items-center gap-2">
                  <CalendarIcon className="w-5 h-5 text-purple-500" /> Events for {selectedDate}
                </h3>
                <div className="space-y-3 mb-6 max-h-48 overflow-y-auto custom-scrollbar">
                  {events.filter(e => e.date === selectedDate).length === 0 ? (
                    <p className="text-xs text-gray-500 text-center py-2">No events scheduled.</p>
                  ) : (
                    events.filter(e => e.date === selectedDate).map(e => (
                      <div key={e.id} className="flex items-center justify-between p-3 bg-pro-bg rounded-lg border border-pro-border">
                        <div>
                          <p className="text-sm text-white font-medium">{e.title}</p>
                          <p className="text-xs text-gray-500 flex items-center gap-1"><Clock className="w-3 h-3"/> {e.time}</p>
                        </div>
                        <button onClick={() => deleteEvent(e.id)} className="text-gray-600 hover:text-red-400"><Trash2 className="w-4 h-4"/></button>
                      </div>
                    ))
                  )}
                </div>
                <div className="border-t border-pro-border pt-4">
                  <h4 className="text-xs font-semibold text-gray-500 uppercase mb-3">Add New Event</h4>
                  <div className="space-y-3">
                    <input type="text" placeholder="Event Title..." value={newEvent.title} onChange={(e) => setNewEvent({...newEvent, title: e.target.value})} className="w-full bg-pro-bg border border-pro-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500" />
                    <div className="flex gap-2">
                      <input type="time" value={newEvent.time} onChange={(e) => setNewEvent({...newEvent, time: e.target.value})} className="flex-1 bg-pro-bg border border-pro-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500" />
                      <button onClick={saveEvent} disabled={!newEvent.title} className="bg-purple-600 hover:bg-purple-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 disabled:opacity-50"><Plus className="w-4 h-4" /> Add</button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* --- SECURITY LOCK MODAL (NEW) --- */}
          {isPinPromptOpen && (
            <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/90 backdrop-blur-md p-4 animate-fadeIn">
              <div className="bg-pro-card border border-pro-border rounded-2xl p-8 w-full max-w-sm shadow-2xl flex flex-col items-center">
                <div className="w-16 h-16 bg-purple-500/10 rounded-full flex items-center justify-center mb-4">
                  {pinMode === 'unlock' ? <Lock className="w-8 h-8 text-purple-500" /> : <Shield className="w-8 h-8 text-blue-500" />}
                </div>
                <h3 className="text-xl font-bold text-pro-white mb-2">
                  {pinMode === 'unlock' ? 'Security Lock Active' : 
                   pinMode === 'setup' ? 'Set New PIN' : 
                   pinMode === 'verify_current' ? 'Verify Current PIN' :
                   pinMode === 'verify_remove' ? 'Disable Security' : 
                   'Verify Current PIN'}
                </h3>
                <p className="text-sm text-gray-500 mb-6 text-center">
                  {pinMode === 'unlock' ? 'Enter your 6-digit PIN to access this journal.' : 
                   pinMode === 'verify_remove' ? 'Enter current PIN to disable security.' : 
                   'Enter a 6-digit PIN to secure your data.'}
                </p>
                <div className="flex justify-center gap-2 mb-6">
                  {[...Array(6)].map((_, i) => (
                    <div key={i} className={`w-3 h-3 rounded-full transition-all ${pinInput.length > i ? 'bg-purple-500 scale-125' : 'bg-gray-700'}`}></div>
                  ))}
                </div>
                <div className="grid grid-cols-3 gap-3 w-full max-w-[240px]">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 'C', 0, 'Go'].map((key) => (
                    <button 
                      key={key}
                      onClick={() => {
                        if (key === 'C') setPinInput('');
                        else if (key === 'Go') handlePinSubmit();
                        else if (pinInput.length < 6) setPinInput(prev => prev + key);
                      }}
                      className={`
                        h-12 rounded-xl text-lg font-bold transition-all active:scale-95 flex items-center justify-center
                        ${key === 'Go' ? 'bg-purple-600 text-white' : key === 'C' ? 'bg-red-500/10 text-red-400' : 'bg-pro-bg border border-pro-border text-gray-300 hover:bg-white/5'}
                      `}
                    >
                      {key === 'Go' ? (pinMode === 'unlock' ? <Unlock className="w-5 h-5"/> : <CheckCircle className="w-5 h-5"/>) : key}
                    </button>
                  ))}
                </div>
                {pinMode === 'unlock' && (
                  <button onClick={() => setIsPinPromptOpen(false)} className="mt-6 text-xs text-gray-500 hover:text-white">Cancel Authentication</button>
                )}
                {pinMode === 'verify_remove' && (
                  <button onClick={() => { setIsPinPromptOpen(false); setIsSettingsOpen(true); }} className="mt-6 text-xs text-gray-500 hover:text-white">Cancel</button>
                )}
              </div>
            </div>
          )}

          {/* --- SETTINGS MODAL (NEW) --- */}
          {isSettingsOpen && (
            <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fadeIn">
              <div className="bg-pro-card border border-pro-border rounded-2xl p-6 w-full max-w-md shadow-2xl relative">
                <button onClick={() => setIsSettingsOpen(false)} className="absolute top-4 right-4 text-gray-500 hover:text-white"><X className="w-5 h-5"/></button>
                <h3 className="text-xl font-bold text-pro-white mb-6 flex items-center gap-2">
                  <SettingsIcon className="w-5 h-5 text-gray-400" /> Settings
                </h3>
                <div className="space-y-4">
                  <div className="bg-pro-bg rounded-xl border border-pro-border p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${securityPin ? 'bg-green-500/10 text-green-500' : 'bg-gray-700/30 text-gray-500'}`}>
                          <Shield className="w-5 h-5" />
                        </div>
                        <div>
                          <h4 className="font-medium text-white">Journal Security</h4>
                          <p className="text-xs text-gray-500">{securityPin ? 'PIN Protection Active' : 'No PIN Set'}</p>
                        </div>
                      </div>
                      {securityPin && <span className="text-[10px] bg-green-500/10 text-green-500 px-2 py-1 rounded border border-green-500/20">SECURE</span>}
                    </div>
                    <div className="grid grid-cols-2 gap-2 mt-4">
                      {securityPin ? (
                        <>
                          <button onClick={() => { setPinMode('verify_current'); setPinInput(''); setIsPinPromptOpen(true); setIsSettingsOpen(false); }} className="py-2 px-3 bg-pro-card border border-pro-border rounded-lg text-xs text-white hover:bg-white/5 transition-colors">Change PIN</button>
                          <button onClick={initiateRemovePin} className="py-2 px-3 bg-red-500/10 border border-red-500/20 rounded-lg text-xs text-red-400 hover:bg-red-500/20 transition-colors">Remove Security</button>
                        </>
                      ) : (
                        <button onClick={() => { setPinMode('setup'); setPinInput(''); setIsPinPromptOpen(true); setIsSettingsOpen(false); }} className="col-span-2 py-2 px-3 bg-blue-600 hover:bg-blue-500 rounded-lg text-xs text-white font-medium transition-colors flex items-center justify-center gap-2"><KeyRound className="w-3 h-3"/> Setup PIN Protection</button>
                      )}
                    </div>
                  </div>
                  {/* Add more settings here later if needed */}
                </div>
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