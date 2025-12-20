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
let submissionsLocked = false;
let correctAnswer = ""; // Admin sets this
let submissionLimit = 0; 
let playerMessageCounts = {}; 

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

io.on('connection', (socket) => {
    socket.emit('load_history', logs);
    socket.emit('update_scoreboard', { scores, visible: showScoreboard });
    socket.emit('update_limit', submissionLimit);
    socket.emit('lock_status', submissionsLocked);

    socket.on('check_name', (name, callback) => {
        const forbidden = ["ADMIN", "admin", "SYSTEM"];
        if (forbidden.includes(name)) return callback({ success: false, message: "Name reserved." });
        if (name === "gusztika007xd") return callback({ success: true });
        if (scores.hasOwnProperty(name)) return callback({ success: false, message: "Name taken!" });
        callback({ success: true });
    });

    socket.on('set_correct_answer', (val) => { correctAnswer = val; });

    socket.on('toggle_lock', (status) => {
        submissionsLocked = status;
        io.emit('lock_status', submissionsLocked);
    });

    socket.on('set_limit', (num) => {
        submissionLimit = parseInt(num);
        playerMessageCounts = {}; 
        io.emit('update_limit', submissionLimit);
    });

    socket.on('submit_answer', (data) => {
        if (submissionsLocked && data.name !== "ADMIN" && data.name !== "gusztika007xd") return;

        // Limit checking
        if (data.name !== "ADMIN" && data.name !== "gusztika007xd" && submissionLimit > 0) {
            playerMessageCounts[data.name] = (playerMessageCounts[data.name] || 0) + 1;
            if (playerMessageCounts[data.name] > submissionLimit) return;
        }

        // Answer validation logic
        let isCorrect = false;
        if (correctAnswer.trim() !== "" && data.name !== "ADMIN" && data.name !== "gusztika007xd") {
            const validAnswers = correctAnswer.split(',').map(a => a.trim());
            if (validAnswers.includes(data.text.trim())) {
                isCorrect = true;
            }
        }

        const entry = {
            id: Date.now() + Math.random(),
            name: data.name,
            text: data.text,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
            isCorrect: isCorrect
        };
        
        logs.push(entry);
        if (data.name !== "ADMIN" && data.name !== "gusztika007xd" && !(data.name in scores)) {
            scores[data.name] = 0;
        }
        
        io.emit('new_log', entry);
        if (isCorrect) socket.emit('correct_notification'); // Only tell the person who got it right
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
