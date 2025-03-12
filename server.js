import express from 'express';
import cors from 'cors';
import basicAuth from 'express-basic-auth';
import fs from 'fs';

const app = express();
app.use(express.json());

// Enable CORS
app.use(cors({ origin: '*' })); // Allow all origins

const users = {};

app.use(basicAuth({ users, challenge: true }));

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

app.listen(3000, () => console.log('Server running on port 3000'));
