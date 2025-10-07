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

// Middlewares

app.use(cors({
  origin: ['http://localhost:3000/', 'https://chat-shat.vercel.app/'],
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
