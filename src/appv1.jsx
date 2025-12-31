import React, { useState, useEffect, useRef } from 'react';
import { PenLine, Calendar, Search, Trash2, BookOpen, Tag, Smile, Image, Star, TrendingUp, Settings, Palette, Moon, Sun, Filter, Grid, List, BarChart3, Heart, Meh, Frown, Angry, Laugh, LogOut } from 'lucide-react';
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
  const [searchTerm, setSearchTerm] = useState('');
  const [view, setView] = useState('write');
  const [showSettings, setShowSettings] = useState(false);
  const [filterTag, setFilterTag] = useState(null);
  const [filterMood, setFilterMood] = useState(null);
  const [sortBy, setSortBy] = useState('date-desc');
  const [layoutView, setLayoutView] = useState('grid');
  const [newTag, setNewTag] = useState('');
  
  // Settings
  const [theme, setTheme] = useState('purple');
  const [darkMode, setDarkMode] = useState(true);
  const [font, setFont] = useState('default');
  
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);

  const moods = [
    { id: 'happy', icon: Laugh, label: 'Happy', color: 'text-yellow-400' },
    { id: 'good', icon: Smile, label: 'Good', color: 'text-green-400' },
    { id: 'neutral', icon: Meh, label: 'Neutral', color: 'text-blue-400' },
    { id: 'sad', icon: Frown, label: 'Sad', color: 'text-indigo-400' },
    { id: 'angry', icon: Angry, label: 'Angry', color: 'text-red-400' }
  ];

  const themes = {
    purple: 'from-slate-900 via-purple-900 to-slate-900',
    ocean: 'from-slate-900 via-blue-900 to-slate-900',
    forest: 'from-slate-900 via-green-900 to-slate-900',
    sunset: 'from-slate-900 via-orange-900 to-slate-900',
    rose: 'from-slate-900 via-rose-900 to-slate-900'
  };

  const fonts = {
    default: 'font-sans',
    serif: 'font-serif',
    mono: 'font-mono'
  };

  // --- AUTH LISTENER ---
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoadingAuth(false);
      if (currentUser) {
        loadEntries(currentUser.uid);
        loadSettings();
      } else {
        setEntries([]); // Clear sensitive data on logout
      }
    });
    return () => unsubscribe();
  }, []);

  // --- DATA FUNCTIONS ---
  
  const loadSettings = () => {
    try {
      const saved = localStorage.getItem('journal:settings');
      if (saved) {
        const settings = JSON.parse(saved);
        setTheme(settings.theme || 'purple');
        setDarkMode(settings.darkMode !== false);
        setFont(settings.font || 'default');
      }
    } catch (error) {
      console.log('No saved settings');
    }
  };

  const saveSettings = (newSettings) => {
    try {
      localStorage.setItem('journal:settings', JSON.stringify(newSettings));
    } catch (error) {
      console.error('Failed to save settings:', error);
    }
  };

  const loadEntries = async (uid) => {
    if (!uid) return;
    try {
      // SECURE QUERY: Only get entries where userId == uid
      const q = query(collection(db, "entries"), where("userId", "==", uid));
      const querySnapshot = await getDocs(q);
      const loadedEntries = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setEntries(loadedEntries.sort((a, b) => new Date(b.date) - new Date(a.date)));
    } catch (error) {
      console.error("Error loading entries: ", error);
    }
  };

  const saveEntry = async () => {
    if (!currentEntry.title.trim() || !currentEntry.content.trim() || !user) return;

    const entryId = editingId || Date.now().toString();
    const entry = {
      ...currentEntry,
      id: entryId,
      userId: user.uid, // IMPORTANT: Link entry to user
      timestamp: new Date().toISOString(),
      wordCount: currentEntry.content.trim().split(/\s+/).length
    };

    try {
      await setDoc(doc(db, "entries", entryId), entry);
      await loadEntries(user.uid);
      
      setCurrentEntry({ 
        title: '', content: '', date: new Date().toISOString().split('T')[0],
        mood: null, tags: [], favorite: false, images: []
      });
      setEditingId(null);
      setView('entries');
    } catch (error) {
      console.error("Failed to save entry:", error);
      alert("Error saving. Check console.");
    }
  };

  const deleteEntry = async (id) => {
    try {
      await deleteDoc(doc(db, "entries", id));
      if (user) await loadEntries(user.uid);
    } catch (error) {
      console.error("Failed to delete entry:", error);
    }
  };

  const toggleFavorite = async (id) => {
    const entry = entries.find(e => e.id === id);
    if (entry) {
      const updated = { ...entry, favorite: !entry.favorite };
      try {
        await setDoc(doc(db, "entries", id), updated, { merge: true });
        if (user) await loadEntries(user.uid);
      } catch (error) {
        console.error("Failed to update favorite:", error);
      }
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Error logging out:", error);
    }
  };

  // --- UI LOGIC (Unchanged helpers) ---
  const editEntry = (entry) => {
    setCurrentEntry({ 
      title: entry.title, content: entry.content, date: entry.date,
      mood: entry.mood, tags: entry.tags || [], favorite: entry.favorite || false, images: entry.images || []
    });
    setEditingId(entry.id);
    setView('write');
  };

  const addTag = () => {
    if (newTag.trim() && !currentEntry.tags.includes(newTag.trim())) {
      setCurrentEntry({ ...currentEntry, tags: [...currentEntry.tags, newTag.trim()] });
      setNewTag('');
    }
  };
  const removeTag = (t) => setCurrentEntry({ ...currentEntry, tags: currentEntry.tags.filter(tag => tag !== t) });
  
  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => setCurrentEntry({ ...currentEntry, images: [...currentEntry.images, event.target.result] });
      reader.readAsDataURL(file);
    }
  };
  const removeImage = (index) => setCurrentEntry({ ...currentEntry, images: currentEntry.images.filter((_, i) => i !== index) });

  const applyFormatting = (format) => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = currentEntry.content.substring(start, end);
    let formattedText = selectedText;
    switch (format) {
      case 'bold': formattedText = `**${selectedText}**`; break;
      case 'italic': formattedText = `*${selectedText}*`; break;
      case 'header': formattedText = `# ${selectedText}`; break;
      case 'bullet': formattedText = `\n- ${selectedText}`; break;
    }
    const newContent = currentEntry.content.substring(0, start) + formattedText + currentEntry.content.substring(end);
    setCurrentEntry({ ...currentEntry, content: newContent });
  };

  const renderFormattedContent = (content) => {
    return content
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/^# (.*$)/gm, '<h2 class="text-2xl font-bold mt-4 mb-2">$1</h2>')
      .replace(/^- (.*$)/gm, '<li class="ml-4">• $1</li>');
  };

  // --- FILTERING ---
  const getAllTags = () => {
    const tagSet = new Set();
    entries.forEach(e => e.tags && e.tags.forEach(t => tagSet.add(t)));
    return Array.from(tagSet);
  };

  const getFilteredAndSortedEntries = () => {
    let filtered = entries.filter(entry => {
      const matchesSearch = entry.title.toLowerCase().includes(searchTerm.toLowerCase()) || entry.content.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesTag = !filterTag || (entry.tags && entry.tags.includes(filterTag));
      const matchesMood = !filterMood || entry.mood === filterMood;
      return matchesSearch && matchesTag && matchesMood;
    });
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'date-desc': return new Date(b.date) - new Date(a.date);
        case 'date-asc': return new Date(a.date) - new Date(b.date);
        case 'title': return a.title.localeCompare(b.title);
        case 'favorite': return (b.favorite ? 1 : 0) - (a.favorite ? 1 : 0);
        default: return 0;
      }
    });
    return filtered;
  };

  const getStats = () => {
    const totalEntries = entries.length;
    const totalWords = entries.reduce((sum, entry) => sum + (entry.wordCount || 0), 0);
    const moodCounts = {};
    moods.forEach(m => moodCounts[m.id] = 0);
    entries.forEach(entry => { if (entry.mood) moodCounts[entry.mood]++; });
    const favorites = entries.filter(e => e.favorite).length;
    return { totalEntries, totalWords, moodCounts, favorites };
  };

  const formatDate = (dateString) => new Date(dateString).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  const filteredEntries = getFilteredAndSortedEntries();
  const stats = getStats();
  const allTags = getAllTags();

  // --- RENDER ---
  if (loadingAuth) return <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white">Loading...</div>;
  if (!user) return <Login />;
  if (!user.emailVerified) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white bg-opacity-10 backdrop-blur-md rounded-2xl p-8 border border-white border-opacity-20 text-center">
          <h2 className="text-2xl text-white mb-4">Verify your Email</h2>
          <p className="text-purple-200 mb-6">
            We sent a verification link to <strong>{user.email}</strong>.<br/>
            Please check your inbox (and spam folder) and click the link to activate your account.
          </p>
          
          <div className="flex flex-col gap-3">
            <button 
              onClick={() => window.location.reload()} 
              className="py-3 bg-purple-600 text-white rounded-xl hover:bg-purple-700 transition-all"
            >
              I have verified it! (Refresh)
            </button>
            <button 
              onClick={handleLogout} 
              className="py-3 bg-white bg-opacity-10 text-purple-200 rounded-xl hover:bg-opacity-20 transition-all"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen bg-gradient-to-br ${themes[theme]} ${fonts[font]} transition-all duration-500`}>
      {/* Animated background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-500 rounded-full mix-blend-multiply filter blur-3xl opacity-10 animate-pulse"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-pink-500 rounded-full mix-blend-multiply filter blur-3xl opacity-10 animate-pulse" style={{ animationDelay: '2s' }}></div>
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div className="flex items-center gap-3">
            <BookOpen className="w-8 h-8 text-purple-300" strokeWidth={1.5} />
            <h1 className="text-4xl font-light text-white tracking-wider">Lumina</h1>
          </div>
          <div className="flex gap-2">
             <button onClick={() => setShowSettings(!showSettings)} className="p-3 rounded-full bg-white bg-opacity-10 text-purple-200 hover:bg-opacity-20 transition-all">
              <Settings className="w-5 h-5" />
            </button>
            <button onClick={handleLogout} className="p-3 rounded-full bg-white bg-opacity-10 text-red-200 hover:bg-red-500 hover:bg-opacity-20 transition-all" title="Sign Out">
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* ... (Settings Panel and Navigation - Keep logic same as before) ... */}
        {showSettings && (
          <div className="mb-8 bg-white bg-opacity-10 backdrop-blur-md rounded-2xl p-6 border border-white border-opacity-20">
            <h3 className="text-xl text-white mb-4 flex items-center gap-2">
              <Palette className="w-5 h-5" />
              Personalization
            </h3>
            <div className="grid md:grid-cols-3 gap-6">
              <div>
                <label className="text-purple-200 text-sm mb-2 block">Theme</label>
                <div className="flex gap-2">
                  {Object.keys(themes).map(t => (
                    <button key={t} onClick={() => { setTheme(t); saveSettings({ theme: t, darkMode, font }); }}
                      className={`w-10 h-10 rounded-full border-2 transition-all ${theme === t ? 'border-white scale-110' : 'border-transparent'}`}
                      style={{ background: t === 'purple' ? '#6b21a8' : t === 'ocean' ? '#1e3a8a' : t === 'forest' ? '#14532d' : t === 'sunset' ? '#9a3412' : '#881337' }}
                    />
                  ))}
                </div>
              </div>
              <div>
                <label className="text-purple-200 text-sm mb-2 block">Font</label>
                <select value={font} onChange={(e) => { setFont(e.target.value); saveSettings({ theme, darkMode, font: e.target.value }); }}
                  className="w-full bg-white bg-opacity-10 text-white px-4 py-2 rounded-lg border border-white border-opacity-20">
                  <option value="default">Default</option>
                  <option value="serif">Serif</option>
                  <option value="mono">Monospace</option>
                </select>
              </div>
              <div>
                <label className="text-purple-200 text-sm mb-2 block">Mode</label>
                <button onClick={() => { setDarkMode(!darkMode); saveSettings({ theme, darkMode: !darkMode, font }); }}
                  className="flex items-center gap-2 px-4 py-2 bg-white bg-opacity-10 rounded-lg hover:bg-opacity-20 transition-all">
                  {darkMode ? <Moon className="w-4 h-4 text-purple-300" /> : <Sun className="w-4 h-4 text-yellow-300" />}
                  <span className="text-white text-sm">{darkMode ? 'Dark' : 'Light'}</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className="flex flex-wrap justify-center gap-3 mb-8">
          <button onClick={() => setView('write')} className={`flex items-center gap-2 px-5 py-2.5 rounded-full transition-all ${view === 'write' ? 'bg-white bg-opacity-20 text-white shadow-lg' : 'bg-white bg-opacity-5 text-purple-200 hover:bg-opacity-10'}`}>
            <PenLine className="w-4 h-4" /> Write
          </button>
          <button onClick={() => setView('entries')} className={`flex items-center gap-2 px-5 py-2.5 rounded-full transition-all ${view === 'entries' ? 'bg-white bg-opacity-20 text-white shadow-lg' : 'bg-white bg-opacity-5 text-purple-200 hover:bg-opacity-10'}`}>
            <Calendar className="w-4 h-4" /> Entries ({entries.length})
          </button>
          <button onClick={() => setView('stats')} className={`flex items-center gap-2 px-5 py-2.5 rounded-full transition-all ${view === 'stats' ? 'bg-white bg-opacity-20 text-white shadow-lg' : 'bg-white bg-opacity-5 text-purple-200 hover:bg-opacity-10'}`}>
            <BarChart3 className="w-4 h-4" /> Stats
          </button>
        </div>

        {/* Write View */}
        {view === 'write' && (
          <div className="max-w-4xl mx-auto">
            <div className="bg-white bg-opacity-10 backdrop-blur-md rounded-3xl p-8 shadow-2xl border border-white border-opacity-20">
              <div className="flex flex-wrap gap-4 mb-6">
                <input type="date" value={currentEntry.date} onChange={(e) => setCurrentEntry({ ...currentEntry, date: e.target.value })} className="bg-white bg-opacity-10 text-purple-100 px-4 py-2 rounded-xl border border-white border-opacity-20 focus:outline-none focus:border-purple-300" />
                <div className="flex items-center gap-2">
                  <span className="text-purple-200 text-sm">Mood:</span>
                  {moods.map(mood => (
                    <button key={mood.id} onClick={() => setCurrentEntry({ ...currentEntry, mood: mood.id })} className={`p-2 rounded-lg transition-all ${currentEntry.mood === mood.id ? 'bg-white bg-opacity-20 scale-110' : 'bg-white bg-opacity-5 hover:bg-opacity-10'}`} title={mood.label}>
                      <mood.icon className={`w-5 h-5 ${mood.color}`} />
                    </button>
                  ))}
                </div>
              </div>
              <input type="text" placeholder="Entry title..." value={currentEntry.title} onChange={(e) => setCurrentEntry({ ...currentEntry, title: e.target.value })} className="w-full bg-transparent text-3xl font-light text-white placeholder-purple-300 placeholder-opacity-40 mb-4 focus:outline-none" />
              <div className="flex flex-wrap gap-2 mb-4 pb-4 border-b border-white border-opacity-10">
                <button onClick={() => applyFormatting('bold')} className="px-3 py-1.5 bg-white bg-opacity-10 text-white rounded hover:bg-opacity-20 text-sm font-bold">B</button>
                <button onClick={() => applyFormatting('italic')} className="px-3 py-1.5 bg-white bg-opacity-10 text-white rounded hover:bg-opacity-20 text-sm italic">I</button>
                <button onClick={() => applyFormatting('header')} className="px-3 py-1.5 bg-white bg-opacity-10 text-white rounded hover:bg-opacity-20 text-sm">H</button>
                <button onClick={() => applyFormatting('bullet')} className="px-3 py-1.5 bg-white bg-opacity-10 text-white rounded hover:bg-opacity-20 text-sm">• List</button>
                <button onClick={() => fileInputRef.current?.click()} className="px-3 py-1.5 bg-white bg-opacity-10 text-white rounded hover:bg-opacity-20 text-sm flex items-center gap-1"><Image className="w-4 h-4" /> Image</button>
                <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
              </div>
              {currentEntry.images.length > 0 && (
                <div className="flex gap-2 mb-4 flex-wrap">
                  {currentEntry.images.map((img, i) => (
                    <div key={i} className="relative group">
                      <img src={img} alt="" className="w-24 h-24 object-cover rounded-lg" />
                      <button onClick={() => removeImage(i)} className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 className="w-3 h-3" /></button>
                    </div>
                  ))}
                </div>
              )}
              <textarea ref={textareaRef} placeholder="What's on your mind today?" value={currentEntry.content} onChange={(e) => setCurrentEntry({ ...currentEntry, content: e.target.value })} className="w-full h-64 bg-transparent text-white text-lg leading-relaxed placeholder-purple-300 placeholder-opacity-40 focus:outline-none resize-none" />
              <div className="text-purple-300 text-sm mb-4">{currentEntry.content.trim() ? currentEntry.content.trim().split(/\s+/).length : 0} words</div>
              <div className="mb-6">
                <div className="flex gap-2 mb-2 flex-wrap">
                  {currentEntry.tags.map(tag => (
                    <span key={tag} className="inline-flex items-center gap-1 px-3 py-1 bg-purple-500 bg-opacity-30 text-purple-200 rounded-full text-sm">{tag} <button onClick={() => removeTag(tag)} className="hover:text-white">×</button></span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input type="text" placeholder="Add tag..." value={newTag} onChange={(e) => setNewTag(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && addTag()} className="flex-1 bg-white bg-opacity-10 text-white px-4 py-2 rounded-xl border border-white border-opacity-20 focus:outline-none placeholder-purple-300" />
                  <button onClick={addTag} className="px-4 py-2 bg-purple-500 bg-opacity-30 text-purple-200 rounded-xl hover:bg-opacity-40"><Tag className="w-4 h-4" /></button>
                </div>
              </div>
              <div className="flex justify-end gap-3">
                {editingId && (
                  <button onClick={() => { setCurrentEntry({ title: '', content: '', date: new Date().toISOString().split('T')[0], mood: null, tags: [], favorite: false, images: [] }); setEditingId(null); }} className="px-6 py-3 rounded-full bg-white bg-opacity-10 text-purple-200 hover:bg-opacity-20">Cancel</button>
                )}
                <button onClick={saveEntry} className="px-8 py-3 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 text-white font-medium hover:shadow-lg hover:scale-105 transition-all disabled:opacity-50" disabled={!currentEntry.title.trim() || !currentEntry.content.trim()}>{editingId ? 'Update' : 'Save Entry'}</button>
              </div>
            </div>
          </div>
        )}

        {/* Entries View */}
        {view === 'entries' && (
          <div className="max-w-6xl mx-auto">
            <div className="mb-6 space-y-4">
              <div className="flex flex-wrap gap-3">
                <div className="flex-1 min-w-[200px] relative">
                  <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-purple-300 w-5 h-5" />
                  <input type="text" placeholder="Search entries..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full bg-white bg-opacity-10 backdrop-blur-sm text-white placeholder-purple-300 pl-12 pr-4 py-3 rounded-full border border-white border-opacity-20 focus:outline-none" />
                </div>
                <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="bg-white bg-opacity-10 text-white px-4 py-3 rounded-full border border-white border-opacity-20">
                  <option value="date-desc">Newest First</option>
                  <option value="date-asc">Oldest First</option>
                  <option value="title">Title A-Z</option>
                  <option value="favorite">Favorites</option>
                </select>
                <div className="flex gap-2">
                  <button onClick={() => setLayoutView(layoutView === 'grid' ? 'list' : 'grid')} className="p-3 bg-white bg-opacity-10 text-purple-200 rounded-full hover:bg-opacity-20">{layoutView === 'grid' ? <List className="w-5 h-5" /> : <Grid className="w-5 h-5" />}</button>
                </div>
              </div>
              {allTags.length > 0 && (
                <div className="flex gap-2 flex-wrap">
                  <span className="text-purple-300 text-sm py-2">Filter:</span>
                  <button onClick={() => setFilterTag(null)} className={`px-3 py-1 rounded-full text-sm ${!filterTag ? 'bg-purple-500 bg-opacity-30 text-white' : 'bg-white bg-opacity-10 text-purple-200'}`}>All</button>
                  {allTags.map(tag => (
                    <button key={tag} onClick={() => setFilterTag(tag)} className={`px-3 py-1 rounded-full text-sm ${filterTag === tag ? 'bg-purple-500 bg-opacity-30 text-white' : 'bg-white bg-opacity-10 text-purple-200'}`}>{tag}</button>
                  ))}
                </div>
              )}
              <div className="flex gap-2 items-center">
                <span className="text-purple-300 text-sm">Mood:</span>
                <button onClick={() => setFilterMood(null)} className={`px-3 py-1 rounded-full text-sm ${!filterMood ? 'bg-purple-500 bg-opacity-30 text-white' : 'bg-white bg-opacity-10 text-purple-200'}`}>All</button>
                {moods.map(mood => (
                  <button key={mood.id} onClick={() => setFilterMood(mood.id)} className={`p-2 rounded-lg ${filterMood === mood.id ? 'bg-white bg-opacity-20' : 'bg-white bg-opacity-5'}`} title={mood.label}>
                    <mood.icon className={`w-4 h-4 ${mood.color}`} />
                  </button>
                ))}
              </div>
            </div>
            {filteredEntries.length === 0 ? (
              <div className="text-center py-20">
                <BookOpen className="w-16 h-16 text-purple-300 opacity-30 mx-auto mb-4" />
                <p className="text-purple-200 text-lg opacity-60">No entries found</p>
              </div>
            ) : (
              <div className={layoutView === 'grid' ? 'grid gap-5 md:grid-cols-2 lg:grid-cols-3' : 'space-y-4'}>
                {filteredEntries.map((entry) => {
                  const mood = moods.find(m => m.id === entry.mood);
                  return (
                    <div key={entry.id} className={`bg-white bg-opacity-10 backdrop-blur-sm rounded-2xl p-5 border border-white border-opacity-20 hover:bg-opacity-15 transition-all cursor-pointer group ${layoutView === 'list' ? 'flex gap-4' : ''}`} onClick={() => editEntry(entry)}>
                      <div className="flex-1">
                        <div className="flex justify-between items-start mb-3">
                          <div className="flex items-center gap-2">
                            <span className="text-purple-300 text-sm">{formatDate(entry.date)}</span>
                            {mood && <mood.icon className={`w-4 h-4 ${mood.color}`} />}
                          </div>
                          <div className="flex gap-1">
                            <button onClick={(e) => { e.stopPropagation(); toggleFavorite(entry.id); }} className="p-1.5 hover:bg-yellow-500 hover:bg-opacity-20 rounded transition-all"><Star className={`w-4 h-4 ${entry.favorite ? 'fill-yellow-400 text-yellow-400' : 'text-purple-300'}`} /></button>
                            <button onClick={(e) => { e.stopPropagation(); if (confirm('Delete this entry?')) deleteEntry(entry.id); }} className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-red-500 hover:bg-opacity-20 rounded transition-all"><Trash2 className="w-4 h-4 text-red-300" /></button>
                          </div>
                        </div>
                        <h3 className="text-xl font-medium text-white mb-2 line-clamp-1">{entry.title}</h3>
                        {entry.images && entry.images.length > 0 && (<div className="mb-2"><img src={entry.images[0]} alt="" className="w-full h-32 object-cover rounded-lg" /></div>)}
                        <div className="text-purple-100 opacity-80 text-sm line-clamp-3 leading-relaxed mb-2" dangerouslySetInnerHTML={{ __html: renderFormattedContent(entry.content) }} />
                        {entry.tags && entry.tags.length > 0 && (<div className="flex gap-1 flex-wrap mt-2">{entry.tags.map(tag => (<span key={tag} className="px-2 py-0.5 bg-purple-500 bg-opacity-20 text-purple-200 rounded text-xs">{tag}</span>))}</div>)}
                        {entry.wordCount && (<div className="text-purple-300 text-xs mt-2">{entry.wordCount} words</div>)}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Stats View */}
        {view === 'stats' && (
          <div className="max-w-4xl mx-auto">
            <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-white bg-opacity-10 backdrop-blur-md rounded-2xl p-6 border border-white border-opacity-20">
                <h3 className="text-lg text-white mb-4 flex items-center gap-2"><TrendingUp className="w-5 h-5 text-purple-300" /> Overview</h3>
                <div className="space-y-4">
                  <div><div className="text-3xl font-bold text-white">{stats.totalEntries}</div><div className="text-purple-200 text-sm">Total Entries</div></div>
                  <div><div className="text-3xl font-bold text-white">{stats.totalWords.toLocaleString()}</div><div className="text-purple-200 text-sm">Total Words Written</div></div>
                  <div><div className="text-3xl font-bold text-white">{stats.favorites}</div><div className="text-purple-200 text-sm">Favorite Entries</div></div>
                </div>
              </div>
              <div className="bg-white bg-opacity-10 backdrop-blur-md rounded-2xl p-6 border border-white border-opacity-20">
                <h3 className="text-lg text-white mb-4 flex items-center gap-2"><Heart className="w-5 h-5 text-purple-300" /> Mood Distribution</h3>
                <div className="space-y-3">
                  {moods.map(mood => (
                    <div key={mood.id} className="flex items-center justify-between">
                      <div className="flex items-center gap-2"><mood.icon className={`w-5 h-5 ${mood.color}`} /><span className="text-purple-100">{mood.label}</span></div>
                      <div className="flex items-center gap-3">
                        <div className="w-32 h-2 bg-white bg-opacity-10 rounded-full overflow-hidden"><div className="h-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all" style={{ width: `${stats.totalEntries > 0 ? (stats.moodCounts[mood.id] / stats.totalEntries) * 100 : 0}%` }} /></div>
                        <span className="text-white text-sm w-8 text-right">{stats.moodCounts[mood.id]}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              {allTags.length > 0 && (
                <div className="bg-white bg-opacity-10 backdrop-blur-md rounded-2xl p-6 border border-white border-opacity-20 md:col-span-2">
                  <h3 className="text-lg text-white mb-4 flex items-center gap-2"><Tag className="w-5 h-5 text-purple-300" /> Popular Tags</h3>
                  <div className="flex gap-2 flex-wrap">
                    {allTags.map(tag => {
                      const count = entries.filter(e => e.tags && e.tags.includes(tag)).length;
                      return (<div key={tag} className="px-4 py-2 bg-purple-500 bg-opacity-20 text-purple-100 rounded-full text-sm">{tag} <span className="text-purple-300">({count})</span></div>);
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}