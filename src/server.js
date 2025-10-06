import "./config/env.js";
import app from "./app.js";
import mongoose from "mongoose";
import http from "http";
import { Server } from "socket.io";
import { chatSocket } from "./sockets/chatSocket.js"; // ✅ import your socket handlers

const server = http.createServer(app);

const PORT = process.env.PORT || 10000;

// === Setup Socket.IO ===
export const io = new Server(server, {
  cors: {
    origin: ["http://localhost:3000", "https://chat-shat.vercel.app"], // array of allowed origins
    credentials: true,
  },
});
// Attach io to app
app.set("io", io);

// ✅ pass io to socket handler
chatSocket(io);
console.log("mongo url is:- ", process.env.MONGO_URI);
// === Connect MongoDB + Start Server ===
mongoose
  .connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => {
    console.log("✅ MongoDB connected");

    server.listen(PORT, () => {
      console.log(`🚀 Server + Socket.IO running on ${PORT}`);
    });
  })
  .catch((err) => {
    console.error("❌ MongoDB connection error:", err);
  });
