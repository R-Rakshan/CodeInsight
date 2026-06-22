const jwt = require('jsonwebtoken');
const { query } = require('../config/database');
const { formatErrorResponse } = require('./errorHandler');

const auth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json(
        formatErrorResponse('Access denied. No token provided.', 'AUTH_ERROR')
      );
    }

    const token = authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json(
        formatErrorResponse('Access denied. Invalid token format.', 'AUTH_ERROR')
      );
    }

    if (!process.env.JWT_SECRET) {
      console.error('[Auth] JWT_SECRET is not configured');
      return res.status(500).json(
        formatErrorResponse('Server authentication configuration error.', 'SERVER_ERROR')
      );
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        return res.status(401).json(
          formatErrorResponse('Token has expired. Please log in again.', 'AUTH_ERROR')
        );
      }
      if (err.name === 'JsonWebTokenError') {
        return res.status(401).json(
          formatErrorResponse('Invalid token. Please log in again.', 'AUTH_ERROR')
        );
      }
      throw err;
    }

    if (!decoded.userId) {
      return res.status(401).json(
        formatErrorResponse('Invalid token payload.', 'AUTH_ERROR')
      );
    }

    const result = await query(
      'SELECT id, email, full_name, created_at, updated_at FROM users WHERE id = $1',
      [decoded.userId]
    );

    if (result.rows.length === 0) {
      return res.status(401).json(
        formatErrorResponse('User not found. Token may be invalid.', 'AUTH_ERROR')
      );
    }

    req.user = result.rows[0];
    next();
  } catch (err) {
    next(err);
  }
};

module.exports = auth;
