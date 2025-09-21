import jwt from 'jsonwebtoken'

// middlewares/verifyToken.js
export const verifyToken = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }

  const token = authHeader.split(' ')[1]; // ✅ fix here
  console.log(token)
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // attach user data to the request
    console.log(req.user)
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};





// Middleware: Restricts access to specific roles
export const requireRole = (...allowedRoles) =>{
    return( req, res, next) =>{
        if(!req.user || !allowedRoles.includes(req.user.role)){
            return res.status(403).json({ error: 'Access denied' });
        }
        next();
    }
}