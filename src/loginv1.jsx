import React, { useState } from 'react';
import { auth } from './firebase';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, sendEmailVerification } from 'firebase/auth';
import { BookOpen, ArrowRight, Lock, Mail, Loader2 } from 'lucide-react';

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
      // Send the verification email immediately
      await sendEmailVerification(userCredential.user);
      alert("Account created! We sent you a verification email. Please check your inbox (and spam) before logging in.");
      
      // Optional: Sign them out immediately so they have to login again after verifying
      // await signOut(auth); 
    } else {
      await signInWithEmailAndPassword(auth, email, password);
    }
  } catch (err) {
    const msg = err.code.replace('auth/', '').replace(/-/g, ' ');
    setError(msg.charAt(0).toUpperCase() + msg.slice(1));
  } finally {
    setLoading(false);
  }
};

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      {/* Background Ambience */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-600 rounded-full mix-blend-screen filter blur-3xl opacity-20 animate-pulse"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-pink-600 rounded-full mix-blend-screen filter blur-3xl opacity-20 animate-pulse" style={{ animationDelay: '2s' }}></div>
      </div>

      <div className="relative z-10 w-full max-w-md bg-white bg-opacity-10 backdrop-blur-xl rounded-3xl shadow-2xl border border-white border-opacity-20 p-8">
        
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <div className="p-3 bg-white bg-opacity-10 rounded-full">
              <BookOpen className="w-8 h-8 text-purple-300" />
            </div>
          </div>
          <h1 className="text-3xl font-light text-white tracking-wider mb-2">Lumina</h1>
          <p className="text-purple-200 text-sm">Your private thoughts, secured.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 transform -translate-y-1/2 text-purple-300 w-5 h-5" />
              <input
                type="email"
                placeholder="Email address"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-slate-800 bg-opacity-50 text-white pl-12 pr-4 py-3 rounded-xl border border-white border-opacity-10 focus:outline-none focus:border-purple-400 focus:bg-opacity-80 transition-all placeholder-gray-400"
              />
            </div>
          </div>

          <div>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 transform -translate-y-1/2 text-purple-300 w-5 h-5" />
              <input
                type="password"
                placeholder="Password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-slate-800 bg-opacity-50 text-white pl-12 pr-4 py-3 rounded-xl border border-white border-opacity-10 focus:outline-none focus:border-purple-400 focus:bg-opacity-80 transition-all placeholder-gray-400"
              />
            </div>
          </div>

          {error && (
            <div className="p-3 bg-red-500 bg-opacity-20 border border-red-500 border-opacity-30 rounded-lg text-red-200 text-sm text-center">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl font-medium hover:opacity-90 transition-all transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (
              <>
                {isSignUp ? 'Create Account' : 'Sign In'}
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button
            onClick={() => setIsSignUp(!isSignUp)}
            className="text-purple-300 hover:text-white text-sm transition-colors"
          >
            {isSignUp ? 'Already have an account? Sign In' : "Don't have an account? Sign Up"}
          </button>
        </div>
      </div>
    </div>
  );
}