import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import userRoutes from "./routes/userRoutes.js";
import chatRoutes from "./routes/chatRoutes.js";
import path from "path";
import cookieParser from "cookie-parser";
import { scheduleCompressedFileCleanup } from "./cronjob/cleanup.js";

dotenv.config();
const app = express();
app.set("trust proxy", 1);

// app.use((req, res, next) => {
//   if (req.secure || req.headers['x-forwarded-proto'] === 'https') {
//     next();
//   } else {
//     return res.redirect(`https://${req.headers.host}${req.url}`);
//   }
// });

// Middlewares

app.use(cors({
  origin: ["https://chat-shat.vercel.app", "http://localhost:3000"],
  credentials: true,
}));

app.use(cookieParser());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ limit: "10mb", extended: true }));
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

// Routes
app.use("/api", userRoutes);
app.use("/api", chatRoutes);
scheduleCompressedFileCleanup();

export default app;
