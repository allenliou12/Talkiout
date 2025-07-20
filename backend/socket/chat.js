const IDLE_TIMEOUT = 60000; // ← ADD THIS LINE (1 minute idle timeout)
const MESSAGE_COOLDOWN = 500; // ms
const BURST_LIMIT = 10;
const BURST_WINDOW = 10 * 1000; // 10 seconds

const {
    cooldownTimers,
    earlyLeaveCounts,
    leaveTimestamps,
    idleTimers,
    lastMessageTime,
    messageBursts
} = require("./chat_state");

function handleChat(io, socket) {

    //  Reset idle timeout on user activity
    function resetIdleTimer() {
        if (idleTimers[socket.id]) {
            clearTimeout(idleTimers[socket.id]);
        }

        idleTimers[socket.id] = setTimeout(() => {
            console.log(`[IDLE] Disconnecting ${socket.id} due to inactivity`);
            socket.emit("idle-timeout");  // Optional: frontend alert
            socket.disconnect(); // Trigger disconnect cleanup
        }, IDLE_TIMEOUT);
    }

    // Start timer on initial connect
    resetIdleTimer();

    function handleLeave(socket) {
        const now = Date.now();
        const joinedAt = leaveTimestamps[socket.id] || 0;
        const leftTooEarly = (now - joinedAt) < 10 * 1000; // Left within 10s

        if (leftTooEarly) {
            earlyLeaveCounts[socket.id] = (earlyLeaveCounts[socket.id] || 0) + 1;
        } else {
            earlyLeaveCounts[socket.id] = 0; // reset if they stayed long enough
        }

        if (earlyLeaveCounts[socket.id] >= 3) {
            const cooldown = 30 * 1000; // 30 seconds
            cooldownTimers[socket.id] = Date.now() + cooldown;
            socket.emit("chat-paused", cooldown / 1000); // notify frontend
            earlyLeaveCounts[socket.id] = 0;
        }

        leaveTimestamps[socket.id] = now;
    }

    //  Messaging
    socket.on("message", ({ roomId, message }) => {
        const now = Date.now();
        const last = lastMessageTime[socket.id] || 0;
        const burst = messageBursts[socket.id] || [];

        // Check cooldown
        if (now - last < MESSAGE_COOLDOWN) return;

        // Clean up old burst messages (keep only within 10s)
        const recentBursts = burst.filter(ts => now - ts < BURST_WINDOW);
        if (recentBursts.length >= BURST_LIMIT) {
            console.log(`[SPAM] ${socket.id} hit spam limit`);
            socket.emit("spam-warning", "You're sending messages too fast. Slow down!");
            return;
        }

        // Update burst and time tracking
        recentBursts.push(now);
        messageBursts[socket.id] = recentBursts;
        lastMessageTime[socket.id] = now;

        // Emit message
        socket.to(roomId).emit("message", message);
        resetIdleTimer();  // keep if you’ve added idle logic
    });

    //  Typing events
    socket.on("typing", (roomId) => {
        socket.to(roomId).emit("typing");
        resetIdleTimer();
    });

    socket.on("stop-typing", (roomId) => {
        socket.to(roomId).emit("stop-typing");
        resetIdleTimer();
    });

    socket.on("leave-room", (roomId) => {
        socket.leave(roomId);
        socket.to(roomId).emit("stranger-left");
        io.to(roomId).socketsLeave(roomId);
        console.log(`[LEAVE] ${socket.id} left ${roomId}`);

        clearTimeout(idleTimers[socket.id]);
        delete idleTimers[socket.id];
        delete lastMessageTime[socket.id];
        delete messageBursts[socket.id];

        handleLeave(socket); // ← ADD THIS
    });

    //  Disconnected
    socket.on("disconnect", () => {
        clearTimeout(idleTimers[socket.id]);
        delete idleTimers[socket.id];
        delete lastMessageTime[socket.id];
        delete messageBursts[socket.id];

        const rooms = Array.from(socket.rooms);
        for (const room of rooms) {
            if (room.startsWith("room-")) {
                socket.to(room).emit("stranger-left");
                io.to(room).socketsLeave(room);
                console.log(`[DISCONNECT] ${socket.id} left ${room}`);
            }
        }

        handleLeave(socket); // ← ADD THIS
    });
}

module.exports = handleChat;
