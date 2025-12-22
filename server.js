const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

let logs = []; 
let scores = {}; 
let winners = []; 
let showScoreboard = true;
let submissionsLocked = false;
let correctAnswer = ""; 
let submissionLimit = 0; 
let playerMessageCounts = {}; 

// Logic for automatic points
let currentPointsValue = 0; 
let playersWhoScoredThisRound = new Set(); 

app.use(express.static(path.join(__dirname)));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

function getLocalTime() {
    const d = new Date();
    const local = new Date(d.getTime() + (1 * 60 * 60 * 1000));
    return local.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

io.on('connection', (socket) => {
    socket.emit('load_history', logs);
    socket.emit('update_scoreboard', { scores, winners, visible: showScoreboard });
    socket.emit('update_limit', submissionLimit);
    socket.emit('lock_status', submissionsLocked);

    socket.on('check_name', (name, callback) => {
        const forbidden = ["ADMIN", "admin", "SYSTEM"];
        const secretAdminName = "gusztika007xd";
        if (forbidden.includes(name)) return callback({ success: false, message: "Name reserved." });
        if (name === secretAdminName) return callback({ success: true, isAdmin: true });
        if (scores.hasOwnProperty(name)) return callback({ success: false, message: "Name taken!" });
        callback({ success: true, isAdmin: false });
    });

    socket.on('set_correct_answer', (val) => { correctAnswer = val; });

    socket.on('toggle_lock', (status) => {
        submissionsLocked = status;
        io.emit('lock_status', submissionsLocked);
    });

    socket.on('reset_stars', () => {
        winners = [];
        io.emit('update_scoreboard', { scores, winners, visible: showScoreboard });
    });

    socket.on('order_scoreboard', () => {
        const sortedEntries = Object.entries(scores).sort((a, b) => b[1] - a[1]);
        const newScores = {};
        sortedEntries.forEach(([key, val]) => newScores[key] = val);
        scores = newScores;
        io.emit('update_scoreboard', { scores, winners, visible: showScoreboard });
    });

    socket.on('toggle_scoreboard', (status) => {
        showScoreboard = status;
        io.emit('update_scoreboard', { scores, winners, visible: showScoreboard });
    });

    socket.on('set_limit', (num) => {
        submissionLimit = parseInt(num);
        playerMessageCounts = {}; 
        io.emit('update_limit', submissionLimit);
    });

    socket.on('submit_answer', (data) => {
        if (submissionsLocked && data.name !== "ADMIN" && data.name !== "gusztika007xd") return;

        // Reset points logic if ADMIN sends "--- NEW ROUND ---"
        if (data.name === "ADMIN" && data.text === "--- NEW ROUND ---") {
            playersWhoScoredThisRound.clear();
            currentPointsValue = 0;
        }

        // Set points value based on 1, 2, 3 buttons
        if (data.name === "ADMIN" && ["1", "2", "3"].includes(data.text)) {
            currentPointsValue = parseInt(data.text);
        }

        if (data.name !== "ADMIN" && data.name !== "gusztika007xd" && submissionLimit > 0) {
            playerMessageCounts[data.name] = (playerMessageCounts[data.name] || 0) + 1;
            if (playerMessageCounts[data.name] > submissionLimit) return;
        }

        let isCorrect = false;
        let isHalfCorrect = false;

        if (correctAnswer.trim() !== "" && data.name !== "ADMIN" && data.name !== "gusztika007xd") {
            const playerInput = data.text.toLowerCase().trim();
            const groups = correctAnswer.split(',').map(g => g.trim().toLowerCase());

            for (let group of groups) {
                if (group.includes('+')) {
                    const components = group.split('+').map(c => c.trim());
                    const matches = components.filter(c => playerInput.includes(c));
                    
                    if (matches.length === components.length) {
                        isCorrect = true;
                        break;
                    } else if (matches.length > 0) {
                        isHalfCorrect = true;
                    }
                } else {
                    if (playerInput.includes(group)) {
                        isCorrect = true;
                        break;
                    }
                }
            }

            if (isCorrect) {
                if (!winners.includes(data.name)) winners.push(data.name);
                io.emit('play_ting');
                // Give points if not already scored
                if (!playersWhoScoredThisRound.has(data.name) && currentPointsValue > 0) {
                    scores[data.name] = (scores[data.name] || 0) + currentPointsValue;
                    playersWhoScoredThisRound.add(data.name);
                }
            } else if (isHalfCorrect) {
                io.emit('play_almost');
                if (!playersWhoScoredThisRound.has(data.name) && currentPointsValue > 0) {
                    scores[data.name] = (scores[data.name] || 0) + currentPointsValue;
                    playersWhoScoredThisRound.add(data.name);
                }
            }
        }

        const entry = {
            id: Date.now() + Math.random(),
            name: data.name,
            text: data.text,
            time: getLocalTime(),
            isCorrect: isCorrect,
            isHalfCorrect: isHalfCorrect
        };
        
        logs.push(entry);
        if (data.name !== "ADMIN" && data.name !== "gusztika007xd" && !(data.name in scores)) {
            scores[data.name] = 0;
        }
        
        io.emit('new_log', entry);
        if (isCorrect) socket.emit('correct_notification', 'CORRECT! 🎉');
        if (isHalfCorrect && !isCorrect) socket.emit('correct_notification', 'ALMOST! (Half-Correct) 🤔');
        io.emit('update_scoreboard', { scores, winners, visible: showScoreboard }); 
    });

    socket.on('delete_msg', (id) => {
        logs = logs.filter(l => l.id !== id);
        io.emit('remove_msg_client', id);
    });

    socket.on('update_score', (data) => {
        if (scores[data.name] !== undefined) {
            scores[data.name] += data.delta;
            io.emit('update_scoreboard', { scores, winners, visible: showScoreboard });
        }
    });

    socket.on('delete_player', (name) => {
        delete scores[name];
        winners = winners.filter(n => n !== name);
        delete playerMessageCounts[name];
        io.emit('update_scoreboard', { scores, winners, visible: showScoreboard });
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
