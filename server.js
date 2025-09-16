import express from 'express';
import cors from 'cors';
import basicAuth from 'express-basic-auth';
import fs from 'fs';
import dotenv from 'dotenv';
import os from 'os';
import multer from 'multer';
import path from 'path';
import ngrok from '@ngrok/ngrok';
import ical from "ical-generator";

dotenv.config();

const port = 3541;

(async function () {
    // Establish connectivity
    const listener = await ngrok.forward({ addr: port, authtoken_from_env: true, domain: process.env.NGROK_DOMAIN });

    // Output ngrok url to console
    console.log(`Ingress established at: ${listener.url()}`);
})();

process.stdin.resume();

const app = express();
const DATA_FILE = 'data.json';
const storage = fs.existsSync(DATA_FILE) ? JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')) : {};
const upload = multer({ dest: 'uploads/' });

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(cors({ origin: '*' }));

const auth = basicAuth({
    users: JSON.parse(process.env.USERS || '{}'),
    challenge: true
});

app.get('/users/:username/timetable', (req, res) => {
    const { username } = req.params;
    res.json(storage[username]?.timetable || {});
});

app.post('/users/:username/timetable', auth, (req, res) => {
    const { username } = req.params;
    if (username !== req.auth.user) {
        return res.status(403).json({ error: 'Unauthorized' });
    }

    storage[username] ||= {};
    storage[username].timetable = req.body;
    fs.writeFileSync(DATA_FILE, JSON.stringify(storage, null, 2));
    res.json({ success: true });
});

app.get('/users/:username/timetable/credits.ics', (req, res) => {
    const { username } = req.params;

    const cal = ical({ name: `Uitlopen ${username}` });

    (storage[username]?.timetable?.timetable || []).forEach(show => cal.createEvent({
        start: new Date(show.creditsTime),
        end: new Date(show.creditsTime),
        summary: `${show.auditorium.replace(/^\w+\s/, '')} - ${show.playlist}`,
        description: show.feature,
        location: show.auditorium,
    }));

    res.setHeader("Content-Type", "text/calendar; charset=utf-8");
    res.setHeader("Content-Disposition", "attachment; filename=credits.ics");
    res.send(cal.toString());
});

app.get('/users/:username/pictures', (req, res) => {
    const { username } = req.params;
    const userDir = path.join('uploads', username);
    if (!fs.existsSync(userDir)) {
        return res.json([]);
    }
    const files = fs.readdirSync(userDir);
    res.json(files);
});

app.post('/users/:username/pictures', auth, upload.array('pictures'), (req, res) => {
    const { username } = req.params;
    if (username !== req.auth.user) {
        return res.status(403).json({ error: 'Unauthorized' });
    }

    const userDir = path.join('uploads', username);
    if (!fs.existsSync(userDir)) {
        fs.mkdirSync(userDir, { recursive: true });
    }

    req.files.forEach(file => {
        const destPath = path.join(userDir, file.originalname);
        fs.renameSync(file.path, destPath);
    });

    res.json({ success: true, files: req.files.map(file => file.originalname) });
});

app.delete('/users/:username/pictures', auth, (req, res) => {
    const { username } = req.params;
    if (username !== req.auth.user) {
        return res.status(403).json({ error: 'Unauthorized' });
    }

    const userDir = path.join('uploads', username);
    if (fs.existsSync(userDir)) {
        fs.readdirSync(userDir).forEach(file => {
            fs.unlinkSync(path.join(userDir, file));
        });
        fs.rmdirSync(userDir);
    }

    res.json({ success: true });
});

app.get('/users/:username/pictures/:filename', (req, res) => {
    const { username, filename } = req.params;
    const filePath = path.join('uploads', username, filename);
    if (fs.existsSync(filePath)) {
        res.sendFile(path.resolve(filePath));
    } else {
        res.status(404).json({ error: 'Not found' });
    }
});

