"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useStore, Player } from "@/store/useStore";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [selectedPlayerId, setSelectedPlayerId] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [fetchError, setFetchError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  
  const { setCurrentPlayer } = useStore();
  const router = useRouter();

  useEffect(() => {
    async function fetchPlayers() {
      const { data, error } = await supabase.from('players').select('*').order('name');
      if (error) {
        console.error("Supabase Error:", error);
        setFetchError(error.message);
      }
      if (data) {
        setPlayers(data);
      }
      setIsLoading(false);
    }
    fetchPlayers();
  }, []);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    
    const player = players.find(p => p.id === selectedPlayerId);
    
    if (!player) {
      setError("Please select a player to claim.");
      return;
    }
    
    if (player.pin !== pin) {
      setError("Incorrect PIN. Please try again.");
      return;
    }
    
    // Login successful
    setCurrentPlayer(player);
    router.push('/hub');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center gap-6">
        <div className="animate-pulse">
          <img
            src="/trip-logo.jpg"
            alt="MCXVI"
            className="w-56 h-56 object-contain opacity-80 mix-blend-luminosity"
          />
        </div>
        <p className="text-neon font-mono text-xs tracking-[0.4em] uppercase opacity-70 animate-pulse">Loading...</p>
      </div>
    );
  }

  if (fetchError) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6 text-slate-100">
        <div className="bg-red-500/10 border border-red-500/50 p-6 rounded-xl max-w-sm text-center space-y-4">
          <h2 className="text-red-400 font-bold">Database Error</h2>
          <p className="text-sm font-mono text-slate-300">{fetchError}</p>
          <p className="text-xs text-slate-400">Did you enable RLS by accident? Make sure RLS is disabled for the players table.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6 text-slate-100 selection:bg-neon selection:text-slate-900">
      
      <div className="w-full max-w-sm space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-700">
        
        <div className="text-center space-y-4">
          <div className="flex justify-center mb-2">
            <img
              src="/trip-logo.jpg"
              alt="MCXVI Trip Logo"
              className="w-44 h-44 object-contain opacity-90 mix-blend-luminosity drop-shadow-[0_0_30px_rgba(74,222,128,0.15)]"
            />
          </div>
          <h1 className="text-5xl font-black tracking-tighter text-white">
            MC<span className="text-neon">XVI</span>
          </h1>
          <p className="text-sm font-medium text-slate-400 uppercase tracking-widest">
            Mancation Sixteen
          </p>
        </div>

        <form onSubmit={handleLogin} className="bg-slate-800/80 border border-slate-700/50 backdrop-blur-xl p-8 rounded-3xl space-y-6 shadow-2xl">
          
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-widest pl-1">Claim Profile</label>
            <select 
              value={selectedPlayerId}
              onChange={(e) => setSelectedPlayerId(e.target.value)}
              className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-3 text-white font-medium focus:outline-none focus:border-neon focus:ring-1 focus:ring-neon transition-all appearance-none"
            >
              <option value="" disabled>Select your name...</option>
              {players.map(p => (
                <option key={p.id} value={p.id}>{p.name} {p.role === 'commissioner' ? '⭐' : ''}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-widest pl-1">Access PIN</label>
            <input 
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={4}
              placeholder="0000"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-3 text-white font-mono text-xl tracking-[0.5em] focus:outline-none focus:border-neon focus:ring-1 focus:ring-neon transition-all text-center"
            />
          </div>

          {error && (
            <p className="text-red-400 text-xs font-bold text-center bg-red-400/10 py-2 rounded-lg">{error}</p>
          )}

          <button 
            type="submit"
            className="w-full py-4 bg-neon hover:bg-neon-bright text-slate-900 font-black text-lg rounded-xl transition-all shadow-[0_0_15px_rgba(var(--color-neon),0.2)] hover:shadow-[0_0_25px_rgba(var(--color-neon),0.4)] mt-4"
          >
            ENTER
          </button>
        </form>

      </div>
    </div>
  );
}
