import React, { useState, useEffect, useRef } from 'react';
import { Upload, Database, BarChart3, MessageSquare, Brain, Download, Trash2, LogOut, TrendingUp, PieChart, Activity, User, Lock, Mail, AlertTriangle } from 'lucide-react';
// NOTE: The 'papaparse' module import was removed to fix a build error.
// The code now assumes the global 'Papa' object is available, which requires loading 
// PapaParse via a CDN script tag in the host HTML for your application to run properly.
import { LineChart, Line, BarChart, Bar, ScatterChart, Scatter, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ComposedChart } from 'recharts';
/* global Papa */

// --- Utility Components for Messaging ---

/**
 * Custom alert replacement since window.alert is forbidden.
 */
const AlertMessage = ({ message, type, onClose }) => {
  if (!message) return null;

  const colorClasses = {
    error: 'bg-red-600/50 border-red-500',
    success: 'bg-emerald-600/50 border-emerald-500',
    info: 'bg-cyan-600/50 border-cyan-500',
    warning: 'bg-yellow-600/50 border-yellow-500',
  };
  const Icon = type === 'error' ? AlertTriangle : (type === 'success' ? Brain : Activity);

  return (
    <div className={`fixed top-4 right-4 z-50 p-4 rounded-lg shadow-xl text-white flex items-center gap-3 ${colorClasses[type] || colorClasses.info}`}>
      <Icon className="w-5 h-5 flex-shrink-0" />
      <p className="text-sm font-medium">{message}</p>
      <button onClick={onClose} className="ml-4 p-1 rounded-full hover:bg-white/20 transition">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
};

// --- Main Application Component ---

export default function DataMind() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authMode, setAuthMode] = useState('login');
  const [currentUser, setCurrentUser] = useState(null);
  const [authForm, setAuthForm] = useState({ email: '', password: '', name: '' });
  const [notification, setNotification] = useState({ message: '', type: '' });
  
  const [datasets, setDatasets] = useState([]);
  const [activeDataset, setActiveDataset] = useState(null);
  const [view, setView] = useState('manager');
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [insights, setInsights] = useState([]);
  const [stats, setStats] = useState(null);
  const [chartConfig, setChartConfig] = useState({ type: 'line', xCol: '', yCol: '' });

  // Ref for auto-scrolling chat
  const chatEndRef = useRef(null);

  // Auto-scroll chat window when new messages arrive
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  // Load user from localStorage on initial load
  useEffect(() => {
    const savedUser = localStorage.getItem('datamind_current_user');
    if (savedUser) {
      try {
        const user = JSON.parse(savedUser);
        setCurrentUser(user);
        setIsAuthenticated(true);
        loadUserData(user.email);
      } catch (e) {
        console.error('Error loading user:', e);
        // Clear corrupt user session if parsing fails
        localStorage.removeItem('datamind_current_user'); 
      }
    }
  }, []);

  // --- Data Persistence (Local Storage for User-Specific Data) ---

  const loadUserData = (email) => {
    const userDataKey = `datamind_${email}_data`;
    try {
      const saved = JSON.parse(localStorage.getItem(userDataKey) || '[]');
      setDatasets(saved);
      // Reset active dataset if it doesn't exist in the loaded data
      if (activeDataset && !saved.find(d => d.id === activeDataset.id)) {
        setActiveDataset(null);
      }
    } catch (e) {
      console.error('Error loading data:', e);
      setDatasets([]);
    }
  };

  const saveUserData = (data) => {
    if (currentUser) {
      const userDataKey = `datamind_${currentUser.email}_data`;
      localStorage.setItem(userDataKey, JSON.stringify(data));
      setDatasets(data);
    }
  };

  // --- Authentication Logic (Simulated Backend via LocalStorage) ---

  const showNotification = (message, type = 'info') => {
    setNotification({ message, type });
    setTimeout(() => setNotification({ message: '', type: '' }), 5000);
  };

  const handleAuth = (e) => {
    e.preventDefault();
    const users = JSON.parse(localStorage.getItem('datamind_users') || '[]');
    
    if (authMode === 'register') {
      if (!authForm.name || !authForm.email || !authForm.password) {
        showNotification('All fields are required for registration.', 'error');
        return;
      }

      if (users.find(u => u.email === authForm.email)) {
        showNotification('Email already registered! Please use a different email or sign in.', 'error');
        return;
      }
      
      const newUser = {
        name: authForm.name,
        email: authForm.email,
        password: authForm.password, // In a real app, this would be hashed!
        id: Date.now() 
      };
      
      users.push(newUser);
      localStorage.setItem('datamind_users', JSON.stringify(users));
      localStorage.setItem('datamind_current_user', JSON.stringify(newUser));
      
      setCurrentUser(newUser);
      setIsAuthenticated(true);
      loadUserData(newUser.email);
      setAuthForm({ email: '', password: '', name: '' });
      showNotification('Registration successful! Welcome to DataMind.', 'success');
      
    } else { // Login Mode
      const user = users.find(u => u.email === authForm.email && u.password === authForm.password);
      
      if (user) {
        localStorage.setItem('datamind_current_user', JSON.stringify(user));
        setCurrentUser(user);
        setIsAuthenticated(true);
        loadUserData(user.email);
        setAuthForm({ email: '', password: '', name: '' });
        showNotification(`Welcome back, ${user.name}!`, 'success');
      } else {
        showNotification('Invalid email or password. Please try again.', 'error');
      }
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('datamind_current_user');
    setCurrentUser(null);
    setIsAuthenticated(false);
    setDatasets([]);
    setActiveDataset(null);
    setView('manager');
    setChatMessages([]);
    setInsights([]);
    setStats(null);
    showNotification('You have been signed out.', 'info');
  };

  // --- Data Processing Functions ---

  const handleFileUpload = (e) => {
    // Check if PapaParse is loaded globally
    if (typeof Papa === 'undefined') {
        showNotification('PapaParse library is not loaded. Cannot upload data.', 'error');
        return;
    }

    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    
    reader.onload = (event) => {
      Papa.parse(event.target.result, {
        header: true,
        dynamicTyping: true,
        skipEmptyLines: true,
        complete: (result) => {
          if (result.data && result.data.length > 0) {
            const newDataset = {
              id: Date.now(),
              name: file.name,
              data: result.data,
              columns: Object.keys(result.data[0] || {}),
              uploadedAt: new Date().toISOString()
            };
            const updated = [...datasets, newDataset];
            saveUserData(updated);
            setActiveDataset(newDataset);
            setView('explorer');
            analyzeDataset(newDataset);
            showNotification(`Dataset "${newDataset.name}" uploaded and analyzed!`, 'success');
          } else {
            showNotification('No data found in file. Please upload a valid CSV/JSON.', 'error');
          }
        },
        error: (error) => {
          showNotification('Error parsing file: ' + error.message, 'error');
        }
      });
    };

    reader.readAsText(file);
  };

  const calculateCorrelation = (data, col1, col2) => {
    const pairs = data.map(row => [row[col1], row[col2]]).filter(([a, b]) => 
      typeof a === 'number' && typeof b === 'number' && !isNaN(a) && !isNaN(b)
    );
    
    if (pairs.length < 2) return 0;
    
    const mean1 = pairs.reduce((sum, [a]) => sum + a, 0) / pairs.length;
    const mean2 = pairs.reduce((sum, [, b]) => sum + b, 0) / pairs.length;
    
    let num = 0, den1 = 0, den2 = 0;
    pairs.forEach(([a, b]) => {
      const diff1 = a - mean1;
      const diff2 = b - mean2;
      num += diff1 * diff2;
      den1 += diff1 * diff1;
      den2 += diff2 * diff2;
    });
    
    // Pearson correlation formula
    return num / Math.sqrt(den1 * den2) || 0;
  };

  const analyzeDataset = (dataset) => {
    if (!dataset || !dataset.data || dataset.data.length === 0) return;

    const cols = dataset.columns;
    const data = dataset.data;
    const newStats = {};
    const newInsights = [];

    cols.forEach(col => {
      const values = data.map(row => row[col]).filter(v => v != null);
      const numericValues = values.filter(v => typeof v === 'number' && !isNaN(v));
      
      if (numericValues.length > 0) {
        const sorted = [...numericValues].sort((a, b) => a - b);
        const sum = numericValues.reduce((a, b) => a + b, 0);
        const mean = sum / numericValues.length;
        const median = sorted[Math.floor(sorted.length / 2)];
        const min = sorted[0];
        const max = sorted[sorted.length - 1];
        
        newStats[col] = {
          type: 'numeric',
          mean: mean.toFixed(2),
          median: median.toFixed(2),
          min: min.toFixed(2),
          max: max.toFixed(2),
          missing: ((data.length - values.length) / data.length * 100).toFixed(1) + '%',
        };

        // Simple anomaly/variance detection
        if (max - min > mean * 5 && numericValues.length > 10) {
          newInsights.push({
            agent: 'Analyst',
            text: `Extreme variance detected in **${col}** - range is very wide compared to the mean.`,
            type: 'warning'
          });
        }
      } else {
        const unique = [...new Set(values)];
        const mode = values.sort((a,b) => 
          values.filter(v => v===a).length - values.filter(v => v===b).length
        ).pop();
        
        newStats[col] = {
          type: 'categorical',
          unique: unique.length,
          mode: mode,
          missing: ((data.length - values.length) / data.length * 100).toFixed(1) + '%'
        };

        if (unique.length / data.length > 0.8) {
          newInsights.push({
            agent: 'Analyst',
            text: `High cardinality detected in **${col}** (${unique.length} unique values). This column might function as an ID or key.`,
            type: 'info'
          });
        }
      }
    });

    // Correlation analysis
    const numCols = cols.filter(c => newStats[c]?.type === 'numeric');
    for (let i = 0; i < numCols.length; i++) {
      for (let j = i + 1; j < numCols.length; j++) {
        const corr = calculateCorrelation(data, numCols[i], numCols[j]);
        if (Math.abs(corr) > 0.8) {
          newInsights.push({
            agent: 'Analyst',
            text: `Strong **${corr > 0 ? 'positive' : 'negative'}** correlation found between **${numCols[i]}** and **${numCols[j]}** (r = ${corr.toFixed(2)}).`,
            type: 'info'
          });
        }
      }
    }

    if (data.length > 10) {
      newInsights.push({
        agent: 'Insight',
        text: `Dataset loaded successfully: **${data.length}** records across **${cols.length}** features.`,
        type: 'info'
      });
    }

    setStats(newStats);
    setInsights(newInsights);
  };

  const deleteDataset = (id) => {
    const updated = datasets.filter(d => d.id !== id);
    saveUserData(updated);
    if (activeDataset?.id === id) {
      setActiveDataset(null);
      setView('manager');
      setStats(null);
      setInsights([]);
    }
    showNotification('Dataset deleted successfully.', 'success');
  };

  // --- Export Functions ---

  const exportData = () => {
    if (!activeDataset) return;
    if (typeof Papa === 'undefined') {
        showNotification('PapaParse library is not loaded. Cannot export data.', 'error');
        return;
    }

    const csv = Papa.unparse(activeDataset.data);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activeDataset.name.replace(/\.csv|\.json/i, '')}_export.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportInsights = () => {
    if (!activeDataset) return;
    const markdown = `# DataMind Analysis Report\n\n**Dataset:** ${activeDataset?.name}\n**Date:** ${new Date().toLocaleDateString()}\n\n## AI Insights\n\n${insights.map(i => `- **[${i.agent}]** ${i.text.replace(/\*\*/g, '')}`).join('\n')}`;
    const blob = new Blob([markdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'datamind_insights.md';
    a.click();
    URL.revokeObjectURL(url);
  };

  // --- AI Chat Logic (Local NLP Simulation) ---

  const handleChat = () => {
    if (!chatInput.trim() || !activeDataset) return;

    const userMsg = { role: 'user', text: chatInput };
    const query = chatInput.toLowerCase();
    let response = '';

    const newChatHistory = [...chatMessages, userMsg];
    setChatMessages(newChatHistory);
    setChatInput('');
    
    // Delayed response to simulate processing
    setTimeout(() => {
        if (query.includes('summary') || query.includes('summarize')) {
          const numCols = activeDataset.columns.filter(c => stats?.[c]?.type === 'numeric').length;
          response = `This dataset contains **${activeDataset.data.length} records** with **${activeDataset.columns.length} columns**. We detected **${numCols} numeric features**. Focus on the Data Explorer tab for detailed statistics.`;
        } else if (query.includes('column') || query.includes('feature') || query.includes('what are')) {
          response = `The available columns in the **${activeDataset.name}** dataset are: ${activeDataset.columns.join(', ')}.`;
        } else if (query.includes('highest') || query.includes('maximum') || query.includes('max') || query.includes('lowest') || query.includes('min')) {
          const colMatch = activeDataset.columns.find(c => query.includes(c.toLowerCase()));
          if (colMatch && stats?.[colMatch]?.type === 'numeric') {
            const stat = stats[colMatch];
            if (query.includes('max') || query.includes('highest')) {
                response = `The maximum value found in **${colMatch}** is **${stat.max}**.`;
            } else {
                response = `The minimum value found in **${colMatch}** is **${stat.min}**.`;
            }
          } else {
            response = 'Please specify a **numeric column** name to find the maximum or minimum value.';
          }
        } else if (query.includes('average') || query.includes('mean')) {
          const colMatch = activeDataset.columns.find(c => query.includes(c.toLowerCase()));
          if (colMatch && stats?.[colMatch]?.type === 'numeric') {
            response = `The average (mean) value of **${colMatch}** is **${stats[colMatch].mean}**.`;
          } else {
            response = 'Please specify a **numeric column** name to calculate the average.';
          }
        } else if (query.includes('pattern') || query.includes('trend') || query.includes('anomaly')) {
          response = insights.length > 0 
            ? `Here are the key findings I detected:\n\n${insights.map(i => `* **${i.agent}**: ${i.text}`).join('\n')}`
            : 'I did not detect any strong correlations or anomalies. The data appears stable.';
        } else {
          response = 'I am the **Conversational Agent**. I can analyze your data using natural language! Try asking: "summarize the data", "what are the columns?", or "find the average of [column]".';
        }

        const botMsg = { role: 'assistant', text: response };
        setChatMessages(prev => [...prev, botMsg]);
    }, 500);
  };
  
  // --- Auth Screen Render ---

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-emerald-900 to-slate-900 flex items-center justify-center p-6 text-white font-sans">
        <AlertMessage {...notification} onClose={() => setNotification({ message: '', type: '' })} />

        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <Brain className="w-16 h-16 mx-auto mb-4 text-emerald-400" />
            <h1 className="text-4xl font-extrabold tracking-tight bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent mb-2">
              DataMind
            </h1>
            <p className="text-emerald-300/70">Local AI Data Playground</p>
          </div>

          <div className="bg-slate-800/70 backdrop-blur-xl rounded-2xl p-8 border border-emerald-500/30 shadow-2xl">
            <div className="flex gap-2 mb-6 p-1 bg-slate-700 rounded-xl">
              <button
                type="button"
                onClick={() => setAuthMode('login')}
                className={`flex-1 py-2 rounded-lg transition font-semibold ${authMode === 'login' ? 'bg-emerald-600 text-white shadow-md' : 'text-emerald-300 hover:bg-slate-600'}`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => setAuthMode('register')}
                className={`flex-1 py-2 rounded-lg transition font-semibold ${authMode === 'register' ? 'bg-emerald-600 text-white shadow-md' : 'text-emerald-300 hover:bg-slate-600'}`}
              >
                Register
              </button>
            </div>

            <form onSubmit={handleAuth} className="space-y-4">
              {authMode === 'register' && (
                <div className="space-y-1">
                  <label className="block text-sm text-emerald-300">Full Name</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-emerald-400/80" />
                    <input
                      type="text"
                      value={authForm.name}
                      onChange={e => setAuthForm({...authForm, name: e.target.value})}
                      className="w-full bg-slate-700 rounded-lg pl-11 pr-4 py-3 border border-emerald-500/30 focus:border-emerald-400 focus:outline-none text-white placeholder-slate-400"
                      placeholder="Your Name"
                      required={authMode === 'register'}
                    />
                  </div>
                </div>
              )}

              <div className="space-y-1">
                <label className="block text-sm text-emerald-300">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-emerald-400/80" />
                  <input
                    type="email"
                    value={authForm.email}
                    onChange={e => setAuthForm({...authForm, email: e.target.value})}
                    className="w-full bg-slate-700 rounded-lg pl-11 pr-4 py-3 border border-emerald-500/30 focus:border-emerald-400 focus:outline-none text-white placeholder-slate-400"
                    placeholder="you@example.com"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-sm text-emerald-300">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-emerald-400/80" />
                  <input
                    type="password"
                    value={authForm.password}
                    onChange={e => setAuthForm({...authForm, password: e.target.value})}
                    className="w-full bg-slate-700 rounded-lg pl-11 pr-4 py-3 border border-emerald-500/30 focus:border-emerald-400 focus:outline-none text-white placeholder-slate-400"
                    placeholder="••••••••"
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold py-3 rounded-lg transition shadow-lg shadow-emerald-500/20 mt-6"
              >
                {authMode === 'login' ? 'Sign In to DataMind' : 'Create Account'}
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }
  
  // --- Main App Render (Authenticated) ---

  const defaultChartColor = '#6ee7b7'; // emerald-300
  const lineChartColor = '#34d399'; // emerald-500

  // Helper to render the correct chart type
  const renderChart = () => {
    if (!chartConfig.xCol || !chartConfig.yCol) {
      return (
        <div className="bg-slate-800/50 rounded-lg p-12 text-center text-emerald-300/60">
          <PieChart className="w-16 h-16 mx-auto mb-4 opacity-50" />
          <p>Select **X** and **Y** columns to visualize your data.</p>
        </div>
      );
    }
    
    // Only use the first 100 rows for performance
    const chartData = activeDataset.data.slice(0, 100);

    return (
      <ResponsiveContainer width="100%" height={300}>
        <ComposedChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#ffffff20" />
          <XAxis dataKey={chartConfig.xCol} stroke={defaultChartColor} />
          <YAxis stroke={defaultChartColor} />
          <Tooltip 
            contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #059669', borderRadius: '8px' }} 
            labelStyle={{ color: defaultChartColor }}
          />
          <Legend wrapperStyle={{ paddingTop: '10px' }}/>
          
          {chartConfig.type === 'line' && (
            <Line type="monotone" dataKey={chartConfig.yCol} stroke={lineChartColor} strokeWidth={3} dot={{ fill: lineChartColor }} />
          )}
          {chartConfig.type === 'bar' && (
            <Bar dataKey={chartConfig.yCol} fill={defaultChartColor} />
          )}
          {chartConfig.type === 'area' && (
            <Area type="monotone" dataKey={chartConfig.yCol} stroke={lineChartColor} fill={lineChartColor} fillOpacity={0.6} />
          )}
          {chartConfig.type === 'scatter' && (
            <Scatter name="Data Points" dataKey={chartConfig.yCol} fill={defaultChartColor} />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-emerald-950 to-slate-900 text-white font-sans">
      <AlertMessage {...notification} onClose={() => setNotification({ message: '', type: '' })} />

      {/* Header / Navigation */}
      <header className="border-b border-emerald-500/30 bg-black/30 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-6 py-4 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Brain className="w-8 h-8 text-emerald-400" />
            <h1 className="text-2xl font-bold bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent">
              DataMind
            </h1>
            <span className="text-sm text-emerald-300/60 hidden sm:block">Local AI Data Playground</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex gap-2">
              {['manager', 'explorer', 'chat'].map(v => (
                <button
                  key={v}
                  onClick={() => { setView(v); if(v === 'explorer' && activeDataset) analyzeDataset(activeDataset); }}
                  disabled={v !== 'manager' && !activeDataset}
                  className={`px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-medium transition ${view === v ? 'bg-emerald-600 shadow-md shadow-emerald-500/20' : 'bg-white/10 hover:bg-white/20'} disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {v === 'manager' && <Database className="w-4 h-4" />}
                  {v === 'explorer' && <BarChart3 className="w-4 h-4" />}
                  {v === 'chat' && <MessageSquare className="w-4 h-4" />}
                  {v.charAt(0).toUpperCase() + v.slice(1)}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-3 pl-4 border-l border-emerald-500/30">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-semibold text-emerald-300">{currentUser?.name}</p>
                <p className="text-xs text-emerald-400/60">{currentUser?.email}</p>
              </div>
              <button
                onClick={handleLogout}
                className="p-3 bg-red-600/20 hover:bg-red-600/30 rounded-full transition"
                title="Logout"
              >
                <LogOut className="w-4 h-4 text-red-400" />
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8">
        
        {/* Dataset Manager (Upload & List) */}
        {view === 'manager' && (
          <div className="space-y-6">
            <div className="bg-slate-800/70 backdrop-blur-md rounded-xl p-8 border border-emerald-500/30 shadow-xl">
              <h2 className="text-2xl font-semibold mb-4 flex items-center gap-2 text-emerald-300">
                <Upload className="w-6 h-6 text-emerald-400" />
                Dataset Manager
              </h2>
              <label 
                className="block w-full border-2 border-dashed border-emerald-500/50 rounded-xl p-12 text-center cursor-pointer hover:border-emerald-400 transition hover:bg-slate-800/50"
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => { e.preventDefault(); handleFileUpload({ target: { files: e.dataTransfer.files } }); }}
              >
                <input type="file" accept=".csv,.json" onChange={handleFileUpload} className="hidden" />
                <Database className="w-12 h-12 mx-auto mb-4 text-emerald-400" />
                <p className="text-lg mb-2 text-white">Drop your **CSV** or **JSON** file here</p>
                <p className="text-sm text-emerald-300/60">or click to browse. Data is saved locally for {currentUser.email}.</p>
              </label>
            </div>

            {datasets.length > 0 && (
              <div className="bg-slate-800/70 backdrop-blur-md rounded-xl p-6 border border-emerald-500/30 shadow-xl">
                <h2 className="text-xl font-semibold mb-4 text-emerald-300">Your Datasets ({datasets.length})</h2>
                <div className="space-y-3">
                  {datasets.map(ds => (
                    <div 
                      key={ds.id} 
                      className={`rounded-lg p-4 flex items-center justify-between transition ${activeDataset?.id === ds.id ? 'bg-emerald-600/30 border border-emerald-500' : 'bg-slate-700/30 hover:bg-slate-700/50'}`}
                    >
                      <div className="flex items-center gap-4">
                        <Database className="w-6 h-6 text-emerald-400" />
                        <div>
                          <h3 className="font-semibold">{ds.name}</h3>
                          <p className="text-sm text-emerald-300/60">
                            {ds.data.length} rows × {ds.columns.length} columns
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button 
                          onClick={() => { setActiveDataset(ds); setView('explorer'); analyzeDataset(ds); }} 
                          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 rounded-lg transition text-sm font-semibold"
                        >
                          Open
                        </button>
                        <button 
                          onClick={() => deleteDataset(ds.id)} 
                          className="p-2 bg-red-600/20 hover:bg-red-600/30 rounded-lg transition"
                          title="Delete Dataset"
                        >
                          <Trash2 className="w-4 h-4 text-red-400" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Data Explorer */}
        {view === 'explorer' && activeDataset && (
          <div className="space-y-6">
            <div className="bg-slate-800/70 backdrop-blur-md rounded-xl p-6 border border-emerald-500/30 shadow-xl">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-4">
                <h2 className="text-2xl font-semibold flex items-center gap-2 text-emerald-300">
                  <Activity className="w-6 h-6 text-emerald-400" />
                  Exploring: {activeDataset.name}
                </h2>
                <div className="flex gap-3">
                  <button 
                    onClick={exportData} 
                    className="px-4 py-2 bg-teal-600 hover:bg-teal-700 rounded-lg flex items-center gap-2 transition text-sm font-semibold"
                  >
                    <Download className="w-4 h-4" /> Export Data
                  </button>
                  <button 
                    onClick={exportInsights} 
                    className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 rounded-lg flex items-center gap-2 transition text-sm font-semibold"
                  >
                    <Download className="w-4 h-4" /> Export Insights
                  </button>
                </div>
              </div>

              {/* Stats Overview */}
              {stats && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-8">
                  {Object.entries(stats).map(([col, stat]) => (
                    <div key={col} className="bg-slate-700/50 rounded-xl p-4 border border-emerald-500/20">
                      <h3 className="font-bold text-emerald-300 mb-2 truncate">{col}</h3>
                      <div className="text-xs space-y-1">
                        <p className={`font-semibold ${stat.type === 'numeric' ? 'text-blue-300' : 'text-yellow-300'}`}>
                            Type: {stat.type.toUpperCase()}
                        </p>
                        {stat.type === 'numeric' ? (
                          <>
                            <p>Mean: <span className="text-emerald-400">{stat.mean}</span></p>
                            <p>Range: <span className="text-emerald-400">{stat.min} - {stat.max}</span></p>
                          </>
                        ) : (
                          <>
                            <p>Unique Values: <span className="text-emerald-400">{stat.unique}</span></p>
                            <p>Mode: <span className="text-emerald-400 truncate max-w-[100px] inline-block">{stat.mode || 'N/A'}</span></p>
                          </>
                        )}
                        <p>Missing: <span className={`font-bold ${stat.missing.startsWith('0.0') ? 'text-emerald-400' : 'text-red-400'}`}>{stat.missing}</span></p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* AI Insights */}
              {insights.length > 0 && (
                <div className="bg-gradient-to-r from-emerald-700/20 to-teal-700/20 rounded-xl p-6 mb-8 border border-emerald-500/30">
                  <h3 className="text-xl font-semibold mb-4 flex items-center gap-2 text-emerald-300">
                    <Brain className="w-5 h-5 text-emerald-400" />
                    AI Insights & Patterns
                  </h3>
                  <div className="space-y-3">
                    {insights.map((insight, idx) => (
                      <div 
                        key={idx} 
                        className={`rounded-lg p-3 flex items-start gap-3 text-sm border-l-4 ${insight.type === 'warning' ? 'bg-red-900/30 border-red-400' : 'bg-slate-900/40 border-emerald-400'}`}
                      >
                        <TrendingUp className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
                        <div>
                          <span className="text-xs font-semibold uppercase text-emerald-300">[{insight.agent}]</span>
                          <p className="mt-1" dangerouslySetInnerHTML={{ __html: insight.text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }}></p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Visualization */}
              <div className="bg-slate-700/50 rounded-xl p-6 mb-8 border border-emerald-500/30">
                <h3 className="text-xl font-semibold mb-4 flex items-center gap-2 text-emerald-300">
                  <PieChart className="w-5 h-5 text-emerald-400" />
                  Interactive Visualization
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  <select 
                    value={chartConfig.type} 
                    onChange={e => setChartConfig({...chartConfig, type: e.target.value})} 
                    className="bg-slate-800 rounded-lg px-3 py-2 border border-emerald-500/30 text-white focus:ring-emerald-400 focus:border-emerald-400"
                  >
                    <option value="line">Line Chart</option>
                    <option value="bar">Bar Chart</option>
                    <option value="scatter">Scatter Plot</option>
                    <option value="area">Area Chart</option>
                  </select>
                  <select 
                    value={chartConfig.xCol} 
                    onChange={e => setChartConfig({...chartConfig, xCol: e.target.value})} 
                    className="bg-slate-800 rounded-lg px-3 py-2 border border-emerald-500/30 text-white focus:ring-emerald-400 focus:border-emerald-400"
                  >
                    <option value="">Select X axis</option>
                    {activeDataset.columns.map(col => <option key={col} value={col}>{col}</option>)}
                  </select>
                  <select 
                    value={chartConfig.yCol} 
                    onChange={e => setChartConfig({...chartConfig, yCol: e.target.value})} 
                    className="bg-slate-800 rounded-lg px-3 py-2 border border-emerald-500/30 text-white focus:ring-emerald-400 focus:border-emerald-400"
                  >
                    <option value="">Select Y axis</option>
                    {activeDataset.columns.map(col => <option key={col} value={col}>{col}</option>)}
                  </select>
                </div>
                
                <div className="w-full bg-slate-900/50 p-4 rounded-xl">
                  {renderChart()}
                </div>
              </div>

              {/* Data Table Preview */}
              <div className="bg-slate-700/50 rounded-xl p-6 border border-emerald-500/30">
                <h3 className="text-xl font-semibold mb-4 text-emerald-300">Data Preview (First 10 Rows)</h3>
                <div className="overflow-x-auto max-h-[400px]">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-emerald-500/50 bg-slate-900/50 sticky top-0">
                        {activeDataset.columns.map(col => (
                          <th key={col} className="px-4 py-3 text-left font-bold text-emerald-300 whitespace-nowrap">{col}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {activeDataset.data.slice(0, 10).map((row, idx) => (
                        <tr key={idx} className="border-b border-white/10 hover:bg-slate-700/30 transition">
                          {activeDataset.columns.map(col => (
                            <td key={col} className="px-4 py-2 whitespace-nowrap">
                              {/* Safely render values, handling null/undefined */}
                              {row[col] != null ? (typeof row[col] === 'object' ? JSON.stringify(row[col]) : row[col].toString()) : <span className="text-red-400/50 italic">N/A</span>}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {activeDataset.data.length > 10 && (
                    <p className="text-sm text-emerald-300/60 mt-4 text-center">
                      Showing 10 of **{activeDataset.data.length}** rows
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* AI Chat */}
        {view === 'chat' && activeDataset && (
          <div className="bg-slate-800/70 backdrop-blur-md rounded-xl border border-emerald-500/30 h-[650px] flex flex-col shadow-xl">
            <div className="p-6 border-b border-emerald-500/30">
              <h2 className="text-xl font-semibold flex items-center gap-2 text-emerald-300">
                <MessageSquare className="w-5 h-5 text-emerald-400" />
                AI Conversational Agent
              </h2>
              <p className="text-sm text-emerald-300/60 mt-1">Ask questions about **{activeDataset.name}** to get data-backed answers.</p>
            </div>
            
            {/* Chat History */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {chatMessages.length === 0 && (
                <div className="text-center text-emerald-300/60 mt-20">
                  <Brain className="w-16 h-16 mx-auto mb-4 text-emerald-400/50" />
                  <p className="mb-4">Start a conversation! Try asking one of these suggested queries:</p>
                  <div className="space-y-2 text-sm max-w-sm mx-auto">
                    {['"Summarize the data"', '"What patterns do you see?"', '"Find the average of [column name]"'].map((prompt, i) => (
                        <div key={i} className="bg-slate-700/30 rounded-lg p-3 cursor-pointer hover:bg-slate-700/50 transition" onClick={() => setChatInput(prompt.replace(/"/g, ''))}>
                            {prompt}
                        </div>
                    ))}
                  </div>
                </div>
              )}
              {chatMessages.map((msg, idx) => (
                <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] rounded-xl p-4 shadow-md ${msg.role === 'user' ? 'bg-emerald-600/90' : 'bg-slate-700/50'}`}>
                    <p className="text-sm font-medium" dangerouslySetInnerHTML={{ __html: msg.text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }}></p>
                  </div>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>

            {/* Chat Input */}
            <div className="p-6 border-t border-emerald-500/30">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                  onKeyPress={e => e.key === 'Enter' && handleChat()}
                  placeholder="Ask about your data..."
                  className="flex-1 bg-slate-700 rounded-lg px-4 py-3 border border-emerald-500/30 focus:border-emerald-400 focus:outline-none text-white placeholder-slate-400"
                  disabled={!activeDataset}
                />
                <button 
                  onClick={handleChat} 
                  className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 rounded-lg transition font-semibold disabled:opacity-50"
                  disabled={!activeDataset || !chatInput.trim()}
                >
                  Send
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
