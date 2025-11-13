import express from 'express';
import cors from 'cors';
import os from 'os';

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
