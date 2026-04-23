/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useRef, useEffect, ChangeEvent, DragEvent } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Upload, Sparkles, Copy, RefreshCw, X, AlertCircle, LogIn, LogOut, User as UserIcon, History, ExternalLink, ArrowLeft, ShieldCheck } from 'lucide-react';
import { analyzeConversationAndGenerateRizz, RizzLine } from './services/geminiService';
import { useAuth } from './hooks/useAuth';
import { db } from './lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { BrowserRouter, Routes, Route, useNavigate, Link } from 'react-router-dom';
import ProfilePage from './pages/ProfilePage';

interface FirestoreErrorInfo {
  error: string;
  operationType: 'create' | 'update' | 'delete' | 'list' | 'get' | 'write';
  path: string | null;
  authInfo: {
    userId: string;
    email: string;
    emailVerified: boolean;
    isAnonymous: boolean;
    providerInfo: { providerId: string; displayName: string; email: string; }[];
  }
}

function handleFirestoreError(error: any, operation: FirestoreErrorInfo['operationType'], path: string | null = null, user: any = null): never {
  if (error.code === 'permission-denied') {
    const errorInfo: FirestoreErrorInfo = {
      error: error.message,
      operationType: operation,
      path: path,
      authInfo: user ? {
        userId: user.uid,
        email: user.email || '',
        emailVerified: user.emailVerified,
        isAnonymous: user.isAnonymous,
        providerInfo: user.providerData.map((p: any) => ({
          providerId: p.providerId,
          displayName: p.displayName || '',
          email: p.email || '',
        })),
      } : {
        userId: 'unauthenticated',
        email: '',
        emailVerified: false,
        isAnonymous: true,
        providerInfo: [],
      }
    };
    throw new Error(JSON.stringify(errorInfo));
  }
  throw error;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/profile" element={<ProfilePage />} />
      </Routes>
    </BrowserRouter>
  );
}

