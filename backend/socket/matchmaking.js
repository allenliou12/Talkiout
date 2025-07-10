let waitingUser = null;

function handleMatchmaking(io, socket) {
    socket.on("start-chat", () => {
        if (waitingUser) {
            const roomId = `room-${waitingUser.id}-${socket.id}`;
            socket.join(roomId);
            waitingUser.join(roomId);

            // Assign nicknames
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
}

module.exports = handleMatchmaking;
