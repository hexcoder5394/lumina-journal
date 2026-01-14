import React, { useState, useEffect, useCallback } from 'react';
import { 
  LayoutDashboard, PenTool, BookOpen, BarChart2, // Sidebar Icons
  Clock, Cloud, Zap, Play, Pause, RotateCw, // Widget Icons
  CheckCircle, Plus, X, Save, DollarSign, Calendar as CalendarIcon,
  ChevronLeft, ChevronRight, Maximize2, Minimize2, LogOut,
  Moon, Sun, Edit3, Menu, GraduationCap, ExternalLink, Sunrise,
  Linkedin, Github, TrendingUp, Mail, Link, Bell, CalendarCheck, Trash2,
  Lock, Unlock, Shield, KeyRound, Settings as SettingsIcon, CreditCard,
  HardDrive, FileText, Image as ImageIcon, File, Folder, Sparkles, Bot
} from 'lucide-react';
import { db, auth } from './firebase'; 
import { collection, getDocs, setDoc, doc, deleteDoc, query, where, onSnapshot } from 'firebase/firestore';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import Login from './Login';

// --- CONFIGURATION ---
const GEMINI_API_KEY = "AIzaSyBVgQJ1iNCmJepaTruUIVk_Mz4_ABvlhCE"; 

// Helper for debouncing writes
const debounce = (func, delay) => {
  let timeoutId;
  return (...args) => {
    if (timeoutId) clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func(...args), delay);
  };
};

