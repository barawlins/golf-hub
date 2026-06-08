import { getHolesForTee } from '@/lib/courseData';

export type TeamStanding = {
  id: string;
  name: string;
  color: string;
  logo: string;
  points: number;
};

export function calculateLeaderboard(matches: any[], participants: any[], scores: any[], teams: any[]) {
  const teamStandings: Record<string, TeamStanding> = {};
  
  // Initialize teams with 0 points (ignoring DB base points for now to calculate live)
  teams.forEach(t => {
    teamStandings[t.id] = { id: t.id, name: t.name, color: t.color_hex, logo: t.logo_url || '', points: 0 };
  });

  // Per-player point contributions
  const playerPoints: Record<string, number> = {};

  const matchDetails = matches.map(match => {
    const mParts = participants.filter(p => p.match_id === match.id);
    const mScores = scores.filter(s => s.match_id === match.id);

    // Group scores by hole
    const scoresByHole: Record<number, Record<string, number>> = {};
    const boughtDrivesByHole: Record<number, Record<string, number>> = {};
    mScores.forEach(s => {
      if (!scoresByHole[s.hole_number]) {
         scoresByHole[s.hole_number] = {};
         boughtDrivesByHole[s.hole_number] = {};
      }
      scoresByHole[s.hole_number][s.player_id] = s.strokes;
      boughtDrivesByHole[s.hole_number][s.player_id] = s.bought_drives || 0;
    });

    let isMatchComplete = true;
    mParts.forEach(p => {
      const pScores = mScores.filter(s => s.player_id === p.player_id);
      if (pScores.length < 18) {
        isMatchComplete = false;
      }
    });

    let ninesTotals: Record<string, number> = {};
    let bestBallTotals: Record<string, number> = {};

    mParts.forEach(p => {
      ninesTotals[p.player_id] = 0;
    });

    // Determine teams for match play formats (1v1, 2v1, 2v2, 1v1v1)
    let teamA_id = '';
    let teamA_players: string[] = [];
    let teamB_id = '';
    let teamB_players: string[] = [];
    let teamC_id = '';
    let teamC_players: string[] = [];

    if (match.format === '1v1' || match.format === '2v1' || match.format === '2v2' || match.format === '1v1v1') {
      const counts: Record<string, string[]> = {};
      mParts.forEach(p => {
        if (!counts[p.team_id]) counts[p.team_id] = [];
        counts[p.team_id].push(p.player_id);
      });
      const tIds = Object.keys(counts);
      if (tIds.length >= 2) {
         teamA_id = tIds[0]; teamA_players = counts[tIds[0]];
         teamB_id = tIds[1]; teamB_players = counts[tIds[1]];
      }
      if (tIds.length >= 3) {
         teamC_id = tIds[2]; teamC_players = counts[tIds[2]];
      }
      bestBallTotals[teamA_id] = 0; // holes won or points
      bestBallTotals[teamB_id] = 0;
      if (teamC_id) bestBallTotals[teamC_id] = 0;
    }

    const holeWinners: Record<number, string[]> = {};
    const playerHolesWon: Record<string, number> = {};
    mParts.forEach(p => { playerHolesWon[p.player_id] = 0; });
    // Process each hole 1 to 18
    for (let h = 1; h <= 18; h++) {
      const hScores = scoresByHole[h];
      if (!hScores) continue;

      if (match.format === 'nines') {
        // We need all 3 scores to calculate nines points for a hole
        if (Object.keys(hScores).length === 3) {
           const pIds = Object.keys(hScores);
           const pScores = pIds.map(id => ({ id, score: hScores[id] })).sort((a,b) => a.score - b.score);
           
           if (pScores[0].score === pScores[1].score && pScores[1].score === pScores[2].score) {
             // 3-way tie (3 pts each)
             ninesTotals[pScores[0].id] += 3;
             ninesTotals[pScores[1].id] += 3;
             ninesTotals[pScores[2].id] += 3;
           } else if (pScores[0].score === pScores[1].score) {
             // 2-way tie for 1st (4 pts each, 1 pt for last)
             ninesTotals[pScores[0].id] += 4;
             ninesTotals[pScores[1].id] += 4;
             ninesTotals[pScores[2].id] += 1;
           } else if (pScores[1].score === pScores[2].score) {
             // 2-way tie for 2nd (5 pts for 1st, 2 pts each for 2nd/3rd)
             ninesTotals[pScores[0].id] += 5;
             ninesTotals[pScores[1].id] += 2;
             ninesTotals[pScores[2].id] += 2;
           } else {
             // No ties
             ninesTotals[pScores[0].id] += 5;
             ninesTotals[pScores[1].id] += 3;
             ninesTotals[pScores[2].id] += 1;
           }

           const minScore = pScores[0].score;
           const winners = pScores.filter(ps => ps.score === minScore).map(ps => ps.id);
           // Highlight if 1 or 2 players tied for low, but not if all 3 tied (push)
           if (winners.length < 3) {
             holeWinners[h] = winners;
           }
        }
      } else if (match.format === '2v1') {
        const teeHoles = getHolesForTee(match.course_id, match.tee_id);
        const par = teeHoles[h]?.par || 4;

        let singleTeamId = teamA_players.length === 1 ? teamA_id : teamB_id;
        let singlePlayers = teamA_players.length === 1 ? teamA_players : teamB_players;
        let twosomeTeamId = teamA_players.length === 2 ? teamA_id : teamB_id;
        let twosomePlayers = teamA_players.length === 2 ? teamA_players : teamB_players;

        // Fallback just in case
        if (singlePlayers.length !== 1 || twosomePlayers.length !== 2) {
            singleTeamId = teamA_id; singlePlayers = teamA_players;
            twosomeTeamId = teamB_id; twosomePlayers = teamB_players;
        }

        const calculateStableford = (score: number, p: number, isSingle: boolean) => {
            const toPar = score - p;
            if (toPar <= -2) return 5;
            if (toPar === -1) return 3;
            if (toPar === 0) return 1;
            if (toPar === 1) return 0;
            if (toPar === 2) return isSingle ? -1 : -2;
            if (toPar >= 3) return isSingle ? -1 : -3;
            return 0;
        };

        const singleScore = hScores[singlePlayers[0]];
        const tScores = twosomePlayers.map(pid => hScores[pid]).filter(s => s !== undefined);

        if (singleScore !== undefined) {
            const pts = calculateStableford(singleScore, par, true);
            bestBallTotals[singleTeamId] += pts;
            playerHolesWon[singlePlayers[0]] += pts;
            if (pts > 0) holeWinners[h] = [singlePlayers[0]];
        }

        if (tScores.length > 0) {
            const bestTwosomeScore = Math.min(...tScores);
            const pts = calculateStableford(bestTwosomeScore, par, false);
            bestBallTotals[twosomeTeamId] += pts;
            twosomePlayers.forEach(pid => { playerHolesWon[pid] += pts; });
            if (pts > 0) {
               const contributors = twosomePlayers.filter(pid => hScores[pid] === bestTwosomeScore);
               if (!holeWinners[h]) holeWinners[h] = contributors;
               else holeWinners[h] = [...holeWinners[h], ...contributors];
            }
        }

      } else if (match.format === '1v1v1') {
        const teeHoles = getHolesForTee(match.course_id, match.tee_id);
        const par = teeHoles[h]?.par || 4;
        
        const calculateStableford = (score: number, p: number) => {
            const toPar = score - p;
            if (toPar <= -2) return 5;
            if (toPar === -1) return 3;
            if (toPar === 0) return 1;
            if (toPar === 1) return 0;
            if (toPar === 2) return -1;
            if (toPar >= 3) return -2;
            return 0;
        };

        const bDrives = boughtDrivesByHole[h] || {};
        const pScores = [
            { pid: teamA_players[0], tid: teamA_id },
            { pid: teamB_players[0], tid: teamB_id },
            { pid: teamC_players[0], tid: teamC_id }
        ].filter(x => x.pid && hScores[x.pid] !== undefined);

        pScores.forEach(({ pid, tid }) => {
            let pts = calculateStableford(hScores[pid], par);
            pts -= (bDrives[pid] || 0); // subtract bought drives penalty
            bestBallTotals[tid] += pts;
            playerHolesWon[pid] += pts;
        });

      } else if (match.format === '1v1' || match.format === '2v2') {
        // Match play: best ball per side
        const tA_scores = teamA_players.map(pid => hScores[pid]).filter(s => s !== undefined);
        const tB_scores = teamB_players.map(pid => hScores[pid]).filter(s => s !== undefined);

        if (tA_scores.length > 0 && tB_scores.length > 0) {
           const tA_best = Math.min(...tA_scores);
           const tB_best = Math.min(...tB_scores);
           if (tA_best < tB_best) {
             bestBallTotals[teamA_id] += 1;
             const contributors = teamA_players.filter(pid => hScores[pid] === tA_best);
             holeWinners[h] = contributors;
             contributors.forEach(pid => { playerHolesWon[pid] += 1 / contributors.length; });
           } else if (tB_best < tA_best) {
             bestBallTotals[teamB_id] += 1;
             const contributors = teamB_players.filter(pid => hScores[pid] === tB_best);
             holeWinners[h] = contributors;
             contributors.forEach(pid => { playerHolesWon[pid] += 1 / contributors.length; });
           }
           // Ties result in no holes won for either team
        }
      }
    }

    // Award Match Points to Team Standings
    let leaderText = "Tied";
    if (match.format === 'nines') {
       // Rank players by ninesTotals to award match.points_1st, etc
       const ranked = mParts.map(p => ({
         pid: p.player_id,
         tid: p.team_id,
         total: ninesTotals[p.player_id]
       })).sort((a,b) => b.total - a.total);
       
       if (ranked.length >= 3) {
           if (ranked[0].total === ranked[1].total && ranked[1].total === ranked[2].total) {
               const split = ((match.points_1st || 0) + (match.points_2nd || 0) + (match.points_3rd || 0)) / 3;
               if (teamStandings[ranked[0].tid]) teamStandings[ranked[0].tid].points += split;
               if (teamStandings[ranked[1].tid]) teamStandings[ranked[1].tid].points += split;
               if (teamStandings[ranked[2].tid]) teamStandings[ranked[2].tid].points += split;
               playerPoints[ranked[0].pid] = (playerPoints[ranked[0].pid] || 0) + split;
               playerPoints[ranked[1].pid] = (playerPoints[ranked[1].pid] || 0) + split;
               playerPoints[ranked[2].pid] = (playerPoints[ranked[2].pid] || 0) + split;
           } else if (ranked[0].total === ranked[1].total) {
               const split = ((match.points_1st || 0) + (match.points_2nd || 0)) / 2;
               if (teamStandings[ranked[0].tid]) teamStandings[ranked[0].tid].points += split;
               if (teamStandings[ranked[1].tid]) teamStandings[ranked[1].tid].points += split;
               if (teamStandings[ranked[2].tid]) teamStandings[ranked[2].tid].points += (match.points_3rd || 0);
               playerPoints[ranked[0].pid] = (playerPoints[ranked[0].pid] || 0) + split;
               playerPoints[ranked[1].pid] = (playerPoints[ranked[1].pid] || 0) + split;
               playerPoints[ranked[2].pid] = (playerPoints[ranked[2].pid] || 0) + (match.points_3rd || 0);
           } else if (ranked[1].total === ranked[2].total) {
               const split = ((match.points_2nd || 0) + (match.points_3rd || 0)) / 2;
               if (teamStandings[ranked[0].tid]) teamStandings[ranked[0].tid].points += (match.points_1st || 0);
               if (teamStandings[ranked[1].tid]) teamStandings[ranked[1].tid].points += split;
               if (teamStandings[ranked[2].tid]) teamStandings[ranked[2].tid].points += split;
               playerPoints[ranked[0].pid] = (playerPoints[ranked[0].pid] || 0) + (match.points_1st || 0);
               playerPoints[ranked[1].pid] = (playerPoints[ranked[1].pid] || 0) + split;
               playerPoints[ranked[2].pid] = (playerPoints[ranked[2].pid] || 0) + split;
           } else {
               if (teamStandings[ranked[0].tid]) teamStandings[ranked[0].tid].points += (match.points_1st || 0);
               if (teamStandings[ranked[1].tid]) teamStandings[ranked[1].tid].points += (match.points_2nd || 0);
               if (teamStandings[ranked[2].tid]) teamStandings[ranked[2].tid].points += (match.points_3rd || 0);
               playerPoints[ranked[0].pid] = (playerPoints[ranked[0].pid] || 0) + (match.points_1st || 0);
               playerPoints[ranked[1].pid] = (playerPoints[ranked[1].pid] || 0) + (match.points_2nd || 0);
               playerPoints[ranked[2].pid] = (playerPoints[ranked[2].pid] || 0) + (match.points_3rd || 0);
           }
       }
       
       leaderText = `Leader: ${ranked[0].total} pts`;
    } else if (match.format === '2v1') {
       let singleTeamId = teamA_players.length === 1 ? teamA_id : teamB_id;
       let twosomeTeamId = teamA_players.length === 2 ? teamA_id : teamB_id;

       if (singleTeamId === teamA_id && twosomeTeamId === teamB_id) {
           // proper initialization
       } else if (singleTeamId === teamB_id && twosomeTeamId === teamA_id) {
           // proper initialization
       } else {
           singleTeamId = teamA_id;
           twosomeTeamId = teamB_id;
       }

       if (bestBallTotals[singleTeamId] > bestBallTotals[twosomeTeamId]) {
         if (teamStandings[singleTeamId]) teamStandings[singleTeamId].points += (match.point_value || 0);
         leaderText = `${teamStandings[singleTeamId]?.name || 'Single'} ${bestBallTotals[singleTeamId]} - ${bestBallTotals[twosomeTeamId]} (UP ${bestBallTotals[singleTeamId] - bestBallTotals[twosomeTeamId]})`;
       } else if (bestBallTotals[twosomeTeamId] > bestBallTotals[singleTeamId]) {
         if (teamStandings[twosomeTeamId]) teamStandings[twosomeTeamId].points += (match.point_value || 0);
         leaderText = `${teamStandings[twosomeTeamId]?.name || 'Twosome'} ${bestBallTotals[twosomeTeamId]} - ${bestBallTotals[singleTeamId]} (UP ${bestBallTotals[twosomeTeamId] - bestBallTotals[singleTeamId]})`;
       } else {
         const split = (match.point_value || 0) / 2;
         if (teamStandings[singleTeamId]) teamStandings[singleTeamId].points += split;
         if (teamStandings[twosomeTeamId]) teamStandings[twosomeTeamId].points += split;
         leaderText = `Tied ${bestBallTotals[singleTeamId]} - ${bestBallTotals[twosomeTeamId]}`;
       }
     } else if (match.format === '1v1v1') {
        const scores = [
            { tid: teamA_id, total: bestBallTotals[teamA_id] || 0, pid: teamA_players[0] },
            { tid: teamB_id, total: bestBallTotals[teamB_id] || 0, pid: teamB_players[0] },
            { tid: teamC_id, total: bestBallTotals[teamC_id] || 0, pid: teamC_players[0] }
        ].filter(x => x.tid).sort((a,b) => b.total - a.total);
        
        if (scores.length >= 3) {
            if (scores[0].total === scores[1].total && scores[1].total === scores[2].total) {
                // 3-way tie: split 1st and 2nd points (pts_1 + pts_2) / 3
                const split = ((match.points_1st || 0) + (match.points_2nd || 0)) / 3;
                if (teamStandings[scores[0].tid]) teamStandings[scores[0].tid].points += split;
                if (teamStandings[scores[1].tid]) teamStandings[scores[1].tid].points += split;
                if (teamStandings[scores[2].tid]) teamStandings[scores[2].tid].points += split;
                playerPoints[scores[0].pid] = (playerPoints[scores[0].pid] || 0) + split;
                playerPoints[scores[1].pid] = (playerPoints[scores[1].pid] || 0) + split;
                playerPoints[scores[2].pid] = (playerPoints[scores[2].pid] || 0) + split;
            } else if (scores[0].total === scores[1].total) {
                // 2-way tie for 1st
                const split = ((match.points_1st || 0) + (match.points_2nd || 0)) / 2;
                if (teamStandings[scores[0].tid]) teamStandings[scores[0].tid].points += split;
                if (teamStandings[scores[1].tid]) teamStandings[scores[1].tid].points += split;
                playerPoints[scores[0].pid] = (playerPoints[scores[0].pid] || 0) + split;
                playerPoints[scores[1].pid] = (playerPoints[scores[1].pid] || 0) + split;
                // 3rd place gets 0
            } else if (scores[1].total === scores[2].total) {
                // 1st gets 1st points, 2nd and 3rd split 2nd points
                if (teamStandings[scores[0].tid]) teamStandings[scores[0].tid].points += (match.points_1st || 0);
                playerPoints[scores[0].pid] = (playerPoints[scores[0].pid] || 0) + (match.points_1st || 0);
                
                const split = (match.points_2nd || 0) / 2;
                if (teamStandings[scores[1].tid]) teamStandings[scores[1].tid].points += split;
                if (teamStandings[scores[2].tid]) teamStandings[scores[2].tid].points += split;
                playerPoints[scores[1].pid] = (playerPoints[scores[1].pid] || 0) + split;
                playerPoints[scores[2].pid] = (playerPoints[scores[2].pid] || 0) + split;
            } else {
                if (teamStandings[scores[0].tid]) teamStandings[scores[0].tid].points += (match.points_1st || 0);
                if (teamStandings[scores[1].tid]) teamStandings[scores[1].tid].points += (match.points_2nd || 0);
                playerPoints[scores[0].pid] = (playerPoints[scores[0].pid] || 0) + (match.points_1st || 0);
                playerPoints[scores[1].pid] = (playerPoints[scores[1].pid] || 0) + (match.points_2nd || 0);
            }
            leaderText = `Leader: ${scores[0].total} pts`;
        }
     } else if (match.format === '1v1' || match.format === '2v2') {
       if (bestBallTotals[teamA_id] > bestBallTotals[teamB_id]) {
         if (teamStandings[teamA_id]) teamStandings[teamA_id].points += (match.point_value || 0);
         leaderText = `${teamStandings[teamA_id]?.name || 'Team A'} ${bestBallTotals[teamA_id] - bestBallTotals[teamB_id]} UP`;
         // Split points among winning team members
         const pv = match.point_value || 0;
         teamA_players.forEach(pid => { playerPoints[pid] = (playerPoints[pid] || 0) + pv / teamA_players.length; });
       } else if (bestBallTotals[teamB_id] > bestBallTotals[teamA_id]) {
         if (teamStandings[teamB_id]) teamStandings[teamB_id].points += (match.point_value || 0);
         leaderText = `${teamStandings[teamB_id]?.name || 'Team B'} ${bestBallTotals[teamB_id] - bestBallTotals[teamA_id]} UP`;
         const pv = match.point_value || 0;
         teamB_players.forEach(pid => { playerPoints[pid] = (playerPoints[pid] || 0) + pv / teamB_players.length; });
       } else {
         if (teamStandings[teamA_id]) teamStandings[teamA_id].points += ((match.point_value || 0) / 2);
         if (teamStandings[teamB_id]) teamStandings[teamB_id].points += ((match.point_value || 0) / 2);
         leaderText = "All Square";
         // Tie: split half-points among each side
         const halfPv = (match.point_value || 0) / 2;
         teamA_players.forEach(pid => { playerPoints[pid] = (playerPoints[pid] || 0) + halfPv / teamA_players.length; });
         teamB_players.forEach(pid => { playerPoints[pid] = (playerPoints[pid] || 0) + halfPv / teamB_players.length; });
       }
    }

    let leaderColor = '#4ade80';
    let leaderLogo = '';
    if (match.format === 'nines') {
       const ranked = mParts.map(p => ({
         tid: p.team_id,
         total: ninesTotals[p.player_id]
       })).sort((a,b) => b.total - a.total);
       
       if (ranked.length >= 2 && ranked[0].total === ranked[1].total) {
           leaderColor = '#4ade80';
           leaderLogo = '';
       } else {
           leaderColor = teamStandings[ranked[0].tid]?.color || '#4ade80';
           leaderLogo = teamStandings[ranked[0].tid]?.logo || '';
       }
    } else if (match.format === '1v1v1') {
        const scores = [
            { tid: teamA_id, total: bestBallTotals[teamA_id] || 0 },
            { tid: teamB_id, total: bestBallTotals[teamB_id] || 0 },
            { tid: teamC_id, total: bestBallTotals[teamC_id] || 0 }
        ].filter(x => x.tid).sort((a,b) => b.total - a.total);
        if (scores.length > 0) {
           if (scores.length >= 2 && scores[0].total === scores[1].total) {
               leaderColor = '#4ade80';
               leaderLogo = '';
           } else {
               leaderColor = teamStandings[scores[0].tid]?.color || '#4ade80';
               leaderLogo = teamStandings[scores[0].tid]?.logo || '';
           }
        }
     } else if (match.format === '1v1' || match.format === '2v1' || match.format === '2v2') {
       if (bestBallTotals[teamA_id] > bestBallTotals[teamB_id]) {
         leaderColor = teamStandings[teamA_id]?.color || '#4ade80';
         leaderLogo = teamStandings[teamA_id]?.logo || '';
       } else if (bestBallTotals[teamB_id] > bestBallTotals[teamA_id]) {
         leaderColor = teamStandings[teamB_id]?.color || '#4ade80';
         leaderLogo = teamStandings[teamB_id]?.logo || '';
       }
    }

    const enrichedParticipants = mParts.map(p => {
       const team = teams.find(t => t.id === p.team_id);
       return { ...p, teamColor: team?.color_hex || '#ffffff', teamLogo: team?.logo_url || '' };
    });

    return {
      match,
      format: match.format,
      participants: enrichedParticipants,
      leaderText,
      leaderColor,
      leaderLogo,
      ninesTotals,
      bestBallTotals,
      teamA_id,
      teamB_id,
      teamC_id,
      isMatchComplete,
      rawScores: mScores,
      holeWinners,
      playerHolesWon
    };
  });

  return {
    standings: Object.values(teamStandings).sort((a,b) => b.points - a.points),
    matchDetails,
    playerPoints
  };
}
