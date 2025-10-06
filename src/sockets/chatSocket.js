import Chat from "../models/Chat.js";
import { activeCalls } from "./callStore.js";

// ✅ Global map of currently online users
const onlineUsers = new Map();

export const chatSocket = (io) => {
  // ✅ Keep this outer listener — it handles everything for chat & presence
  io.on("connection", (socket) => {
    console.log("⚡ User connected:", socket.id);

    // ================== ONLINE STATUS HANDLING ==================

    // When a user registers (login)
    socket.on("register-user", (userId) => {
      socket.userId = userId;
      onlineUsers.set(userId, socket.id);
      console.log(`✅ User online: ${userId}`);

      // Broadcast that this user is now online
      io.emit("user:status", { userId, online: true });
    });

    // Handle online status check
    socket.on("user:check-status", (userId, callback) => {
      const isOnline = onlineUsers.has(userId);
      if (callback) callback(isOnline);
    });

    // When a user logs out manually
    socket.on("user:logout", (userId) => {
      onlineUsers.delete(userId);
      console.log(`🚪 User logged out: ${userId}`);
      io.emit("user:status", { userId, online: false });
    });

    // Auto remove user on disconnect
    socket.on("disconnect", () => {
      const userId = socket.userId;
      if (userId && onlineUsers.has(userId)) {
        onlineUsers.delete(userId);
        console.log(`❌ User offline: ${userId}`);
        io.emit("user:status", { userId, online: false });
      }
      console.log("🔌 Socket disconnected:", socket.id);
    });

    // ================== CHAT ROOM & MESSAGE HANDLING ==================

    socket.on("user:join", ({ userId }) => {
      socket.join(userId);
      console.log(`👤 User ${userId} joined personal room`);
    });

    socket.on("conversation:join", ({ conversationId }) => {
      socket.join(conversationId);
      console.log(`💬 ${socket.id} joined conversation ${conversationId}`);
    });

    socket.on("conversation:leave", ({ conversationId }) => {
      socket.leave(conversationId);
      console.log(`🚪 ${socket.id} left conversation ${conversationId}`);
    });

    // Send + Save Message
    socket.on("sendMessage", async (data) => {
      try {
        const { conversationId, message, mediaUrl, sender, receiver } = data;

        // 1️⃣ Save in DB
        const chat = await Chat.create({
          conversation: conversationId,
          sender,
          receiver,
          message,
          mediaUrl,
        });

        // 2️⃣ Populate user fields
        await chat.populate("sender", "username fullName profileImage");
        await chat.populate("receiver", "username fullName profileImage");

        // 3️⃣ Emit to room
        io.to(conversationId).emit("receiveMessage", chat);
      } catch (err) {
        console.error("❌ Error saving message:", err);
      }
    });

    // Seen status
    socket.on("markSeen", (data) => {
      const { conversationId, messageId } = data;
      io.to(conversationId).emit("messageSeen", { messageId, status: "seen" });
    });

    // Typing indicators
    socket.on("typing", ({ conversationId, senderId }) => {
      socket.to(conversationId).emit("typing", { senderId });
    });

    socket.on("typing_stop", ({ conversationId, senderId }) => {
      socket.to(conversationId).emit("typing_stop", { senderId });
    });

    // ================== AUDIO CALL EVENTS ==================
    const userSockets = new Map(); // Map of userId -> socket
    const activeCalls = new Map(); // Map of callKey -> call info

    function getCallKey(callerId, calleeId) {
      return [callerId, calleeId].sort().join("-");
    }

    // Register for call system
    socket.on("register-user", (userId) => {
      socket.userId = userId;
      userSockets.set(userId, socket);
      console.log(`🔗 Registered user (call): ${userId}`);
    });

    // Initiate call
    socket.on("webrtc:call", ({ to, from, callerName }) => {
      const callKey = getCallKey(from, to);
      activeCalls.set(callKey, {
        callerId: from,
        calleeId: to,
        status: "ringing",
      });

      const calleeSocket = userSockets.get(to);
      if (calleeSocket) {
        calleeSocket.emit("webrtc:incoming-call", { from, callerName });
        socket.emit("call-status", { status: "calling", with: to });
        calleeSocket.emit("call-status", { status: "ringing", with: from });
      }
    });

    // Accept call
    socket.on("webrtc:accept", ({ from, to }) => {
      const callKey = getCallKey(from, to);
      const call = activeCalls.get(callKey);
      if (call) {
        call.status = "in-call";
        activeCalls.set(callKey, call);

        const callerSocket = userSockets.get(to);
        if (callerSocket) {
          callerSocket.emit("webrtc:call-accepted", { from });
          socket.emit("call-status", { status: "in-call", with: to });
          callerSocket.emit("call-status", { status: "in-call", with: from });
        }
      }
    });

    // Reject call
    socket.on("webrtc:reject", ({ from, to }) => {
      const callKey = getCallKey(from, to);
      activeCalls.delete(callKey);

      const callerSocket = userSockets.get(to);
      if (callerSocket) {
        callerSocket.emit("webrtc:call-rejected", { from });
        socket.emit("call-status", { status: "rejected", with: to });
        callerSocket.emit("call-status", { status: "rejected", with: from });
      }
    });

    // Offer
    socket.on("webrtc:offer", ({ to, offer }) => {
      const targetSocket = userSockets.get(to);
      if (targetSocket) {
        targetSocket.emit("webrtc:offer", { from: socket.userId, offer });
        targetSocket.emit("call-status", {
          status: "connecting",
          with: socket.userId,
        });
      }
    });

    // Answer
    socket.on("webrtc:answer", ({ to, answer }) => {
      const targetSocket = userSockets.get(to);
      if (targetSocket) {
        targetSocket.emit("webrtc:answer", { from: socket.userId, answer });
        targetSocket.emit("call-status", {
          status: "connecting",
          with: socket.userId,
        });
      }
    });

    // ICE candidates
    socket.on("webrtc:ice-candidate", ({ to, candidate }) => {
      const targetSocket = userSockets.get(to);
      if (targetSocket) {
        targetSocket.emit("webrtc:ice-candidate", {
          from: socket.userId,
          candidate,
        });
      }
    });

    // Hang up
    socket.on("webrtc:hangup", ({ to }) => {
      const callKey = getCallKey(socket.userId, to);
      activeCalls.delete(callKey);

      const targetSocket = userSockets.get(to);
      if (targetSocket) {
        targetSocket.emit("webrtc:hangup", { from: socket.userId });
        socket.emit("call-status", { status: "ended", with: to });
        targetSocket.emit("call-status", {
          status: "ended",
          with: socket.userId,
        });
      }
    });

    // Cleanup on disconnect for call system
    socket.on("disconnect", () => {
      if (socket.userId) {
        userSockets.delete(socket.userId);
        for (const [key, call] of activeCalls.entries()) {
          if (
            call.callerId === socket.userId ||
            call.calleeId === socket.userId
          ) {
            activeCalls.delete(key);
          }
        }
      }
    });
  });
};