function Dashboard() {
  const navigate = useNavigate();
  const { user, loading: authLoading, signInWithGoogle, logOut, updateProfile } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [platform, setPlatform] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<RizzLine[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [userProfilePhoto, setUserProfilePhoto] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const profileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (user?.photoURL) {
      setUserProfilePhoto(user.photoURL);
    }
  }, [user]);

  const handleProfilePhotoChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile && user) {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64String = reader.result as string;
        try {
          await updateProfile({ photoURL: base64String });
          setUserProfilePhoto(base64String);
        } catch (err: any) {
          handleFirestoreError(err, 'update', `users/${user.uid}`, user);
        }
      };
      reader.readAsDataURL(selectedFile);
    }
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      processFile(selectedFile);
    }
  };

  const processFile = (selectedFile: File) => {
    if (!selectedFile.type.startsWith('image/') && !selectedFile.type.startsWith('video/')) {
      setError('Please upload an image or video file.');
      return;
    }
    setFile(selectedFile);
    setError(null);
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreview(reader.result as string);
    };
    reader.readAsDataURL(selectedFile);
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile) {
      processFile(droppedFile);
    }
  };

  const generateRizz = async () => {
    if (!preview || !file) return;

    setLoading(true);
    setError(null);
    setResults([]);

    try {
      const rizzLines = await analyzeConversationAndGenerateRizz(preview, file.type, platform, videoEditPrompt);
      setResults(rizzLines);

      // Save to history if logged in
      if (user) {
        try {
          await addDoc(collection(db, 'rizz_history'), {
            userId: user.uid,
            platform: platform || 'Unknown',
            mediaUrl: preview, // Note: In a real app we'd upload to Storage first, but for this demo we'll store the base64 preview or a truncated version
            rizzLines: rizzLines,
            createdAt: serverTimestamp(),
          });
        } catch (err: any) {
          handleFirestoreError(err, 'create', 'rizz_history', user);
        }
      }
    } catch (err: any) {
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setFile(null);
    setPreview(null);
    setPlatform('');
    setResults([]);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const [videoEditPrompt, setVideoEditPrompt] = useState('');

  const VideoEditor = () => (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-slate-900/80 backdrop-blur-2xl border border-white/10 rounded-[2.5rem] p-6 mb-8"
    >
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xs font-black uppercase tracking-[0.2em] text-pink-500 flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-pink-500 animate-pulse" />
          Neural Editor v2.0
        </h3>
        <div className="flex gap-2">
          <span className="text-[9px] font-black uppercase tracking-widest text-slate-500 bg-white/5 px-2 py-1 rounded">Active Processing</span>
        </div>
      </div>

      <div className="space-y-6">
        {/* User Directives Input */}
        <div className="space-y-3">
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">AI Directives</label>
          <div className="relative">
            <textarea
              value={videoEditPrompt}
              onChange={(e) => setVideoEditPrompt(e.target.value)}
              placeholder="e.g., 'Focus on her hair flip at 0:04' or 'Her voice sounds sarcastic, call it out'..."
              className="w-full bg-slate-950/50 border border-white/10 rounded-2xl px-4 py-3 text-sm text-white placeholder:text-slate-700 focus:outline-none focus:ring-2 focus:ring-pink-500/50 transition-all resize-none h-24"
            />
            <div className="absolute bottom-3 right-3 text-[9px] font-black uppercase tracking-widest text-slate-600">
              Context Engine
            </div>
          </div>
        </div>

        {/* Mock Trimmer */}
        <div className="relative h-12 bg-slate-950 rounded-lg border border-white/5 overflow-hidden group">
          <div className="absolute inset-y-0 left-[20%] right-[30%] bg-pink-500/20 border-x border-pink-500 items-center justify-between flex px-2">
            <div className="w-1 h-4 bg-pink-500 rounded-full" />
            <div className="w-1 h-4 bg-pink-500 rounded-full" />
          </div>
          <div className="absolute inset-0 flex items-center justify-around opacity-20 pointer-events-none">
            {[...Array(20)].map((_, i) => (
              <div key={i} className={`w-0.5 ${i % 4 === 0 ? 'h-6' : 'h-3'} bg-white`} />
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <div className="flex justify-between text-[9px] font-black uppercase tracking-widest text-slate-500">
              <span>Dynamic Tracking</span>
              <span className="text-white">Active</span>
            </div>
            <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
              <div className="h-full w-[85%] bg-gradient-to-r from-pink-500 to-violet-500" />
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-[9px] font-black uppercase tracking-widest text-slate-500">
              <span>Tone Logic</span>
              <span className="text-white">Encrypted</span>
            </div>
            <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
              <div className="h-full w-full bg-gradient-to-r from-pink-500 to-violet-500" />
            </div>
          </div>
        </div>

        <div className="p-4 bg-pink-500/5 border border-pink-500/20 rounded-2xl">
          <p className="text-[10px] text-pink-200 font-medium leading-relaxed italic">
            "The AI will prioritize your directives during the generation phase to capture specific moments and emotional cues."
          </p>
        </div>
      </div>
    </motion.div>
  );

  const copyToClipboard = (text: string, id: number) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white font-sans selection:bg-pink-500/30 overflow-x-hidden">
      {/* Dynamic Background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-pink-500/10 blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-violet-500/10 blur-[120px]" />
      </div>

      <div className="relative z-10 container mx-auto px-4 py-6 max-w-4xl">
        {/* Auth Bar & Welcome Message */}
        <div className="flex flex-col gap-4 mb-8">
          <div className="flex justify-between items-center h-12">
            <div className="flex items-center gap-6">
              <div className="hidden sm:block">
                {!user && (
                  <motion.div 
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="text-[10px] font-black tracking-[0.3em] uppercase text-slate-500"
                  >
                    Status: Guest Mode / Restricted
                  </motion.div>
                )}
              </div>
              
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex items-center gap-2 px-3 py-1 bg-green-500/10 border border-green-500/20 rounded-full group cursor-default"
              >
                <ShieldCheck className="w-3 h-3 text-green-500 group-hover:animate-pulse" />
                <span className="text-[9px] font-black uppercase tracking-widest text-green-500/80">Neural Firewall: Active</span>
              </motion.div>
            </div>
            
            <div className="flex items-center gap-4">
              {authLoading ? (
                <div className="w-8 h-8 rounded-full bg-slate-800 animate-pulse" />
              ) : user ? (
                <motion.div 
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center gap-3 bg-white/5 backdrop-blur-2xl px-5 py-2 rounded-full border border-white/10 group/profile hover:border-pink-500/50 transition-all cursor-default"
                >
                  <input
                    type="file"
                    ref={profileInputRef}
                    onChange={handleProfilePhotoChange}
                    className="hidden"
                    accept="image/*"
                  />
                  <div 
                    className="relative cursor-pointer group/avatar"
                    onClick={() => profileInputRef.current?.click()}
                    title="Change Profile Picture"
                  >
                    <img 
                      src={userProfilePhoto || user.photoURL || ''} 
                      alt="" 
                      className="w-7 h-7 rounded-full border border-white/20 group-hover/avatar:border-pink-500 transition-colors" 
                    />
                    <div className="absolute inset-0 bg-black/40 rounded-full opacity-0 group-hover/avatar:opacity-100 flex items-center justify-center transition-opacity">
                      <Upload className="w-3 h-3 text-white" />
                    </div>
                    <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-500 border-2 border-slate-950 rounded-full" />
                  </div>
                  <div 
                    className="flex flex-col cursor-pointer hover:opacity-80 transition-opacity"
                    onClick={() => navigate('/profile')}
                  >
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 leading-none mb-1">Authenticated</span>
                    <span className="text-xs font-bold text-white leading-none underline decoration-pink-500/30 underline-offset-4">{user.displayName}</span>
                  </div>
                  <button 
                    onClick={() => logOut()}
                    className="ml-2 p-1.5 hover:bg-white/10 rounded-full transition-colors text-slate-500 hover:text-pink-500"
                    title="Log Out"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                  </button>
                </motion.div>
              ) : (
                <motion.button 
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => signInWithGoogle()}
                  className="flex items-center gap-2 bg-gradient-to-r from-pink-500 to-violet-600 text-white px-5 py-2.5 rounded-full font-black text-[10px] uppercase tracking-[0.2em] shadow-xl shadow-pink-500/20"
                >
                  <LogIn className="w-3.5 h-3.5" />
                  Access Full Intelligence
                </motion.button>
              )}
            </div>
          </div>

          {!user && !authLoading && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-pink-500 inline-block self-center sm:self-start px-3 py-1 rounded-sm rotate-[-1deg]"
            >
              <p className="text-[10px] font-black text-slate-950 uppercase tracking-widest">
                Sign in to save your successful plays and analysis history
              </p>
            </motion.div>
          )}
        </div>

        <header className="mb-20">
          <motion.div
            initial={{ y: 30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            className="relative"
          >
            <div className="absolute -top-12 -left-4 text-[10vw] font-black text-white/5 pointer-events-none select-none tracking-tight">
              GAME CHANGER
            </div>
            <h1 className="text-[18vw] sm:text-[120px] font-black leading-[0.82] tracking-[-0.04em] uppercase italic text-white mb-4">
              RIZZ<span className="text-transparent bg-clip-text bg-gradient-to-br from-pink-500 to-violet-600">KEY</span>
            </h1>
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="h-px bg-white/20 flex-grow" />
              <p className="text-slate-400 font-bold uppercase tracking-[0.3em] text-[10px] whitespace-nowrap">
                Next-Gen Screen Analysis Engine v2.4
              </p>
            </div>
          </motion.div>
        </header>

        <main className="max-w-2xl mx-auto">
          {/* Error Message */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="mb-6 overflow-hidden"
              >
                <div className="bg-red-500/10 border border-red-500/50 text-red-500 p-4 rounded-2xl flex items-center gap-3">
                  <AlertCircle className="w-5 h-5 flex-shrink-0" />
                  <p className="text-sm font-medium">{error}</p>
                  <button onClick={() => setError(null)} className="ml-auto hover:bg-white/10 p-1 rounded-full">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Upload Section */}
          <AnimatePresence mode="wait">
            {!preview ? (
              <motion.div
                key="dropzone"
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: -20, opacity: 0 }}
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className="group relative border-2 border-dashed border-slate-700/50 rounded-[2.5rem] p-16 text-center cursor-pointer hover:border-pink-500 transition-all bg-slate-900/30 backdrop-blur-3xl overflow-hidden shadow-2xl"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-pink-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  className="hidden"
                  accept="image/*,video/*"
                />
                <div className="relative">
                  <div className="w-20 h-20 bg-slate-800/50 rounded-3xl flex items-center justify-center mx-auto mb-6 group-hover:scale-110 group-hover:rotate-3 transition-transform">
                    <Upload className="w-10 h-10 text-slate-400 group-hover:text-pink-500 transition-colors" />
                  </div>
                  <h3 className="text-2xl font-bold mb-2">Drop media here</h3>
                  <p className="text-slate-500 font-medium">Screenshots or recordings</p>
                </div>
              </motion.div>
            ) : (results.length === 0 && !loading) ? (
              <motion.div
                key="preview"
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="space-y-6"
              >
                <div className="space-y-4">
                  <div className="relative aspect-[3/4] max-h-[500px] mx-auto rounded-[2rem] overflow-hidden border-4 border-slate-800 shadow-2xl group">
                    {file?.type.startsWith('video/') ? (
                      <video src={preview} className="w-full h-full object-cover" autoPlay muted loop controls />
                    ) : (
                      <img src={preview} className="w-full h-full object-cover" alt="Preview" />
                    )}
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <button 
                        onClick={(e) => { e.stopPropagation(); reset(); }}
                        className="bg-white/10 backdrop-blur-md p-4 rounded-full hover:bg-white/20 transition-all"
                      >
                        <RefreshCw className="w-8 h-8" />
                      </button>
                    </div>
                  </div>

                  <VideoEditor />

                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Username or App (e.g. Hinge, Instagram, Chat)"
                      value={platform}
                      onChange={(e) => setPlatform(e.target.value)}
                      className="w-full bg-slate-900/50 border-2 border-slate-800 rounded-2xl px-6 py-4 focus:border-pink-500 focus:outline-none transition-all font-medium text-white placeholder:text-slate-600"
                    />
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-700 tracking-widest uppercase">
                      Optional Context
                    </div>
                  </div>
                </div>
                <button
                  onClick={generateRizz}
                  className="w-full bg-gradient-to-r from-pink-500 to-violet-600 hover:from-pink-600 hover:to-violet-700 text-white font-black py-6 rounded-full uppercase tracking-[0.2em] transition-all transform active:scale-95 shadow-xl shadow-pink-500/20 text-lg flex items-center justify-center gap-2 group"
                >
                  <Sparkles className="w-6 h-6 group-hover:rotate-12 transition-transform" />
                  Generate Rizz
                </button>
              </motion.div>
            ) : null}
          </AnimatePresence>

          {/* Loading State */}
          <AnimatePresence>
            {loading && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="mt-12 text-center"
              >
                <div className="relative inline-block w-16 h-16 mb-6">
                  <div className="absolute inset-0 border-4 border-pink-500/20 rounded-full" />
                  <div className="absolute inset-0 border-4 border-pink-500 border-t-transparent rounded-full animate-spin" />
                </div>
                <p className="text-xl font-bold text-slate-300 animate-pulse">Analyzing the vibe...</p>
                <p className="text-sm text-slate-500 mt-2">Checking compatibility vectors</p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Results Section */}
          <AnimatePresence>
            {results.length > 0 && (
              <motion.div
                initial={{ y: 40, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                className="mt-12 space-y-6"
              >
                <div className="flex items-center justify-between px-2">
                  <h2 className="text-xl font-black tracking-[0.2em] flex items-center gap-3 italic uppercase text-pink-500">
                    <div className="w-8 h-px bg-pink-500" />
                    AI Insights
                  </h2>
                </div>

                <div className="space-y-4">
                  {results.map((item, index) => (
                    <motion.div
                      key={index}
                      initial={{ x: -20, opacity: 0 }}
                      animate={{ x: 0, opacity: 1 }}
                      transition={{ delay: index * 0.1 }}
                      className="group relative bg-slate-900/50 border border-white/5 backdrop-blur-xl p-8 rounded-[2rem] hover:border-pink-500/50 transition-all hover:bg-slate-900/70 shadow-lg"
                    >
                      <div className="flex justify-between items-start mb-4">
                        <span className="text-xs font-black uppercase tracking-[0.2em] px-3 py-1 bg-pink-500/10 text-pink-500 rounded-full border border-pink-500/20">
                          {item.type}
                        </span>
                        <button 
                          onClick={() => copyToClipboard(item.text, index)}
                          className="flex items-center gap-1.5 text-slate-500 hover:text-white transition-colors text-xs font-bold uppercase tracking-wider"
                        >
                          {copiedId === index ? <Sparkles className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                          {copiedId === index ? 'Copied' : 'Copy'}
                        </button>
                      </div>
                      <p className="text-xl font-medium leading-relaxed italic text-white/90">
                        "{item.text}"
                      </p>
                    </motion.div>
                  ))}
                </div>

                <button
                  onClick={reset}
                  className="w-full py-6 text-slate-500 hover:text-pink-500 transition-all text-sm font-black uppercase tracking-[0.2em] hover:tracking-[0.3em] flex items-center justify-center gap-2"
                >
                  <RefreshCw className="w-4 h-4" />
                  Try another screen
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </main>

        <footer className="mt-24 text-center pb-12">
          {user && (
            <div className="mb-12 max-w-lg mx-auto">
              <div className="flex items-center justify-between mb-4 px-2">
                <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Recent Activity</h3>
                <Link to="/profile" className="text-[10px] font-black uppercase tracking-widest text-pink-500 hover:underline flex items-center gap-1">
                  Full History <ExternalLink className="w-2.5 h-2.5" />
                </Link>
              </div>
              <div className="bg-slate-900/30 border border-white/5 rounded-2xl overflow-hidden backdrop-blur-sm">
                <div className="p-4 flex items-center gap-4 hover:bg-white/5 transition-colors cursor-pointer" onClick={() => navigate('/profile')}>
                   <div className="w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center">
                     <History className="w-5 h-5 text-slate-600" />
                   </div>
                   <div className="text-left flex-grow">
                     <p className="text-xs font-bold uppercase tracking-wider text-slate-300">View your activity profile</p>
                     <p className="text-[10px] text-slate-500 font-medium">Access all generated sessions and analytics</p>
                   </div>
                   <Link to="/profile" className="p-2 bg-pink-500/10 rounded-full text-pink-500">
                     <ArrowLeft className="w-3 h-3 rotate-180" />
                   </Link>
                </div>
              </div>
            </div>
          )}
          <p className="text-slate-600 text-[10px] tracking-[0.3em] uppercase font-bold leading-loose">
            Use your Rizz responsibly.<br />
            Powered by RizzKey AI Engines
          </p>
        </footer>
      </div>
    </div>
  );
}
