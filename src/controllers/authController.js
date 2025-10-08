import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/user.js";
import OtpToken from "../models/otpToken.js";
import { generateSixDigitOtp } from "../utils/generateOtp.js";
import { signAccessTokenn, verifyToken } from "../utils/token.js";
import { sendOtpEmail } from "../utils/sendOtpEmail.js";

const JWT_SECRET = process.env.JWT_SECRET;

const OTP_TTL_MINUTES = parseInt(process.env.OTP_TTL_MINUTES || "10", 10);

export async function signup(req, res, next) {
  try {
    const { fullName, username, email, password } = req.body;
    if (!fullName || !username || !email || !password) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const usernameLC = username.toLowerCase();
    const emailLC = email.toLowerCase();

    // check if verified user already exists
    const existingUser = await User.findOne({
      $or: [{ email: emailLC }, { username: usernameLC }],
      isVerified: true,
    });
    if (existingUser) {
      return res
        .status(409)
        .json({ message: "Email or username already in use" });
    }

    // delete any previous unconsumed OTP for this email
    await OtpToken.deleteMany({ email: emailLC, purpose: "signup" });

    // hash password temporarily
    const passwordHash = await bcrypt.hash(password, 10);

    const code = generateSixDigitOtp();
    const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000);

    await OtpToken.create({
      fullName,
      username: usernameLC,
      email: emailLC,
      passwordHash,
      code,
      purpose: "signup",
      expiresAt,
    });

    await sendOtpEmail(emailLC, code);

    return res.status(200).json({
      message: "OTP sent. Please verify to complete signup.",
      otpExpiresInMinutes: OTP_TTL_MINUTES,
    });
  } catch (err) {
    next(err);
  }
}

export async function login(req, res, next) {
  try {
    const { identifier, password } = req.body; // identifier = email OR username
    if (!identifier || !password) {
      return res
        .status(400)
        .json({ message: "identifier and password are required" });
    }

    const idLC = String(identifier).toLowerCase();
    const user = await User.findOne({
      $or: [{ email: idLC }, { username: idLC }],
    });
    if (!user) return res.status(401).json({ message: "Invalid credentials" });

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(401).json({ message: "Invalid credentials" });

    const accessToken = signAccessTokenn(user);
 
    res.cookie("accessToken", accessToken, {
      httpOnly: true, // cannot be accessed by JS
      secure: true,
      sameSite: "none",
      maxAge: 7 * 24 * 60 * 60 * 1000,// 7 days in ms
      path: "/",
    });

    // You can still send user info in JSON, but no need to send the token anymore
    return res.json({
      message: "Login successful",
      user: {
        id: user._id,
        fullName: user.fullName,
        username: user.username,
        email: user.email,
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function forgotPassword(req, res, next) {
  try {
    const { identifier } = req.body; // email or username
    if (!identifier)
      return res.status(400).json({ message: "identifier is required" });

    const idLC = String(identifier).trim().toLowerCase();
    const user = await User.findOne({
      $or: [{ email: idLC }, { username: idLC }],
    });

    if (!user) return res.status(404).json({ message: "User not found" });

    // Delete any previous password_reset OTPs
    await OtpToken.deleteMany({ user: user._id, purpose: "password_reset" });

    const code = generateSixDigitOtp();
    const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000);

    await OtpToken.create({
      user: user._id,
      code,
      purpose: "password_reset",
      expiresAt,
    });

    // Send OTP via email using Resend
    await sendOtpEmail(user.email, code);

    return res.json({
      message: "OTP sent to your email for password reset. Check your inbox.",
      otpExpiresInMinutes: OTP_TTL_MINUTES,
      username: user.username,
      email: user.email,
    });
  } catch (err) {
    console.error("Forgot password error:", err);
    next(err);
  }
}

export async function verifyOtp(req, res, next) {
  try {
    const { identifier, code, purpose } = req.body;

    if (!identifier || !code || !purpose) {
      return res.status(400).json({ message: "identifier, code, purpose required" });
    }

    if (!["signup", "password_reset"].includes(purpose)) {
      return res.status(400).json({ message: "Invalid purpose" });
    }

    const idLC = identifier.toLowerCase();
    let otpDoc;

    if (purpose === "signup") {
      otpDoc = await OtpToken.findOne({
        $or: [{ email: idLC }, { username: idLC }],
        code: String(code),
        purpose,
        consumed: false,
      }).sort({ createdAt: -1 });
    }

    if (purpose === "password_reset") {
      const user = await User.findOne({
        $or: [{ email: idLC }, { username: idLC }],
      });
      if (!user) return res.status(404).json({ message: "User not found" });

      otpDoc = await OtpToken.findOne({
        user: user._id,
        code: String(code),
        purpose,
        consumed: false,
      }).sort({ createdAt: -1 });
    }

    if (!otpDoc) return res.status(400).json({ message: "Invalid OTP" });
    if (otpDoc.expiresAt < new Date()) return res.status(400).json({ message: "OTP expired" });

    otpDoc.consumed = true;
    await otpDoc.save();

    if (purpose === "signup") {
      const user = await User.create({
        fullName: otpDoc.fullName,
        username: otpDoc.username,
        email: otpDoc.email,
        passwordHash: otpDoc.passwordHash,
        isVerified: true,
      });

      const accessToken = signAccessTokenn(user); // normal login token

      res.cookie("accessToken", accessToken, {
        httpOnly: true,
        secure: true,
        sameSite: "none",
        maxAge: 7 * 24 * 60 * 60 * 1000,
        path: "/",
      });

      return res.json({
        message: "Signup completed",
        user: {
          id: user._id,
          fullName: user.fullName,
          username: user.username,
          email: user.email,
        },
      });
    }

    if (purpose === "password_reset") {
      const user = await User.findById(otpDoc.user);
      if (!user) return res.status(404).json({ message: "User not found" });

      // ⚡ Create a separate reset token containing purpose
      const resetToken = jwt.sign(
        { id: user._id.toString(), purpose: "password_reset" },
        process.env.JWT_SECRET,
        { expiresIn: "10m" } // reset tokens should expire quickly
      );

      return res.json({
        message: "OTP verified. You can now reset your password.",
        resetToken,
      });
    }

    return res.status(400).json({ message: "Unhandled purpose" });
  } catch (err) {
    console.error("verifyOtp error:", err);
    next(err);
  }
}
export const getMe = async (req, res, next) => {
  try {
    if (!req.user || !req.user._id) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const user = await User.findById(req.user._id).select(
      "fullName username profileImage"
    );

    res.json({ user });
  } catch (err) {
    next(err);
  }
};

// === Reset Password ===
export async function resetPassword(req, res, next) {
  try {
    const { resetToken, newPassword, confirmPassword } = req.body;

    if (!resetToken || !newPassword || !confirmPassword) {
      return res.status(400).json({
        message: "resetToken, newPassword, confirmPassword are required",
      });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({ message: "Passwords do not match" });
    }

    let payload;
    try {
      payload = verifyToken(resetToken, JWT_SECRET); // ✅ always use helper
    } catch (err) {
      console.error("JWT verify failed:", err.message);
      return res.status(400).json({ message: err.message }); // more descriptive
    }

    if (payload.purpose !== "password_reset") {
      return res.status(400).json({ message: "Invalid reset token purpose" });
    }

    const userId = payload.id;
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    user.passwordHash = await bcrypt.hash(newPassword, 10);
    await user.save();

    return res.json({ message: "Password changed successfully" });
  } catch (err) {
    next(err);
  }
}
  