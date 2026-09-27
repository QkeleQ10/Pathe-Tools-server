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

const mediaDir = 'C:\\Slides';

app.get('/media/:type', (req, res) => {
    try {
        const type = req.params.type; // 'all', 'images' or 'videos'
        const files = fs.readdirSync(mediaDir);
        const imageFiles = files
            .filter(file => {
                const ext = path.extname(file).toLowerCase();
                if (type === 'videos')
                    return ['.mp4', '.webm', '.ogg', '.mov', '.mkv', '.avi', '.wmv'].includes(ext);
                else if (type === 'images')
                    return ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'].includes(ext);
                else
                    return true;
            });
        res.json(imageFiles);
    } catch (error) {
        console.error('Error reading slides directory:', error);
        res.status(500).json({ error: 'Failed to read slides directory' });
    }
});

app.get('/media/file/:filename', (req, res) => {
    try {
        const filename = req.params.filename;
        const filePath = path.join(mediaDir, filename);

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
