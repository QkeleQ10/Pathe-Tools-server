import express from 'express';
import cors from 'cors';
import os from 'os';
import path from 'path';
import fs from 'fs';

const port = 3541;

const app = express();

app.use(express.json());
app.use(cors({ origin: '*' }));

app.get('/proxy', async (req, res) => {
    const { url } = req.query;

    try {
        const response = await fetch(url);
        const data = await response.text();
        res.send(data);
    } catch (error) {
        console.error('Error fetching from proxy URL:', error);
        res.status(500).json({ error: 'Failed to fetch from proxy URL' });
    }
});

const slidesDir = 'C:\\Slides';

app.get('/slides', (req, res) => {
    try {
        const files = fs.readdirSync(slidesDir);
        const imageFiles = files.filter(file => {
            const ext = path.extname(file).toLowerCase();
            return ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'].includes(ext);
        });
        res.json(imageFiles);
    } catch (error) {
        console.error('Error reading slides directory:', error);
        res.status(500).json({ error: 'Failed to read slides directory' });
    }
});

app.get('/slides/:filename', (req, res) => {
    try {
        const filename = req.params.filename;
        const filePath = path.join(slidesDir, filename);
        
        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ error: 'File not found' });
        }
        
        res.sendFile(filePath);
    } catch (error) {
        console.error('Error serving slide:', error);
        res.status(500).json({ error: 'Failed to serve slide' });
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
