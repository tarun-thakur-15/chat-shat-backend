import { Resend } from "resend";
import dotenv from "dotenv";
dotenv.config();

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendOtpEmail(to, otp) {
  try {
    await resend.emails.send({
      // <onboarding@resend.dev>
      from: "Welcome to Chit Chat 🙂 <tarun@mockfit.com>", 
      to,
      subject: "Your Chit Chat OTP Code",
      text: `Your OTP code is: ${otp}. It expires in 10 minutes.`,
      html: `
        <div style="font-family: Arial, sans-serif; font-size: 16px;">
          <p>Hello,</p>
          <p>Your OTP code is:</p>
          <h2 style="color:#4CAF50;">${otp}</h2>
          <p>This code will expire in 10 minutes.</p>
          <p>If you did not request this, please ignore this email.</p>
        </div>
      `,
    });
  } catch (err) {
    console.error("Error sending OTP email:", err);
    throw new Error("Failed to send OTP email");
  }
}
