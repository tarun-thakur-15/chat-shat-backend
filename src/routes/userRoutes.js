import { Router } from "express";
import {
  signup,
  login,
  forgotPassword,
  verifyOtp,
  resetPassword,
  getMe,
} from "../controllers/authController.js";
import {
  uploadProfileImage,
  uploadCoverImage,
  updateBio,
  getMyProfile,
  getFriendRequests,
  getDashboardDetails,
  getMutuals,
  getSuggestedUsers,
  acceptFriendRequest,
  sendFriendRequest,
  searchUsers,
  searchFriends,
  getLastFriendRequests,
  unfriendUser,
  deleteFriendRequest,
  getUserProfile,
  removeFriend,
  changeFullName,
  changeUsername,
} from "../controllers/userController.js";
import { protect } from "../middlewares/authmiddleware.js";

const router = Router();

router.post("/signup", signup); // implemented and tested
router.post("/login", login); // implemented and tested
router.post("/forgot-password", forgotPassword); //implemented and tested
router.post("/verify-otp", verifyOtp); //implemented and tested
router.post("/reset-password", resetPassword); //implemented and tested
router.post("/logout", (req, res) => {
  res.clearCookie("accessToken", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
  }); 
  res.json({ message: "Logged out successfully" });
}); // implemented and tested
router.get("/getMe", protect, getMe); // implemented and tested
router.post("/profile-image", protect, uploadProfileImage); // implemented and tested
router.post("/cover-image", protect, uploadCoverImage); // implemented and tested
router.post("/bio", protect, updateBio); // implemented and tested
router.get("/myprofile", protect, getMyProfile); // implemented and tested
router.get("/dashboard", protect, getDashboardDetails);
router.get("/mutuals/:userId", protect, getMutuals);
router.get("/getSuggestedUsers", protect, getSuggestedUsers); // implemented and tested
router.post("/sendFriendRequest/:userId", protect, sendFriendRequest); // implemented and tested
router.post("/acceptFriendRequest/:userId", protect, acceptFriendRequest); // implemented and tested
router.get("/friends/requests", protect, getFriendRequests);
router.get("/searchUser", protect, searchUsers); // implemented and tested
router.get("/searchFriends", protect, searchFriends); // implemented and tested
router.get("/getLastThreeFriendRequests", protect, getLastFriendRequests);
router.post("/unfriend", protect, unfriendUser); // not needed
router.delete("/deleteRequest", protect, deleteFriendRequest); // implemented and tested
router.get("/user/:userIdorUsername", protect, getUserProfile); // implemented and tested
router.delete("/remove-friend/:userId", protect, removeFriend); // implemented and tested
router.patch("/changeFullName", protect, changeFullName); // implemented and tested
router.patch("/changeUserName", protect, changeUsername); // implemented and tested

export default router;
