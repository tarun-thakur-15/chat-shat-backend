import mongoose from "mongoose";

const conversationSchema = new mongoose.Schema(
  {
    participants: [
      { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }
    ],

    latestMessage: { type: mongoose.Schema.Types.ObjectId, ref: "Chat" },
    updatedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

conversationSchema.index({ participants: 1 }, { unique: true });

export default mongoose.model("Conversation", conversationSchema);
