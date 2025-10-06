import jwt from "jsonwebtoken";

export const protect = (req, res, next) => {
  let token;

  // ✅ Read token from HTTP-only cookie
  if (req.cookies && req.cookies.accessToken) {
    token = req.cookies.accessToken;
  }

  if (!token) {
    return res.status(401).json({ error: "Not authorized, no token" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    req.user = { _id: decoded.id, username: decoded.username, email: decoded.email }; // attach full payload if needed
    next();
  } catch (error) {
    return res.status(401).json({ error: "Not authorized, token invalid" });
  }
};
