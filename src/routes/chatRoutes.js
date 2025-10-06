import express from "express";
import { startConversation, sendMessage, getMessages, markMessageSeen, getConversations, unsendMessage } from "../controllers/chatController.js";
import { protect } from "../middlewares/authmiddleware.js";
import { upload } from "../middlewares/upload.js";

const router = express.Router();

router.get("/getConversations", protect, getConversations);
router.post("/startConversation", protect, startConversation);
router.post("/sendMessage", protect, upload.single("media"), sendMessage);
router.get("/messages/:conversationId", protect, getMessages);
router.patch("/message/seen", protect, markMessageSeen);
router.post("/message/unsend", protect, unsendMessage);

export default router;
