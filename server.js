import express from 'express';
import cors from 'cors';
import basicAuth from 'express-basic-auth';
import fs from 'fs';
import dotenv from 'dotenv';
import os from 'os';

dotenv.config();

const app = express();
app.use(express.json());

// Enable CORS
app.use(cors({ origin: '*' })); // Allow all origins

app.use(basicAuth({
    users: JSON.parse(process.env.USERS || '{}'),
    challenge: true
}));

const DATA_FILE = 'data.json';
let storage = fs.existsSync(DATA_FILE) ? JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')) : {};

app.get('/:username/:objectname', (req, res) => {
    const { username, objectname } = req.params;
    if (!['timetable', 'memo'].includes(objectname)) {
        return res.status(403).json({ error: 'Invalid object type' });
    }
    res.json(storage[username]?.[objectname] || {});
});

app.post('/:username/:objectname', (req, res) => {
    const { username, objectname } = req.params;
    if (!['timetable', 'memo'].includes(objectname)) {
        return res.status(403).json({ error: 'Invalid object type' });
    }
    if (username !== req.auth.user) {
        return res.status(403).json({ error: 'Unauthorized' });
    }

    storage[username] = storage[username] || {};
    storage[username][objectname] = req.body;
    fs.writeFileSync(DATA_FILE, JSON.stringify(storage, null, 2));
    res.json({ success: true });
});

function getLocalIp() {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) {
                return iface.address;
            }
        }
    }
    return 'localhost';
}

const port = 3000;
app.listen(port, () => {
    const localIp = getLocalIp();
    console.log(`Server running on port ${port}`);
    console.log(`Local IP: ${localIp}`);
});
