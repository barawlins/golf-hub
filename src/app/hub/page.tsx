"use client";

import { useEffect, useState } from "react";
import { useStore, Player } from "@/store/useStore";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { COURSES, getHolesForTee } from "@/lib/courseData";
import { calculateLeaderboard, TeamStanding } from "@/lib/scoringEngine";

function boostColor(hex: string) {
  if (!hex) return '#ffffff';
  hex = hex.replace('#', '');
  if (hex.length === 3) hex = hex.split('').map(c => c+c).join('');
  let r = parseInt(hex.substring(0, 2), 16);
  let g = parseInt(hex.substring(2, 4), 16);
  let b = parseInt(hex.substring(4, 6), 16);
  
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  
  if (brightness < 160) {
     const boost = 160 - brightness;
     r = Math.min(255, Math.floor(r + boost));
     g = Math.min(255, Math.floor(g + boost));
     b = Math.min(255, Math.floor(b + boost));
  }
  
  return `#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${b.toString(16).padStart(2,'0')}`;
}

export default function HubPage() {
  const { currentPlayer, setCurrentPlayer, logout } = useStore();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"leaderboard" | "scorecard" | "admin" | "rosters">("leaderboard");

  // Leaderboard State
  const [standings, setStandings] = useState<TeamStanding[]>([]);
  const [matchResults, setMatchResults] = useState<any[]>([]);

  // Admin Panel State
  const [teamName, setTeamName] = useState("");
  const [teamColor, setTeamColor] = useState("#4ade80");
  const [teamLogo, setTeamLogo] = useState("");
  const [undraftedPlayers, setUndraftedPlayers] = useState<Player[]>([]);
  const [myRoster, setMyRoster] = useState<Player[]>([]);
  const [allPlayers, setAllPlayers] = useState<Player[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [completedMatches, setCompletedMatches] = useState<any[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const [expandedMatchId, setExpandedMatchId] = useState<string | null>(null);

  // Matchup Creator State
  const [matchFormat, setMatchFormat] = useState<'2v1' | 'nines'>('nines');
  const [matchCourse, setMatchCourse] = useState<string>(COURSES[0].id);
  const [matchTee, setMatchTee] = useState<string>(COURSES[0].tees[0].id);
  const [matchPointValue, setMatchPointValue] = useState<number>(2);
  const [ninesPoints, setNinesPoints] = useState({ first: 2, second: 1, third: 0 });
  const [selectedMatchPlayers, setSelectedMatchPlayers] = useState<string[]>(["", "", ""]);

  // Scorecard State
  const [activeMatch, setActiveMatch] = useState<any>(null);
  const [matchParticipants, setMatchParticipants] = useState<any[]>([]);
  const [currentHole, setCurrentHole] = useState(1);
  const [playerStrokes, setPlayerStrokes] = useState<Record<string, number | ''>>({});
  const [isSubmittingScore, setIsSubmittingScore] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (isMounted && !currentPlayer) {
      router.push("/");
    }
  }, [isMounted, currentPlayer, router]);

  useEffect(() => {
    async function loadAdminData() {
      if (currentPlayer?.role !== 'commissioner' || !currentPlayer.team_id) return;
      
      const { data: teamData } = await supabase.from('teams').select('*').eq('id', currentPlayer.team_id).single();
      if (teamData) {
        setTeamName(teamData.name);
        setTeamColor(teamData.color_hex);
        setTeamLogo(teamData.logo_url || "");
      }

      // Fetch completed matches
      const { data: compMatches } = await supabase.from('matches').select('id, format, status').eq('status', 'completed');
      setCompletedMatches(compMatches || []);

      fetchPlayerPools();
    }
    
    async function fetchMyMatch() {
      if (!currentPlayer) return;
      // Get the match participant row for the current player
      const { data: participant } = await supabase
        .from('match_participants')
        .select('match_id, matches(*)')
        .eq('player_id', currentPlayer.id)
        .eq('matches.status', 'in_progress')
        .single();
        
      if (participant && participant.matches) {
        const matchData = participant.matches as any;
        setActiveMatch(matchData);

        // Fetch all participants in this match
        const { data: mParts } = await supabase
          .from('match_participants')
          .select('player_id, players(name, photo_url), team_id, teams(color_hex)')
          .eq('match_id', matchData.id);
        if (mParts) setMatchParticipants(mParts);

        fetchExistingScores(matchData.id, 1, mParts || []);
      }
    }

    async function fetchLeaderboardData() {
      const { data: teams } = await supabase.from('teams').select('*');
      
      // Fetch ALL matches to correctly calculate total standings
      const { data: activeMatches } = await supabase.from('matches').select('*').eq('status', 'in_progress');
      const { data: participants } = await supabase.from('match_participants').select('*, players(name)');
      const { data: scores } = await supabase.from('hole_scores').select('*');

      if (teams && activeMatches && participants && scores) {
        // Calculate LIVE standings by adding base total_points + live points
        const results = calculateLeaderboard(activeMatches, participants, scores, teams);
        
        // Add permanent base points
        results.standings.forEach(s => {
           const dbTeam = teams.find(t => t.id === s.id);
           s.points += (dbTeam?.total_points || 0);
        });
        
        // Re-sort
        results.standings.sort((a,b) => b.points - a.points);

        // Fetch all drafted players for Rosters tab (so it loads for non-commissioners too)
        const { data: playersList } = await supabase.from('players').select('*, teams(name)').not('team_id', 'is', null).order('name');
        if (playersList) {
          setAllPlayers(playersList);
        }

        setStandings(results.standings);
        setMatchResults(results.matchDetails);
      }
    }

    if (currentPlayer) {
      loadAdminData();
      fetchMyMatch();
      fetchLeaderboardData();

      // Set up Realtime Listener for Live Leaderboard
      const channel = supabase.channel('live-tournament')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'hole_scores' }, () => {
          fetchLeaderboardData();
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'matches' }, () => {
          fetchLeaderboardData();
          fetchMyMatch();
        })
        .subscribe();

      // Cleanup listener on unmount
      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [currentPlayer]);

  async function fetchExistingScores(matchId: string, hole: number, participants: any[]) {
    const { data } = await supabase
      .from('hole_scores')
      .select('player_id, strokes')
      .eq('match_id', matchId)
      .eq('hole_number', hole);
      
    const map: Record<string, number | ''> = {};
    participants.forEach(p => {
      const found = data?.find(s => s.player_id === p.player_id);
      map[p.player_id] = found ? found.strokes : '';
    });
    setPlayerStrokes(map);
  }

  const handleHoleChange = (direction: 'next' | 'prev') => {
    let newHole = currentHole;
    if (direction === 'next' && currentHole < 18) newHole++;
    if (direction === 'prev' && currentHole > 1) newHole--;
    
    setCurrentHole(newHole);
    if (activeMatch) {
      fetchExistingScores(activeMatch.id, newHole, matchParticipants);
    }
  };

  const updatePlayerStroke = (playerId: string, delta: number) => {
    setPlayerStrokes(prev => {
      const current = prev[playerId];
      if (current === '' && delta < 0) return prev;
      const newVal = current === '' ? 1 : Math.max(1, current + delta);
      return { ...prev, [playerId]: newVal };
    });
  };

  const submitAllScores = async () => {
    if (!currentPlayer || !activeMatch) return;
    
    // Check that at least one score is entered
    const entries = Object.entries(playerStrokes).filter(([, v]) => v !== '');
    if (entries.length === 0) {
      alert("Please enter at least one score before submitting.");
      return;
    }

    setIsSubmittingScore(true);
    
    const upserts = entries.map(([playerId, strokes]) => ({
      match_id: activeMatch.id,
      player_id: playerId,
      hole_number: currentHole,
      strokes: strokes
    }));

    const { error } = await supabase.from('hole_scores').upsert(
      upserts,
      { onConflict: 'match_id,player_id,hole_number' }
    );

    setIsSubmittingScore(false);
    
    if (error) {
      setToast("Network error. Scores not saved.");
      setTimeout(() => setToast(null), 3000);
    } else {
      setToast(`Hole ${currentHole} Saved!`);
      setTimeout(() => setToast(null), 2000);
      if (currentHole < 18) {
        handleHoleChange('next');
      }
    }
  };

  async function fetchPlayerPools() {
    if (!currentPlayer?.team_id) return;
    // Undrafted
    const { data: undrafted } = await supabase.from('players').select('*').is('team_id', null).order('name');
    if (undrafted) {
      setUndraftedPlayers(undrafted.filter((p: any) => !p.name.toLowerCase().includes('spectator')));
    }
    
    // My Roster
    const { data: roster } = await supabase.from('players').select('*').eq('team_id', currentPlayer.team_id).order('name');
    if (roster) setMyRoster(roster);

    // All Players for Matchup Creator
    const { data: allP } = await supabase.from('players').select('*, teams(name)').not('team_id', 'is', null).order('name');
    if (allP) setAllPlayers(allP);
  }

  // File Upload Helper
  const uploadImage = async (file: File, prefix: string) => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${prefix}-${Math.random()}.${fileExt}`;
    
    const { error } = await supabase.storage.from('images').upload(fileName, file);
    if (error) {
      alert("Error uploading image. Did you make the bucket public? " + error.message);
      return null;
    }
    const { data } = supabase.storage.from('images').getPublicUrl(fileName);
    return data.publicUrl;
  };

  const handleTeamLogoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    setIsUploading(true);
    const url = await uploadImage(e.target.files[0], 'team-logo');
    if (url) setTeamLogo(url);
    setIsUploading(false);
  };

  const handlePlayerPhotoChange = async (e: React.ChangeEvent<HTMLInputElement>, playerId: string) => {
    if (!e.target.files || e.target.files.length === 0) return;
    setIsUploading(true);
    const url = await uploadImage(e.target.files[0], `player-${playerId}`);
    if (url) {
      const { error: dbError } = await supabase.from('players').update({ photo_url: url }).eq('id', playerId);
      if (dbError) {
        alert("Photo uploaded, but failed to save to database: " + dbError.message);
      } else {
        fetchPlayerPools(); // Refresh to show new photo
      }
    }
    setIsUploading(false);
  };

  const handleSelfPhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!currentPlayer || !e.target.files || e.target.files.length === 0) return;
    setIsUploading(true);
    const url = await uploadImage(e.target.files[0], `player-${currentPlayer.id}`);
    if (url) {
      const { error: dbError } = await supabase.from('players').update({ photo_url: url }).eq('id', currentPlayer.id);
      if (dbError) {
        alert("Photo uploaded, but failed to save to database: " + dbError.message);
      } else {
        // Update local store so the header refreshes instantly
        setCurrentPlayer({ ...currentPlayer, photo_url: url });
        
        // Update the rosters view instantly without re-fetching
        setAllPlayers(prev => prev.map(p => p.id === currentPlayer.id ? { ...p, photo_url: url } : p));
        
        setToast("Profile photo updated!");
        setTimeout(() => setToast(null), 3000);
        
        if (currentPlayer.role === 'commissioner') {
          fetchPlayerPools();
        }
      }
    }
    setIsUploading(false);
  };

  const handleSaveStyling = async () => {
    if (!currentPlayer?.team_id) return;
    setIsSaving(true);
    await supabase.from('teams').update({
      name: teamName,
      color_hex: teamColor,
      logo_url: teamLogo || null
    }).eq('id', currentPlayer.team_id);
    setIsSaving(false);
    alert("Team styling saved successfully!");
  };

  const handleDraftPlayer = async (playerId: string) => {
    if (!currentPlayer?.team_id) return;
    await supabase.from('players').update({ team_id: currentPlayer.team_id }).eq('id', playerId);
    fetchPlayerPools();
  };

  const handleCreateMatch = async () => {
    if (selectedMatchPlayers.includes("")) {
      alert("Please select 3 players for the match.");
      return;
    }
    
    // Check if we need to enforce rules (like 1 from each team for Nines)
    // We'll trust the Commissioner for now to keep it simple, but we create the match.
    setIsSaving(true);
    
    // 1. Ensure an Active Round exists
    let { data: activeRound } = await supabase.from('rounds').select('id').eq('status', 'active').maybeSingle();
    if (!activeRound) {
      const { data: newRound } = await supabase.from('rounds').insert({ round_number: 1, status: 'active' }).select('id').single();
      activeRound = newRound;
    }

    if (!activeRound) {
      alert("Failed to create or find an active round.");
      setIsSaving(false); return;
    }

    // 2. Create the Match
    const { data: newMatch, error: matchError } = await supabase.from('matches').insert({
      round_id: activeRound.id,
      course_id: matchCourse,
      tee_id: matchTee,
      format: matchFormat,
      scoring_rule: matchFormat === 'nines' ? 'aggregate' : 'best_ball',
      point_value: matchFormat === '2v1' ? matchPointValue : null,
      points_1st: matchFormat === 'nines' ? ninesPoints.first : null,
      points_2nd: matchFormat === 'nines' ? ninesPoints.second : null,
      points_3rd: matchFormat === 'nines' ? ninesPoints.third : null,
      status: 'in_progress'
    }).select('id').single();

    if (matchError || !newMatch) {
      alert("Error creating match. Did you update the database format constraint? " + matchError?.message);
      setIsSaving(false); return;
    }

    // 3. Add Participants
    const participants = selectedMatchPlayers.map(pid => {
      const p = allPlayers.find(x => x.id === pid);
      if (!p) return null;
      return { match_id: newMatch.id, player_id: p.id, team_id: p.team_id };
    }).filter(Boolean);

    await supabase.from('match_participants').insert(participants);
    
    setIsSaving(false);
    alert(`${matchFormat.toUpperCase()} Match created successfully!`);
    setSelectedMatchPlayers(["", "", ""]); // reset form
  };

  const handleLogout = () => {
    logout();
    router.push("/");
  };

  const handleRevertMatch = async (matchId: string) => {
    if (!confirm("Are you sure you want to revert this match? This will subtract points and put it back in progress.")) return;
    setIsSaving(true);
    try {
      const { data: match } = await supabase.from('matches').select('*').eq('id', matchId).single();
      const { data: participants } = await supabase.from('match_participants').select('*, players(name)').eq('match_id', matchId);
      const { data: scores } = await supabase.from('hole_scores').select('*').eq('match_id', matchId);
      const { data: teams } = await supabase.from('teams').select('*');

      if (match && participants && scores && teams) {
        const results = calculateLeaderboard([match], participants, scores, teams);
        const matchResult = results.matchDetails[0];

        const deductPoints = async (teamId: string, pts: number) => {
          if (!teamId || pts === 0) return;
          const { data: t } = await supabase.from('teams').select('total_points').eq('id', teamId).single();
          await supabase.from('teams').update({ total_points: (t?.total_points || 0) - pts }).eq('id', teamId);
        };

        if (matchResult.format === 'nines') {
          const ranked = matchResult.participants.map((p: any) => ({
             tid: p.team_id,
             total: matchResult.ninesTotals[p.player_id]
          })).sort((a: any, b: any) => b.total - a.total);
          
          await Promise.all([
            deductPoints(ranked[0].tid, matchResult.match.points_1st || 0),
            deductPoints(ranked[1].tid, matchResult.match.points_2nd || 0),
            deductPoints(ranked[2].tid, matchResult.match.points_3rd || 0)
          ]);
        } else if (matchResult.format === '2v1') {
          const scoreA = matchResult.bestBallTotals[matchResult.teamA_id] || 0;
          const scoreB = matchResult.bestBallTotals[matchResult.teamB_id] || 0;
          const pVal = matchResult.match.point_value || 0;

          if (scoreA > scoreB) await deductPoints(matchResult.teamA_id, pVal);
          else if (scoreB > scoreA) await deductPoints(matchResult.teamB_id, pVal);
          else {
            await deductPoints(matchResult.teamA_id, pVal / 2);
            await deductPoints(matchResult.teamB_id, pVal / 2);
          }
        }

        // Revert status
        await supabase.from('matches').update({ status: 'in_progress' }).eq('id', matchId);
        await supabase.from('rounds').update({ status: 'active' }).eq('id', match.round_id);

        alert("Match reverted to Active!");
        window.location.reload();
      }
    } catch (e) {
      console.error(e);
      alert("Error reverting match.");
    }
    setIsSaving(false);
  };

  const handleCancelMatch = async (matchId: string) => {
    if (!confirm("Cancel this match? All scores will be permanently deleted.")) return;
    setIsSaving(true);
    try {
      // Delete all scores for this match
      await supabase.from('hole_scores').delete().eq('match_id', matchId);
      // Delete all participants
      await supabase.from('match_participants').delete().eq('match_id', matchId);
      // Delete the match itself
      await supabase.from('matches').delete().eq('id', matchId);
      
      alert("Match cancelled and deleted.");
      window.location.reload();
    } catch (e) {
      console.error(e);
      alert("Error cancelling match.");
    }
    setIsSaving(false);
  };

  const handleFinalizeMatch = async (matchId: string) => {
    if (!confirm("Are you sure you want to finalize this match and permanently award points?")) return;
    setIsSaving(true);
    
    try {
      const matchResult = matchResults.find(m => m.match.id === matchId);
      if (!matchResult) return;

      const awardPoints = async (teamId: string, pts: number) => {
        if (!teamId || pts === 0) return;
        const { data: t } = await supabase.from('teams').select('total_points').eq('id', teamId).single();
        await supabase.from('teams').update({ total_points: (t?.total_points || 0) + pts }).eq('id', teamId);
      };

      if (matchResult.format === 'nines') {
        const ranked = matchResult.participants.map((p: any) => ({
           tid: p.team_id,
           total: matchResult.ninesTotals[p.player_id]
        })).sort((a: any, b: any) => b.total - a.total);
        
        await Promise.all([
          awardPoints(ranked[0].tid, matchResult.match.points_1st || 0),
          awardPoints(ranked[1].tid, matchResult.match.points_2nd || 0),
          awardPoints(ranked[2].tid, matchResult.match.points_3rd || 0)
        ]);
      } else if (matchResult.format === '2v1') {
        const scoreA = matchResult.bestBallTotals[matchResult.teamA_id] || 0;
        const scoreB = matchResult.bestBallTotals[matchResult.teamB_id] || 0;
        const pVal = matchResult.match.point_value || 0;

        if (scoreA > scoreB) await awardPoints(matchResult.teamA_id, pVal);
        else if (scoreB > scoreA) await awardPoints(matchResult.teamB_id, pVal);
        else {
          await awardPoints(matchResult.teamA_id, pVal / 2);
          await awardPoints(matchResult.teamB_id, pVal / 2);
        }
      }

      await supabase.from('matches').update({ status: 'completed' }).eq('id', matchId);

      // Check auto-advance
      const { data: activeRound } = await supabase.from('rounds').select('*').eq('status', 'active').maybeSingle();
      if (activeRound) {
        const { data: roundMatches } = await supabase.from('matches').select('status').eq('round_id', activeRound.id);
        const completedCount = roundMatches?.filter(m => m.status === 'completed').length || 0;
        const inProgressCount = roundMatches?.filter(m => m.status === 'in_progress').length || 0;

        if (completedCount >= 3 && inProgressCount === 0) {
          await supabase.from('rounds').update({ status: 'completed' }).eq('id', activeRound.id);
          await supabase.from('rounds').update({ status: 'active' }).eq('round_number', activeRound.round_number + 1);
          alert("All matches finalized! Advancing tournament to the next round.");
          window.location.reload();
        } else {
          window.location.reload();
        }
      } else {
        window.location.reload();
      }
    } catch (e) {
      console.error(e);
      alert("Error finalizing match.");
    }
    setIsSaving(false);
  };

  if (!isMounted || !currentPlayer) return null;

  // Determine active course data
  const activeCourse = activeMatch ? COURSES.find(c => c.id === activeMatch.course_id) || COURSES[0] : null;
  const activeHoles = activeMatch ? getHolesForTee(activeMatch.course_id, activeMatch.tee_id) : activeCourse?.holes || {};
  const currentHoleData = activeCourse ? (activeHoles[currentHole] || { par: 4, yardage: 0 }) : { par: 4, yardage: 0 };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 font-sans selection:bg-neon selection:text-slate-900">
      
      {toast && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 bg-slate-800 border border-neon/50 text-neon px-6 py-3 rounded-full font-bold shadow-[0_0_20px_rgba(var(--color-neon),0.3)] z-50 animate-in fade-in slide-in-from-top-4 duration-300 flex items-center gap-3">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
          {toast}
        </div>
      )}

      <header className="px-6 py-8 border-b border-slate-800 bg-slate-900/80 backdrop-blur-md sticky top-0 z-50">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-black tracking-tighter text-white">
              MC<span className="text-neon">XVI</span>
            </h1>
            <div className="mt-3 flex items-center gap-3">
              {/* Profile Photo Uploader */}
              <label className="relative group cursor-pointer w-10 h-10 rounded-full overflow-hidden border-2 border-slate-700 hover:border-neon transition-colors flex-shrink-0">
                {currentPlayer.photo_url ? (
                  <img src={currentPlayer.photo_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-slate-800 flex items-center justify-center text-xs font-bold text-slate-400">
                    {currentPlayer.name.charAt(0)}
                  </div>
                )}
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                  <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <input type="file" accept="image/*" onChange={handleSelfPhotoChange} className="hidden" disabled={isUploading} />
              </label>

              <div>
                <span className="text-sm font-black text-slate-200 block leading-tight">{currentPlayer.name}</span>
                {currentPlayer.role === 'commissioner' ? (
                  <span className="bg-yellow-500/10 text-yellow-500 text-[9px] uppercase font-bold px-1.5 py-0.5 rounded border border-yellow-500/20 inline-block mt-0.5">
                    Admin
                  </span>
                ) : (
                  <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block mt-0.5">
                    Player
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="text-right flex flex-col items-end gap-3">
            <span className="inline-block px-3 py-1 bg-neon/10 text-neon border border-neon/30 rounded-full text-xs font-bold tracking-wide uppercase shadow-[0_0_15px_rgba(var(--color-neon),0.2)]">
              Live
            </span>
            <button onClick={handleLogout} className="text-xs text-slate-500 hover:text-slate-300 underline underline-offset-4 font-medium transition-colors">
              Sign Out
            </button>
          </div>
        </div>
      </header>

      <main className="p-6 max-w-md mx-auto w-full space-y-8 pb-24">
        
        <div className="flex bg-slate-800 p-1.5 rounded-xl shadow-[inset_0_2px_4px_rgba(0,0,0,0.3)] overflow-x-auto no-scrollbar gap-1 relative z-20">
          <button 
            onClick={() => setActiveTab("leaderboard")}
            className={`flex-1 min-w-[90px] py-3 px-2 text-[10px] sm:text-xs font-black rounded-lg transition-all uppercase tracking-widest whitespace-nowrap ${activeTab === "leaderboard" ? "bg-slate-700 text-white shadow-md border border-slate-600/50" : "text-slate-400 hover:text-slate-200 hover:bg-slate-700/30"}`}
          >
            Standings
          </button>
          <button 
            onClick={() => setActiveTab("scorecard")}
            className={`flex-1 min-w-[90px] py-3 px-2 text-[10px] sm:text-xs font-black rounded-lg transition-all uppercase tracking-widest whitespace-nowrap ${activeTab === "scorecard" ? "bg-slate-700 text-neon shadow-md border border-neon/20" : "text-slate-400 hover:text-slate-200 hover:bg-slate-700/30"}`}
          >
            Scorecard
          </button>
          <button 
            onClick={() => setActiveTab("rosters")}
            className={`flex-1 min-w-[90px] py-3 px-2 text-[10px] sm:text-xs font-black rounded-lg transition-all uppercase tracking-widest whitespace-nowrap ${activeTab === "rosters" ? "bg-slate-700 text-blue-400 shadow-md border border-blue-400/20" : "text-slate-400 hover:text-slate-200 hover:bg-slate-700/30"}`}
          >
            Rosters
          </button>
          {currentPlayer.role === 'commissioner' && (
            <button 
              onClick={() => setActiveTab("admin")}
              className={`flex-1 min-w-[90px] py-3 px-2 text-[10px] sm:text-xs font-black rounded-lg transition-all uppercase tracking-widest whitespace-nowrap ${activeTab === "admin" ? "bg-slate-700 text-yellow-500 shadow-md border border-yellow-500/20" : "text-slate-400 hover:text-slate-200 hover:bg-slate-700/30"}`}
            >
              Admin
            </button>
          )}
        </div>

        {activeTab === "leaderboard" && (
          <section className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Team Leaderboard */}
            <div className="bg-slate-800 border border-slate-700 rounded-2xl p-5 space-y-4">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <span className="w-2 h-6 bg-neon rounded-full inline-block"></span>
                Team Standings
              </h2>
              <div className="space-y-2">
                {standings.length === 0 ? (
                  <div className="text-center p-4 text-slate-500 text-sm font-medium">Waiting for teams...</div>
                ) : (
                  standings.map((team, index) => (
                    <div key={team.id} className="flex justify-between items-center p-3 bg-slate-900/50 rounded-xl border border-slate-800">
                      <div className="flex items-center gap-3">
                        <span className="text-xl font-black text-slate-500 w-6">{index + 1}</span>
                        {team.logo ? (
                          <img src={team.logo} alt={team.name} className="w-8 h-8 rounded-full object-cover border-2 shadow-sm" style={{ borderColor: team.color }} />
                        ) : (
                          <div className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs text-slate-900" style={{ backgroundColor: team.color }}>
                            {team.name.substring(0, 2).toUpperCase()}
                          </div>
                        )}
                        <p className="font-bold text-lg" style={{ color: boostColor(team.color) }}>{team.name}</p>
                      </div>
                      <span className="text-xl font-black text-neon">{team.points} <span className="text-[10px] text-slate-500 uppercase tracking-widest">PTS</span></span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Active Matches Summaries */}
            {matchResults.length > 0 && (
              <div className="space-y-4 mt-8">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <span className="w-2 h-6 bg-yellow-500 rounded-full inline-block"></span>
                  Active Matches
                </h2>
                {matchResults.map(m => (
                  <div key={m.match.id} className="bg-slate-800 border border-slate-700 rounded-2xl p-4 relative overflow-hidden">
                    {/* Leading Team Watermark */}
                    {m.leaderLogo && !m.leaderText.includes('Tied') && !m.leaderText.includes('Square') && (
                      <div 
                        className="absolute right-[-10%] top-[-10%] w-48 h-48 opacity-[0.08] pointer-events-none"
                        style={{ backgroundImage: `url(${m.leaderLogo})`, backgroundSize: 'contain', backgroundRepeat: 'no-repeat', backgroundPosition: 'center' }}
                      />
                    )}
                    
                    <div className="flex justify-between items-center border-b border-slate-700 pb-2 mb-3 relative z-10">
                      <span className="text-xs text-slate-400 font-bold uppercase">{m.format === 'nines' ? 'Nines (5-3-1)' : '2v1 Best Ball'}</span>
                      <span className="text-xs font-black uppercase tracking-wide" style={{ color: boostColor(m.leaderColor) }}>{m.leaderText}</span>
                    </div>
                    <div className="space-y-2 relative z-10">
                      {m.participants.map((p: any) => (
                        <div key={p.player_id} className="flex justify-between text-sm items-center">
                          <div className="flex items-center gap-2">
                            {p.teamLogo ? (
                              <img src={p.teamLogo} alt="" className="w-5 h-5 rounded-full object-cover border shadow-sm" style={{ borderColor: p.teamColor }} />
                            ) : (
                              <div className="w-5 h-5 rounded-full" style={{ backgroundColor: p.teamColor }}></div>
                            )}
                            <span className="font-bold text-base" style={{ color: p.teamColor }}>{p.players?.name || 'Unknown'}</span>
                          </div>
                          <span className="text-white font-black bg-slate-900 px-3 py-1 rounded-lg border border-slate-700">
                            {m.format === 'nines' ? `${m.ninesTotals[p.player_id]} pts` : (() => {
                              const myHoles = m.bestBallTotals[p.team_id] ?? 0;
                              const oppTeamId = p.team_id === m.teamA_id ? m.teamB_id : m.teamA_id;
                              const oppHoles = m.bestBallTotals[oppTeamId] ?? 0;
                              const diff = myHoles - oppHoles;
                              if (diff > 0) return `${diff} UP`;
                              if (diff < 0) return `${Math.abs(diff)} DN`;
                              return 'AS';
                            })()}
                          </span>
                        </div>
                      ))}
                    </div>

                    <button 
                      onClick={() => setExpandedMatchId(expandedMatchId === m.match.id ? null : m.match.id)}
                      className="w-full mt-4 py-2.5 bg-slate-700/30 hover:bg-slate-700/60 text-xs font-bold text-slate-300 rounded-xl transition-all border border-slate-700/50 uppercase tracking-widest relative z-10"
                    >
                      {expandedMatchId === m.match.id ? 'Hide Full Scorecard' : 'View Full Scorecard'}
                    </button>

                    {expandedMatchId === m.match.id && (
                      <div className="mt-4 overflow-x-auto rounded-xl border border-slate-700 relative z-10 pb-2">
                        <table className="w-full text-xs text-center border-collapse min-w-[600px]">
                          <thead>
                            <tr className="bg-slate-900 text-slate-400 border-b border-slate-700">
                              <th className="p-3 text-left sticky left-0 bg-slate-900 border-r border-slate-700 z-20 shadow-[2px_0_5px_rgba(0,0,0,0.5)]">Hole</th>
                              {[...Array(18)].map((_, i) => (
                                <th key={i} className="p-3 border-slate-800 border-r text-slate-500 font-bold">{i + 1}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {/* Course Par Row */}
                            <tr className="bg-slate-800/80 text-slate-500 border-b border-slate-700">
                              <td className="p-2 text-left font-medium sticky left-0 bg-slate-800/80 border-r border-slate-700 z-20 shadow-[2px_0_5px_rgba(0,0,0,0.5)]">Par</td>
                              {[...Array(18)].map((_, i) => {
                                const teeHoles = getHolesForTee(m.match.course_id, m.match.tee_id);
                                return <td key={i} className="p-2 border-slate-700/50 border-r">{teeHoles[i + 1]?.par ?? '-'}</td>;
                              })}
                            </tr>
                            {/* Player Rows */}
                            {m.participants.map((p: any) => (
                              <tr key={p.player_id} className="border-b border-slate-700/50 bg-slate-800 hover:bg-slate-700/30 transition-colors">
                                <td className="p-2 pl-3 text-left font-bold sticky left-0 bg-slate-800 border-r border-slate-700 whitespace-nowrap z-20 shadow-[2px_0_5px_rgba(0,0,0,0.5)]">
                                  <div className="flex items-center gap-2">
                                    {p.teamLogo ? (
                                      <img src={p.teamLogo} alt="" className="w-4 h-4 rounded-full object-cover border" style={{ borderColor: p.teamColor }} />
                                    ) : (
                                      <div className="w-4 h-4 rounded-full" style={{ backgroundColor: p.teamColor }}></div>
                                    )}
                                    <span style={{ color: boostColor(p.teamColor) }}>{p.players?.name?.split(' ')[0] || 'Unknown'}</span>
                                  </div>
                                </td>
                                {[...Array(18)].map((_, i) => {
                                  const scoreObj = m.rawScores?.find((s: any) => s.player_id === p.player_id && s.hole_number === i + 1);
                                  const teeHoles = getHolesForTee(m.match.course_id, m.match.tee_id);
                                  const par = teeHoles[i + 1]?.par || 4;
                                  let textStyle = "text-slate-300 font-medium";
                                  let bgStyle = "w-6 h-6 flex items-center justify-center mx-auto";
                                  
                                  if (scoreObj) {
                                    if (scoreObj.strokes < par) { 
                                       textStyle = "text-slate-100 font-bold";
                                       bgStyle = "border border-slate-400 rounded-full w-6 h-6 flex items-center justify-center mx-auto";
                                    } else if (scoreObj.strokes > par) { 
                                       textStyle = "text-slate-100 font-bold";
                                       bgStyle = "border border-slate-500 rounded-md w-6 h-6 flex items-center justify-center mx-auto";
                                    }
                                  }
                                  
                                  const isWinner = m.holeWinners?.[i + 1]?.includes(p.player_id);
                                  
                                  return (
                                    <td key={i} className={`p-1 border-slate-700/50 border-r ${isWinner ? 'bg-neon/10 shadow-[inset_0_0_8px_rgba(var(--color-neon),0.2)]' : ''}`}>
                                      <div className={bgStyle}>
                                        <span className={isWinner ? 'text-neon font-black drop-shadow-md' : textStyle}>
                                          {scoreObj ? scoreObj.strokes : '-'}
                                        </span>
                                      </div>
                                    </td>
                                  );
                                })}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {currentPlayer.role === 'commissioner' && m.isMatchComplete && (
                      <div className="mt-4 pt-3 border-t border-slate-700 text-center animate-in fade-in zoom-in duration-300">
                         <button 
                           onClick={() => handleFinalizeMatch(m.match.id)}
                           disabled={isSaving}
                           className="bg-yellow-500 hover:bg-yellow-400 text-yellow-950 text-xs font-black uppercase tracking-widest py-3 px-4 rounded-xl w-full transition-all disabled:opacity-50 shadow-[0_0_20px_rgba(234,179,8,0.3)] hover:shadow-[0_0_25px_rgba(234,179,8,0.5)] hover:-translate-y-0.5"
                         >
                           {isSaving ? 'Finalizing...' : '18 Holes Complete • Finalize Match'}
                         </button>
                      </div>
                    )}

                    {currentPlayer.role === 'commissioner' && (
                      <div className="mt-3 text-center">
                        <button 
                          onClick={() => handleCancelMatch(m.match.id)}
                          disabled={isSaving}
                          className="text-[10px] text-red-500/60 hover:text-red-500 font-bold uppercase tracking-widest transition-colors disabled:opacity-50"
                        >
                          Cancel Match
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {activeTab === "scorecard" && (
          <section className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {!activeMatch ? (
              <div className="bg-slate-800 border border-slate-700 rounded-2xl p-8 text-center space-y-4">
                <div className="w-16 h-16 bg-slate-700 rounded-full mx-auto flex items-center justify-center">
                  <span className="text-2xl">⛳</span>
                </div>
                <h2 className="text-xl font-bold text-white">No Active Match</h2>
                <p className="text-sm text-slate-400">You are not currently assigned to a match that is in progress. Check back once the Commissioner starts the round!</p>
              </div>
            ) : (
              <>
                <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                  <button onClick={() => handleHoleChange('prev')} disabled={currentHole === 1} className="text-slate-500 hover:text-white disabled:opacity-30">◀ Prev</button>
                  <div className="text-center">
                    <h2 className="text-xl font-bold text-white">
                      Hole <span className="text-neon text-3xl ml-1">{currentHole}</span>
                    </h2>
                    <span className="text-xs text-slate-400 font-mono mb-1">
                      Par {currentHoleData.par} • {currentHoleData.yardage}y
                    </span>
                  </div>
                  <button onClick={() => handleHoleChange('next')} disabled={currentHole === 18} className="text-slate-500 hover:text-white disabled:opacity-30">Next ▶</button>
                </div>

                <div className="bg-slate-800 border border-slate-700 rounded-2xl p-5 space-y-4">
                  <h3 className="font-bold text-sm text-slate-400 uppercase tracking-widest">Enter Scores</h3>
                  
                  {matchParticipants.map(p => {
                    const name = p.players?.name || 'Unknown';
                    const firstName = name.split(' ')[0];
                    const teamColor = p.teams?.color_hex || '#ffffff';
                    const val = playerStrokes[p.player_id];
                    const isMe = p.player_id === currentPlayer.id;
                    
                    return (
                      <div key={p.player_id} className={`flex items-center justify-between p-3 rounded-xl border transition-colors ${
                        isMe ? 'bg-slate-700/40 border-neon/20' : 'bg-slate-900/50 border-slate-700/50'
                      }`}>
                        <div className="flex items-center gap-2 min-w-0">
                          {p.players?.photo_url ? (
                            <img src={p.players.photo_url} alt="" className="w-8 h-8 rounded-full object-cover border-2 flex-shrink-0" style={{ borderColor: teamColor }} />
                          ) : (
                            <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-slate-900 flex-shrink-0" style={{ backgroundColor: boostColor(teamColor) }}>
                              {name.charAt(0)}
                            </div>
                          )}
                          <div className="min-w-0">
                            <span className="text-sm font-black block truncate" style={{ color: boostColor(teamColor) }}>{firstName}</span>
                            {isMe && <span className="text-[9px] text-neon font-bold uppercase">You</span>}
                          </div>
                        </div>
                        <input
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          value={val === '' ? '' : val}
                          placeholder="-"
                          onChange={(e) => {
                            const raw = e.target.value.replace(/[^0-9]/g, '');
                            setPlayerStrokes(prev => ({
                              ...prev,
                              [p.player_id]: raw === '' ? '' : Math.max(1, parseInt(raw))
                            }));
                          }}
                          className="w-16 h-12 text-center text-2xl font-black text-neon bg-slate-900 border-2 border-slate-700 rounded-xl focus:border-neon focus:outline-none focus:ring-1 focus:ring-neon/50 transition-all placeholder:text-slate-600"
                        />
                      </div>
                    );
                  })}

                  <button 
                    onClick={submitAllScores}
                    disabled={isSubmittingScore}
                    className="w-full py-4 bg-neon hover:bg-neon/90 text-slate-900 font-black text-lg rounded-xl transition-all shadow-[0_0_20px_rgba(var(--color-neon),0.3)] hover:shadow-[0_0_30px_rgba(var(--color-neon),0.5)] disabled:opacity-50"
                  >
                    {isSubmittingScore ? "SAVING..." : `SUBMIT HOLE ${currentHole}`}
                  </button>
                </div>
              </>
            )}
          </section>
        )}

        {activeTab === "admin" && currentPlayer.role === "commissioner" && (
          <section className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            
            <div className="space-y-4">
              <h2 className="text-xl font-bold text-white border-b border-slate-800 pb-2">Team Styling</h2>
              <div className="bg-slate-800 border border-slate-700 rounded-2xl p-5 space-y-5">
                
                {/* Logo Upload */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest pl-1">Team Logo</label>
                  <div className="flex items-center gap-4 bg-slate-900 border border-slate-700 rounded-xl px-4 py-4">
                    {teamLogo ? (
                      <img src={teamLogo} alt="Team Logo" className="w-16 h-16 object-contain rounded-lg bg-black/20" />
                    ) : (
                      <div className="w-16 h-16 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center">
                        <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Logo</span>
                      </div>
                    )}
                    <label className="flex-1 cursor-pointer bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-lg py-2 text-center text-sm font-bold text-white transition-colors">
                      {isUploading ? "Uploading..." : "Upload Logo"}
                      <input type="file" accept="image/*" onChange={handleTeamLogoChange} className="hidden" disabled={isUploading} />
                    </label>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest pl-1">Team Name</label>
                  <input type="text" value={teamName} onChange={e => setTeamName(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white font-medium focus:border-yellow-500 focus:outline-none focus:ring-1 focus:ring-yellow-500 transition-all" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest pl-1">Primary Color</label>
                  <div className="flex items-center gap-4 bg-slate-900 border border-slate-700 rounded-xl px-4 py-2">
                    <input type="color" value={teamColor} onChange={e => setTeamColor(e.target.value)} className="w-8 h-8 rounded cursor-pointer bg-transparent border-0 p-0" />
                    <span className="text-sm font-mono text-slate-300 uppercase">{teamColor}</span>
                  </div>
                </div>
                <button 
                  onClick={handleSaveStyling}
                  disabled={isSaving}
                  className="w-full py-3 mt-2 bg-slate-700 hover:bg-slate-600 text-white font-bold rounded-xl transition-all border border-slate-600 active:scale-[0.98] disabled:opacity-50"
                >
                  {isSaving ? "Saving..." : "Save Styling"}
                </button>
              </div>
            </div>

            {/* My Team Roster (to assign photos) */}
            <div className="space-y-4">
              <h2 className="text-xl font-bold text-white border-b border-slate-800 pb-2">My Roster</h2>
              <div className="bg-slate-800 border border-slate-700 rounded-2xl p-2 space-y-2">
                {myRoster.length === 0 ? (
                  <div className="text-center p-6 text-slate-500 text-sm font-medium">Draft players to add them to your roster.</div>
                ) : (
                  myRoster.map((player) => (
                    <div key={player.id} className="flex justify-between items-center p-3 bg-slate-900/50 rounded-xl border border-slate-800">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center overflow-hidden shadow-inner shrink-0 relative group cursor-pointer">
                          {player.photo_url ? (
                            <img src={player.photo_url} alt={player.name} className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Photo</span>
                          )}
                          <label className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer">
                             <span className="text-[8px] text-white font-bold uppercase">Upload</span>
                             <input type="file" accept="image/*" onChange={(e) => handlePlayerPhotoChange(e, player.id)} className="hidden" disabled={isUploading} />
                          </label>
                        </div>
                        <div>
                          <p className="font-bold text-base text-white">{player.name}</p>
                          <p className="text-xs text-slate-500 mt-0.5 uppercase tracking-wider">{player.role}</p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Player Draft Pool */}
            <div className="space-y-4">
              <div className="flex justify-between items-end border-b border-slate-800 pb-2">
                <h2 className="text-xl font-bold text-white">Player Pool</h2>
                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Undrafted: {undraftedPlayers.length}</span>
              </div>
              <div className="bg-slate-800 border border-slate-700 rounded-2xl p-2 space-y-2">
                {undraftedPlayers.length === 0 ? (
                  <div className="text-center p-6 text-slate-500 text-sm font-medium">All players have been drafted!</div>
                ) : (
                  undraftedPlayers.map((player) => (
                    <div key={player.id} className="flex justify-between items-center p-3 bg-slate-900/50 rounded-xl border border-slate-800">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center overflow-hidden shadow-inner shrink-0 relative group cursor-pointer">
                          {player.photo_url ? (
                            <img src={player.photo_url} alt={player.name} className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Photo</span>
                          )}
                          <label className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer">
                             <span className="text-[8px] text-white font-bold uppercase">Upload</span>
                             <input type="file" accept="image/*" onChange={(e) => handlePlayerPhotoChange(e, player.id)} className="hidden" disabled={isUploading} />
                          </label>
                        </div>
                        <div>
                          <p className="font-bold text-sm text-white">{player.name}</p>
                        </div>
                      </div>
                      <button 
                        onClick={() => handleDraftPlayer(player.id)}
                        className="bg-yellow-500/10 text-yellow-500 hover:bg-yellow-500 hover:text-slate-900 px-4 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all border border-yellow-500/20"
                      >
                        Draft
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Matchup Creator */}
            <div className="space-y-4">
              <div className="flex justify-between items-end border-b border-slate-800 pb-2">
                <h2 className="text-xl font-bold text-white">Matchup Creator</h2>
                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Active Round: 1</span>
              </div>
              <div className="bg-slate-800 border border-slate-700 rounded-2xl p-5 space-y-5">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest pl-1">Course</label>
                  <select 
                    value={matchCourse} 
                    onChange={e => {
                      const newCourse = e.target.value;
                      setMatchCourse(newCourse);
                      const course = COURSES.find(c => c.id === newCourse);
                      if (course) setMatchTee(course.tees[0].id);
                    }}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white font-medium focus:border-yellow-500 focus:outline-none focus:ring-1 focus:ring-yellow-500 transition-all appearance-none"
                  >
                    {COURSES.map(c => (
                      <option key={c.id} value={c.id}>{c.name} (Par {c.par})</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest pl-1">Tees</label>
                  <select 
                    value={matchTee} 
                    onChange={e => setMatchTee(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white font-medium focus:border-yellow-500 focus:outline-none focus:ring-1 focus:ring-yellow-500 transition-all appearance-none"
                  >
                    {(COURSES.find(c => c.id === matchCourse)?.tees || []).map(t => (
                      <option key={t.id} value={t.id}>{t.name} — {t.totalYardage} yds</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest pl-1">Format</label>
                  <select 
                    value={matchFormat} 
                    onChange={e => setMatchFormat(e.target.value as any)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white font-medium focus:border-yellow-500 focus:outline-none focus:ring-1 focus:ring-yellow-500 transition-all appearance-none"
                  >
                    <option value="nines">Nines (5-3-1)</option>
                    <option value="2v1">2 vs 1 Best Ball</option>
                  </select>
                </div>

                {matchFormat === '2v1' && (
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest pl-1">Match Points for Winner</label>
                    <input 
                      type="number" 
                      value={matchPointValue}
                      onChange={e => setMatchPointValue(Number(e.target.value))}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white font-medium focus:border-yellow-500 focus:outline-none"
                    />
                  </div>
                )}
                {matchFormat === 'nines' && (
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest pl-1">Match Points Payout</label>
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <label className="text-[10px] text-slate-500 uppercase pl-1">1st Place</label>
                        <input type="number" value={ninesPoints.first} onChange={e => setNinesPoints({...ninesPoints, first: Number(e.target.value)})} className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-3 text-white font-medium text-center focus:border-yellow-500 focus:outline-none" />
                      </div>
                      <div className="flex-1">
                        <label className="text-[10px] text-slate-500 uppercase pl-1">2nd Place</label>
                        <input type="number" value={ninesPoints.second} onChange={e => setNinesPoints({...ninesPoints, second: Number(e.target.value)})} className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-3 text-white font-medium text-center focus:border-yellow-500 focus:outline-none" />
                      </div>
                      <div className="flex-1">
                        <label className="text-[10px] text-slate-500 uppercase pl-1">3rd Place</label>
                        <input type="number" value={ninesPoints.third} onChange={e => setNinesPoints({...ninesPoints, third: Number(e.target.value)})} className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-3 text-white font-medium text-center focus:border-yellow-500 focus:outline-none" />
                      </div>
                    </div>
                  </div>
                )}
                
                <div className="space-y-3">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest pl-1">Select Players</label>
                  {[0, 1, 2].map((index) => (
                    <select 
                      key={index}
                      value={selectedMatchPlayers[index]}
                      onChange={(e) => {
                        const newSelected = [...selectedMatchPlayers];
                        newSelected[index] = e.target.value;
                        setSelectedMatchPlayers(newSelected);
                      }}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white font-medium focus:border-yellow-500 focus:outline-none text-sm appearance-none"
                    >
                      <option value="">Choose Player...</option>
                      {allPlayers.map(p => (
                        <option key={p.id} value={p.id}>{p.name} ({p.teams?.name || 'No Team'})</option>
                      ))}
                    </select>
                  ))}
                </div>

                <button 
                  onClick={handleCreateMatch}
                  disabled={isSaving}
                  className="w-full py-4 mt-2 bg-yellow-500 hover:bg-yellow-400 text-slate-900 font-black text-lg rounded-xl transition-all shadow-[0_0_15px_rgba(234,179,8,0.2)] hover:shadow-[0_0_25px_rgba(234,179,8,0.4)] disabled:opacity-50"
                >
                  {isSaving ? "CREATING..." : "START MATCH"}
                </button>
              </div>
            </div>

              {/* Completed Matches Revert Options */}
              {completedMatches.length > 0 && (
                <div className="bg-slate-800/30 border border-slate-700/50 rounded-2xl p-5 mt-8 border-t border-red-500/20">
                  <h3 className="text-red-500 font-bold mb-4 flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                    Danger Zone: Revert Matches
                  </h3>
                  <div className="space-y-3">
                    {completedMatches.map(m => (
                      <div key={m.id} className="flex justify-between items-center bg-slate-800 p-3 rounded-xl border border-slate-700">
                        <span className="text-sm font-medium text-slate-300 uppercase">{m.format} Match</span>
                        <button 
                          onClick={() => handleRevertMatch(m.id)}
                          disabled={isSaving}
                          className="bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/30 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors"
                        >
                          Revert Match
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
          </section>
        )}

        {activeTab === "rosters" && (
          <section className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {standings.map(team => (
              <div key={team.id} className="bg-slate-800/50 border border-slate-700 rounded-3xl p-6 relative overflow-hidden">
                <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundColor: team.color }}></div>
                
                <div className="flex items-center gap-4 border-b border-slate-700/50 pb-4 mb-4 relative z-10">
                  {team.logo ? (
                    <img src={team.logo} alt={team.name} className="w-12 h-12 rounded-xl object-cover border-2 shadow-lg" style={{ borderColor: team.color }} />
                  ) : (
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center text-lg font-black shadow-lg" style={{ backgroundColor: team.color, color: '#1e293b' }}>
                      {team.name.substring(0, 2).toUpperCase()}
                    </div>
                  )}
                  <div>
                    <h3 className="text-xl font-black uppercase tracking-tight" style={{ color: boostColor(team.color) }}>{team.name}</h3>
                    <p className="text-xs font-bold text-slate-400">Team Roster</p>
                  </div>
                </div>

                <div className="space-y-3 relative z-10">
                  {allPlayers.filter(p => p.team_id === team.id).map(player => (
                    <div key={player.id} className="flex items-center gap-3 bg-slate-900/50 p-3 rounded-xl border border-slate-700/50">
                      {player.photo_url ? (
                        <img src={player.photo_url} alt="" className="w-8 h-8 rounded-full object-cover border" style={{ borderColor: team.color }} />
                      ) : (
                        <div className="w-8 h-8 rounded-full flex items-center justify-center bg-slate-800 text-xs font-bold text-slate-400 border border-slate-700">
                          {player.name.charAt(0)}
                        </div>
                      )}
                      <div>
                        <p className="font-bold text-sm text-slate-200">{player.name}</p>
                        {player.role === 'commissioner' && (
                          <p className="text-[10px] text-yellow-500 font-bold uppercase tracking-widest mt-0.5">Captain</p>
                        )}
                      </div>
                    </div>
                  ))}
                  {allPlayers.filter(p => p.team_id === team.id).length === 0 && (
                     <p className="text-sm text-slate-500 italic text-center py-2">No players drafted yet.</p>
                  )}
                </div>
              </div>
            ))}
            {standings.length === 0 && (
              <div className="text-center p-8 text-slate-500 font-medium bg-slate-800 rounded-2xl border border-slate-700">
                 No teams found.
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  );
}