app.delete('/users/:username/pictures/:filename', auth, (req, res) => {
    const { username, filename } = req.params;
    if (username !== req.auth.user) {
        return res.status(403).json({ error: 'Unauthorized' });
    }

    const filePath = path.join('uploads', username, filename);
    if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        res.json({ success: true });
    } else {
        res.status(404).json({ error: 'Not found' });
    }
});

// Global credits stingers endpoints
app.get('/global/creditsstingers', (req, res) => {
    res.json(storage.global?.creditsstingers || []);
});

app.post('/global/creditsstingers', auth, (req, res) => {
    const { title } = req.body;

    if (!title || typeof title !== 'string') {
        return res.status(400).json({ error: 'Invalid title value' });
    }

    storage.global ||= {};
    storage.global.creditsstingers ||= [];

    // Add the new entry
    storage.global.creditsstingers.push(title);

    // Keep only the newest 50 items
    if (storage.global.creditsstingers.length > 50) {
        storage.global.creditsstingers = storage.global.creditsstingers.slice(-50);
    }

    fs.writeFileSync(DATA_FILE, JSON.stringify(storage, null, 2));
    res.json({ success: true, creditsstingers: storage.global.creditsstingers });
});

app.delete('/global/creditsstingers', auth, (req, res) => {
    const { title } = req.body;

    if (!title || typeof title !== 'string') {
        return res.status(400).json({ error: 'Invalid title value' });
    }

    storage.global ||= {};
    storage.global.creditsstingers ||= [];

    const index = storage.global.creditsstingers.indexOf(title);
    if (index === -1) {
        return res.status(404).json({ error: 'title not found' });
    }

    storage.global.creditsstingers.splice(index, 1);

    fs.writeFileSync(DATA_FILE, JSON.stringify(storage, null, 2));
    res.json({ success: true, creditsstingers: storage.global.creditsstingers });
});

// OMDb API endpoint
app.get('/omdb', async (req, res) => {
    const { t: title, y: year } = req.query;

    if (!title) {
        return res.status(400).json({ error: 'Title parameter (t) is required' });
    }

    const apiKey = process.env.OMDB_APIKEY;
    if (!apiKey) {
        return res.status(500).json({ error: 'OMDb API key not configured' });
    }

    const currentYear = new Date().getFullYear();
    const searchYear = year || currentYear;

    try {
        // First try with year (either provided or current year)
        let url = `https://www.omdbapi.com/?t=${encodeURIComponent(title)}&y=${searchYear}&plot=full&apikey=${apiKey}`;
        let response = await fetch(url);
        let data = await response.json();

        // If not found and we used a year, try without year
        if (data.Response === 'False' && data.Error === 'Movie not found!' && (year || currentYear)) {
            url = `https://www.omdbapi.com/?t=${encodeURIComponent(title)}&plot=full&apikey=${apiKey}`;
            response = await fetch(url);
            data = await response.json();
        }

        if (data.Response === 'False') {
            return res.status(404).json({ error: data.Error || 'Movie not found' });
        }

        res.json(data);
    } catch (error) {
        console.error('OMDb API error:', error);
        res.status(500).json({ error: 'Failed to fetch movie information' });
    }
});

app.get('/pathe-api', async (req, res) => {
    const { endpoint } = req.query;

    try {
        const response = await fetch(`https://www.pathe.nl/api/${endpoint || 'shows'}?language=nl`);
        const data = await response.json();
        res.json(data);
    } catch (error) {
        console.error('Error fetching from Pathé API:', error);
        res.status(500).json({ error: 'Failed to fetch from Pathé API' });
    }
});

function getLocalIp() {
    const interfaces = os.networkInterfaces();
    // console.log(interfaces);
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) {
                return iface.address;
            }
        }
    }
    return 'localhost';
}

app.listen(port, () => {
    const localIp = getLocalIp();
    console.log(`Server running on port ${port} (http://${localIp}:${port})`);
});
