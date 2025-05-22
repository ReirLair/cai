const express = require('express');
const fs = require('fs');
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
