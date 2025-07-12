import express from 'express';
import cors from 'cors';
import basicAuth from 'express-basic-auth';
import fs from 'fs';
import dotenv from 'dotenv';
import os from 'os';
import multer from 'multer';
import path from 'path';
import ngrok from '@ngrok/ngrok';

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
