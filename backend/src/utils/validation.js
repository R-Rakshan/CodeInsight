const ERROR_MESSAGES = {
  REQUIRED: (field) => `${field} is required`,
  EMAIL_INVALID: 'Please enter a valid email address',
  PASSWORD_MIN_LENGTH: 'Password must be at least 8 characters long',
  PASSWORD_UPPERCASE: 'Password must contain at least one uppercase letter',
  PASSWORD_LOWERCASE: 'Password must contain at least one lowercase letter',
  PASSWORD_NUMBER: 'Password must contain at least one number',
  CODE_REQUIRED: 'Code is required and cannot be empty',
  CODE_MAX_LENGTH: 'Code must not exceed 10000 characters',
  CODE_TYPE: 'Code must be a string',
  LANGUAGE_TYPE: 'Language must be a string',
  REVIEW_TYPE_INVALID: 'Review type must be one of: full, security, performance, quality, bugs',
};

const MAX_CODE_LENGTH = 10000;
const VALID_REVIEW_TYPES = ['full', 'security', 'performance', 'quality', 'bugs'];

const validateEmail = (email) => {
  if (typeof email !== 'string') return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email.trim());
};

const getEmailError = (email) => {
  if (!email || typeof email !== 'string' || email.trim() === '') {
    return ERROR_MESSAGES.REQUIRED('email');
  }
  if (!validateEmail(email)) {
    return ERROR_MESSAGES.EMAIL_INVALID;
  }
  return null;
};

const getPasswordErrors = (password) => {
  const errors = [];

  if (!password || typeof password !== 'string') {
    errors.push(ERROR_MESSAGES.REQUIRED('password'));
    return errors;
  }

  if (password.length < 8) {
    errors.push(ERROR_MESSAGES.PASSWORD_MIN_LENGTH);
  }
  if (!/[A-Z]/.test(password)) {
    errors.push(ERROR_MESSAGES.PASSWORD_UPPERCASE);
  }
  if (!/[a-z]/.test(password)) {
    errors.push(ERROR_MESSAGES.PASSWORD_LOWERCASE);
  }
  if (!/[0-9]/.test(password)) {
    errors.push(ERROR_MESSAGES.PASSWORD_NUMBER);
  }

  return errors;
};

const validatePassword = (password) => {
  return getPasswordErrors(password).length === 0;
};

const validateRequired = (fields) => {
  const errors = [];

  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined || value === null || String(value).trim() === '') {
      errors.push(ERROR_MESSAGES.REQUIRED(key));
    }
  }

  return errors;
};

const getCodeErrors = (code) => {
  const errors = [];

  if (code === undefined || code === null || (typeof code === 'string' && code.trim() === '')) {
    errors.push(ERROR_MESSAGES.CODE_REQUIRED);
    return errors;
  }

  if (typeof code !== 'string') {
    errors.push(ERROR_MESSAGES.CODE_TYPE);
    return errors;
  }

  if (code.length > MAX_CODE_LENGTH) {
    errors.push(ERROR_MESSAGES.CODE_MAX_LENGTH);
  }

  return errors;
};

const validateCode = (code) => {
  return getCodeErrors(code).length === 0;
};

const getReviewTypeError = (reviewType) => {
  if (reviewType === undefined || reviewType === null) {
    return null;
  }
  if (!VALID_REVIEW_TYPES.includes(reviewType)) {
    return ERROR_MESSAGES.REVIEW_TYPE_INVALID;
  }
  return null;
};

const validateReviewType = (reviewType) => {
  return getReviewTypeError(reviewType) === null;
};

const validateReviewInput = ({ code, language, review_type }) => {
  const errors = [...getCodeErrors(code)];

  if (language !== undefined && language !== null && typeof language !== 'string') {
    errors.push(ERROR_MESSAGES.LANGUAGE_TYPE);
  }

  const reviewTypeError = getReviewTypeError(review_type);
  if (reviewTypeError) {
    errors.push(reviewTypeError);
  }

  return errors;
};

module.exports = {
  ERROR_MESSAGES,
  MAX_CODE_LENGTH,
  VALID_REVIEW_TYPES,
  validateEmail,
  getEmailError,
  validatePassword,
  getPasswordErrors,
  validateRequired,
  validateCode,
  getCodeErrors,
  validateReviewType,
  getReviewTypeError,
  validateReviewInput,
};
