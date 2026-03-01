const express = require('express');
const path = require('path');
const fs = require('fs');
const app = express();
const port = process.env.PORT || 3000;

// Security: Disable 'X-Powered-By' header to hide server technology
app.disable('x-powered-by');

app.use(express.json());

// Path to persistent data file
const DATA_FILE = path.join(__dirname, 'likes_data.json');

// Fail-safe persistence: Safe read/write with error recovery
function getSafeStats() {
    const defaultData = { likes: 0, dislikes: 0, visitorCount: 0 };
    try {
        if (!fs.existsSync(DATA_FILE)) {
            fs.writeFileSync(DATA_FILE, JSON.stringify(defaultData, null, 2));
            return defaultData;
        }
        const raw = fs.readFileSync(DATA_FILE, 'utf8');
        if (!raw || raw.trim() === '') return defaultData;
        const data = JSON.parse(raw);

        // Ensure data integrity
        data.likes = Number(data.likes) || 0;
        data.dislikes = Number(data.dislikes) || 0;
        data.visitorCount = Number(data.visitorCount) || 0;
        return data;
    } catch (err) {
        console.error('Persistence read error (using defaults):', err.message);
        return defaultData;
    }
}

function saveSafeStats(data) {
    try {
        // Atomic-style write (write to temp then rename) often safer, but for this size:
        const payload = JSON.stringify(data, null, 2);
        fs.writeFileSync(DATA_FILE, payload);
        return true;
    } catch (err) {
        console.error('Persistence write error:', err.message);
        return false;
    }
}

// Initial initialization
let currentStats = getSafeStats();

// Middleware: Visitor tracking & Security
app.use((req, res, next) => {
    const requestedPath = req.path;
    const requestedFile = path.basename(requestedPath);

    // 1. Block access to any sensitive system files via URL
    const sensitiveFiles = [
        'server.js',
        'likes_data.json',
        'package.json',
        'package-lock.json',
        '.gitignore',
        'render.yaml'
    ];

    // Check both the filename itself AND common paths
    const isSensitive = sensitiveFiles.includes(requestedFile) ||
        requestedPath.includes('.git') ||
        requestedPath.includes('node_modules');

    if (isSensitive) {
        return res.status(403).send('<h1>403 Forbidden: Access to system assets is restricted.</h1>');
    }

    // 2. Count visitors on entry
    // Only increment when the main entry page is loaded
    if (requestedPath === '/' || requestedPath === '/index.html') {
        const data = getSafeStats();
        data.visitorCount++;
        saveSafeStats(data);
        currentStats = data;
    }

    // 3. Prevent clickjacking & other security headers
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-Content-Type-Options', 'nosniff');

    next();
});

// Serve static files from 'public' directory
app.use(express.static(path.join(__dirname, 'public'), {
    index: false,
    maxAge: '1h', // Basic caching for performance
    dotfiles: 'deny' // Strictly deny any .env or .hidden files
}));

// API endpoints with error boundaries
app.get('/api/stats', (req, res) => {
    try {
        res.json(getSafeStats());
    } catch (err) {
        res.status(500).json({ error: 'Stats unavailable' });
    }
});

app.post('/api/stats', (req, res) => {
    try {
        const { action } = req.body;
        const data = getSafeStats();

        if (action === 'like') data.likes++;
        else if (action === 'dislike') data.dislikes++;
        else if (action === 'ping') { /* basic health signal */ }
        else {
            return res.status(400).json({ error: 'Invalid action' });
        }

        if (saveSafeStats(data)) {
            res.json(data);
        } else {
            res.status(500).json({ error: 'Failed to update stats' });
        }
    } catch (err) {
        res.status(500).json({ error: 'Server processing error' });
    }
});

// Global Fallback: Serve UI for any unknown route
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'), (err) => {
        if (err) res.status(500).send('Critical System Error');
    });
});

// Centralized Error Handler to prevent process crashes
process.on('uncaughtException', (err) => {
    console.error('ALERT: Uncaught Exception:', err.message);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('ALERT: Unhandled Rejection at:', promise, 'reason:', reason);
});

app.listen(port, () => {
    console.log(`[PROD] Medical Simulator Operating Port: ${port}`);
});
