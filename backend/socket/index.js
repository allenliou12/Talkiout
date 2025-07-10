const handleMatchmaking = require("./matchmaking");
const handleChat = require("./chat");

module.exports = function registerSocketHandlers(io, socket) {
    handleMatchmaking(io, socket);
    handleChat(io, socket);
};
