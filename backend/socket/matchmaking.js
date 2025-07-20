let waitingUser = null;
const { cooldownTimers } = require("./chat_state");

function handleMatchmaking(io, socket) {
    socket.on("start-chat", () => {
        const cooldownUntil = cooldownTimers[socket.id];

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

        if (waitingUser) {
            const roomId = `room-${waitingUser.id}-${socket.id}`;
            socket.join(roomId);
            waitingUser.join(roomId);

            const nicknames = {
                [waitingUser.id]: "Stranger A",
                [socket.id]: "Stranger B"
            };

            io.to(roomId).emit("matched", { roomId, nicknames });
            console.log(`[MATCH] ${waitingUser.id} ↔ ${socket.id} in ${roomId}`);
            waitingUser = null;
        } else {
            waitingUser = socket;
            socket.emit("waiting");
            console.log(`[QUEUE] ${socket.id} is waiting`);
        }
    });

    // 🔌 Handle disconnect: clear waitingUser if they disconnect
    socket.on("disconnect", () => {
        if (waitingUser && waitingUser.id === socket.id) {
            waitingUser = null;
            console.log(`[DISCONNECT] ${socket.id} was waiting and disconnected`);
        }
    });

    // ✋ Optional: allow user to manually cancel matchmaking
    socket.on("cancel-search", () => {
        if (waitingUser && waitingUser.id === socket.id) {
            waitingUser = null;
            console.log(`[CANCEL] ${socket.id} cancelled search`);
        }
    });
}

module.exports = handleMatchmaking;
