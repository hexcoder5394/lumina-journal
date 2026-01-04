import React, { useState } from 'react';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  sendEmailVerification 
} from 'firebase/auth';
import { auth } from './firebase';
import { 
  Mail, Lock, ArrowRight, Loader2, 
  Cpu, ShieldCheck, AlertCircle 
} from 'lucide-react';

export default function Login() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);

    try {
      if (isLogin) {
        // LOGIN LOGIC
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        // SIGN UP LOGIC
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        await sendEmailVerification(userCredential.user);
        setMessage("Account created! Please check your email to verify.");
        // Optional: Switch back to login view or stay logged in depending on logic
      }
    } catch (err) {
      console.error(err);
      switch(err.code) {
        case 'auth/invalid-email': setError('Invalid email address format.'); break;
        case 'auth/user-disabled': setError('This account has been disabled.'); break;
        case 'auth/user-not-found': setError('No account found with this email.'); break;
        case 'auth/wrong-password': setError('Incorrect password.'); break;
        case 'auth/email-already-in-use': setError('Email already in use.'); break;
        case 'auth/weak-password': setError('Password should be at least 6 characters.'); break;
        default: setError('Authentication failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-pro-bg flex items-center justify-center relative overflow-hidden font-sans text-pro-text">
      
      {/* --- BACKGROUND ANIMATION (Matches Dashboard) --- */}
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
      
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-indigo-600/20 rounded-full blur-[120px] animate-float"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-blue-600/20 rounded-full blur-[120px] animate-float-delayed"></div>
      </div>

      {/* --- LOGIN CARD --- */}
      <div className="relative z-10 w-full max-w-md px-6">
        
        {/* Logo Section */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-gradient-primary rounded-2xl flex items-center justify-center text-white shadow-2xl shadow-indigo-500/30 mb-4 transform hover:scale-105 transition-transform duration-500">
            <Cpu className="w-8 h-8" />
          </div>
          <h1 className="text-4xl font-bold text-pro-white tracking-tight">Lumina</h1>
          <p className="text-gray-500 mt-2">Your Personal Life Operating System</p>
        </div>

        {/* Card Container */}
        <div className="bg-pro-card border border-pro-border rounded-3xl p-8 shadow-2xl backdrop-blur-xl">
          
          {/* Toggle Switch */}
          <div className="flex bg-pro-bg p-1 rounded-xl mb-8 border border-pro-border">
            <button 
              onClick={() => { setIsLogin(true); setError(''); setMessage(''); }}
              className={`flex-1 py-2.5 text-sm font-medium rounded-lg transition-all duration-300 ${isLogin ? 'bg-pro-card text-pro-white shadow-sm border border-pro-border' : 'text-gray-500 hover:text-gray-300'}`}
            >
              Sign In
            </button>
            <button 
              onClick={() => { setIsLogin(false); setError(''); setMessage(''); }}
              className={`flex-1 py-2.5 text-sm font-medium rounded-lg transition-all duration-300 ${!isLogin ? 'bg-pro-card text-pro-white shadow-sm border border-pro-border' : 'text-gray-500 hover:text-gray-300'}`}
            >
              Register
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            
            {/* Error / Success Messages */}
            {error && (
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-center gap-2">
                <AlertCircle className="w-4 h-4" /> {error}
              </div>
            )}
            {message && (
              <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20 text-green-400 text-sm flex items-center gap-2">
                <ShieldCheck className="w-4 h-4" /> {message}
              </div>
            )}

            {/* Email Input */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider ml-1">Email Identity</label>
              <div className="relative group">
                <Mail className="absolute left-4 top-3.5 w-5 h-5 text-gray-500 group-focus-within:text-pro-primary transition-colors" />
                <input 
                  type="email" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="user@lumina.os" 
                  className="w-full bg-pro-bg border border-pro-border rounded-xl py-3 pl-12 pr-4 text-pro-white placeholder-gray-600 focus:outline-none focus:border-pro-primary focus:ring-1 focus:ring-pro-primary transition-all"
                  required 
                />
              </div>
            </div>

            {/* Password Input */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider ml-1">Access Key</label>
              <div className="relative group">
                <Lock className="absolute left-4 top-3.5 w-5 h-5 text-gray-500 group-focus-within:text-pro-primary transition-colors" />
                <input 
                  type="password" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••" 
                  className="w-full bg-pro-bg border border-pro-border rounded-xl py-3 pl-12 pr-4 text-pro-white placeholder-gray-600 focus:outline-none focus:border-pro-primary focus:ring-1 focus:ring-pro-primary transition-all"
                  required 
                />
              </div>
            </div>

            {/* Submit Button */}
            <button 
              type="submit" 
              disabled={loading}
              className="w-full bg-gradient-primary hover:opacity-90 text-white font-bold py-3.5 rounded-xl transition-all transform active:scale-[0.98] shadow-lg shadow-indigo-500/25 flex items-center justify-center gap-2 mt-4 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  {isLogin ? 'Authenticate' : 'Initialize Account'} 
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>

          </form>
        </div>

        {/* Footer Text */}
        <p className="text-center text-gray-600 text-xs mt-8">
          Lumina OS v2.0 &bull; Secure Connection Established
        </p>

      </div>
    </div>
  );
}