const express = require('express');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcrypt');
const cron = require('node-cron');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = 3000;

app.use(express.json());

// File-based storage
function loadData(file) {
    if (!fs.existsSync(file)) return [];
    return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function saveData(file, data) {
    fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

// User Management
function loadUsers() {
    return loadData('users.json');
}

function saveUsers(users) {
    saveData('users.json', users);
}

// Session Management

const sessions = new Map();
app.use(express.static(path.join(__dirname, 'public')));

// Serve index.html on root route
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/welcome', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.post('/register', async (req, res) => {
    const { username, password, socials } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Username and password are required' });

    let users = loadUsers();
    if (users.find(u => u.username === username)) {
        return res.status(400).json({ error: 'Username already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = { 
        username, 
        password: hashedPassword, 
        socials: socials || null, 
        balance: 1000,
        betHistory: []
    };
    users.push(newUser);
    saveUsers(users);
    const sessionToken = uuidv4();
    sessions.set(sessionToken, username);
    res.json({ success: true, message: 'Registered successfully', user: { username, balance: newUser.balance, socials }, sessionToken });
});

app.post('/login', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Username and password are required' });

    const users = loadUsers();
    const user = users.find(u => u.username === username);
    if (!user || !(await bcrypt.compare(password, user.password))) {
        return res.status(401).json({ error: 'Invalid credentials' });
    }

    const sessionToken = uuidv4();
    sessions.set(sessionToken, username);
    res.json({ success: true, message: 'Login successful', user: { username, balance: user.balance, socials: user.socials }, sessionToken });
});

app.get('/api/validate-session', (req, res) => {
    const sessionToken = req.headers.authorization?.split('Bearer ')[1];
    if (!sessionToken || !sessions.has(sessionToken)) {
        return res.status(401).json({ error: 'Invalid session' });
    }
    const username = sessions.get(sessionToken);
    const users = loadUsers();
    const user = users.find(u => u.username === username);
    if (!user) {
        sessions.delete(sessionToken);
        return res.status(401).json({ error: 'User not found' });
    }
    res.json({ success: true, user: { username, balance: user.balance, socials: user.socials } });
});

// ... (Rest of the original server.js code remains unchanged)
function getRandomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function generateOdds(probability) {
    const decimal = (1 / probability).toFixed(2);
    return Math.max(1.5, Math.min(decimal, 4.5)); // Balanced odds range
}

function simulateMatch(teamA, teamB) {
    const strengthA = teamA.strength;
    const strengthB = teamB.strength;
    const totalStrength = strengthA + strengthB;

    const goalsA = Math.random() < strengthA / totalStrength ? getRandomInt(1, 4) : getRandomInt(0, 2);
    const goalsB = Math.random() < strengthB / totalStrength ? getRandomInt(1, 4) : getRandomInt(0, 2);
    const totalGoals = goalsA + goalsB;
    const isDraw = goalsA === goalsB;

    const possessionA = getRandomInt(40, 60) + Math.floor((strengthA - strengthB) / 2);
    const possessionB = 100 - possessionA;

    const cornersA = getRandomInt(2, 10);
    const cornersB = getRandomInt(2, 10);

    const btts = goalsA > 0 && goalsB > 0;
    const firstHalfGoals = getRandomInt(0, Math.min(goalsA, goalsB));

    const matchTime = new Date(Date.now() + getRandomInt(5, 120) * 60 * 1000); // Match ends in 5-120 minutes

    return {
        matchId: uuidv4(),
        home: teamA.team,
        away: teamB.team,
        score: `${goalsA} - ${goalsB}`,
        result: goalsA > goalsB ? teamA.team : goalsB > goalsA ? teamB.team : 'Draw',
        endTime: matchTime,
        bettingOpen: true,
        possession: {
            [teamA.team]: `${possessionA}%`,
            [teamB.team]: `${ possessionB}%`
        },
        corners: {
            [teamA.team]: cornersA,
            [teamB.team]: cornersB
        },
        markets: {
            match_winner: {
                [teamA.team]: { result: goalsA > goalsB, odds: generateOdds(strengthA / totalStrength) },
                [teamB.team]: { result: goalsB > goalsA, odds: generateOdds(strengthB / totalStrength) },
                Draw: { result: isDraw, odds: generateOdds(0.25) }
            },
            over_0_5: { result: totalGoals > 0.5, odds: generateOdds(totalGoals / 5) },
            over_1_5: { result: totalGoals > 1.5, odds: generateOdds(totalGoals / 6) },
            over_2_5: { result: totalGoals > 2.5, odds: generateOdds(totalGoals / 7) },
            both_teams_to_score: { result: btts, odds: generateOdds(btts ? 0.6 : 0.3) },
            double_chance: {
                [`${teamA.team} or Draw`]: { result: goalsA >= goalsB, odds: generateOdds(0.7) },
                [`${teamB.team} or Draw`]: { result: goalsB >= goalsA, odds: generateOdds(0.7) }
            }
        }
    };
}

function generateMatches() {
    const teams = JSON.parse(fs.readFileSync('teams.json', 'utf8'));
    const matches = [];
    const used = new Set();

    while (matches.length < 10) {
        const i = getRandomInt(0, teams.length - 1);
        const j = getRandomInt(0, teams.length - 1);
        if (i !== j && !used.has(`${i}-${j}`) && !used.has(`${j}-${i}`)) {
            used.add(`${i}-${j}`);
            matches.push(simulateMatch(teams[i], teams[j]));
        }
    }

    saveData('matches.json', matches);
}

// Initialize matches
generateMatches();

// Regenerate every 10 minutes
cron.schedule('*/10 * * * *', generateMatches);

// Betting Logic
function isValidBet(betSelections, matches) {
    const matchBets = {};
    for (const selection of betSelections) {
        const { matchId, market, option } = selection;
        const match = matches.find(m => m.matchId === matchId);
        if (!match || !match.bettingOpen || new Date() > new Date(match.endTime) - 60000) {
            return false; // Betting closed or match too close to end
        }
        if (!matchBets[matchId]) matchBets[matchId] = new Set();
        matchBets[matchId].add(`${market}:${option}`);
    }

    // Check for conflicting bets (e.g., Home Win and Home or Draw)
    for (const matchId in matchBets) {
        const selections = matchBets[matchId];
        if (selections.has('match_winner:Draw') && (selections.has(`match_winner:${matches.find(m => m.matchId === matchId).home}`) || selections.has(`match_winner:${matches.find(m => m.matchId === matchId).away}`))) {
            return false;
        }
        if (selections.has('double_chance:' + matches.find(m => m.matchId === matchId).home + ' or Draw') && selections.has(`match_winner:${matches.find(m => m.matchId === matchId).away}`)) {
            return false;
        }
        if (selections.has('double_chance:' + matches.find(m => m.matchId === matchId).away + ' or Draw') && selections.has(`match_winner:${matches.find(m => m.matchId === matchId).home}`)) {
            return false;
        }
    }
    return true;
}

app.post('/api/bet', async (req, res) => {
    const { username, betSelections, stake } = req.body;
    if (!username || !betSelections || !stake || stake <= 0) {
        return res.status(400).json({ error: 'Invalid bet details' });
    }

    const users = loadUsers();
    const user = users.find(u => u.username === username);
    if (!user || user.balance < stake) {
        return res.status(400).json({ error: 'Insufficient balance or user not found' });
    }

    const matches = loadData('matches.json');
    if (!isValidBet(betSelections, matches)) {
        return res.status(400).json({ error: 'Invalid or conflicting bet selections' });
    }

    const totalOdds = betSelections.reduce((acc, sel) => {
        const match = matches.find(m => m.matchId === sel.matchId);
        const odds = match.markets[sel.market][sel.option].odds;
        return acc * odds;
    }, 1);

    user.balance -= stake;
    const bet = {
        betId: uuidv4(),
        username,
        selections: betSelections,
        stake,
        totalOdds: totalOdds.toFixed(2),
        potentialPayout: (stake * totalOdds).toFixed(2),
        status: 'pending',
        placedAt: new Date().toISOString()
    };

    user.betHistory.push(bet);
    saveUsers(users);
    saveData('bets.json', [...loadData('bets.json'), bet]);
    res.json({ success: true, message: 'Bet placed', bet });
});

// Auto-settle bets
cron.schedule('* * * * *', () => {
    const matches = loadData('matches.json');
    const bets = loadData('bets.json');
    const users = loadUsers();

    bets.forEach(bet => {
        if (bet.status !== 'pending') return;

        const allSettled = bet.selections.every(sel => {
            const match = matches.find(m => m.matchId === sel.matchId);
            if (!match || new Date() < new Date(match.endTime)) return false;
            return match.markets[sel.market][sel.option].result;
        });

        if (allSettled) {
            const user = users.find(u => u.username === bet.username);
            if (user) {
                user.balance += parseFloat(bet.potentialPayout);
                bet.status = 'won';
            }
        } else if (bet.selections.some(sel => {
            const match = matches.find(m => m.matchId === sel.matchId);
            return match && new Date() >= new Date(match.endTime) && !match.markets[sel.market][sel.option].result;
        })) {
            bet.status = 'lost';
        }
    });

    saveData('bets.json', bets);
    saveUsers(users);
});

// Leaderboard
app.get('/api/leaderboard', (req, res) => {
    const users = loadUsers();
    const leaderboard = users
        .map(u => ({
            username: u.username,
            balance: u.balance,
            totalBets: u.betHistory.length,
            totalWon: u.betHistory.filter(b => b.status === 'won').length
        }))
        .sort((a, b) => b.balance - a.balance)
        .slice(0, 10);
    res.json(leaderboard);
});

// Bet History
app.get('/api/bet-history/:username', (req, res) => {
    const users = loadUsers();
    const user = users.find(u => u.username === req.params.username);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user.betHistory);
});

// League Standings
function updateLeagueStandings() {
    const matches = loadData('matches.json');
    const teams = JSON.parse(fs.readFileSync('teams.json', 'utf8'));
    const standings = teams.map(team => ({
        team: team.team,
        wins: 0,
        losses: 0,
        draws: 0,
        points: 0
    }));

    matches.forEach(match => {
        const homeTeam = standings.find(s => s.team === match.home);
        const awayTeam = standings.find(s => s.team === match.away);
        if (match.result === match.home) {
            homeTeam.wins += 1;
            homeTeam.points += 3;
            awayTeam.losses += 1;
        } else if (match.result === match.away) {
            awayTeam.wins += 1;
            awayTeam.points += 3;
            homeTeam.losses += 1;
        } else {
            homeTeam.draws += 1;
            awayTeam.draws += 1;
            homeTeam.points += 1;
            awayTeam.points += 1;
        }
    });

    saveData('standings.json', standings.sort((a, b) => b.points - a.points));
}

cron.schedule('*/5 * * * *', updateLeagueStandings);

app.get('/api/standings', (req, res) => {
    res.json(loadData('standings.json'));
});

app.get('/api/matches', (req, res) => {
    res.json(loadData('matches.json'));
});

app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));
