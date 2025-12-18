const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

let logs = []; 
let scores = {}; // Stores { "Name": Score }

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

io.on('connection', (socket) => {
    // Send history and current scores to new connections
    socket.emit('load_history', logs);
    socket.emit('update_scoreboard', scores);

    socket.on('submit_answer', (data) => {
        const entry = {
            name: data.name,
            text: data.text,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
        };
        logs.push(entry);
        if (!(data.name in scores)) scores[data.name] = 0;
        
        io.emit('new_log', entry);
        io.emit('update_scoreboard', scores); 
    });

    socket.on('update_score', (data) => {
        if (scores[data.name] !== undefined) {
            scores[data.name] += data.delta;
            io.emit('update_scoreboard', scores);
        }
    });

    socket.on('delete_player', (name) => {
        delete scores[name];
        io.emit('update_scoreboard', scores);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));