import Chat from "../models/Chat.js";
import Conversation from "../models/Conversation.js";
import User from "../models/user.js";
import { io } from "../server.js";
import fs from "fs";
import axios from "axios";
import FormData from "form-data";
import sharp from "sharp";
import os from "os";
import path from "path";
import dotenv from "dotenv";
dotenv.config();
const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHANNEL_ID = process.env.CHANNEL_ID;

export const getConversations = async (req, res) => {
  try {
    const userId = req.user._id;

    // 🧩 Fetch user to get friend list
    const user = await User.findById(userId).select("friends friendRequests");
    const friendIds = user.friends.map((id) => id.toString());

    // 🧩 Fetch all conversations for this user
    const conversations = await Conversation.find({
      participants: userId,
    })
      .sort({ updatedAt: -1 })
      .populate("participants", "username fullName profileImage")
      .populate({
        path: "latestMessage",
        select: "message mediaUrl sender status createdAt",
        populate: { path: "sender", select: "username fullName profileImage" },
      });

    const validConversations = [];

    // ✅ Process and filter conversations
    for (const convo of conversations) {
      const otherParticipants = convo.participants.filter(
        (p) => p._id.toString() !== userId.toString()
      );

      // 🧠 Skip and delete conversation if not a friend anymore
      const isStillFriend = otherParticipants.every((p) =>
        friendIds.includes(p._id.toString())
      );

      if (!isStillFriend) {
        await Conversation.findByIdAndDelete(convo._id);
        await Chat.deleteMany({ conversation: convo._id });
        continue;
      }

      // Count unseen messages per participant
      const participantsWithNewCount = await Promise.all(
        otherParticipants.map(async (p) => {
          const newMessagesCount = await Chat.countDocuments({
            conversation: convo._id,
            sender: p._id,
            receiver: userId,
            status: { $ne: "seen" },
          });

          return {
            ...p.toObject(),
            newMessagesCount,
          };
        })
      );

      validConversations.push({
        ...convo.toObject(),
        participants: participantsWithNewCount,
      });
    }

    // 🧩 Friends without conversation
    const friendsWithConversationIds = validConversations
      .map((c) => c.participants[0]?._id.toString())
      .filter(Boolean);

    const friendsWithoutConversation = await User.find({
      _id: { $in: friendIds, $nin: friendsWithConversationIds },
    }).select("username fullName profileImage");

    const totalFriendRequests = user.friendRequests.length;

    // 🔁 Socket emit for real-time sync
    io.to(userId.toString()).emit("conversation:update", {
      conversations: validConversations,
      friendsWithoutConversation,
      totalFriendRequests,
    });

    res.json({
      success: true,
      conversations: validConversations,
      friendsWithoutConversation,
      totalFriendRequests,
    });
  } catch (err) {
    console.error("❌ Error in getConversations:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// Send message
export const sendMessage = async (req, res) => {
  try {
    const { receiverId, message, fileType } = req.body;
    const senderId = req.user._id;

    // Validate friendship
    const sender = await User.findById(senderId).select("friends");
    if (!sender)
      return res
        .status(404)
        .json({ success: false, message: "Sender not found" });

    const isFriend = sender.friends.some((f) => f.equals(receiverId));
    if (!isFriend)
      return res.status(403).json({
        success: false,
        message: "You can only send messages to friends",
      });

    // Check or create conversation
    let conversation = await Conversation.findOne({
      participants: { $all: [senderId, receiverId] },
    });
    if (!conversation) {
      conversation = await Conversation.create({
        participants: [senderId, receiverId],
      });
    }

    let mediaUrl = null;
    let fileName = null;
    let fileSize = null;

    if (req.file) {
      fileName = req.file.originalname;
      fileSize = req.file.size;

      const formData = new FormData();
      formData.append("chat_id", CHANNEL_ID);

      let fileId = null;

      // ✅ Decide upload method based on fileType instead of only mimetype
      if (fileType === "photo") {
        // Compress image before sending to Telegram
        const compressedPath = path.join(
          os.tmpdir(),
          `compressed-${Date.now()}.jpg`
        );
        await sharp(req.file.path)
          .resize({ width: 1920, withoutEnlargement: true })
          .jpeg({ quality: 85, progressive: true, chromaSubsampling: "4:4:4" })
          .toFile(compressedPath);

        formData.append("photo", fs.createReadStream(compressedPath));
        const tgRes = await axios.post(
          `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendPhoto`,
          formData,
          { headers: formData.getHeaders() }
        );
        const photos = tgRes.data.result.photo;
        fileId = photos[photos.length - 1].file_id;

        fs.unlinkSync(compressedPath);
      } else if (fileType === "video") {
        formData.append("video", fs.createReadStream(req.file.path));
        const tgRes = await axios.post(
          `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendVideo`,
          formData,
          { headers: formData.getHeaders() }
        );
        fileId = tgRes.data.result.video.file_id;
      } else {
        // Treat as document for "doc" and "audio"
        formData.append("document", fs.createReadStream(req.file.path));
        const tgRes = await axios.post(
          `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendDocument`,
          formData,
          { headers: formData.getHeaders() }
        );
        fileId = tgRes.data.result.document.file_id;
      }

      // ✅ Get permanent file path from Telegram
      if (fileId) {
        const fileRes = await axios.get(
          `https://api.telegram.org/bot${TELEGRAM_TOKEN}/getFile?file_id=${fileId}`
        );
        const filePath = fileRes.data.result.file_path;
        mediaUrl = `https://api.telegram.org/file/bot${TELEGRAM_TOKEN}/${filePath}`;
      }

      // Clean up uploaded temp file
      fs.unlink(req.file.path, (err) => {
        if (err) console.error("❌ Error deleting uploaded file:", err);
      });
    }

    // Save chat in DB
    const chat = await Chat.create({
      conversation: conversation._id,
      sender: senderId,
      receiver: receiverId,
      message,
      fileName,
      fileSize,
      mediaUrl,
      fileType: fileType || "doc",
      status: "sent",
    });

    await chat.populate("sender", "username fullName profileImage");
    await chat.populate("receiver", "username fullName profileImage");

    conversation.latestMessage = chat._id;
    conversation.updatedAt = new Date();
    await conversation.save();

    const io = req.app.get("io");
    io.to(conversation._id.toString()).emit("receiveMessage", chat);

    // ✅ Updated conversation with new message counts
    const updatedConversation = await Conversation.findById(conversation._id)
      .sort({ updatedAt: -1 })
      .populate("participants", "username fullName profileImage")
      .populate({
        path: "latestMessage",
        select: "message mediaUrl sender status createdAt",
        populate: { path: "sender", select: "username fullName profileImage" },
      });

    // Recalculate unread counts
    const conversationsWithCounts = await Promise.all(
      conversation.participants.map(async (pid) => {
        const newMessagesCount = await Chat.countDocuments({
          conversation: conversation._id,
          receiver: pid,
          status: { $ne: "seen" },
        });

        return {
          ...updatedConversation.toObject(),
          newMessagesCount,
        };
      })
    );

    // Emit updated conversation to each participant
    conversation.participants.forEach((pid, index) => {
      io.to(pid.toString()).emit("conversation:update", {
        conversations: [conversationsWithCounts[index]],
      });
    });

    res.json({ success: true, chat });
  } catch (err) {
    console.error("❌ Error in sendMessage:", err.response?.data || err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

export const startConversation = async (req, res) => {
  try {
    const { receiverId } = req.body;
    const senderId = req.user._id;

    if (!receiverId) {
      return res
        .status(400)
        .json({ success: false, message: "Receiver ID is required" });
    }

    // Check if sender exists
    const sender = await User.findById(senderId).select("friends");
    if (!sender) {
      return res
        .status(404)
        .json({ success: false, message: "Sender not found" });
    }

    // ✅ Check if receiver is a friend
    const isFriend = sender.friends.some((friendId) =>
      friendId.equals(receiverId)
    );
    if (!isFriend) {
      return res.status(403).json({
        success: false,
        message: "You can only start conversations with friends",
      });
    }

    // Check if conversation already exists
    let conversation = await Conversation.findOne({
      participants: { $all: [senderId, receiverId] },
    });

    if (conversation) {
      return res.status(200).json({
        success: true,
        conversation,
        message: "Conversation already exists",
      });
    }

    // Create new conversation
    conversation = await Conversation.create({
      participants: [senderId, receiverId],
    });

    res.status(201).json({ success: true, conversation });
  } catch (err) {
    console.error("❌ Error in startConversation:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

export const getMessages = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { before, limit = 10 } = req.query;
    const senderId = req.user._id;

    if (!conversationId) {
      return res.status(400).json({
        success: false,
        message: "Conversation ID is required",
      });
    }

    // 🔹 MARK UNREAD MESSAGES AS SEEN
    await Chat.updateMany(
      {
        conversation: conversationId,
        receiver: senderId,
        status: { $ne: "seen" },
      },
      {
        $set: { status: "seen", seenAt: new Date() },
      }
    );

    const query = { conversation: conversationId };
    if (before) {
      query.createdAt = { $lt: new Date(before) };
    }

    let messages = await Chat.find(query)
      .sort({ createdAt: -1 })
      .limit(Number(limit))
      .populate("sender", "username fullName profileImage")
      .populate("receiver", "username fullName profileImage");

    if (messages.length === 0) {
      let conversation = await Conversation.findById(conversationId).populate(
        "participants",
        "username fullName profileImage"
      );

      if (!conversation) {
        return res.status(404).json({
          success: false,
          message: "Conversation not found",
        });
      }

      return res.json({
        success: true,
        messages: [],
        conversation,
        pagination: {
          limit: Number(limit),
          hasMore: false,
          nextCursor: null,
        },
      });
    }

    const updatedMessages = await Promise.all(
      messages.map(async (msg) => {
        let obj = msg.toObject();
        if (obj.mediaUrl) {
          try {
            const fileRes = await axios.get(
              `https://api.telegram.org/bot${TELEGRAM_TOKEN}/getFile?file_id=${obj.mediaUrl}`
            );
            const filePath = fileRes.data.result.file_path;
            obj.mediaUrl = `https://api.telegram.org/file/bot${TELEGRAM_TOKEN}/${filePath}`;
          } catch (err) {
            console.error("Error fetching file:", err.response?.data || err);
          }
        }
        return obj;
      })
    );

    const finalMessages = updatedMessages.reverse();

    // 🔹 EMIT UPDATED CONVERSATIONS
    const io = req.app.get("io");
    if (io) {
      const conversations = await Conversation.find({
        participants: senderId,
      })
        .sort({ updatedAt: -1 })
        .populate("participants", "username fullName profileImage")
        .populate({
          path: "latestMessage",
          select: "message mediaUrl sender status createdAt",
          populate: {
            path: "sender",
            select: "username fullName profileImage",
          },
        });

      const filteredConversations = await Promise.all(
        conversations.map(async (convo) => {
          const otherParticipants = convo.participants.filter(
            (p) => p._id.toString() !== senderId.toString()
          );

          const participantsWithNewCount = await Promise.all(
            otherParticipants.map(async (p) => {
              const newMessagesCount = await Chat.countDocuments({
                conversation: convo._id,
                sender: p._id,
                receiver: senderId,
                status: { $ne: "seen" },
              });

              return {
                ...p.toObject(),
                newMessagesCount,
              };
            })
          );

          return {
            ...convo.toObject(),
            participants: participantsWithNewCount,
          };
        })
      );

      io.to(senderId.toString()).emit("conversation:update", {
        conversations: filteredConversations,
      });
    } else {
      console.warn("⚠️ Socket.IO not available");
    }

    res.json({
      success: true,
      messages: finalMessages,
      pagination: {
        limit: Number(limit),
        hasMore: updatedMessages.length === Number(limit),
        nextCursor:
          updatedMessages.length > 0
            ? updatedMessages[updatedMessages.length - 1].createdAt
            : null,
      },
    });
  } catch (err) {
    console.error("❌ Error in getMessages:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// Mark a message as seen
export const markMessageSeen = async (req, res) => {
  try {
    const { messageId } = req.body;

    if (!messageId) {
      return res
        .status(400)
        .json({ success: false, message: "Message ID is required" });
    }

    const chat = await Chat.findById(messageId);

    if (!chat) {
      return res
        .status(404)
        .json({ success: false, message: "Message not found" });
    }

    // Only receiver can mark as seen
    if (chat.receiver.toString() !== req.user._id.toString()) {
      return res
        .status(403)
        .json({ success: false, message: "Unauthorized action" });
    }

    chat.status = "seen";
    chat.seenAt = new Date();

    await chat.save();

    res.json({ success: true, chat });
  } catch (err) {
    console.error("❌ Error in markMessageSeen:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

export const unsendMessage = async (req, res) => {
  try {
    const userId = req.user._id;
    const { messageId } = req.body;

    if (!messageId) {
      return res
        .status(400)
        .json({ success: false, message: "messageId is required" });
    }

    const message = await Chat.findById(messageId);
    if (!message) {
      return res
        .status(404)
        .json({ success: false, message: "Message not found" });
    }

    // Only sender can unsend
    if (message.sender.toString() !== userId.toString()) {
      return res
        .status(403)
        .json({
          success: false,
          message: "You can only unsend your own messages",
        });
    }

    const conversationId = message.conversation;

    // Delete message
    await Chat.findByIdAndDelete(messageId);

    // Update latestMessage in conversation
    const lastMessage = await Chat.findOne({
      conversation: conversationId,
    }).sort({ createdAt: -1 });
    await Conversation.findByIdAndUpdate(conversationId, {
      latestMessage: lastMessage ? lastMessage._id : null,
      updatedAt: new Date(),
    });

    const io = req.app.get("io");
    io.to(conversationId.toString()).emit("message:unsend", { messageId });

    res.json({ success: true, message: "Message unsent successfully" });
  } catch (err) {
    console.error("❌ Error in unsendMessage:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};
