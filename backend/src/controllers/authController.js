const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { query } = require('../config/database');
const { formatErrorResponse } = require('../middleware/errorHandler');
const {
  validatePassword,
  getPasswordErrors,
  getEmailError,
  validateRequired,
} = require('../utils/validation');

const SALT_ROUNDS = 10;
const JWT_EXPIRY = '24h';

const generateToken = (userId) => {
  return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: JWT_EXPIRY });
};

const sanitizeUser = (user) => ({
  id: user.id,
  email: user.email,
  full_name: user.full_name,
  created_at: user.created_at,
  updated_at: user.updated_at,
});

const register = async (req, res, next) => {
  try {
    const { email, password, full_name } = req.body;

    const requiredErrors = validateRequired({ email, password, full_name });
    if (requiredErrors.length > 0) {
      return res.status(400).json(
        formatErrorResponse('Validation failed', 'VALIDATION_ERROR', requiredErrors)
      );
    }

    const normalizedEmail = email.trim().toLowerCase();
    const emailError = getEmailError(normalizedEmail);
    if (emailError) {
      return res.status(400).json(
        formatErrorResponse(emailError, 'VALIDATION_ERROR')
      );
    }

    const passwordErrors = getPasswordErrors(password);
    if (!validatePassword(password)) {
      return res.status(400).json(
        formatErrorResponse('Password does not meet requirements', 'VALIDATION_ERROR', passwordErrors)
      );
    }

    const existingUser = await query('SELECT id FROM users WHERE email = $1', [normalizedEmail]);
    if (existingUser.rows.length > 0) {
      return res.status(409).json(
        formatErrorResponse('An account with this email already exists', 'CONFLICT_ERROR')
      );
    }

    const password_hash = await bcrypt.hash(password, SALT_ROUNDS);

    const result = await query(
      `INSERT INTO users (email, password_hash, full_name)
       VALUES ($1, $2, $3)
       RETURNING id, email, full_name, created_at, updated_at`,
      [normalizedEmail, password_hash, full_name.trim()]
    );

    res.status(201).json({
      success: true,
      data: {
        user: sanitizeUser(result.rows[0]),
      },
    });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json(
        formatErrorResponse('An account with this email already exists', 'CONFLICT_ERROR')
      );
    }
    next(err);
  }
};

const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const requiredErrors = validateRequired({ email, password });
    if (requiredErrors.length > 0) {
      return res.status(400).json(
        formatErrorResponse('Validation failed', 'VALIDATION_ERROR', requiredErrors)
      );
    }

    const normalizedEmail = email.trim().toLowerCase();

    const result = await query(
      'SELECT id, email, password_hash, full_name, created_at, updated_at FROM users WHERE email = $1',
      [normalizedEmail]
    );

    if (result.rows.length === 0) {
      return res.status(401).json(
        formatErrorResponse('Invalid email or password', 'AUTH_ERROR')
      );
    }

    const user = result.rows[0];
    const isMatch = await bcrypt.compare(password, user.password_hash);

    if (!isMatch) {
      return res.status(401).json(
        formatErrorResponse('Invalid email or password', 'AUTH_ERROR')
      );
    }

    const token = generateToken(user.id);

    res.json({
      success: true,
      data: {
        user: sanitizeUser(user),
        token,
      },
    });
  } catch (err) {
    next(err);
  }
};

const getMe = async (req, res) => {
  res.json({
    success: true,
    data: sanitizeUser(req.user),
  });
};

module.exports = {
  register,
  login,
  getMe,
};
