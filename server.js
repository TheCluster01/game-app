const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

let logs = []; 
let scores = {}; 
let showScoreboard = true;
let submissionLimit = 0; 
let playerMessageCounts = {}; 

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

io.on('connection', (socket) => {
    socket.emit('load_history', logs);
    socket.emit('update_scoreboard', { scores, visible: showScoreboard });
    socket.emit('update_limit', submissionLimit);

    socket.on('check_name', (name, callback) => {
        const forbidden = ["ADMIN", "admin", "Admin", "SYSTEM"];
        if (forbidden.includes(name)) {
            callback({ success: false, message: "Name 'ADMIN' is reserved." });
        } else if (name === "gusztika007xd") {
            callback({ success: true });
        } else if (scores.hasOwnProperty(name)) {
            callback({ success: false, message: "Name already taken!" });
        } else {
            callback({ success: true });
        }
    });

    socket.on('set_limit', (num) => {
        submissionLimit = parseInt(num);
        playerMessageCounts = {}; 
        io.emit('update_limit', submissionLimit);
    });

    socket.on('submit_answer', (data) => {
        const name = data.name;
        if (name !== "ADMIN" && name !== "gusztika007xd" && submissionLimit > 0) {
            playerMessageCounts[name] = (playerMessageCounts[name] || 0) + 1;
            if (playerMessageCounts[name] > submissionLimit) return;
        }

        const entry = {
            id: Date.now() + Math.random(),
            name: name,
            text: data.text,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
        };
        
        logs.push(entry);
        if (name !== "ADMIN" && name !== "gusztika007xd" && !(name in scores)) {
            scores[name] = 0;
        }
        
        io.emit('new_log', entry);
        io.emit('update_scoreboard', { scores, visible: showScoreboard }); 
    });

    socket.on('delete_msg', (id) => {
        logs = logs.filter(l => l.id !== id);
        io.emit('remove_msg_client', id);
    });

    socket.on('toggle_scoreboard', (status) => {
        showScoreboard = status;
        io.emit('update_scoreboard', { scores, visible: showScoreboard });
    });

    socket.on('update_score', (data) => {
        if (scores[data.name] !== undefined) {
            scores[data.name] += data.delta;
            io.emit('update_scoreboard', { scores, visible: showScoreboard });
        }
    });

    socket.on('delete_player', (name) => {
        delete scores[name];
        delete playerMessageCounts[name];
        io.emit('update_scoreboard', { scores, visible: showScoreboard });
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));