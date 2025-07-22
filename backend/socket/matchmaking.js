const waitingQueue = [];
const { cooldownTimers } = require("./chat_state");

function handleMatchmaking(io, socket) {
    socket.on("start-chat", () => {
        const cooldownUntil = cooldownTimers[socket.id];
        if (waitingQueue.find(s => s.id === socket.id)) {
            console.log(`[SKIP] ${socket.id} is already in queue`);
            return;
        }
        //  Clear expired cooldown
        if (cooldownUntil && cooldownUntil <= Date.now()) {
            delete cooldownTimers[socket.id];
        }

        //  Still in cooldown? Block them
        else if (cooldownUntil && cooldownUntil > Date.now()) {
            const waitTime = Math.ceil((cooldownUntil - Date.now()) / 1000);
            socket.emit("chat-paused", waitTime);
            console.log(`[BLOCKED] ${socket.id} is on cooldown for ${waitTime}s`);
            return;
        }

        // 👤 Avoid matching the same user with themselves
        if (waitingUser && waitingUser.id === socket.id) {
            console.log(`[SKIP] ${socket.id} is already waiting`);
            return;
        }

        if (waitingQueue.length > 0) {
            const partner = waitingQueue.shift(); // Get the earliest waiting user
        
            const roomId = `room-${partner.id}-${socket.id}`;
            socket.join(roomId);
            partner.join(roomId);
        
            const nicknames = {
                [partner.id]: "Stranger A",
                [socket.id]: "Stranger B"
            };
        
            io.to(roomId).emit("matched", { roomId, nicknames });
            console.log(`[MATCH] ${partner.id} ↔ ${socket.id} in ${roomId}`);
        } else {
            waitingQueue.push(socket);
            socket.emit("waiting");
            console.log(`[QUEUE] ${socket.id} is waiting`);
        }

    });

    // 🔌 Handle disconnect: clear waitingUser if they disconnect
    socket.on("disconnect", () => {
        const index = waitingQueue.findIndex(s => s.id === socket.id);
        if (index !== -1) {
            waitingQueue.splice(index, 1);
            console.log(`[DISCONNECT] ${socket.id} removed from queue`);
        }
    });

    // ✋ Optional: allow user to manually cancel matchmaking
    socket.on("cancel-search", () => {
        const index = waitingQueue.findIndex(s => s.id === socket.id);
        if (index !== -1) {
            waitingQueue.splice(index, 1);
            console.log(`[CANCEL] ${socket.id} cancelled search`);
        }
    });

}

module.exports = handleMatchmaking;
