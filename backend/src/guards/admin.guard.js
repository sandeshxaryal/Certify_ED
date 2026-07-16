// src/guards/admin.guard.js
//
// Restricts a route to admin users. There is currently no ADMIN entry in the
// User `role` enum (every account is created as INSTITUTE), so until that's
// added at the schema level we gate on an explicit allowlist of admin emails
// via the ADMIN_EMAILS env var (comma-separated). This must run AFTER
// authMiddleware, since it relies on req.user being populated.
//
// Example .env entry:
//   ADMIN_EMAILS=founder@yourcompany.com,ops@yourcompany.com

const getAdminEmails = () =>
  (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

const adminMiddleware = (req, res, next) => {
  const adminEmails = getAdminEmails();
  const userEmail = req.user?.email?.toLowerCase();

  if (!userEmail) {
    return res.status(401).json({
      success: false,
      status: 'ERROR',
      message: 'Authentication required',
      code: 'UNAUTHORIZED',
      timestamp: new Date().toISOString()
    });
  }

  const isAdmin = req.user?.role === 'ADMIN' || adminEmails.includes(userEmail);

  if (!isAdmin) {
    console.warn(`[Admin] Access denied for ${userEmail} to admin-only route: ${req.originalUrl}`);
    return res.status(403).json({
      success: false,
      status: 'ERROR',
      message: 'Admin access required',
      code: 'FORBIDDEN',
      timestamp: new Date().toISOString()
    });
  }

  next();
};

export default adminMiddleware;