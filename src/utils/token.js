import jwt from "jsonwebtoken";

export function signAccessTokenn(user) {
  return jwt.sign(
    { id: user._id, username: user.username },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );
}

export function verifyToken(token, secret = process.env.JWT_SECRET) {
  return jwt.verify(token, secret);
}
