import React, { useState, useEffect, useRef } from 'react';
import { 
  PenLine, Calendar as CalIcon, Search, Trash2, Tag, Star, Settings, LogOut, 
  Zap, Cpu, Radio, Activity, Clock, LayoutGrid, Save, Wifi, Battery, RotateCcw, 
  ShieldCheck, Loader2
} from 'lucide-react';
import { db, auth } from './firebase'; 
import { collection, getDocs, setDoc, doc, deleteDoc, query, where } from 'firebase/firestore';
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
  const [accent, setAccent] = useState('cyan'); // 'cyan', 'pink', 'yellow'
  
  // --- WIDGET STATES ---
  const [time, setTime] = useState(new Date());
  const [memo, setMemo] = useState(localStorage.getItem('lumina_memo') || '');
  
  // Habit Tracker State (Resets daily if date changes)
  const [habits, setHabits] = useState(() => {
    const saved = localStorage.getItem('lumina_habits');
    if (saved) {
      const parsed = JSON.parse(saved);
      // Only load if the saved habits are from today
      if (parsed.date === new Date().toISOString().split('T')[0]) {
        return parsed.items;
      }
    }
    // Default Daily Protocols
    return [
      { id: 1, label: 'HYDRATION', completed: false },
      { id: 2, label: 'READING_DATA', completed: false },
      { id: 3, label: 'EXERCISE', completed: false }
    ];
  });

  // Moods Configuration
  const moods = [
    { id: 'happy', icon: Zap, label: 'Super', color: 'text-cyber-yellow' },
    { id: 'good', icon: Activity, label: 'Active', color: 'text-cyber-cyan' },
    { id: 'neutral', icon: Radio, label: 'Stable', color: 'text-white' },
    { id: 'sad', icon: Cpu, label: 'Low Bat', color: 'text-cyber-purple' },
  ];

  // --- INITIALIZATION & EFFECTS ---
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoadingAuth(false);
      if (currentUser) loadEntries(currentUser.uid);
    });

    const timer = setInterval(() => setTime(new Date()), 1000);

    return () => {
      unsubscribe();
      clearInterval(timer);
    };
  }, []);

  // Auto-save Memo
  useEffect(() => {
    localStorage.setItem('lumina_memo', memo);
  }, [memo]);

  // Auto-save Habits
  useEffect(() => {
    localStorage.setItem('lumina_habits', JSON.stringify({
      date: new Date().toISOString().split('T')[0],
      items: habits
    }));
  }, [habits]);

  // --- DATABASE FUNCTIONS ---
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
      setView('entries');
    } catch (e) {
      alert("ERROR SAVING DATA. CHECK CONSOLE.");
    }
  };

  const deleteEntry = async (id) => {
    if(confirm("CONFIRM DELETION PROTOCOL?")) {
      await deleteDoc(doc(db, "entries", id));
      loadEntries(user.uid);
    }
  };

  // --- HELPER FUNCTIONS ---
  const editEntry = (entry) => { setCurrentEntry(entry); setEditingId(entry.id); setView('write'); };

  const toggleHabit = (id) => {
    setHabits(habits.map(h => h.id === id ? { ...h, completed: !h.completed } : h));
  };

  const getStats = () => ({
    total: entries.length,
    words: entries.reduce((s, e) => s + (e.wordCount || 0), 0),
    favs: entries.filter(e => e.favorite).length
  });

  const getLevel = () => {
    const words = entries.reduce((s, e) => s + (e.wordCount || 0), 0);
    const level = Math.floor(words / 500) + 1; // Level up every 500 words
    const progress = (words % 500) / 500 * 100;
    return { level, progress };
  };

  const getDaysInMonth = () => {
    const date = new Date();
    const days = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
    return Array.from({ length: days }, (_, i) => i + 1);
  };

  const hasEntryOnDay = (day) => {
    const currentMonth = new Date().toISOString().slice(0, 7);
    const checkDate = `${currentMonth}-${day.toString().padStart(2, '0')}`;
    return entries.some(e => e.date === checkDate);
  };

  // --- RENDER ---
  if (loadingAuth) return <div className="min-h-screen bg-cyber-dark text-cyber-cyan font-display flex items-center justify-center text-xl tracking-widest animate-pulse">INITIALIZING SYSTEM...</div>;
  
  if (!user || !user.emailVerified) return <Login />;

  // Dynamic Theme Constants
  const accentColor = accent === 'pink' ? 'text-cyber-pink border-cyber-pink shadow-neon-pink' : 
                      accent === 'yellow' ? 'text-cyber-yellow border-cyber-yellow shadow-none' : 
                      'text-cyber-cyan border-cyber-cyan shadow-neon-cyan';
  const accentBg = accent === 'pink' ? 'bg-cyber-pink' : accent === 'yellow' ? 'bg-cyber-yellow' : 'bg-cyber-cyan';
  const accentText = accent === 'pink' ? 'text-cyber-pink' : accent === 'yellow' ? 'text-cyber-yellow' : 'text-cyber-cyan';

  return (
    <div className="min-h-screen bg-cyber-dark bg-grid-pattern text-gray-300 font-body selection:bg-cyber-pink selection:text-white overflow-x-hidden pb-20">
      
      {/* Top HUD Bar */}
      <div className="border-b border-white/10 bg-cyber-dark/90 backdrop-blur-md sticky top-0 z-50 shadow-2xl">
        <div className="max-w-7xl mx-auto px-4 h-16 flex justify-between items-center">
          <div className="flex items-center gap-3 group cursor-pointer" onClick={() => setView('dashboard')}>
            <div className={`p-1.5 border ${accentColor} transition-transform group-hover:rotate-45`}>
              <Cpu className={`w-5 h-5 ${accentText}`} />
            </div>
            <h1 className="text-xl md:text-2xl font-display font-bold tracking-widest text-white uppercase group-hover:text-cyber-cyan transition-colors">
              Lumina <span className={`text-[10px] align-top ${accentText}`}>OS</span>
            </h1>
          </div>
          
          <div className="flex gap-6 items-center">
            {/* Gamification Level Display */}
            <div className="hidden lg:flex flex-col items-end mr-4">
              <span className="text-[10px] font-mono text-gray-500">USER_LEVEL_0{getLevel().level}</span>
              <div className="w-24 h-1 bg-gray-800 mt-1">
                <div className={`h-full ${accentBg} transition-all duration-1000`} style={{ width: `${getLevel().progress}%` }}></div>
              </div>
            </div>

            <div className="hidden md:flex gap-4 text-[10px] font-mono text-gray-500">
              <span className="flex items-center gap-1"><Wifi className="w-3 h-3 text-green-500" /> ONLINE</span>
              <span className="flex items-center gap-1"><Battery className="w-3 h-3 text-cyber-cyan" /> 100%</span>
            </div>
            <button onClick={() => signOut(auth)} className="hover:text-red-500 transition-colors" title="TERMINATE SESSION">
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        
        {/* Navigation Tabs */}
        <div className="grid grid-cols-4 gap-2 md:gap-4 mb-8">
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
                relative h-12 flex flex-col md:flex-row items-center justify-center gap-2 uppercase font-display font-bold tracking-wider transition-all clip-path-slant border-b-2
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

        {/* ================= DASHBOARD VIEW ================= */}
        {view === 'dashboard' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-fadeIn">
            
            {/* WIDGET 1: CHRONOMETER */}
            <div className="md:col-span-2 border border-white/10 bg-cyber-slate/30 p-6 relative overflow-hidden group">
              <div className={`absolute top-0 left-0 w-20 h-20 bg-gradient-to-br from-${accent}-500/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity`}></div>
              <h3 className="text-xs font-mono text-gray-500 mb-2 flex items-center gap-2">
                <Clock className="w-3 h-3" /> // LOCAL_TIME
              </h3>
              <div className="flex flex-col md:flex-row md:items-end gap-4">
                <div className={`text-6xl md:text-7xl font-display font-bold text-white tracking-tighter ${accentText} drop-shadow-[0_0_10px_rgba(255,255,255,0.1)]`}>
                  {time.toLocaleTimeString('en-US', { hour12: false })}
                </div>
                <div className="text-xl font-mono text-gray-400 mb-2 uppercase">
                  {time.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                </div>
              </div>
            </div>

            {/* WIDGET 2: SYSTEM STATUS */}
            <div className="border border-white/10 bg-cyber-slate/30 p-6 flex flex-col justify-between">
              <h3 className="text-xs font-mono text-gray-500 mb-4 flex items-center gap-2">
                <Activity className="w-3 h-3" /> // SYSTEM_STATUS
              </h3>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-xs mb-1 font-mono"><span>MEMORY</span><span>42%</span></div>
                  <div className="h-1 bg-gray-800 w-full"><div className="h-full bg-cyber-cyan w-[42%] animate-pulse"></div></div>
                </div>
                <div>
                  <div className="flex justify-between text-xs mb-1 font-mono"><span>STORAGE</span><span>{entries.length} LOGS</span></div>
                  <div className="h-1 bg-gray-800 w-full"><div className={`h-full ${accentBg} w-[65%]`}></div></div>
                </div>
                <div>
                  <div className="flex justify-between text-xs mb-1 font-mono"><span>MOOD STABILITY</span><span>98%</span></div>
                  <div className="h-1 bg-gray-800 w-full"><div className="h-full bg-cyber-pink w-[98%]"></div></div>
                </div>
              </div>
            </div>

            {/* WIDGET 3: HOLO CALENDAR */}
            <div className="border border-white/10 bg-cyber-slate/30 p-6">
               <h3 className="text-xs font-mono text-gray-500 mb-4 flex items-center gap-2">
                <CalIcon className="w-3 h-3" /> // MONTH_VISUALIZER
              </h3>
              <div className="grid grid-cols-7 gap-2 text-center">
                {['S','M','T','W','T','F','S'].map(d => <span key={d} className="text-xs text-gray-600 font-bold">{d}</span>)}
                {getDaysInMonth().map(day => {
                  const hasData = hasEntryOnDay(day);
                  const isToday = day === new Date().getDate();
                  return (
                    <div 
                      key={day} 
                      className={`
                        aspect-square flex items-center justify-center text-sm font-mono border transition-all
                        ${isToday ? `${accentBg} text-cyber-dark font-bold` : 'border-white/5 text-gray-400'}
                        ${hasData ? `border-${accent}-500 shadow-[0_0_10px_rgba(0,240,255,0.2)]` : ''}
                      `}
                    >
                      {day}
                    </div>
                  )
                })}
              </div>
            </div>

            {/* WIDGET 4: NET-MEMO */}
            <div className="border border-white/10 bg-cyber-slate/30 p-6 relative">
              <h3 className="text-xs font-mono text-gray-500 mb-2 flex items-center gap-2">
                <Save className="w-3 h-3" /> // PERSONAL_MEMORANDA
              </h3>
              <textarea
                value={memo}
                onChange={(e) => setMemo(e.target.value)}
                placeholder="TYPE QUICK NOTES HERE..."
                className="w-full h-32 bg-transparent text-cyber-cyan font-mono text-sm focus:outline-none resize-none placeholder-gray-700"
              />
              <div className="absolute bottom-4 right-4 text-[10px] text-gray-600 uppercase">
                Auto-saved
              </div>
            </div>

            {/* WIDGET 5: DAILY PROTOCOLS (HABITS) */}
            <div className="border border-white/10 bg-cyber-slate/30 p-6 flex flex-col relative overflow-hidden">
              <h3 className="text-xs font-mono text-gray-500 mb-4 flex items-center gap-2">
                <ShieldCheck className="w-3 h-3" /> // DAILY_PROTOCOLS
              </h3>
              
              <div className="flex flex-col gap-3 relative z-10">
                {habits.map(habit => (
                  <div 
                    key={habit.id}
                    onClick={() => toggleHabit(habit.id)}
                    className={`
                      group flex items-center justify-between p-3 border cursor-pointer transition-all duration-300
                      ${habit.completed 
                        ? `border-${accent}-500 bg-${accent}-500/10` 
                        : 'border-white/10 hover:border-white/30 bg-black/20'}
                    `}
                  >
                    <span className={`font-mono text-xs uppercase tracking-wider transition-colors ${habit.completed ? 'text-white' : 'text-gray-500 group-hover:text-gray-300'}`}>
                      {habit.label}
                    </span>
                    <div className={`
                      w-4 h-4 border transition-all duration-300 flex items-center justify-center
                      ${habit.completed ? `bg-${accent}-500 border-${accent}-500 rotate-0` : 'border-gray-600 rotate-45'}
                    `}>
                      {habit.completed && <div className="w-2 h-2 bg-cyber-dark" />}
                    </div>
                  </div>
                ))}
              </div>
              <div className="absolute bottom-0 left-0 h-1 bg-gray-800 w-full">
                <div 
                  className={`h-full ${accentBg} transition-all duration-1000`} 
                  style={{ width: `${(habits.filter(h => h.completed).length / habits.length) * 100}%` }}
                ></div>
              </div>
            </div>

            {/* WIDGET 6: QUICK ACTIONS */}
            <div className="md:col-span-3 border border-white/10 bg-cyber-slate/30 p-4 flex justify-between items-center">
              <span className="text-xs font-mono text-gray-500 uppercase">// SYSTEM_CONTROLS</span>
              <div className="flex gap-4">
                 <button onClick={() => setView('write')} className={`py-2 px-6 border border-white/20 hover:border-${accent}-500 hover:text-${accent}-500 transition-all uppercase font-display text-xs flex items-center gap-2`}>
                  <PenLine className="w-4 h-4" /> New Log
                </button>
                <button onClick={() => {
                  const colors = ['cyan', 'pink', 'yellow'];
                  const next = colors[(colors.indexOf(accent) + 1) % colors.length];
                  setAccent(next);
                }} className="py-2 px-6 border border-white/20 hover:bg-white/5 transition-all uppercase font-display text-xs flex items-center gap-2">
                  <RotateCcw className="w-4 h-4" /> Color Cycle
                </button>
              </div>
            </div>

          </div>
        )}

        {/* ================= WRITE VIEW ================= */}
        {view === 'write' && (
          <div className="border border-white/10 bg-cyber-slate/50 p-6 md:p-8 animate-fadeIn relative">
             <div className={`absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 ${accentColor.split(' ')[0]}`}></div>
             <div className={`absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 ${accentColor.split(' ')[0]}`}></div>
            
            <div className="flex flex-col gap-6">
              <div className="flex flex-wrap justify-between items-end gap-4 border-b border-white/10 pb-6">
                <input type="text" value={currentEntry.title} onChange={(e) => setCurrentEntry({...currentEntry, title: e.target.value})} placeholder="ENTRY_TITLE_Required" className="bg-transparent text-3xl md:text-4xl font-display font-bold text-white placeholder-gray-700 focus:outline-none w-full md:w-auto flex-1 uppercase" />
                <div className="flex gap-2">
                   {moods.map(m => ( <button key={m.id} onClick={() => setCurrentEntry({...currentEntry, mood: m.id})} className={`p-2 border transition-all ${currentEntry.mood === m.id ? `${m.color} border-current shadow-[0_0_10px_currentColor]` : 'border-gray-700 text-gray-600 hover:text-gray-400'}`}><m.icon className="w-5 h-5" /></button> ))}
                </div>
              </div>
              <textarea value={currentEntry.content} onChange={(e) => setCurrentEntry({...currentEntry, content: e.target.value})} placeholder="INITIATE LOG SEQUENCE..." className="w-full h-80 bg-black/20 text-lg leading-relaxed p-4 focus:outline-none border-l-2 border-transparent focus:border-l-cyber-cyan transition-all text-gray-200 resize-none font-mono" />
              <div className="flex justify-between items-center pt-4 border-t border-white/10">
                <div className="flex gap-2 text-xs font-mono text-gray-500">
                  {currentEntry.content.split(/\s+/).length} WORDS // {new Date().toLocaleDateString()}
                </div>
                <button onClick={saveEntry} disabled={!currentEntry.title} className={`px-8 py-3 font-display font-bold tracking-widest uppercase transition-all ${!currentEntry.title ? 'bg-gray-800 text-gray-600 cursor-not-allowed' : `${accentBg} text-cyber-dark hover:shadow-[0_0_20px_rgba(0,240,255,0.4)]`}`}>{editingId ? 'OVERWRITE' : 'SAVE_DATA'}</button>
              </div>
            </div>
          </div>
        )}

        {/* ================= ENTRIES VIEW ================= */}
        {view === 'entries' && (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 animate-fadeIn">
             {entries.map(entry => (
              <div key={entry.id} onClick={() => editEntry(entry)} className="group relative bg-cyber-slate border border-gray-800 hover:border-cyber-cyan/50 transition-all p-5 cursor-pointer overflow-hidden">
                <div className="flex justify-between items-start mb-4 relative z-10"><span className="font-mono text-xs text-cyber-cyan">{entry.date}</span>{entry.favorite && <Star className="w-4 h-4 text-cyber-yellow fill-cyber-yellow" />}</div>
                <h3 className="font-display font-bold text-xl text-white mb-2 uppercase truncate relative z-10 group-hover:text-cyber-cyan transition-colors">{entry.title}</h3>
                <p className="text-gray-400 text-sm line-clamp-3 mb-4 font-mono relative z-10">{entry.content}</p>
                <div className="flex justify-between items-center relative z-10">
                  <div className="flex gap-1">{entry.tags?.slice(0, 3).map(t => <span key={t} className="text-[10px] uppercase border border-gray-700 px-1 text-gray-500">#{t}</span>)}</div>
                  <button onClick={(e) => {e.stopPropagation(); deleteEntry(entry.id)}} className="opacity-0 group-hover:opacity-100 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
                </div>
                <div className="absolute bottom-0 left-0 h-1 w-0 bg-cyber-cyan group-hover:w-full transition-all duration-300"></div>
              </div>
            ))}
          </div>
        )}

        {/* ================= STATS VIEW ================= */}
        {view === 'stats' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-fadeIn">
             <div className="border border-white/10 bg-cyber-slate p-6 flex flex-col items-center justify-center gap-2"><span className={`text-4xl font-display font-bold ${accentText}`}>{getStats().total}</span><span className="text-xs font-mono text-gray-500 tracking-widest uppercase">Total Logs</span></div>
             <div className="border border-white/10 bg-cyber-slate p-6 flex flex-col items-center justify-center gap-2"><span className={`text-4xl font-display font-bold text-white`}>{getStats().words}</span><span className="text-xs font-mono text-gray-500 tracking-widest uppercase">Word Count</span></div>
             <div className="border border-white/10 bg-cyber-slate p-6 flex flex-col items-center justify-center gap-2"><span className="text-4xl font-display font-bold text-cyber-yellow">{getStats().favs}</span><span className="text-xs font-mono text-gray-500 tracking-widest uppercase">Starred</span></div>
             
             {/* Large Level Badge */}
             <div className="md:col-span-3 border border-white/10 bg-cyber-slate/50 p-8 flex flex-col items-center justify-center gap-4">
                <div className="w-32 h-32 rounded-full border-4 border-white/10 flex items-center justify-center relative">
                  <span className={`text-6xl font-display font-bold ${accentText}`}>{getLevel().level}</span>
                  <div className={`absolute inset-0 rounded-full border-4 ${accentColor.split(' ')[0]} border-t-transparent animate-spin`} style={{animationDuration: '3s'}}></div>
                </div>
                <h2 className="text-xl font-display uppercase tracking-widest text-white">Security Clearance Level {getLevel().level}</h2>
                <div className="w-full max-w-md h-2 bg-gray-800 rounded-full overflow-hidden">
                   <div className={`h-full ${accentBg}`} style={{ width: `${getLevel().progress}%` }}></div>
                </div>
                <span className="text-xs font-mono text-gray-500">{Math.floor(getLevel().progress)}% TO NEXT LEVEL</span>
             </div>
          </div>
        )}

      </div>
    </div>
  );
}