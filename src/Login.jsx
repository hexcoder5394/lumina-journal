import React, { useState } from 'react';
import { auth } from './firebase';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, sendEmailVerification } from 'firebase/auth';
import { Cpu, ArrowRight, Lock, Mail, ShieldCheck, AlertTriangle, Loader2 } from 'lucide-react';

export default function Login() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isSignUp) {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        await sendEmailVerification(userCredential.user);
        alert("IDENTITY CREATED. VERIFICATION LINK TRANSMITTED TO EMAIL SECTOR.");
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (err) {
      const msg = err.code.replace('auth/', '').replace(/-/g, ' ');
      setError(msg.toUpperCase());
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-cyber-dark bg-grid-pattern flex items-center justify-center p-4 relative overflow-hidden">
      
      {/* Background Decor */}
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-cyber-cyan to-transparent opacity-50"></div>
      <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-cyber-pink to-transparent opacity-50"></div>

      <div className="relative w-full max-w-md group">
        
        {/* Glowing Backdrop Effect */}
        <div className="absolute -inset-1 bg-gradient-to-r from-cyber-cyan to-cyber-purple opacity-20 blur transition duration-1000 group-hover:opacity-40"></div>
        
        {/* Main Card */}
        <div className="relative bg-cyber-slate/90 border border-white/10 p-8 backdrop-blur-xl">
          
          {/* Decorative Corners */}
          <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-cyber-cyan"></div>
          <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-cyber-cyan"></div>

          {/* Header */}
          <div className="text-center mb-8">
            <div className="flex justify-center mb-4">
              <div className="p-3 border border-cyber-cyan bg-cyber-cyan/10 rounded-none transform rotate-45">
                <Cpu className="w-8 h-8 text-cyber-cyan transform -rotate-45" />
              </div>
            </div>
            <h1 className="text-3xl font-display font-bold text-white tracking-widest uppercase mb-1">
              Lumina <span className="text-cyber-cyan text-xs align-top">OS</span>
            </h1>
            <div className="flex justify-center items-center gap-2 text-xs font-mono text-gray-400">
              <ShieldCheck className="w-3 h-3 text-green-500" />
              <span>SECURE_CONNECTION_ESTABLISHED</span>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            
            {/* Email Input */}
            <div className="group/input">
              <label className="block text-cyber-cyan text-xs font-mono mb-1 tracking-widest uppercase group-focus-within/input:text-white transition-colors">
                // Identity_String (Email)
              </label>
              <div className="relative">
                <div className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-500 group-focus-within/input:text-cyber-cyan transition-colors">
                  <Mail className="w-5 h-5" />
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-black/40 text-white font-mono pl-12 pr-4 py-3 border border-white/10 focus:border-cyber-cyan focus:bg-black/60 focus:outline-none transition-all placeholder-gray-700"
                  placeholder="USER@DOMAIN.COM"
                />
              </div>
            </div>

            {/* Password Input */}
            <div className="group/input">
              <label className="block text-cyber-cyan text-xs font-mono mb-1 tracking-widest uppercase group-focus-within/input:text-white transition-colors">
                // Access_Code (Password)
              </label>
              <div className="relative">
                <div className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-500 group-focus-within/input:text-cyber-cyan transition-colors">
                  <Lock className="w-5 h-5" />
                </div>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-black/40 text-white font-mono pl-12 pr-4 py-3 border border-white/10 focus:border-cyber-cyan focus:bg-black/60 focus:outline-none transition-all placeholder-gray-700"
                  placeholder="••••••••"
                />
              </div>
            </div>

            {/* Error Display */}
            {error && (
              <div className="flex items-start gap-3 p-3 bg-red-900/20 border border-red-500/50 text-red-200 text-xs font-mono animate-pulse">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>ERROR: {error}</span>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className={`
                w-full py-4 bg-cyber-cyan text-cyber-dark font-display font-bold tracking-widest uppercase 
                hover:bg-white hover:shadow-[0_0_20px_rgba(0,240,255,0.6)] transition-all
                disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2
                clip-path-slant
              `}
              style={{ clipPath: 'polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px)' }}
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" /> PROCESSING...
                </>
              ) : (
                <>
                  {isSignUp ? 'INITIALIZE_PROTOCOL' : 'AUTHENTICATE'}
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>
          </form>

          {/* Toggle Mode */}
          <div className="mt-8 pt-6 border-t border-white/10 text-center">
            <button
              onClick={() => { setIsSignUp(!isSignUp); setError(''); }}
              className="text-gray-500 hover:text-cyber-cyan text-xs font-mono uppercase tracking-wider transition-colors"
            >
              {isSignUp 
                ? "[ SWITCH TO LOGIN TERMINAL ]" 
                : "[ CREATE NEW IDENTITY ]"}
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}