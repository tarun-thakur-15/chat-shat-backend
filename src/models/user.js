import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true, trim: true },
    username: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    passwordHash: { type: String, required: true },
    isVerified: { type: Boolean, default: false },

    // new fields
    profileImage: { type: String, default: "" }, // store file path or URL
    coverImage: { type: String, default: "" },
    bio: { type: String, default: "" },

    friends: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }], // accepted friends
    friendRequests: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }], // incoming requests

    usernameChangeHistory: [{ changedAt: { type: Date, default: Date.now } }],
  },
  { timestamps: true }
);

export default mongoose.model("User", userSchema);
