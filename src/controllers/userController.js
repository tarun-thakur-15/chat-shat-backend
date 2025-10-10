import User from "../models/user.js";
import Conversation from "../models/Conversation.js";
import Chat from "../models/Chat.js";
import moment from "moment";
import mongoose from "mongoose";
import { v4 as uuidv4 } from "uuid";
import sharp from "sharp";
import os from "os";
import fs from "fs";
import path from "path";
import axios from "axios";
import FormData from "form-data";

const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHANNEL_ID = process.env.CHANNEL_ID;

// export const uploadProfileImage = async (req, res) => {
//   try {
//     if (!req.user || !req.user._id) {
//       return res.status(401).json({ success: false, message: "Unauthorized" });
//     }

//     const { filePath } = req.body;
//     if (!filePath) {
//       return res
//         .status(400)
//         .json({ success: false, message: "filePath is required" });
//     }

//     const base64Data = filePath.split(",")[1];
//     const buffer = Buffer.from(base64Data, "base64");

//     const filename = `${uuidv4()}.jpeg`;
//     const uploadPath = path.join(process.cwd(), "uploads", filename);

//     await sharp(buffer)
//       .jpeg({ quality: 70 })
//       .toFile(uploadPath);

//     const imageUrl = `${req.protocol}://${req.get("host")}/uploads/${filename}`;

//     const user = await User.findByIdAndUpdate(
//       req.user._id,
//       { profileImage: imageUrl },
//       { new: true }
//     ).select("profileImage");

//     if (!user) {
//       return res
//         .status(404)
//         .json({ success: false, message: "User not found" });
//     }

