import React, { useState } from 'react';
import { 
  auth, 
  signOut, 
  signInAnonymously,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  User 
} from '../firebase';
import { CloudDb } from '../utils/cloudDb';
import { LocalDb } from '../utils/db';
import { 
  X, 
  LogIn, 
  LogOut, 
  Cloud, 
  RefreshCw, 
  CheckCircle2, 
  User as UserIcon, 
  ShieldCheck, 
  Mail, 
  Lock, 
  UserPlus, 
  KeyRound, 
  AlertTriangle,
  Info,
  Smartphone
} from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User | null;
  onDataSynced: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onDataSynced
}) => {
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  
  // Email/Password state: 'signin' | 'signup' | 'forgot'
  const [authMode, setAuthMode] = useState<'signin' | 'signup' | 'forgot'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  if (!isOpen) return null;

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setLoading(true);
    setStatusMessage(null);

    try {
      if (authMode === 'forgot') {
        await sendPasswordResetEmail(auth, email);
        setStatusMessage(`Password reset link sent to ${email}. Please check your email inbox!`);
        setTimeout(() => setAuthMode('signin'), 3500);
        return;
      }

      let userCred;
      if (authMode === 'signup') {
        setStatusMessage('Creating your cloud account...');
        userCred = await createUserWithEmailAndPassword(auth, email, password);
      } else {
        setStatusMessage('Signing into cloud account...');
        userCred = await signInWithEmailAndPassword(auth, email, password);
      }

      if (userCred.user) {
        setStatusMessage('Syncing data with Firebase Cloud...');
        const downloaded = await CloudDb.downloadCloudDataToLocal(userCred.user.uid);
        if (!downloaded) {
          await CloudDb.uploadLocalDataToCloud(userCred.user.uid);
        }
        onDataSynced();
        setStatusMessage(authMode === 'signup' ? 'Account created & synced across devices!' : 'Signed in & synced!');
        setTimeout(() => {
          onClose();
        }, 1200);
      }
    } catch (error: any) {
      console.error('Email auth error:', error);
      if (error.code === 'auth/operation-not-allowed' || error.message?.includes('operation-not-allowed')) {
        setStatusMessage('Email/Password provider is disabled in Firebase Console. Enable "Email/Password" in Firebase Auth -> Sign-in methods.');
      } else if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
        setStatusMessage('Invalid email or password. Please check your credentials or click "Create Account".');
      } else if (error.code === 'auth/email-already-in-use') {
        setStatusMessage('An account with this email already exists. Please switch to "Sign In".');
        setAuthMode('signin');
      } else if (error.code === 'auth/weak-password') {
        setStatusMessage('Password must be at least 6 characters long.');
      } else {
        setStatusMessage(`Authentication error: ${error.message || 'Please try again.'}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleAnonymousSignIn = async () => {
    setLoading(true);
    setStatusMessage('Setting up Guest Cloud Sync (This Device Only)...');
    try {
      const result = await signInAnonymously(auth);
      if (result.user) {
        await CloudDb.uploadLocalDataToCloud(result.user.uid);
        onDataSynced();
        setStatusMessage('Guest sync active on this device!');
        setTimeout(() => {
          onClose();
        }, 1200);
      }
    } catch (error: any) {
      console.error('Guest auth error:', error);
      if (error.code === 'auth/admin-restricted-operation' || error.message?.includes('admin-restricted-operation')) {
        setStatusMessage('Anonymous Auth is disabled in Firebase Console. Enable "Anonymous" under Sign-in providers.');
      } else {
        setStatusMessage(`Guest sign-in failed: ${error.message}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    setLoading(true);
    try {
      await signOut(auth);
      LocalDb.clearAllData();
      onDataSynced();
      setStatusMessage('Signed out successfully.');
      setTimeout(() => {
        onClose();
      }, 1000);
    } catch (error: any) {
      console.error('Sign out error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleForceUpload = async () => {
    if (!currentUser) return;
    setLoading(true);
    setStatusMessage('Uploading current local state to cloud...');
    try {
      await CloudDb.uploadLocalDataToCloud(currentUser.uid);
      setStatusMessage('Cloud backup updated successfully!');
      onDataSynced();
    } catch (e: any) {
      setStatusMessage('Upload failed. Please check internet connection.');
    } finally {
      setLoading(false);
    }
  };

  const handleForceDownload = async () => {
    if (!currentUser) return;
    setLoading(true);
    setStatusMessage('Pulling cloud backup to local device...');
    try {
      await CloudDb.downloadCloudDataToLocal(currentUser.uid);
      setStatusMessage('Local data updated from cloud!');
      onDataSynced();
    } catch (e: any) {
      setStatusMessage('Download failed. Please check internet connection.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-[#121212] border border-white/10 rounded-2xl w-full max-w-md p-6 shadow-2xl relative space-y-4 max-h-[92vh] overflow-y-auto">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-3.5">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Cloud size={20} />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-wide">Cloud Sync & Account</h2>
              <p className="text-[11px] text-gray-400 font-sans">Keep your budget backed up and accessible</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Status indicator */}
        {statusMessage && (
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center gap-2 text-xs text-emerald-300 animate-in fade-in">
            <CheckCircle2 size={16} className="shrink-0 text-emerald-400" />
            <span className="leading-relaxed">{statusMessage}</span>
          </div>
        )}

        {/* Current user card */}
        {currentUser ? (
          <div className="space-y-4">
            <div className="p-3.5 bg-white/5 border border-white/10 rounded-xl flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold shrink-0 mt-0.5">
                <UserIcon size={20} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-1">
                  <p className="text-xs font-bold text-white truncate">
                    {currentUser.isAnonymous ? 'Guest User (Single Device)' : currentUser.email}
                  </p>
                  <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                    currentUser.isAnonymous 
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                      : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  }`}>
                    {currentUser.isAnonymous ? 'Guest' : 'Full Account'}
                  </span>
                </div>
                
                <p className="text-[10px] text-gray-400 truncate font-mono mt-0.5">
                  ID: {currentUser.uid.substring(0, 16)}...
                </p>

                {currentUser.isAnonymous ? (
                  <div className="mt-2.5 p-2 bg-amber-500/10 border border-amber-500/20 rounded-lg text-[10.5px] text-amber-200/90 leading-relaxed flex items-start gap-1.5">
                    <AlertTriangle size={13} className="shrink-0 text-amber-400 mt-0.5" />
                    <span>
                      <strong>This device only:</strong> Your data is backed up to the cloud, but you cannot log into this data on another phone, PC, or tablet. To enable multi-device sync, sign out and create an Email account.
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 mt-2 text-[10px] text-emerald-400 font-medium">
                    <ShieldCheck size={13} className="shrink-0" /> 
                    <span>Multi-Device Sync Active (Accessible on any phone, PC, or tablet)</span>
                  </div>
                )}
              </div>
            </div>

            {/* Sync Controls */}
            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                onClick={handleForceUpload}
                disabled={loading}
                className="p-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs font-semibold text-gray-200 flex items-center justify-center gap-2 transition-colors disabled:opacity-50 cursor-pointer"
              >
                <Cloud size={14} className="text-emerald-400" />
                Upload Local Data
              </button>
              <button
                onClick={handleForceDownload}
                disabled={loading}
                className="p-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs font-semibold text-gray-200 flex items-center justify-center gap-2 transition-colors disabled:opacity-50 cursor-pointer"
              >
                <RefreshCw size={14} className="text-blue-400" />
                Pull Cloud Data
              </button>
            </div>

            <button
              onClick={handleSignOut}
              disabled={loading}
              className="w-full py-2.5 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 rounded-xl text-xs font-semibold text-rose-300 flex items-center justify-center gap-2 transition-colors disabled:opacity-50 cursor-pointer"
            >
              <LogOut size={14} />
              Sign Out
            </button>
          </div>
        ) : (
          <div className="space-y-4 pt-1">
            
            {/* Mode Switcher Tabs */}
            <div className="grid grid-cols-2 gap-1 bg-[#181818] p-1 rounded-xl border border-white/10">
              <button
                type="button"
                onClick={() => setAuthMode('signin')}
                className={`py-2 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  authMode === 'signin'
                    ? 'bg-emerald-600 text-white shadow-md'
                    : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                <LogIn size={13} />
                Sign In
              </button>
              <button
                type="button"
                onClick={() => setAuthMode('signup')}
                className={`py-2 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  authMode === 'signup'
                    ? 'bg-emerald-600 text-white shadow-md'
                    : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                <UserPlus size={13} />
                Create Account
              </button>
            </div>

            {/* Email Form */}
            <form onSubmit={handleEmailAuth} className="space-y-3 bg-[#181818] border border-white/10 rounded-xl p-4">
              <div className="flex items-center gap-2 pb-1 border-b border-white/5">
                <Info size={13} className="text-emerald-400 shrink-0" />
                <p className="text-[11px] text-gray-300">
                  {authMode === 'signin' && 'Sign in to access your budget across your phone, tablet, and PC.'}
                  {authMode === 'signup' && 'Create an account to sync your budget seamlessly on any device.'}
                  {authMode === 'forgot' && 'Enter your email to receive a password reset link.'}
                </p>
              </div>

              {/* Email Input */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Email Address</label>
                <div className="relative">
                  <Mail size={14} className="absolute left-3 top-2.5 text-gray-500" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    autoComplete="email"
                    className="w-full bg-[#111111] border border-white/10 rounded-lg py-2 pl-9 pr-3 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500/50"
                  />
                </div>
              </div>

              {/* Password Input */}
              {authMode !== 'forgot' && (
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Password</label>
                    {authMode === 'signin' && (
                      <button
                        type="button"
                        onClick={() => setAuthMode('forgot')}
                        className="text-[10px] text-emerald-400 hover:underline cursor-pointer"
                      >
                        Forgot password?
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <Lock size={14} className="absolute left-3 top-2.5 text-gray-500" />
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder={authMode === 'signup' ? 'At least 6 characters' : '••••••••'}
                      autoComplete={authMode === 'signup' ? 'new-password' : 'current-password'}
                      className="w-full bg-[#111111] border border-white/10 rounded-lg py-2 pl-9 pr-3 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500/50"
                    />
                  </div>
                  {authMode === 'signup' && (
                    <p className="text-[9.5px] text-gray-500">Must be at least 6 characters.</p>
                  )}
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition-all shadow-md flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer pt-2"
              >
                {authMode === 'signin' && <><LogIn size={13} /> Sign In & Sync Devices</>}
                {authMode === 'signup' && <><UserPlus size={13} /> Create Account & Sync</>}
                {authMode === 'forgot' && <><KeyRound size={13} /> Send Reset Link</>}
              </button>

              {authMode === 'forgot' && (
                <button
                  type="button"
                  onClick={() => setAuthMode('signin')}
                  className="w-full text-center text-[10.5px] text-gray-400 hover:text-white cursor-pointer pt-1"
                >
                  ← Back to Sign In
                </button>
              )}
            </form>

            {/* Divider */}
            <div className="relative flex items-center justify-center my-3">
              <div className="border-t border-white/10 w-full" />
              <span className="bg-[#121212] px-3 text-[10px] text-gray-500 uppercase font-mono tracking-wider">
                or single-device backup
              </span>
            </div>

            {/* Guest Sign-In with Explicit Warning */}
            <div className="p-3.5 bg-white/5 border border-white/10 rounded-xl space-y-2.5">
              <div className="flex items-start gap-2">
                <AlertTriangle size={15} className="text-amber-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h4 className="text-xs font-bold text-gray-200">Guest Sync (This Device Only)</h4>
                  <p className="text-[11px] text-amber-200/80 leading-relaxed">
                    <strong>Important:</strong> If you use Guest mode, your budget data is backed up to the cloud for <em>this device only</em>. Because there is no email or password attached, <strong>you will NOT be able to access this data on another phone, PC, or tablet</strong>.
                  </p>
                  <p className="text-[10px] text-gray-400">
                    To access your budget from multiple devices, create a free <strong>Email Account</strong> above instead.
                  </p>
                </div>
              </div>

              <button
                onClick={handleAnonymousSignIn}
                disabled={loading}
                className="w-full py-2 bg-white/5 hover:bg-white/10 border border-white/15 rounded-lg text-xs font-semibold text-gray-300 flex items-center justify-center gap-2 transition-colors disabled:opacity-50 cursor-pointer"
              >
                <Smartphone size={13} className="text-amber-400" />
                Continue as Guest (This Device Only)
              </button>
            </div>

          </div>
        )}

        <div className="pt-2 text-center border-t border-white/5">
          <p className="text-[10px] text-gray-500">
            Powered by Google Cloud Firebase Firestore & Auth
          </p>
        </div>

      </div>
    </div>
  );
};
