import mongoose from 'mongoose';

const otpTokenSchema = new mongoose.Schema(
  {
    // Signup ke liye user details temporary yaha rakhenge
    fullName: { type: String, trim: true },
    username: { type: String, lowercase: true, trim: true },
    email: { type: String, lowercase: true, trim: true },
    passwordHash: { type: String },

    // OTP info
    code: { type: String, required: true }, // string to preserve leading zeros
    purpose: { type: String, enum: ['signup', 'password_reset'], required: true },
    expiresAt: { type: Date, required: true, index: true },
    consumed: { type: Boolean, default: false },

    // Agar purpose = password_reset hai to user ka reference chahiye
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

// TTL index for auto-delete
otpTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model('OtpToken', otpTokenSchema);
