const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const registerSocketHandlers = require("./socket");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*" },
});

io.on("connection", (socket) => {
    registerSocketHandlers(io, socket);
});

server.listen(3000, () => {
    console.log("🚀 Server running at http://localhost:3000");
});