// Helper: Get Favicon (DuckDuckGo to prevent blocking)
const getFavicon = (url) => {
  try {
    const domain = new URL(url).hostname;
    return `https://icons.duckduckgo.com/ip3/${domain}.ico`;
  } catch (e) {
    return 'https://icons.duckduckgo.com/ip3/google.com.ico'; 
  }
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
  
  // --- COMMAND & SUBSCRIPTION STATE ---
  const [commandLinks, setCommandLinks] = useState([]);
  const [subscriptions, setSubscriptions] = useState([]);
  const [isEditingCommands, setIsEditingCommands] = useState(false);
  const [isEditingSubs, setIsEditingSubs] = useState(false);
  
  const [newLink, setNewLink] = useState({ title: '', url: '' });
  const [newSub, setNewSub] = useState({ name: '', cost: '', url: '' });

  // --- VAULT STATE ---
  const [vaultItems, setVaultItems] = useState([]);
  const [isVaultModalOpen, setIsVaultModalOpen] = useState(false);
  const [newVaultItem, setNewVaultItem] = useState({ title: '', type: 'doc', value: '' });

  // --- BRIEFING STATE ---
  const [briefing, setBriefing] = useState('');
  const [isBriefingOpen, setIsBriefingOpen] = useState(false);
  const [isGeneratingBriefing, setIsGeneratingBriefing] = useState(false);

  // --- SECURITY STATE ---
  const [securityPin, setSecurityPin] = useState(null); 
  const [sessionExpiry, setSessionExpiry] = useState(0); 
  const [isPinPromptOpen, setIsPinPromptOpen] = useState(false); 
  const [pinInput, setPinInput] = useState(''); 
  const [targetView, setTargetView] = useState(null); 
  const [isSettingsOpen, setIsSettingsOpen] = useState(false); 
  const [pinMode, setPinMode] = useState('unlock'); 
  
  // --- EVENTS & REMINDERS STATE ---
  const [events, setEvents] = useState([]);
  const [selectedDate, setSelectedDate] = useState(null);
  const [isEventModalOpen, setEventModalOpen] = useState(false);
  const [newEvent, setNewEvent] = useState({ title: '', time: '' });
  const [dailyReminder, setDailyReminder] = useState(null);

  // --- BUDGET STATE ---
  const [financeData, setFinanceData] = useState({ income: 0, expense: 0, loaded: false });
  const [selectedFinMonth, setSelectedFinMonth] = useState(new Date().toISOString().slice(0, 7));
  const [isEditingBudget, setIsEditingBudget] = useState(false);
  const [tempBudget, setTempBudget] = useState({ income: '' });

  // --- WIDGET DATA ---
  const [weather, setWeather] = useState(null);
  const [pomoTime, setPomoTime] = useState(25 * 60);
  const [pomoActive, setPomoActive] = useState(false);
  const [initialPomoTime, setInitialPomoTime] = useState(25 * 60);
  const [isEditingTimer, setIsEditingTimer] = useState(false);
  const [customMinutes, setCustomMinutes] = useState('25');
  const [memo, setMemo] = useState('');
  const [habits, setHabits] = useState([]);
  const [newHabit, setNewHabit] = useState('');

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
        loadVaultItems(u.uid);
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

  // --- AI BRIEFING LOGIC (UPDATED MODEL) ---
  const generateDailyBriefing = async () => {
    if (!GEMINI_API_KEY || GEMINI_API_KEY.includes("YOUR_GEMINI_API_KEY")) {
      alert("Please enter a valid Gemini API Key in the App.jsx file.");
      return;
    }

    setIsGeneratingBriefing(true);
    setIsBriefingOpen(true);

    try {
      const todayStr = new Date().toISOString().split('T')[0];
      const todayEvents = events.filter(e => e.date === todayStr);
      const incompleteHabits = habits.filter(h => !h.completed);
      const budgetRemaining = financeData.income - financeData.expense;

      const prompt = `
        As Lumina, a personal assistant, write a 3-sentence morning briefing for Achintha.
        Data:
        - Date: ${todayStr}
        - Events: ${todayEvents.length > 0 ? todayEvents.map(e => `${e.time} ${e.title}`).join(', ') : "None"}
        - Habits Left: ${incompleteHabits.length}
        - Budget Left: $${budgetRemaining}
        
        Style: Professional, concise, encouraging. No markdown.
      `;

      // Using gemini-1.5-flash for speed and reliability
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
      });

      const data = await response.json();
      
      if (data.candidates && data.candidates[0].content) {
        setBriefing(data.candidates[0].content.parts[0].text);
      } else {
        console.error("Gemini API Error:", data); // Check console if this happens
        setBriefing("I couldn't generate the briefing. Please check your API Key quota or internet connection.");
      }
    } catch (error) {
      console.error("Network Error:", error);
      setBriefing("Connection failed. Please try again.");
    } finally {
      setIsGeneratingBriefing(false);
    }
  };

  // --- VAULT LOGIC ---
  const loadVaultItems = async (uid) => {
    const q = query(collection(db, "vault_items"), where("userId", "==", uid));
    const snap = await getDocs(q);
    setVaultItems(snap.docs.map(d => ({id: d.id, ...d.data()})));
  };

  const saveVaultItem = async () => {
    if (!newVaultItem.title || !user) return;
    const id = Date.now().toString();
    const itemData = { 
      id, userId: user.uid, title: newVaultItem.title, 
      type: newVaultItem.type, value: newVaultItem.value,
      date: new Date().toISOString().split('T')[0]
    };
    await setDoc(doc(db, "vault_items", id), itemData);
    setVaultItems([...vaultItems, itemData]); 
    setNewVaultItem({ title: '', type: 'doc', value: '' });
    setIsVaultModalOpen(false);
  };

  const deleteVaultItem = async (id) => {
    if(confirm("Permanently delete this item?")) {
      await deleteDoc(doc(db, "vault_items", id));
      setVaultItems(vaultItems.filter(i => i.id !== id));
    }
  };

  // --- DASHBOARD SYNC ---
  const subscribeToDashboard = (uid) => {
    const ref = doc(db, "artifacts", "default-503020-app", "users", uid, "lumina_dashboard", "daily");
    onSnapshot(ref, (snap) => {
      if(snap.exists()) {
        const d = snap.data();
        setMemo(d.memo || '');
        setCommandLinks(d.commandLinks || []); 
        setSubscriptions(d.subscriptions || []); 
        const today = new Date().toISOString().split('T')[0];
        if(d.date !== today) {
           const reset = (d.habits || []).map(h => ({...h, completed: false}));
           setHabits(reset);
           saveDashboard(uid, d.memo, reset, d.commandLinks, d.subscriptions);
        } else {
           setHabits(d.habits || []);
        }
      }
    });
  };

  const saveDashboard = async (uid, m, h, cl, s) => {
    await setDoc(doc(db, "artifacts", "default-503020-app", "users", uid, "lumina_dashboard", "daily"), {
      memo: m !== undefined ? m : memo, 
      habits: h !== undefined ? h : habits,
      commandLinks: cl !== undefined ? cl : commandLinks,
      subscriptions: s !== undefined ? s : subscriptions,
      date: new Date().toISOString().split('T')[0]
    }, { merge: true });
  };

  // --- BUDGET SYNC (Logic Restored) ---
  useEffect(() => {
    if (!user) return;
    const appId = 'default-503020-app';
    const budgetDoc = doc(db, "artifacts", appId, "users", user.uid, "budget", selectedFinMonth);
    const itemsCol = collection(budgetDoc, "items");

    const unsubscribe = onSnapshot(budgetDoc, (snap) => {
      const inc = snap.data()?.income || 0;
      onSnapshot(itemsCol, (iSnap) => {
        let planned = 0;
        iSnap.forEach(doc => planned += (doc.data().amount || 0));
        setFinanceData({ income: inc, expense: planned, loaded: true });
        setTempBudget({ income: inc || '' });
      });
    });
    return () => unsubscribe();
  }, [user, selectedFinMonth]);

  const saveBudgetIncome = async () => {
    if (!user) return;
    const incomeVal = parseFloat(tempBudget.income) || 0;
    await setDoc(doc(db, "artifacts", "default-503020-app", "users", user.uid, "budget", selectedFinMonth), { income: incomeVal }, { merge: true });
    setIsEditingBudget(false);
  };

  // --- COMMAND & SUBSCRIPTION LOGIC ---
  const addCommandLink = () => { if(!newLink.title || !newLink.url) return; const updated = [...commandLinks, { id: Date.now(), ...newLink }]; setCommandLinks(updated); setNewLink({ title: '', url: '' }); if(user) saveDashboard(user.uid, memo, habits, updated, subscriptions); };
  const removeCommandLink = (id) => { const updated = commandLinks.filter(l => l.id !== id); setCommandLinks(updated); if(user) saveDashboard(user.uid, memo, habits, updated, subscriptions); };
  const addSubscription = () => { if(!newSub.name || !newSub.cost) return; const updated = [...subscriptions, { id: Date.now(), ...newSub }]; setSubscriptions(updated); setNewSub({ name: '', cost: '', url: '' }); if(user) saveDashboard(user.uid, memo, habits, commandLinks, updated); };
  const removeSubscription = (id) => { const updated = subscriptions.filter(s => s.id !== id); setSubscriptions(updated); if(user) saveDashboard(user.uid, memo, habits, commandLinks, updated); };
  const getTotalSubscriptionCost = () => subscriptions.reduce((acc, curr) => acc + (parseFloat(curr.cost) || 0), 0);

  // --- MEMO & HABITS ---
  const debouncedSaveMemo = useCallback(debounce((uid, m, h, cl, s) => saveDashboard(uid, m, h, cl, s), 1500), []);
  const handleMemo = (e) => { const val = e.target.value; setMemo(val); if(user) debouncedSaveMemo(user.uid, val, habits, commandLinks, subscriptions); };
  const toggleHabit = (id) => { const updated = habits.map(h => h.id === id ? {...h, completed: !h.completed} : h); setHabits(updated); if(user) saveDashboard(user.uid, memo, updated, commandLinks, subscriptions); };
  const addHabitAction = (e) => { if(e.key === 'Enter' && newHabit) { const updated = [...habits, {id: Date.now(), label: newHabit, completed: false}]; setHabits(updated); setNewHabit(''); if(user) saveDashboard(user.uid, memo, updated, commandLinks, subscriptions); }};
  const deleteHabit = (id) => { const updated = habits.filter(h => h.id !== id); setHabits(updated); if(user) saveDashboard(user.uid, memo, updated, commandLinks, subscriptions); };

  // --- SECURITY LOGIC ---
  const loadSecuritySettings = async (uid) => {
    const docRef = doc(db, "artifacts", "default-503020-app", "users", uid, "lumina_dashboard", "security");
    onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) setSecurityPin(docSnap.data().pin);
      else setSecurityPin(null);
    });
  };

  const handleNavigation = (destination) => {
    const protectedViews = ['write', 'entries', 'vault']; 
    if (protectedViews.includes(destination) && securityPin) {
      if (Date.now() < sessionExpiry) setView(destination);
      else {
        setTargetView(destination);
        setPinMode('unlock');
        setPinInput('');
        setIsPinPromptOpen(true);
      }
    } else setView(destination);
  };

  const handlePinSubmit = useCallback(async () => {
    if (pinMode === 'unlock') {
      if (pinInput === securityPin) {
        setSessionExpiry(Date.now() + 30 * 60 * 1000);
        setIsPinPromptOpen(false);
        if (targetView) setView(targetView);
      } else { alert("ACCESS DENIED: Incorrect PIN"); setPinInput(''); }
    } else if (pinMode === 'setup' || pinMode === 'set_new') {
      if (pinInput.length === 6) {
        await setDoc(doc(db, "artifacts", "default-503020-app", "users", user.uid, "lumina_dashboard", "security"), { pin: pinInput }, { merge: true });
        setIsPinPromptOpen(false);
        alert(pinMode === 'setup' ? "Security Protocol Engaged." : "PIN Updated.");
      }
    } else if (pinMode === 'verify_current' || pinMode === 'verify_remove') {
      if (pinInput === securityPin) {
        if (pinMode === 'verify_remove') {
          await setDoc(doc(db, "artifacts", "default-503020-app", "users", user.uid, "lumina_dashboard", "security"), { pin: null });
          setSecurityPin(null);
          setIsPinPromptOpen(false);
          alert("Security Disabled.");
        } else {
          setPinMode('set_new');
          setPinInput('');
        }
      } else { alert("Incorrect PIN"); setPinInput(''); }
    }
  }, [pinMode, pinInput, securityPin, targetView, user]);

  const initiateRemovePin = () => { setPinMode('verify_remove'); setPinInput(''); setIsPinPromptOpen(true); setIsSettingsOpen(false); };

  // --- PIN KEYBOARD LISTENER ---
  useEffect(() => {
    if (!isPinPromptOpen) return;
    const handleKeyDown = (e) => {
      if (/^[0-9]$/.test(e.key)) setPinInput(prev => (prev.length < 6 ? prev + e.key : prev));
      else if (e.key === 'Backspace') setPinInput(prev => prev.slice(0, -1));
      else if (e.key === 'Delete') setPinInput('');
      else if (e.key === 'Enter') handlePinSubmit();
      else if (e.key === 'Escape') { if(pinMode === 'unlock') setIsPinPromptOpen(false); else if(pinMode === 'verify_remove') { setIsPinPromptOpen(false); setIsSettingsOpen(true); } }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPinPromptOpen, handlePinSubmit, pinMode]);

  // --- EVENTS, TIMER, CALENDAR ---
  const loadEvents = async (uid) => {
    const q = query(collection(db, "calendar_events"), where("userId", "==", uid));
    const snap = await getDocs(q);
    const loadedEvents = snap.docs.map(d => ({id: d.id, ...d.data()}));
    setEvents(loadedEvents);
    const today = new Date().toISOString().split('T')[0];
    if (loadedEvents.filter(e => e.date === today).length > 0) setDailyReminder(`${loadedEvents.filter(e => e.date === today).length} events today.`);
  };
  const saveEvent = async () => {
    if (!newEvent.title || !user || !selectedDate) return;
    const id = Date.now().toString();
    const eventData = { id, userId: user.uid, date: selectedDate, title: newEvent.title, time: newEvent.time };
    await setDoc(doc(db, "calendar_events", id), eventData);
    setEvents([...events, eventData]); setNewEvent({ title: '', time: '' });
  };
  const deleteEvent = async (id) => { if(confirm("Remove?")) { await deleteDoc(doc(db, "calendar_events", id)); setEvents(events.filter(e => e.id !== id)); }};
  const getUpcomingEvents = () => {
    const today = new Date().toISOString().split('T')[0];
    return events.filter(e => e.date >= today).sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));
  };
  useEffect(() => {
    let int = null;
    if (pomoActive && pomoTime > 0) int = setInterval(() => setPomoTime(t => t - 1), 1000);
    return () => clearInterval(int);
  }, [pomoActive, pomoTime]);

  const saveCustomTimer = () => { const mins = parseInt(customMinutes); if (!isNaN(mins) && mins > 0) { const newSeconds = mins * 60; setInitialPomoTime(newSeconds); setPomoTime(newSeconds); setIsEditingTimer(false); } else { setIsEditingTimer(false); }};

  // Helpers
  const getCalendarDays = () => { const days = []; const firstDay = new Date(time.getFullYear(), time.getMonth(), 1).getDay(); const daysInMonth = new Date(time.getFullYear(), time.getMonth() + 1, 0).getDate(); for (let i = 0; i < firstDay; i++) days.push(null); for (let i = 1; i <= daysInMonth; i++) days.push(i); return days; };
  const hasEntryOnDay = (d) => d && entries.some(e => e.date === `${time.toISOString().slice(0,7)}-${d.toString().padStart(2,'0')}`);
  const hasEventOnDay = (d) => d && events.some(e => e.date === `${time.toISOString().slice(0,7)}-${d.toString().padStart(2,'0')}`);
  
  // FIXED GREETING LOGIC
  const getGreetingIcon = () => { const h = time.getHours(); if (h >= 5 && h < 12) return <Sunrise className="w-6 h-6 text-yellow-400 animate-bounce" />; if (h >= 12 && h < 17) return <Sun className="w-6 h-6 text-orange-400 animate-spin" style={{animationDuration:'10s'}}/>; return <Moon className="w-6 h-6 text-indigo-400 animate-pulse" />; };

  // --- ENTRIES ---
  const loadEntries = async (uid) => { const q = query(collection(db, "entries"), where("userId", "==", uid)); const snap = await getDocs(q); setEntries(snap.docs.map(d => ({id: d.id, ...d.data()})).sort((a,b) => new Date(b.date) - new Date(a.date))); };
  const saveEntry = async () => { if(!currentEntry.title || !user) return; const id = editingId || Date.now().toString(); await setDoc(doc(db, "entries", id), {...currentEntry, userId: user.uid, id, wordCount: currentEntry.content.split(/\s+/).length}); loadEntries(user.uid); setCurrentEntry({ title: '', content: '', date: new Date().toISOString().split('T')[0], mood: null }); setEditingId(null); setView('entries'); };
  const deleteEntry = async (id) => { if(confirm("Delete?")) { await deleteDoc(doc(db, "entries", id)); loadEntries(user.uid); }};
  const getStats = () => ({ total: entries.length, words: entries.reduce((s, e) => s + (e.wordCount || 0), 0), level: Math.floor(entries.reduce((s, e) => s + (e.wordCount || 0), 0) / 500) + 1 });
  const getHeatmap = () => { const days = []; const today = new Date(); for(let i=140; i>=0; i--) { const d = new Date(today); d.setDate(d.getDate() - i); const dateStr = d.toISOString().split('T')[0]; const hasEntry = entries.some(e => e.date === dateStr); days.push({date: dateStr, active: hasEntry}); } return days; };
  const getMoodTrend = () => { const data = []; const today = new Date(); for(let i=13; i>=0; i--) { const d = new Date(today); d.setDate(d.getDate() - i); const dateStr = d.toISOString().split('T')[0]; const entry = entries.find(e => e.date === dateStr); let val = 0; if(entry) { if(entry.mood === 'happy') val = 3; else if(entry.mood === 'neutral') val = 2; else if(entry.mood === 'sad') val = 1; } data.push({ date: dateStr, value: val, label: d.toLocaleDateString('en-US', {weekday:'narrow'}) }); } return data; };
  const getWeeklyActivity = () => { const data = []; const today = new Date(); for(let i=6; i>=0; i--) { const d = new Date(today); d.setDate(d.getDate() - i); const dateStr = d.toISOString().split('T')[0]; const entry = entries.find(e => e.date === dateStr); const count = entry ? (entry.wordCount || 0) : 0; data.push({ label: d.toLocaleDateString('en-US', {weekday:'short'}), count }); } return data; };

  if (loadingAuth) return <div className="h-screen bg-pro-bg text-pro-primary flex items-center justify-center font-sans animate-pulse">Loading System...</div>;
  if (!user) return <Login />;

  return (
    <div className="flex h-screen bg-pro-bg text-pro-text font-sans overflow-hidden relative">
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0"><div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-600/10 rounded-full blur-[100px] animate-float"></div><div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-600/10 rounded-full blur-[100px] animate-float-delayed"></div></div>

      {/* Sidebar */}
      {!zenMode && (
        <aside className={`fixed inset-y-0 left-0 z-50 bg-pro-bg/80 backdrop-blur-xl border-r border-pro-border flex flex-col justify-between py-6 transition-all duration-300 ease-in-out shadow-2xl ${isSidebarOpen ? 'w-64' : 'w-20'}`} onMouseEnter={() => setSidebarOpen(true)} onMouseLeave={() => setSidebarOpen(false)}>
          <div>
            <div className="flex items-center gap-3 mb-10 px-4 h-12"><div className="w-12 h-12 shrink-0 bg-gradient-primary rounded-xl flex items-center justify-center text-white font-bold text-xl shadow-lg cursor-pointer">{isSidebarOpen ? 'L' : <Menu className="w-6 h-6" />}</div><h1 className={`text-2xl font-bold text-pro-white tracking-tight transition-opacity duration-300 ${isSidebarOpen ? 'opacity-100' : 'opacity-0 hidden'}`}>Lumina</h1></div>
            <nav className="space-y-2 px-2">
              {[{id:'dashboard',icon:LayoutDashboard,label:'Dashboard'},{id:'write',icon:PenTool,label:'Journal'},{id:'entries',icon:BookOpen,label:'Entries'},{id:'vault',icon:HardDrive,label:'Vault'},{id:'stats',icon:BarChart2,label:'Analytics'}].map(item => (
                <button key={item.id} onClick={() => handleNavigation(item.id)} className={`flex items-center h-12 w-full rounded-xl transition-all duration-200 group relative ${view === item.id ? 'bg-pro-card text-pro-primary shadow-sm border border-pro-border' : 'text-gray-500 hover:bg-white/5 hover:text-pro-white'}`}>
                  <div className="w-16 h-12 flex items-center justify-center shrink-0 relative"><item.icon className={`w-5 h-5 transition-colors ${view === item.id ? 'text-pro-primary' : 'group-hover:text-pro-white'}`} />{securityPin && (item.id === 'write' || item.id === 'entries' || item.id === 'vault') && <div className="absolute top-2 right-4 w-2 h-2 bg-purple-500 rounded-full"></div>}</div><span className={`font-medium whitespace-nowrap overflow-hidden transition-all duration-300 ${isSidebarOpen ? 'opacity-100 w-auto' : 'opacity-0 w-0'}`}>{item.label}</span>
                </button>
              ))}
            </nav>
          </div>
          <div className="border-t border-pro-border pt-6 px-2 space-y-2"><button onClick={() => setIsSettingsOpen(true)} className="flex items-center h-12 w-full rounded-xl text-gray-500 hover:bg-white/5 hover:text-pro-white transition-colors"><div className="w-16 h-12 flex items-center justify-center shrink-0"><SettingsIcon className="w-5 h-5" /></div><span className={`font-medium whitespace-nowrap overflow-hidden transition-all duration-300 ${isSidebarOpen ? 'opacity-100 w-auto' : 'opacity-0 w-0'}`}>Settings</span></button><button onClick={() => signOut(auth)} className="flex items-center h-12 w-full rounded-xl text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors"><div className="w-16 h-12 flex items-center justify-center shrink-0"><LogOut className="w-5 h-5" /></div><span className={`font-medium whitespace-nowrap overflow-hidden transition-all duration-300 ${isSidebarOpen ? 'opacity-100 w-auto' : 'opacity-0 w-0'}`}>Logout</span></button></div>
        </aside>
      )}

      {/* Main Content */}
      <main className={`flex-1 overflow-y-auto relative z-10 transition-all duration-300 ${zenMode ? '' : 'ml-20'}`}>
        {!zenMode && (
          <header className="sticky top-0 z-40 bg-pro-bg/80 backdrop-blur-md px-8 py-6 flex justify-between items-center">
            <div className="flex items-center gap-4">
              {getGreetingIcon()}
              <div>
                <h2 className="text-2xl font-bold text-pro-white">
                  {/* CORRECTED GREETING LOGIC */}
                  {time.getHours() < 12 ? 'Good Morning,' : time.getHours() < 17 ? 'Good Afternoon,' : 'Good Evening,'} 
                  <span className="text-pro-primary"> Achintha</span>
                </h2>
                <p className="text-sm text-gray-500 mt-1">Ready to organize your thoughts?</p>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
               {/* Briefing Button */}
               <button onClick={generateDailyBriefing} className="flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 rounded-lg text-xs font-bold text-white shadow-lg transition-all active:scale-95"><Sparkles className="w-3 h-3" /> Brief Me</button>
               {dailyReminder && <div className="hidden md:flex items-center gap-2 px-4 py-1.5 bg-pro-card rounded-full border border-pro-border animate-fadeIn"><Bell className="w-4 h-4 text-yellow-400 animate-pulse" /><span className="text-xs font-medium text-gray-300">{dailyReminder}</span><button onClick={() => setDailyReminder(null)} className="ml-2 hover:text-white"><X className="w-3 h-3"/></button></div>}
               <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-pro-card rounded-lg border border-pro-border"><div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div><span className="text-xs font-mono text-gray-400">SYS.ONLINE</span></div>
            </div>
          </header>
        )}

        <div className={`mx-auto ${zenMode ? 'h-full flex items-center justify-center' : 'p-8 max-w-7xl'}`}>
          {view === 'dashboard' && !zenMode && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {/* Widgets */}
              <div className="lg:col-span-2 bg-pro-card rounded-2xl p-6 border border-pro-border shadow-sm flex flex-col justify-between relative overflow-hidden group"><div className="flex justify-between items-start z-10"><div className="p-2 bg-pro-bg rounded-lg border border-pro-border"><Clock className="w-5 h-5 text-pro-secondary" /></div><div className="text-right"><span className="text-3xl font-bold text-pro-white">{weather?.temperature}°</span><p className="text-xs text-gray-500 uppercase tracking-wider">Colombo, LK</p></div></div><div className="mt-8 z-10"><h3 className="text-6xl font-bold text-pro-white tracking-tighter font-mono">{time.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</h3><p className="text-pro-text mt-2 font-medium">{time.toLocaleDateString(undefined, {weekday:'long', month:'long', day:'numeric'})}</p></div></div>
              <div className="lg:col-span-1 bg-gradient-primary rounded-2xl p-6 shadow-lg shadow-indigo-500/20 text-white flex flex-col justify-between relative overflow-hidden"><div className="z-10 w-full"><div className="flex justify-between items-center mb-1"><h4 className="text-indigo-100 font-medium text-sm">Focus Session</h4><button onClick={() => setIsEditingTimer(true)} className="text-indigo-200 hover:text-white p-1 rounded hover:bg-white/10"><Edit3 className="w-4 h-4" /></button></div>{isEditingTimer ? (<div className="flex items-center gap-2 mb-2"><input type="number" autoFocus value={customMinutes} onChange={(e) => setCustomMinutes(e.target.value)} className="w-16 bg-white/20 text-white text-2xl font-bold font-mono p-1 rounded border border-white/30 text-center" /><button onClick={saveCustomTimer} className="bg-white/20 hover:bg-white/30 p-1 px-3 rounded text-sm">Set</button></div>) : (<span className="text-5xl font-bold font-mono block cursor-pointer">{Math.floor(pomoTime/60).toString().padStart(2,'0')}:{ (pomoTime%60).toString().padStart(2,'0') }</span>)}</div><div className="flex gap-3 mt-4 z-10"><button onClick={() => setPomoActive(!pomoActive)} className="flex-1 bg-white/20 hover:bg-white/30 backdrop-blur-sm py-2 rounded-lg font-medium transition-colors flex items-center justify-center gap-2">{pomoActive ? <Pause className="w-4 h-4"/> : <Play className="w-4 h-4"/>} {pomoActive ? 'Pause' : 'Start'}</button><button onClick={() => {setPomoActive(false); setPomoTime(initialPomoTime)}} className="px-3 bg-white/20 hover:bg-white/30 backdrop-blur-sm rounded-lg"><RotateCw className="w-4 h-4"/></button></div></div>
              
              {/* Budget */}
              <div className="lg:col-span-1 bg-pro-card rounded-2xl p-6 border border-pro-border shadow-sm flex flex-col justify-between"><div className="flex justify-between items-center mb-4"><h4 className="font-semibold text-pro-white flex items-center gap-2"><DollarSign className="w-4 h-4 text-green-500"/> Budget</h4><div className="flex items-center gap-2 bg-pro-bg rounded-lg p-1 border border-pro-border"><button onClick={() => setSelectedFinMonth(m => {const d = new Date(m + "-01"); d.setMonth(d.getMonth() - 1); return d.toISOString().slice(0, 7);})} className="p-1 text-gray-500 hover:text-white transition-colors"><ChevronLeft className="w-3 h-3"/></button><span className="text-xs font-mono font-medium text-gray-300 min-w-[50px] text-center">{new Date(selectedFinMonth + "-01").toLocaleDateString('en-US', { month: 'short', year: '2-digit' })}</span><button onClick={() => setSelectedFinMonth(m => {const d = new Date(m + "-01"); d.setMonth(d.getMonth() + 1); return d.toISOString().slice(0, 7);})} className="p-1 text-gray-500 hover:text-white transition-colors"><ChevronRight className="w-3 h-3"/></button></div></div>{financeData.loaded ? (isEditingBudget ? (<div className="space-y-2 animate-fadeIn"><div className="flex flex-col gap-1"><span className="text-[10px] text-gray-500">Income (Edit)</span><input className="w-full bg-pro-bg border border-pro-border rounded px-2 py-1 text-xs text-white" value={tempBudget.income} onChange={e=>setTempBudget({...tempBudget, income:e.target.value})} placeholder="5000" /></div><div className="flex gap-2 pt-1"><button onClick={saveBudgetIncome} className="flex-1 bg-green-600 text-white py-1 rounded text-xs">Save</button><button onClick={()=>setIsEditingBudget(false)} className="flex-1 bg-gray-700 text-white py-1 rounded text-xs">Cancel</button></div></div>) : (<div className="space-y-4"><div><span className="text-xs text-gray-500 uppercase">Remaining</span><div className={`text-2xl font-bold ${financeData.income - financeData.expense < 0 ? 'text-red-500' : 'text-emerald-400'}`}>${(financeData.income - financeData.expense).toLocaleString(undefined, { minimumFractionDigits: 2 })}</div></div><div className="w-full bg-pro-bg rounded-full h-2 overflow-hidden relative"><div className={`h-full rounded-full transition-all duration-1000 ${financeData.income - financeData.expense < 0 ? 'bg-red-500' : 'bg-green-500'}`} style={{width: `${Math.min((financeData.expense / (financeData.income || 1)) * 100, 100)}%`}}></div></div><div className="flex justify-between text-[10px] text-gray-500"><span>Spent: ${financeData.expense.toLocaleString()}</span><span>Income: ${financeData.income.toLocaleString()}</span></div><div className="flex gap-2"><button onClick={() => window.open('https://budget.infinityfree.me/?i=1', '_blank')} className="flex-1 py-1.5 text-xs font-medium bg-pro-bg hover:bg-pro-border rounded-lg text-pro-text transition-colors flex items-center justify-center gap-1">App <ExternalLink className="w-3 h-3" /></button><button onClick={() => setIsEditingBudget(true)} className="px-2 py-1.5 bg-pro-bg hover:bg-pro-border rounded-lg text-gray-400 hover:text-white transition-colors"><Edit3 className="w-3 h-3" /></button></div></div>)) : (<div className="flex-1 flex flex-col items-center justify-center text-xs text-gray-500 animate-pulse gap-2"><RotateCw className="w-4 h-4 animate-spin"/><span>Syncing...</span></div>)}</div>

              {/* Habits */}
              <div className="lg:col-span-1 bg-pro-card rounded-2xl p-6 border border-pro-border shadow-sm flex flex-col"><div className="flex justify-between items-center mb-4"><h4 className="font-semibold text-pro-white flex items-center gap-2"><CheckCircle className="w-4 h-4 text-pro-primary"/> Habits</h4><span className="text-xs bg-pro-bg px-2 py-1 rounded text-gray-500">{habits.filter(h => h.completed).length}/{habits.length}</span></div><div className="flex-1 overflow-y-auto space-y-2 max-h-40 custom-scrollbar pr-2">{habits.map(h => (<div key={h.id} className="group flex items-center justify-between p-3 rounded-xl bg-pro-bg border border-pro-border hover:border-pro-primary/50 transition-colors cursor-pointer" onClick={() => toggleHabit(h.id)}><div className="flex items-center gap-3"><div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${h.completed ? 'bg-pro-primary border-pro-primary' : 'border-gray-600'}`}>{h.completed && <CheckCircle className="w-3 h-3 text-white" />}</div><span className={`text-xs ${h.completed ? 'text-gray-500 line-through' : 'text-gray-200'}`}>{h.label}</span></div><button onClick={(e) => {e.stopPropagation(); deleteHabit(h.id)}} className="opacity-0 group-hover:opacity-100 text-gray-500 hover:text-red-400"><X className="w-3 h-3"/></button></div>))}</div><div className="mt-3"><input type="text" value={newHabit} onChange={(e) => setNewHabit(e.target.value)} onKeyDown={addHabitAction} placeholder="Add..." className="w-full bg-pro-bg border border-pro-border rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-pro-primary" /></div></div>

              {/* Calendar */}
              <div className="lg:col-span-1 bg-pro-card rounded-2xl p-6 border border-pro-border shadow-sm flex flex-col"><div className="flex justify-between items-center mb-4"><h4 className="font-semibold text-pro-white flex items-center gap-2"><CalendarIcon className="w-4 h-4 text-pro-secondary"/> Calendar</h4></div><div className="grid grid-cols-7 gap-1 text-center text-xs mb-2">{['S','M','T','W','T','F','S'].map((d, i) => (<span key={i} className="text-gray-600 font-bold">{d}</span>))}</div><div className="grid grid-cols-7 gap-1 text-center flex-1 content-start">{getCalendarDays().map((day, idx) => {if (!day) return <div key={`empty-${idx}`} className="aspect-square"></div>; const hasEvent = hasEventOnDay(day); const isToday = day === new Date().getDate(); return <div key={idx} onClick={() => { setSelectedDate(`${time.toISOString().slice(0,7)}-${day.toString().padStart(2,'0')}`); setEventModalOpen(true); }} className={`aspect-square flex items-center justify-center text-xs font-medium rounded-full transition-all cursor-pointer relative hover:bg-pro-primary/20 ${isToday ? 'bg-pro-primary text-white font-bold' : 'text-gray-400'}`}>{day}{hasEvent && !isToday && <div className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-purple-500 border border-pro-card"></div>}</div>})}</div></div>

              {/* Schedule */}
              <div className="lg:col-span-1 bg-pro-card rounded-2xl p-6 border border-pro-border shadow-sm flex flex-col"><div className="flex justify-between items-center mb-4"><h4 className="font-semibold text-pro-white flex items-center gap-2"><CalendarCheck className="w-4 h-4 text-pink-500"/> Schedule</h4><span className="text-[10px] text-gray-500 uppercase">Upcoming</span></div><div className="flex-1 space-y-3 overflow-y-auto max-h-48 custom-scrollbar pr-1">{getUpcomingEvents().length === 0 ? <div className="text-center text-gray-600 text-xs py-4">No upcoming events.</div> : getUpcomingEvents().slice(0, 5).map(e => (<div key={e.id} className="p-3 bg-pro-bg rounded-lg border border-pro-border flex justify-between items-center"><div><div className="flex items-center gap-2 mb-1"><span className="text-xs font-mono text-pink-400 bg-pink-500/10 px-1.5 py-0.5 rounded">{e.date.slice(5)}</span><span className="text-[10px] text-gray-500">{e.time}</span></div><h5 className="text-sm font-medium text-gray-300 truncate max-w-[120px]">{e.title}</h5></div><button onClick={() => deleteEvent(e.id)} className="text-gray-600 hover:text-red-400"><Trash2 className="w-3 h-3"/></button></div>))}</div></div>

              {/* Subs */}
              <div className="lg:col-span-1 bg-pro-card rounded-2xl p-6 border border-pro-border shadow-sm flex flex-col"><div className="flex justify-between items-center mb-4"><h4 className="font-semibold text-pro-white flex items-center gap-2"><CreditCard className="w-4 h-4 text-orange-500"/> Subs</h4><div className="flex gap-2"><span className="text-xs bg-pro-bg px-2 py-1 rounded text-green-400">${getTotalSubscriptionCost()}</span><button onClick={() => setIsEditingSubs(!isEditingSubs)} className="text-gray-500 hover:text-white"><Edit3 className="w-3 h-3"/></button></div></div>{isEditingSubs ? (<div className="space-y-2 animate-fadeIn"><div className="flex gap-1"><input className="flex-1 bg-pro-bg border border-pro-border rounded px-2 py-1 text-xs text-white" placeholder="Name" value={newSub.name} onChange={e=>setNewSub({...newSub, name:e.target.value})} /><input className="w-16 bg-pro-bg border border-pro-border rounded px-2 py-1 text-xs text-white" placeholder="$" value={newSub.cost} onChange={e=>setNewSub({...newSub, cost:e.target.value})} /></div><div className="flex gap-1"><input className="flex-1 bg-pro-bg border border-pro-border rounded px-2 py-1 text-xs text-white" placeholder="URL (for icon)" value={newSub.url} onChange={e=>setNewSub({...newSub, url:e.target.value})} /><button onClick={addSubscription} className="bg-orange-600 text-white px-2 rounded"><Plus className="w-3 h-3"/></button></div><div className="h-24 overflow-y-auto mt-2 space-y-1">{subscriptions.map(s => (<div key={s.id} className="flex justify-between items-center text-xs p-1 bg-pro-bg rounded border border-pro-border"><span>{s.name}</span><button onClick={() => removeSubscription(s.id)} className="text-red-400"><X className="w-3 h-3"/></button></div>))}</div></div>) : (<div className="flex-1 space-y-2 overflow-y-auto max-h-48 custom-scrollbar">{subscriptions.map(s => (<a key={s.id} href={s.url} target="_blank" rel="noreferrer" className="flex items-center justify-between p-2 bg-pro-bg border border-pro-border rounded-lg hover:border-orange-500/50 transition-colors group"><div className="flex items-center gap-3"><img src={getFavicon(s.url)} alt="" className="w-6 h-6 rounded-full bg-white p-0.5" onError={(e) => e.target.src = 'https://via.placeholder.com/24'} /><span className="text-sm font-medium text-gray-300 group-hover:text-white">{s.name}</span></div><span className="text-xs font-mono text-gray-500">${s.cost}</span></a>))}{subscriptions.length === 0 && <p className="text-xs text-center text-gray-600 mt-4">No active subscriptions.</p>}</div>)}</div>

              {/* Edu */}
              <div className="lg:col-span-1 bg-pro-card rounded-2xl p-6 border border-pro-border shadow-sm flex flex-col justify-between relative overflow-hidden group hover:border-blue-500/50 transition-colors"><div className="absolute inset-0 bg-blue-500/5 opacity-0 group-hover:opacity-100 transition-opacity"></div><div className="relative z-10"><div className="flex items-center gap-3 mb-4"><div className="p-2 bg-blue-500/10 rounded-lg text-blue-400"><GraduationCap className="w-6 h-6" /></div><div><h4 className="font-bold text-pro-white">Education</h4><p className="text-xs text-gray-500">Course Manager</p></div></div><p className="text-sm text-gray-400 mb-4 line-clamp-2">Access your learning dashboard.</p></div><button onClick={() => window.open('https://eduapp-chi.vercel.app/', '_blank')} className="relative z-10 w-full py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2">Launch App <ExternalLink className="w-3 h-3" /></button></div>

              {/* Commands */}
              <div className="lg:col-span-1 bg-pro-card rounded-2xl p-6 border border-pro-border shadow-sm flex flex-col"><div className="flex justify-between items-center mb-4"><h4 className="font-semibold text-pro-white flex items-center gap-2"><Link className="w-4 h-4 text-purple-500"/> Commands</h4><button onClick={() => setIsEditingCommands(!isEditingCommands)} className="text-gray-500 hover:text-white"><Edit3 className="w-3 h-3"/></button></div>{isEditingCommands ? (<div className="space-y-2 animate-fadeIn"><div className="flex flex-col gap-2"><input className="w-full bg-pro-bg border border-pro-border rounded px-2 py-1 text-xs text-white" placeholder="Title" value={newLink.title} onChange={e=>setNewLink({...newLink, title:e.target.value})} /><div className="flex gap-1"><input className="flex-1 bg-pro-bg border border-pro-border rounded px-2 py-1 text-xs text-white" placeholder="URL" value={newLink.url} onChange={e=>setNewLink({...newLink, url:e.target.value})} /><button onClick={addCommandLink} className="bg-purple-600 text-white px-2 rounded hover:bg-purple-500 transition-colors"><Plus className="w-4 h-4"/></button></div></div><div className="h-24 overflow-y-auto mt-2 space-y-1">{commandLinks.map(l => (<div key={l.id} className="flex justify-between items-center text-xs p-1 bg-pro-bg rounded border border-pro-border"><span>{l.title}</span><button onClick={() => removeCommandLink(l.id)} className="text-red-400"><X className="w-3 h-3"/></button></div>))}</div></div>) : (<div className="flex-1 grid grid-cols-2 gap-2 overflow-y-auto custom-scrollbar content-start">{commandLinks.map(link => (<a key={link.id} href={link.url} target="_blank" rel="noreferrer" className="flex flex-col items-center justify-center p-3 bg-pro-bg border border-pro-border rounded-xl hover:border-purple-500 transition-all group h-20"><img src={getFavicon(link.url)} alt="" className="w-6 h-6 mb-2 rounded bg-white p-0.5" onError={(e) => e.target.src = 'https://via.placeholder.com/24'} /><span className="text-[10px] text-gray-400 text-center truncate w-full">{link.title}</span></a>))}{commandLinks.length === 0 && <p className="col-span-2 text-center text-xs text-gray-600 py-4">Add links via Edit mode.</p>}</div>)}</div>

              {/* Notes */}
              <div className="lg:col-span-2 bg-pro-card rounded-2xl p-6 border border-pro-border shadow-sm flex flex-col"><div className="flex justify-between items-center mb-2"><h4 className="font-semibold text-pro-white flex items-center gap-2"><Save className="w-4 h-4 text-yellow-500"/> Quick Notes</h4><span className="text-[10px] text-gray-600 uppercase">Auto-Sync</span></div><textarea value={memo} onChange={handleMemo} placeholder="Capture your thoughts..." className="flex-1 w-full bg-pro-bg rounded-xl border border-pro-border p-4 text-sm text-gray-300 focus:outline-none focus:border-pro-primary resize-none transition-colors" style={{minHeight: '140px'}} /></div>
            </div>
          )}

          {/* AI Briefing Modal */}
          {isBriefingOpen && (
            <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fadeIn">
              <div className="bg-pro-card border border-pro-border rounded-2xl p-6 w-full max-w-lg shadow-2xl relative">
                <button onClick={() => setIsBriefingOpen(false)} className="absolute top-4 right-4 text-gray-500 hover:text-white"><X className="w-5 h-5"/></button>
                <h3 className="text-xl font-bold text-pro-white mb-4 flex items-center gap-2"><Bot className="w-5 h-5 text-blue-400" /> Daily Briefing</h3>
                <div className="p-6 bg-pro-bg border border-pro-border rounded-xl">
                  {isGeneratingBriefing ? (
                    <div className="flex flex-col items-center justify-center py-8 text-gray-400"><Sparkles className="w-8 h-8 text-yellow-400 animate-pulse mb-3" /><p className="text-sm font-medium">Lumina AI is analyzing your day...</p></div>
                  ) : (
                    <div className="text-gray-200 leading-relaxed space-y-4">{briefing.split('\n').map((line, i) => <p key={i}>{line}</p>)}</div>
                  )}
                </div>
                {!isGeneratingBriefing && <div className="mt-4 flex justify-end"><button onClick={() => setIsBriefingOpen(false)} className="px-4 py-2 bg-pro-primary text-white rounded-lg text-sm font-medium hover:bg-opacity-90">Got it</button></div>}
              </div>
            </div>
          )}

          {/* ... (VAULT / WRITE / ENTRIES / STATS / MODALS - Identical to V10) ... */}
          {/* Include Vault/Modals code here. omitted for brevity but CRITICAL for functionality */}
          {/* Re-including for completeness */}
          {view === 'vault' && (<div className="space-y-6"><div className="flex justify-between items-center"><h2 className="text-2xl font-bold text-pro-white flex items-center gap-3"><Shield className="w-8 h-8 text-green-500" /> Digital Vault</h2><button onClick={() => setIsVaultModalOpen(true)} className="px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg flex items-center gap-2"><Plus className="w-4 h-4"/> Add Item</button></div><div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">{vaultItems.map(item => (<div key={item.id} className="bg-pro-card border border-pro-border p-5 rounded-2xl hover:border-green-500/50 transition-colors group relative"><div className="flex items-start justify-between mb-3"><div className={`p-3 rounded-xl ${item.type === 'doc' ? 'bg-blue-500/10 text-blue-400' : item.type === 'image' ? 'bg-purple-500/10 text-purple-400' : 'bg-yellow-500/10 text-yellow-400'}`}>{item.type === 'doc' ? <FileText className="w-6 h-6"/> : item.type === 'image' ? <ImageIcon className="w-6 h-6"/> : <File className="w-6 h-6"/>}</div><button onClick={() => deleteVaultItem(item.id)} className="text-gray-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 className="w-4 h-4"/></button></div><h3 className="text-lg font-bold text-white mb-1">{item.title}</h3><p className="text-xs text-gray-500 mb-4 font-mono">Added: {item.date}</p>{item.value.startsWith('http') ? (<a href={item.value} target="_blank" rel="noreferrer" className="w-full py-2 bg-pro-bg hover:bg-pro-border border border-pro-border rounded-lg text-sm text-center block text-gray-300 transition-colors">Open Document <ExternalLink className="w-3 h-3 inline ml-1"/></a>) : (<div className="w-full p-3 bg-pro-bg border border-pro-border rounded-lg text-xs text-gray-400 font-mono break-all">{item.value}</div>)}</div>))}{vaultItems.length === 0 && (<div className="col-span-full py-12 flex flex-col items-center justify-center text-gray-500 border-2 border-dashed border-pro-border rounded-2xl"><Folder className="w-12 h-12 mb-2 opacity-50"/><p>Vault is empty.</p></div>)}</div></div>)}
          {isVaultModalOpen && (<div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fadeIn"><div className="bg-pro-card border border-pro-border rounded-2xl p-6 w-full max-w-md shadow-2xl relative"><button onClick={() => setIsVaultModalOpen(false)} className="absolute top-4 right-4 text-gray-500 hover:text-white"><X className="w-5 h-5"/></button><h3 className="text-xl font-bold text-pro-white mb-6 flex items-center gap-2"><HardDrive className="w-5 h-5 text-green-500" /> Add to Vault</h3><div className="space-y-4"><div><label className="text-xs text-gray-500 uppercase font-bold block mb-1">Title</label><input autoFocus className="w-full bg-pro-bg border border-pro-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-green-500" placeholder="e.g. Resume 2026" value={newVaultItem.title} onChange={e => setNewVaultItem({...newVaultItem, title: e.target.value})} /></div><div><label className="text-xs text-gray-500 uppercase font-bold block mb-1">Type</label><div className="grid grid-cols-3 gap-2">{['doc', 'image', 'other'].map(t => (<button key={t} onClick={() => setNewVaultItem({...newVaultItem, type: t})} className={`py-2 rounded-lg text-xs font-medium capitalize border ${newVaultItem.type === t ? 'bg-green-600 border-green-500 text-white' : 'bg-pro-bg border-pro-border text-gray-400'}`}>{t}</button>))}</div></div><div><label className="text-xs text-gray-500 uppercase font-bold block mb-1">Link or Note</label><textarea className="w-full bg-pro-bg border border-pro-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-green-500 h-24 resize-none" placeholder="Paste Google Drive link, or type a secure note..." value={newVaultItem.value} onChange={e => setNewVaultItem({...newVaultItem, value: e.target.value})} /></div><button onClick={saveVaultItem} className="w-full py-3 bg-green-600 hover:bg-green-500 text-white rounded-lg font-bold transition-colors">Secure Item</button></div></div></div>)}
          
          {(view === 'write' || zenMode) && (
            <div className={`relative flex flex-col h-full ${zenMode ? 'max-w-3xl mx-auto w-full' : 'bg-pro-card rounded-2xl border border-pro-border p-8 shadow-sm h-[calc(100vh-140px)]'}`}>
              <div className="absolute top-4 right-4 z-20"><button onClick={() => setZenMode(!zenMode)} className="p-2 text-gray-400 hover:text-white bg-pro-bg rounded-full border border-pro-border">{zenMode ? <Minimize2 className="w-5 h-5"/> : <Maximize2 className="w-5 h-5"/>}</button></div>
              <div className="mb-6 border-b border-pro-border pb-4">
                <input type="text" value={currentEntry.title} onChange={(e) => setCurrentEntry({...currentEntry, title: e.target.value})} placeholder="Title..." className="w-full bg-transparent text-4xl font-bold text-pro-white placeholder-gray-700 focus:outline-none" />
                <div className="flex gap-4 mt-4">
                   {[{id:'happy', icon:Sun, color:'text-yellow-400'},{id:'neutral', icon:Cloud, color:'text-gray-400'},{id:'sad', icon:Moon, color:'text-indigo-400'}].map(m => (<button key={m.id} onClick={() => setCurrentEntry({...currentEntry, mood: m.id})} className={`flex items-center gap-2 px-3 py-1.5 rounded-full border transition-all ${currentEntry.mood === m.id ? `bg-pro-bg border-white/20 ${m.color}` : 'border-transparent text-gray-600 hover:bg-pro-bg'}`}><m.icon className="w-4 h-4" /> <span className="text-xs capitalize">{m.id}</span></button>))}
                </div>
              </div>
              <textarea value={currentEntry.content} onChange={(e) => setCurrentEntry({...currentEntry, content: e.target.value})} placeholder="Write..." className="flex-1 w-full bg-transparent text-lg text-gray-300 leading-relaxed resize-none focus:outline-none font-sans" />
              <div className="pt-4 flex justify-between items-center text-sm text-gray-500"><span>{currentEntry.content.split(/\s+/).filter(w => w.length > 0).length} words</span><button onClick={saveEntry} disabled={!currentEntry.title} className="px-6 py-2 bg-pro-primary hover:bg-indigo-500 text-white rounded-lg font-medium transition-colors disabled:opacity-50">Save</button></div>
            </div>
          )}

          {view === 'entries' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-10">
              {entries.map(e => (<div key={e.id} onClick={() => {setCurrentEntry(e); setEditingId(e.id); setView('write')}} className="group bg-pro-card border border-pro-border hover:border-pro-primary/50 p-6 rounded-2xl cursor-pointer transition-all hover:shadow-lg hover:-translate-y-1"><div className="flex justify-between items-start mb-3"><span className="text-xs font-mono text-pro-primary bg-pro-primary/10 px-2 py-1 rounded inline-block">{e.date}</span><button onClick={(event) => { event.stopPropagation(); deleteEntry(e.id); }} className="text-gray-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"><X className="w-4 h-4"/></button></div><h3 className="text-xl font-bold text-pro-white mb-2 truncate">{e.title}</h3><p className="text-gray-500 text-sm line-clamp-3">{e.content}</p></div>))}
            </div>
          )}

          {view === 'stats' && (
            <div className="col-span-full space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-pro-card p-6 rounded-2xl border border-pro-border flex flex-col items-center justify-center relative overflow-hidden"><div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-purple-500"></div><div className="text-4xl font-bold text-pro-white mb-1">{getStats().total}</div><div className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Total Entries</div></div>
                <div className="bg-pro-card p-6 rounded-2xl border border-pro-border flex flex-col items-center justify-center relative overflow-hidden"><div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-cyan-500 to-blue-500"></div><div className="text-4xl font-bold text-pro-secondary mb-1">{getStats().words}</div><div className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Words</div></div>
                <div className="bg-pro-card p-6 rounded-2xl border border-pro-border flex flex-col items-center justify-center relative overflow-hidden"><div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-500 to-pink-500"></div><div className="text-4xl font-bold text-pro-primary mb-1">Lvl {getStats().level}</div><div className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Level</div></div>
              </div>
              <div className="bg-pro-card p-8 rounded-2xl border border-pro-border">
                <div className="flex justify-between items-center mb-6"><h3 className="text-lg font-bold text-pro-white flex items-center gap-2"><BarChart2 className="w-5 h-5 text-pro-primary"/> Heatmap</h3></div>
                <div className="flex flex-wrap gap-1">{getHeatmap().map((d, i) => (<div key={i} title={d.date} className={`w-3 h-3 rounded-sm ${d.active ? 'bg-pro-primary shadow-sm shadow-indigo-500/50' : 'bg-pro-border/30'}`}></div>))}</div>
              </div>
            </div>
          )}

          {isEventModalOpen && (<div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fadeIn"><div className="bg-pro-card border border-pro-border rounded-2xl p-6 w-full max-w-sm shadow-2xl relative"><button onClick={() => setEventModalOpen(false)} className="absolute top-4 right-4 text-gray-500 hover:text-white"><X className="w-5 h-5"/></button><h3 className="text-xl font-bold text-pro-white mb-4 flex items-center gap-2"><CalendarIcon className="w-5 h-5 text-purple-500" /> Events for {selectedDate}</h3><div className="space-y-3 mb-6 max-h-48 overflow-y-auto custom-scrollbar">{events.filter(e => e.date === selectedDate).length === 0 ? <p className="text-xs text-gray-500 text-center py-2">No events scheduled.</p> : events.filter(e => e.date === selectedDate).map(e => (<div key={e.id} className="flex items-center justify-between p-3 bg-pro-bg rounded-lg border border-pro-border"><div><p className="text-sm text-white font-medium">{e.title}</p><p className="text-xs text-gray-500 flex items-center gap-1"><Clock className="w-3 h-3"/> {e.time}</p></div><button onClick={() => deleteEvent(e.id)} className="text-gray-600 hover:text-red-400"><Trash2 className="w-4 h-4"/></button></div>))}</div><div className="border-t border-pro-border pt-4"><h4 className="text-xs font-semibold text-gray-500 uppercase mb-3">Add New Event</h4><div className="space-y-3"><input type="text" placeholder="Event Title..." value={newEvent.title} onChange={(e) => setNewEvent({...newEvent, title: e.target.value})} className="w-full bg-pro-bg border border-pro-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500" /><div className="flex gap-2"><input type="time" value={newEvent.time} onChange={(e) => setNewEvent({...newEvent, time: e.target.value})} className="flex-1 bg-pro-bg border border-pro-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500" /><button onClick={saveEvent} disabled={!newEvent.title} className="bg-purple-600 hover:bg-purple-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 disabled:opacity-50"><Plus className="w-4 h-4" /> Add</button></div></div></div></div></div>)}
          {isPinPromptOpen && (<div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/90 backdrop-blur-md p-4 animate-fadeIn"><div className="bg-pro-card border border-pro-border rounded-2xl p-8 w-full max-w-sm shadow-2xl flex flex-col items-center"><div className="w-16 h-16 bg-purple-500/10 rounded-full flex items-center justify-center mb-4">{pinMode === 'unlock' ? <Lock className="w-8 h-8 text-purple-500" /> : <Shield className="w-8 h-8 text-blue-500" />}</div><h3 className="text-xl font-bold text-pro-white mb-2">{pinMode === 'unlock' ? 'Security Lock Active' : pinMode === 'verify_remove' ? 'Disable Security' : 'Enter PIN'}</h3><p className="text-sm text-gray-500 mb-6 text-center">{pinMode === 'unlock' ? 'Enter PIN to access.' : pinMode === 'verify_remove' ? 'Enter current PIN to verify.' : 'Enter a 6-digit PIN.'}</p><div className="flex justify-center gap-2 mb-6">{[...Array(6)].map((_, i) => (<div key={i} className={`w-3 h-3 rounded-full transition-all ${pinInput.length > i ? 'bg-purple-500 scale-125' : 'bg-gray-700'}`}></div>))}</div><div className="grid grid-cols-3 gap-3 w-full max-w-[240px]">{[1, 2, 3, 4, 5, 6, 7, 8, 9, 'C', 0, 'Go'].map((key) => (<button key={key} onClick={() => {if (key === 'C') setPinInput(''); else if (key === 'Go') handlePinSubmit(); else if (pinInput.length < 6) setPinInput(prev => prev + key);}} className={`h-12 rounded-xl text-lg font-bold transition-all active:scale-95 flex items-center justify-center ${key === 'Go' ? 'bg-purple-600 text-white' : key === 'C' ? 'bg-red-500/10 text-red-400' : 'bg-pro-bg border border-pro-border text-gray-300 hover:bg-white/5'}`}>{key === 'Go' ? <Unlock className="w-5 h-5"/> : key}</button>))}</div><button onClick={() => { setIsPinPromptOpen(false); if(pinMode === 'verify_remove') setIsSettingsOpen(true); }} className="mt-6 text-xs text-gray-500 hover:text-white">Cancel</button></div></div>)}
          {isSettingsOpen && (<div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fadeIn"><div className="bg-pro-card border border-pro-border rounded-2xl p-6 w-full max-w-md shadow-2xl relative"><button onClick={() => setIsSettingsOpen(false)} className="absolute top-4 right-4 text-gray-500 hover:text-white"><X className="w-5 h-5"/></button><h3 className="text-xl font-bold text-pro-white mb-6 flex items-center gap-2"><SettingsIcon className="w-5 h-5 text-gray-400" /> Settings</h3><div className="space-y-4"><div className="bg-pro-bg rounded-xl border border-pro-border p-4"><div className="flex items-start justify-between mb-2"><div className="flex items-center gap-3"><div className={`p-2 rounded-lg ${securityPin ? 'bg-green-500/10 text-green-500' : 'bg-gray-700/30 text-gray-500'}`}><Shield className="w-5 h-5" /></div><div><h4 className="font-medium text-white">Journal Security</h4><p className="text-xs text-gray-500">{securityPin ? 'Active' : 'Disabled'}</p></div></div></div><div className="grid grid-cols-2 gap-2 mt-4">{securityPin ? (<><button onClick={() => { setPinMode('verify_current'); setPinInput(''); setIsPinPromptOpen(true); setIsSettingsOpen(false); }} className="py-2 px-3 bg-pro-card border border-pro-border rounded-lg text-xs text-white hover:bg-white/5">Change PIN</button><button onClick={initiateRemovePin} className="py-2 px-3 bg-red-500/10 border border-red-500/20 rounded-lg text-xs text-red-400 hover:bg-red-500/20">Remove</button></>) : (<button onClick={() => { setPinMode('setup'); setPinInput(''); setIsPinPromptOpen(true); setIsSettingsOpen(false); }} className="col-span-2 py-2 px-3 bg-blue-600 hover:bg-blue-500 rounded-lg text-xs text-white font-medium flex items-center justify-center gap-2"><KeyRound className="w-3 h-3"/> Setup PIN</button>)}</div></div></div></div></div>)}

        </div>
      </main>
    </div>
  );
}
