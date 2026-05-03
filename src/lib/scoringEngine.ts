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

  const matchDetails = matches.map(match => {
    const mParts = participants.filter(p => p.match_id === match.id);
    const mScores = scores.filter(s => s.match_id === match.id);

    // Group scores by hole
    const scoresByHole: Record<number, Record<string, number>> = {};
    mScores.forEach(s => {
      if (!scoresByHole[s.hole_number]) scoresByHole[s.hole_number] = {};
      scoresByHole[s.hole_number][s.player_id] = s.strokes;
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

    // Determine teams for 2v1
    let teamA_id = '';
    let teamA_players: string[] = [];
    let teamB_id = '';
    let teamB_players: string[] = [];

    if (match.format === '2v1') {
      const counts: Record<string, string[]> = {};
      mParts.forEach(p => {
        if (!counts[p.team_id]) counts[p.team_id] = [];
        counts[p.team_id].push(p.player_id);
      });
      const tIds = Object.keys(counts);
      if (tIds.length >= 2) {
         if (counts[tIds[0]].length === 2) {
           teamA_id = tIds[0]; teamA_players = counts[tIds[0]];
           teamB_id = tIds[1]; teamB_players = counts[tIds[1]];
         } else {
           teamA_id = tIds[1]; teamA_players = counts[tIds[1]];
           teamB_id = tIds[0]; teamB_players = counts[tIds[0]];
         }
      }
      bestBallTotals[teamA_id] = 0; // holes won
      bestBallTotals[teamB_id] = 0;
    }

    const holeWinners: Record<number, string[]> = {};
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

           if (pScores[0].score < pScores[1].score) {
             holeWinners[h] = [pScores[0].id];
           }
        }
      } else if (match.format === '2v1') {
        // Need scores for both teams to calculate best ball
        // Ensure at least one score from teamA and the score from teamB
        const tA_scores = teamA_players.map(pid => hScores[pid]).filter(s => s !== undefined);
        const tB_score = teamB_players.map(pid => hScores[pid]).filter(s => s !== undefined)[0];

        if (tA_scores.length > 0 && tB_score !== undefined) {
           const tA_best = Math.min(...tA_scores);
           if (tA_best < tB_score) {
             bestBallTotals[teamA_id] += 1;
             holeWinners[h] = teamA_players.filter(pid => hScores[pid] === tA_best);
           } else if (tB_score < tA_best) {
             bestBallTotals[teamB_id] += 1;
             holeWinners[h] = teamB_players.filter(pid => hScores[pid] === tB_score);
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
       
       if (teamStandings[ranked[0].tid]) teamStandings[ranked[0].tid].points += (match.points_1st || 0);
       if (teamStandings[ranked[1].tid]) teamStandings[ranked[1].tid].points += (match.points_2nd || 0);
       if (teamStandings[ranked[2].tid]) teamStandings[ranked[2].tid].points += (match.points_3rd || 0);
       
       leaderText = `Leader: ${ranked[0].total} pts`;
    } else if (match.format === '2v1') {
       if (bestBallTotals[teamA_id] > bestBallTotals[teamB_id]) {
         if (teamStandings[teamA_id]) teamStandings[teamA_id].points += (match.point_value || 0);
         leaderText = `${teamStandings[teamA_id]?.name} Up ${bestBallTotals[teamA_id] - bestBallTotals[teamB_id]}`;
       } else if (bestBallTotals[teamB_id] > bestBallTotals[teamA_id]) {
         if (teamStandings[teamB_id]) teamStandings[teamB_id].points += (match.point_value || 0);
         leaderText = `${teamStandings[teamB_id]?.name} Up ${bestBallTotals[teamB_id] - bestBallTotals[teamA_id]}`;
       } else {
         if (teamStandings[teamA_id]) teamStandings[teamA_id].points += ((match.point_value || 0) / 2);
         if (teamStandings[teamB_id]) teamStandings[teamB_id].points += ((match.point_value || 0) / 2);
         leaderText = "All Square";
       }
    }

    let leaderColor = '#4ade80';
    let leaderLogo = '';
    if (match.format === 'nines') {
       const ranked = mParts.map(p => ({
         tid: p.team_id,
         total: ninesTotals[p.player_id]
       })).sort((a,b) => b.total - a.total);
       leaderColor = teamStandings[ranked[0].tid]?.color || '#4ade80';
       leaderLogo = teamStandings[ranked[0].tid]?.logo || '';
    } else if (match.format === '2v1') {
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
      isMatchComplete,
      rawScores: mScores,
      holeWinners
    };
  });

  return {
    standings: Object.values(teamStandings).sort((a,b) => b.points - a.points),
    matchDetails
  };
}
