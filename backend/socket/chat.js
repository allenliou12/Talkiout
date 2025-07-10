const lastMessageTime = {}; // moved outside
const MESSAGE_COOLDOWN = 500; // ms

function handleChat(io, socket) {
    socket.on("message", ({ roomId, message }) => {
        const now = Date.now();
        const last = lastMessageTime[socket.id] || 0;

        if (now - last < MESSAGE_COOLDOWN) return;

        lastMessageTime[socket.id] = now;
        socket.to(roomId).emit("message", message);
    });

    socket.on("typing", (roomId) => {
        socket.to(roomId).emit("typing");
    });

    socket.on("stop-typing", (roomId) => {
        socket.to(roomId).emit("stop-typing");
    });

    socket.on("leave-room", (roomId) => {
        socket.leave(roomId);
        socket.to(roomId).emit("stranger-left");
        io.to(roomId).socketsLeave(roomId);
        console.log(`[LEAVE] ${socket.id} left ${roomId}`);
    });

    socket.on("disconnect", () => {
        delete lastMessageTime[socket.id];
        const rooms = Array.from(socket.rooms);
        for (const room of rooms) {
            if (room.startsWith("room-")) {
                socket.to(room).emit("stranger-left");
                io.to(room).socketsLeave(room);
                console.log(`[DISCONNECT] ${socket.id} left ${room}`);
            }
        }
    });
}

module.exports = handleChat;
