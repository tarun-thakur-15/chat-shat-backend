import mongoose from "mongoose";

const chatSchema = new mongoose.Schema(
  {
    conversation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Conversation",
      required: true,
    },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    receiver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    message: { type: String, default: "" }, // text message
    fileName: { type: String },
    fileSize: { type: Number },
    mediaUrl: { type: String, default: "" }, // media file path
    fileType: { type: String },

    status: {
      type: String,
      enum: ["sent", "delivered", "seen"],
      default: "sent",
    },

    seenAt: { type: Date, default: null },
  },
  { timestamps: true }
);

export default mongoose.model("Chat", chatSchema);
