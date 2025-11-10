module.exports = {
    apps: [
        {
            name: 'pathe-tools-server',
            script: 'server.js',
            env: { NODE_ENV: 'production' }
        },
        {
            name: 'pathe-tools-server-update',
            script: 'update.bat',
            interpreter: "none",
            autorestart: false,
            watch: false,
            env: { NODE_ENV: 'production' }
        }
    ]
};