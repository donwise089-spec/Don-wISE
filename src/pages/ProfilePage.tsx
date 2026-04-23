import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { useAuth } from '../hooks/useAuth';
import { db } from '../lib/firebase';
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { ArrowLeft, User as UserIcon, Calendar, MessageSquare, ExternalLink, Shield } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function ProfilePage() {
  const { user, loading: authLoading, updateProfile } = useAuth();
  const [history, setHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  useEffect(() => {
    if (user) {
      fetchHistory();
    }
  }, [user]);

  const fetchHistory = async () => {
    if (!user) return;
    setLoadingHistory(true);
    try {
      const q = query(
        collection(db, 'rizz_history'),
        where('userId', '==', user.uid),
        orderBy('createdAt', 'desc'),
        limit(20)
      );
      const querySnapshot = await getDocs(q);
      const historyData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setHistory(historyData);
    } catch (error) {
      console.error("Error fetching history:", error);
    } finally {
      setLoadingHistory(false);
    }
  };

  if (authLoading) return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white">Loading...</div>;
  if (!user) return <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white gap-4">
    <p>Please log in to view your profile</p>
    <Link to="/" className="text-pink-500 hover:underline">Back to Home</Link>
  </div>;

  return (
    <div className="min-h-screen bg-slate-950 text-white font-sans selection:bg-pink-500/30 overflow-x-hidden p-4 sm:p-8">
      {/* Dynamic Background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-pink-500/5 blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-violet-500/5 blur-[120px]" />
      </div>

      <div className="relative z-10 max-w-4xl mx-auto">
        <header className="mb-12 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors group">
            <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
            <span className="text-sm font-black uppercase tracking-widest text-[10px]">Back to Console</span>
          </Link>
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-pink-500" />
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Security: Tier 1 Encrypted</span>
          </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* User Card */}
          <div className="md:col-span-1 space-y-6">
            <motion.div 
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="bg-slate-900/50 backdrop-blur-3xl border border-white/10 rounded-[2.5rem] p-8 text-center"
            >
              <div className="relative w-32 h-32 mx-auto mb-6">
                <img 
                  src={user.photoURL || ''} 
                  alt={user.displayName || 'User'} 
                  className="w-full h-full rounded-full border-4 border-slate-800 object-cover"
                />
                <div className="absolute bottom-2 right-2 w-6 h-6 bg-green-500 border-4 border-slate-950 rounded-full" />
              </div>
              <h2 className="text-2xl font-black italic">{user.displayName}</h2>
              <p className="text-slate-500 text-sm mb-6">{user.email}</p>
              
              <div className="grid grid-cols-2 gap-4 text-left">
                <div className="bg-slate-950/50 p-4 rounded-2xl border border-white/5">
                  <span className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">Generated</span>
                  <span className="text-xl font-black italic text-pink-500">{history.length}+</span>
                </div>
                <div className="bg-slate-950/50 p-4 rounded-2xl border border-white/5">
                  <span className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">Success</span>
                  <span className="text-xl font-black italic text-violet-500">92%</span>
                </div>
              </div>
            </motion.div>

            <div className="bg-white/5 p-6 rounded-3xl border border-white/10">
              <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400 mb-4">Account Analytics</h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500">Member Since</span>
                  <span className="font-bold">April 2024</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500">Peak Performance</span>
                  <span className="font-bold text-pink-500">10.0 Rizz</span>
                </div>
              </div>
            </div>
          </div>

          {/* History / "Profile Table" */}
          <div className="md:col-span-2">
            <motion.div 
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.1 }}
              className="bg-slate-900/30 backdrop-blur-xl border border-white/10 rounded-[2.5rem] overflow-hidden"
            >
              <div className="p-8 border-b border-white/10 flex items-center justify-between">
                <h3 className="text-xl font-black italic flex items-center gap-3">
                  <MessageSquare className="w-6 h-6 text-pink-500" />
                  Rizz History
                </h3>
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Last 20 Sessions</span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-white/5 bg-white/5 text-[10px] font-black uppercase tracking-widest text-slate-500">
                      <th className="px-8 py-4">Source Platform</th>
                      <th className="px-8 py-4">Date</th>
                      <th className="px-8 py-4">Status</th>
                      <th className="px-8 py-4"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {loadingHistory ? (
                      [...Array(3)].map((_, i) => (
                        <tr key={i} className="animate-pulse">
                          <td colSpan={4} className="px-8 py-6 h-16 bg-white/5"></td>
                        </tr>
                      ))
                    ) : history.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-8 py-16 text-center text-slate-600 font-bold italic">
                          No generated rizz found in your records.
                        </td>
                      </tr>
                    ) : (
                      history.map((record) => (
                        <tr key={record.id} className="group border-b border-white/5 hover:bg-white/5 transition-colors">
                          <td className="px-8 py-6">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-xl bg-slate-800 overflow-hidden border border-white/10">
                                <img src={record.mediaUrl} className="w-full h-full object-cover" alt="" />
                              </div>
                              <span className="font-bold italic uppercase tracking-wider text-sm">{record.platform || 'Unknown'}</span>
                            </div>
                          </td>
                          <td className="px-8 py-6 text-slate-400 text-xs font-medium">
                            {record.createdAt?.toDate().toLocaleDateString()}
                          </td>
                          <td className="px-8 py-6">
                            <span className="px-2 py-1 rounded bg-green-500/10 text-green-500 text-[10px] font-black uppercase tracking-widest border border-green-500/20">
                              Analyzed
                            </span>
                          </td>
                          <td className="px-8 py-6 text-right">
                             <button className="p-2 hover:bg-pink-500/20 rounded-full transition-colors opacity-0 group-hover:opacity-100">
                               <ExternalLink className="w-4 h-4 text-pink-500" />
                             </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}