//     res.json({ success: true, profileImage: user.profileImage });
//   } catch (err) {
//     console.error("❌ Error in uploadProfileImage:", err);
//     res.status(500).json({ success: false, message: "Server error" });
//   }
// };
export const uploadProfileImage = async (req, res) => {
  try {
    if (!req.user || !req.user._id) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const { filePath } = req.body;
    if (!filePath) {
      return res
        .status(400)
        .json({ success: false, message: "filePath is required" });
    }

    // Decode base64 → buffer
    const base64Data = filePath.split(",")[1];
    const buffer = Buffer.from(base64Data, "base64");

    // Compress to temporary file
    const tmpPath = path.join(os.tmpdir(), `${uuidv4()}.jpeg`);
    await sharp(buffer)
      .resize({ width: 800, withoutEnlargement: true })
      .jpeg({ quality: 80, progressive: true })
      .toFile(tmpPath);

    // Prepare FormData for Telegram upload
    const formData = new FormData();
    formData.append("chat_id", CHANNEL_ID);
    formData.append("photo", fs.createReadStream(tmpPath));

    // Send to Telegram
    const tgRes = await axios.post(
      `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendPhoto`,
      formData,
      { headers: formData.getHeaders() }
    );

    // Get file_id of uploaded photo
    const photos = tgRes.data.result.photo;
    const fileId = photos[photos.length - 1].file_id;

    // Request Telegram for file path (publicly accessible)
    const fileRes = await axios.get(
      `https://api.telegram.org/bot${TELEGRAM_TOKEN}/getFile?file_id=${fileId}`
    );
    const tgFilePath = fileRes.data.result.file_path;
    const imageUrl = `https://api.telegram.org/file/bot${TELEGRAM_TOKEN}/${tgFilePath}`;

    // Clean up temporary file
    fs.unlink(tmpPath, () => {});

    // Update user profile image
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { profileImage: imageUrl },
      { new: true }
    ).select("profileImage");

    if (!user)
      return res
        .status(404)
        .json({ success: false, message: "User not found" });

    res.json({ success: true, profileImage: user.profileImage });
  } catch (err) {
    console.error("❌ Error in uploadProfileImage:", err.response?.data || err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// export const uploadCoverImage = async (req, res) => {
//   try {
//     if (!req.user || !req.user._id) {
//       return res.status(401).json({ success: false, message: "Unauthorized" });
//     }

//     const { filePath } = req.body;
//     if (!filePath) {
//       return res
//         .status(400)
//         .json({ success: false, message: "filePath is required" });
//     }

//     const base64Data = filePath.split(",")[1];
//     const buffer = Buffer.from(base64Data, "base64");

//     const MAX_SIZE_BYTES = 3 * 1024 * 1024;
//     if (buffer.length > MAX_SIZE_BYTES) {
//       return res
//         .status(400)
//         .json({ success: false, message: "Cover image cannot exceed 3MB" });
//     }

//     const fileName = `${uuidv4()}.jpeg`;
//     const uploadDir = path.join(process.cwd(), "uploads");
//     if (!fs.existsSync(uploadDir)) {
//       fs.mkdirSync(uploadDir);
//     }
//     const filePathOnDisk = path.join(uploadDir, fileName);

//     await sharp(buffer)
//       .jpeg({ quality: 75 })
//       .toFile(filePathOnDisk);

//     const imageUrl = `${req.protocol}://${req.get("host")}/uploads/${fileName}`;
//     const user = await User.findByIdAndUpdate(
//       req.user._id,
//       { coverImage: imageUrl },
//       { new: true }
//     ).select("coverImage");

//     if (!user) {
//       return res
//         .status(404)
//         .json({ success: false, message: "User not found" });
//     }

//     res.json({ success: true, coverImage: user.coverImage });
//   } catch (err) {
//     console.error("❌ Error in uploadCoverImage:", err);
//     res.status(500).json({ success: false, message: "Server error" });
//   }
// };
export const uploadCoverImage = async (req, res) => {
  try {
    if (!req.user || !req.user._id) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const { filePath } = req.body;
    if (!filePath) {
      return res
        .status(400)
        .json({ success: false, message: "filePath is required" });
    }

    // Decode base64 → buffer
    const base64Data = filePath.split(",")[1];
    const buffer = Buffer.from(base64Data, "base64");

    // Check size limit before processing (max 3MB)
    const MAX_SIZE_BYTES = 3 * 1024 * 1024;
    if (buffer.length > MAX_SIZE_BYTES) {
      return res
        .status(400)
        .json({ success: false, message: "Cover image cannot exceed 3MB" });
    }

    // Save to a temporary compressed file
    const tmpPath = path.join(os.tmpdir(), `${uuidv4()}.jpeg`);
    await sharp(buffer)
      .resize({ width: 1920, withoutEnlargement: true })
      .jpeg({ quality: 80, progressive: true })
      .toFile(tmpPath);

    // Prepare FormData for Telegram upload
    const formData = new FormData();
    formData.append("chat_id", CHANNEL_ID);
    formData.append("photo", fs.createReadStream(tmpPath));

    // Upload to Telegram
    const tgRes = await axios.post(
      `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendPhoto`,
      formData,
      { headers: formData.getHeaders() }
    );

    // Get file_id of uploaded photo
    const photos = tgRes.data.result.photo;
    const fileId = photos[photos.length - 1].file_id;

    // Request Telegram file path
    const fileRes = await axios.get(
      `https://api.telegram.org/bot${TELEGRAM_TOKEN}/getFile?file_id=${fileId}`
    );
    const tgFilePath = fileRes.data.result.file_path;

    // Construct Telegram CDN URL
    const imageUrl = `https://api.telegram.org/file/bot${TELEGRAM_TOKEN}/${tgFilePath}`;

    // Clean up temp file
    fs.unlink(tmpPath, () => {});

    // Update user with new cover image
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { coverImage: imageUrl },
      { new: true }
    ).select("coverImage");

    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    res.json({ success: true, coverImage: user.coverImage });
  } catch (err) {
    console.error("❌ Error in uploadCoverImage:", err.response?.data || err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};
export const updateBio = async (req, res) => {
  try {
    if (!req.user || !req.user._id) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const { bio } = req.body;
    if (!bio || typeof bio !== "string") {
      return res.status(400).json({
        success: false,
        message: "Bio is required and must be a string",
      });
    }

    if (bio.length > 500) {
      // arbitrary limit, can adjust
      return res
        .status(400)
        .json({ success: false, message: "Bio cannot exceed 500 characters" });
    }

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { bio },
      { new: true }
    ).select("bio");

    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    res.json({ success: true, bio: user.bio });
  } catch (err) {
    console.error("❌ Error in updateBio:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

export const getMyProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .populate("friends", "fullName username profileImage")
      .select("-passwordHash -__v");

    if (!user) return res.status(404).json({ message: "User not found" });

    const formattedDate = moment(user.createdAt).format("Do MMMM, YYYY");

    res.json({
      fullName: user.fullName,
      username: user.username,
      profileImage: user.profileImage,
      coverImage: user.coverImage,
      bio: user.bio,
      joinedOn: formattedDate,
      totalFriends: user.friends.length,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error" });
  }
};

export const sendFriendRequestbefore = async (req, res) => {
  try {
    if (!req.user || !req.user._id) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const { userId } = req.body; // recipient
    const senderId = req.user._id;

    if (!userId) {
      return res
        .status(400)
        .json({ success: false, message: "userId is required" });
    }

    if (senderId.toString() === userId.toString()) {
      return res
        .status(400)
        .json({ success: false, message: "Cannot send request to yourself" });
    }

    const recipient = await User.findById(userId);
    if (!recipient) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    // Check already friends
    if (recipient.friends.some((f) => f.toString() === senderId.toString())) {
      return res
        .status(400)
        .json({ success: false, message: "Already friends" });
    }

    // Check duplicate request
    if (
      recipient.friendRequests.some((f) => f.toString() === senderId.toString())
    ) {
      return res
        .status(400)
        .json({ success: false, message: "Request already sent" });
    }

    // If recipient already requested sender → auto accept
    const sender = await User.findById(senderId);
    if (sender.friendRequests.some((f) => f.toString() === userId.toString())) {
      sender.friendRequests = sender.friendRequests.filter(
        (f) => f.toString() !== userId.toString()
      );
      sender.friends.push(userId);
      recipient.friends.push(senderId);
      await sender.save();
      await recipient.save();

      return res.json({
        success: true,
        message: "Friend request auto-accepted",
      });
    }

    // Otherwise push new request
    recipient.friendRequests.push(senderId);
    await recipient.save();

    res.json({ success: true, message: "Friend request sent" });
  } catch (err) {
    console.error("❌ Error in sendFriendRequest:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

export const getFriendRequests = async (req, res) => {
  try {
    const currentUser = await User.findById(req.user._id).populate(
      "friendRequests",
      "fullName username profileImage"
    );

    if (!currentUser) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    res.json({
      success: true,
      requests: currentUser.friendRequests || [],
    });
  } catch (err) {
    console.error("❌ Error in getFriendRequests:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

export const getDashboardDetails = async (req, res) => {
  try {
    if (!req.user || !req.user._id) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const user = await User.findById(req.user._id)
      .populate("friends", "fullName username profileImage")
      .populate("friendRequests", "fullName username profileImage");

    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    res.json({
      success: true,
      friends: user.friends || [],
      topRequests: (user.friendRequests || []).slice(0, 3),
    });
  } catch (err) {
    console.error("❌ Error in getDashboardDetails:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

export const getMutuals = async (req, res) => {
  try {
    if (!req.user || !req.user._id) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const { userId } = req.params;

    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid user ID" });
    }

    const currentUser = await User.findById(req.user._id).select("friends");
    if (!currentUser) {
      return res
        .status(404)
        .json({ success: false, message: "Current user not found" });
    }

    const otherUser = await User.findById(userId).select("friends");
    if (!otherUser) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    const currentFriends = currentUser.friends.map((f) => f.toString());
    const otherFriends = otherUser.friends.map((f) => f.toString());

    const mutualIds = currentFriends.filter((id) => otherFriends.includes(id));

    const mutuals = await User.find({ _id: { $in: mutualIds } }).select(
      "fullName username profileImage"
    );

    res.json({
      success: true,
      mutuals: mutuals || [],
    });
  } catch (err) {
    console.error("❌ Error in getMutuals:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

export const getSuggestedUsers = async (req, res) => {
  try {
    const suggestedUserId = "68e3bff40683c2944cb37e41"; //user id of tarun thakur

    const user = await User.findById(suggestedUserId).select(
      "fullName username profileImage email friends friendRequests createdAt"
    );

    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "Suggested user not found" });
    }

    const formattedDate = moment(user.createdAt).format("Do MMMM, YYYY");

    // ✅ Check friendship
    const isFriend = user.friends.some(
      (friendId) => friendId.toString() === req.user._id.toString()
    );

    // ✅ Check if this user has sent us a request
    const hasSentRequest = user.friendRequests.some(
      (reqId) => reqId.toString() === req.user._id.toString()
    );

    // ✅ Transform into response object
    const suggestedUser = {
      _id: user._id,
      fullName: user.fullName,
      username: user.username,
      email: user.email,
      joinedOn: formattedDate,
      profileImage: user.profileImage,
      friendsCount: user.friends?.length || 0,
    };

    res.json({ success: true, suggested: suggestedUser });
  } catch (err) {
    console.error("❌ Error in getSuggestedUsers:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

export const sendFriendRequest = async (req, res) => {
  try {
    const { userId } = req.params;
    const currentUserId = req.user._id;

    if (userId === String(currentUserId)) {
      return res.status(400).json({
        success: false,
        message: "You cannot send a friend request to yourself.",
      });
    }

    const targetUser = await User.findById(userId);
    const currentUser = await User.findById(currentUserId);

    if (!targetUser) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    if (
      targetUser.friends.includes(currentUserId) ||
      currentUser.friends.includes(userId)
    ) {
      return res
        .status(400)
        .json({ success: false, message: "You are already friends." });
    }

    if (targetUser.friendRequests.includes(currentUserId)) {
      return res
        .status(400)
        .json({ success: false, message: "Friend request already sent." });
    }

    targetUser.friendRequests.push(currentUserId);
    await targetUser.save();

    res.json({ success: true, message: "Friend request sent." });
  } catch (err) {
    console.error("❌ Error in sendFriendRequest:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

export const acceptFriendRequest = async (req, res) => {
  try {
    const { userId } = req.params;
    const currentUserId = req.user._id;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid userId" });
    }

    if (userId === String(currentUserId)) {
      return res.status(400).json({
        success: false,
        message: "Cannot accept friend request from yourself",
      });
    }

    const currentUser = await User.findById(currentUserId);
    const requestSender = await User.findById(userId);

    if (!requestSender) {
      return res
        .status(404)
        .json({ success: false, message: "Request sender not found" });
    }

    if (!currentUser.friendRequests.some((id) => id.equals(userId))) {
      return res
        .status(400)
        .json({ success: false, message: "No friend request from this user." });
    }

    // Mutual friendship without duplicates
    if (!currentUser.friends.some((id) => id.equals(userId))) {
      currentUser.friends.push(userId);
    }
    if (!requestSender.friends.some((id) => id.equals(currentUserId))) {
      requestSender.friends.push(currentUserId);
    }

    // Remove request
    currentUser.friendRequests = currentUser.friendRequests.filter(
      (id) => !id.equals(userId)
    );

    await currentUser.save();
    await requestSender.save();

    res.json({ success: true, message: "Friend request accepted." });
  } catch (err) {
    console.error("❌ Error in acceptFriendRequest:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

export const searchUsers = async (req, res) => {
  try {
    const { query } = req.query; // ?query=tarun

    if (!query || query.trim() === "") {
      return res
        .status(400)
        .json({ success: false, message: "Search query is required" });
    }

    // Find users by username OR fullName (case-insensitive)
    const users = await User.find({
      $or: [
        { username: { $regex: query, $options: "i" } },
        { fullName: { $regex: query, $options: "i" } },
      ],
    }).select("fullName username profileImage email friends createdAt");

    if (!users.length) {
      return res
        .status(404)
        .json({ success: false, message: "No users found" });
    }

    // ✅ Transform each user into enriched object
    const transformed = users.map((user) => {
      const formattedDate = moment(user.createdAt).format("Do MMMM, YYYY");

      const isFriend = user.friends.some(
        (friendId) => friendId.toString() === req.user._id.toString()
      );

      return {
        _id: user._id,
        fullName: user.fullName,
        username: user.username,
        email: user.email,
        profileImage: user.profileImage,
        joinedOn: formattedDate,
        friendsCount: user.friends?.length || 0,
      };
    });

    res.json({ success: true, results: transformed });
  } catch (err) {
    console.error("❌ Error in searchUsers:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

export const searchFriends = async (req, res) => {
  try {
    const { username } = req.query;

    if (!username || username.trim() === "") {
      return res
        .status(400)
        .json({ success: false, message: "Username is required" });
    }

    // Find the exact user by username
    const targetUser = await User.findOne({
      username: username.toLowerCase(),
    }).select("friends");

    if (!targetUser) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    // Fetch details of friends

    const results = await User.find({
      _id: { $in: targetUser.friends },
    }).select("_id username fullName profileImage");

    res.json({ success: true, results });
  } catch (err) {
    console.error("❌ Error in searchFriends:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

export const getLastFriendRequests = async (req, res) => {
  try {
    const currentUser = await User.findById(req.user._id).populate({
      path: "friendRequests",
      select: "fullName username profileImage",
    });

    if (!currentUser) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Get only the last 3 requests
    const lastRequests = currentUser.friendRequests.slice(-3).reverse();
    // reverse to show newest first

    res.json({
      success: true,
      requests: lastRequests,
    });
  } catch (err) {
    console.error("❌ Error in getLastFriendRequests:", err);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

export const unfriendUser = async (req, res) => {
  try {
    const { friendId } = req.body; // friend’s _id to unfriend

    if (!friendId) {
      return res.status(400).json({
        success: false,
        message: "Friend ID is required",
      });
    }

    // Remove friendId from current user's friends list
    await User.findByIdAndUpdate(req.user._id, {
      $pull: { friends: friendId },
    });

    // Remove current user from friend's friends list
    await User.findByIdAndUpdate(friendId, {
      $pull: { friends: req.user._id },
    });

    res.json({
      success: true,
      message: "Friend removed successfully",
    });
  } catch (err) {
    console.error("❌ Error in unfriendUser:", err);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

export const deleteFriendRequest = async (req, res) => {
  try {
    const { userId } = req.body; // the user who sent the request

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "User ID is required",
      });
    }

    // Find the current logged-in user
    const currentUser = await User.findById(req.user._id);

    if (!currentUser) {
      return res.status(404).json({
        success: false,
        message: "Current user not found",
      });
    }

    // Check if request exists
    if (!currentUser.friendRequests.includes(userId)) {
      return res.status(400).json({
        success: false,
        message: "No friend request from this user",
      });
    }

    // Remove the request
    currentUser.friendRequests = currentUser.friendRequests.filter(
      (reqId) => reqId.toString() !== userId.toString()
    );
    await currentUser.save();

    res.json({
      success: true,
      message: "Friend request deleted successfully",
    });
  } catch (err) {
    console.error("❌ Error in deleteFriendRequest:", err);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

export const getUserProfile = async (req, res) => {
  try {
    const { userIdorUsername } = req.params; // could be ObjectId or username
    let user;

    // ✅ Check if userId is a valid MongoDB ObjectId
    if (mongoose.Types.ObjectId.isValid(userIdorUsername)) {
      user = await User.findById(userIdorUsername).select(
        "fullName username profileImage coverImage bio friends friendRequests createdAt"
      );
    } else {
      // Otherwise, treat it as username
      user = await User.findOne({
        username: userIdorUsername.toLowerCase(),
      }).select(
        "fullName username profileImage coverImage bio friends friendRequests createdAt"
      );
    }

    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    // ✅ Fetch the logged-in user to safely check their friendRequests
    const loggedInUser = await User.findById(req.user._id).select(
      "friendRequests friends"
    );

    if (!loggedInUser) {
      return res
        .status(404)
        .json({ success: false, message: "Logged-in user not found" });
    }

    const formattedDate = moment(user.createdAt).format("Do MMMM, YYYY");

    // ✅ Check if they are already friends
    const isFriend = user.friends.some(
      (friendId) => friendId.toString() === req.user._id.toString()
    );

    // ✅ Check if logged-in user has SENT a friend request to this user
    const hasSendFriendRequest = user.friendRequests.some(
      (requesterId) => requesterId.toString() === req.user._id.toString()
    );

    // ✅ Check if logged-in user has RECEIVED a friend request from this user
    const hasReceivedFriendRequest = loggedInUser.friendRequests.some(
      (requesterId) => requesterId.toString() === user._id.toString()
    );

    // ✅ Final response
    res.json({
      success: true,
      profile: {
        _id: user._id,
        fullName: user.fullName,
        username: user.username,
        profileImage: user.profileImage,
        coverImage: user.coverImage,
        bio: user.bio,
        joinedOn: formattedDate,
        totalFriends: user.friends.length,
        isFriend,
        hasSendFriendRequest,
        hasReceivedFriendRequest,
      },
    });
  } catch (err) {
    console.error("❌ Error in getUserProfile:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

export const removeFriend = async (req, res) => {
  try {
    const { userId } = req.params;
    const currentUserId = req.user._id;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid userId" });
    }

    if (userId === String(currentUserId)) {
      return res
        .status(400)
        .json({ success: false, message: "You cannot unfriend yourself." });
    }

    const currentUser = await User.findById(currentUserId);
    const friendUser = await User.findById(userId);

    if (!friendUser) {
      return res
        .status(404)
        .json({ success: false, message: "Friend not found" });
    }

    // Remove from friends lists
    currentUser.friends = currentUser.friends.filter(
      (id) => !id.equals(userId)
    );
    friendUser.friends = friendUser.friends.filter(
      (id) => !id.equals(currentUserId)
    );

    await currentUser.save();
    await friendUser.save();

    // 🧹 Delete conversation between them
    const conversation = await Conversation.findOneAndDelete({
      participants: { $all: [currentUserId, userId] },
    });

    // 🗑️ If you also store chat messages, delete them too
    if (conversation) {
      await Chat.deleteMany({ conversation: conversation._id });
    }

    res.json({
      success: true,
      message: "Friend removed and conversation deleted successfully.",
    });
  } catch (err) {
    console.error("❌ Error in removeFriend:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

export const changeFullName = async (req, res) => {
  try {
    const { fullName } = req.body;
    const userId = req.user._id;

    if (!fullName || fullName.trim() === "") {
      return res
        .status(400)
        .json({ success: false, message: "Full name is required" });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    user.fullName = fullName.trim();
    await user.save();

    res.json({
      success: true,
      message: "Full name updated successfully",
      fullName: user.fullName,
    });
  } catch (err) {
    console.error("❌ Error in changeFullName:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

export const changeUsername = async (req, res) => {
  try {
    const { username } = req.body;
    const userId = req.user._id;

    if (!username || username.trim() === "") {
      return res
        .status(400)
        .json({ success: false, message: "Username is required" });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    // Check if username already exists
    const existing = await User.findOne({ username: username.toLowerCase() });
    if (existing) {
      return res
        .status(400)
        .json({ success: false, message: "Username already taken" });
    }

    // Check how many times username changed in last 7 days
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const recentChanges = user.usernameChangeHistory.filter(
      (change) => change.changedAt > oneWeekAgo
    );

    if (recentChanges.length >= 2) {
      return res.status(400).json({
        success: false,
        message: "You can only change your username twice per week",
      });
    }

    // Change username
    user.username = username.toLowerCase().trim();
    user.usernameChangeHistory.push({ changedAt: new Date() });
    await user.save();

    res.json({
      success: true,
      message: "Username updated successfully",
      username: user.username,
    });
  } catch (err) {
    console.error("❌ Error in changeUsername:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};
