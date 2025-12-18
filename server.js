const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

let logs = []; // This stores all messages in memory

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

io.on('connection', (socket) => {
    // Send existing logs to Admin when they connect
    socket.on('admin_login', () => {
        socket.emit('load_history', logs);
    });

    socket.on('submit_answer', (data) => {
        const entry = {
            name: data.name,
            text: data.text,
            time: new Date().toLocaleTimeString()
        };
        logs.push(entry);
        // Send to everyone logged in as admin
        io.emit('new_log', entry);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));