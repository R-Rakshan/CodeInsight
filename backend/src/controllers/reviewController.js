const { query } = require('../config/database');
const { getAIReview } = require('../services/geminiService');
const { formatErrorResponse } = require('../middleware/errorHandler');
const { validateReviewInput } = require('../utils/validation');

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 100;

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const isValidUUID = (id) => UUID_REGEX.test(id);

const parsePagination = (queryParams) => {
  let limit = parseInt(queryParams.limit, 10);
  let offset = parseInt(queryParams.offset, 10);

  if (Number.isNaN(limit) || limit < 1) {
    limit = DEFAULT_LIMIT;
  }
  if (limit > MAX_LIMIT) {
    limit = MAX_LIMIT;
  }
  if (Number.isNaN(offset) || offset < 0) {
    offset = 0;
  }

  return { limit, offset };
};

const formatReview = (row) => ({
  id: row.id,
  user_id: row.user_id,
  code: row.code,
  language: row.language,
  review_type: row.review_type,
  score: row.score,
  issues: row.issues,
  optimized_code: row.optimized_code,
  summary: row.summary,
  created_at: row.created_at,
  updated_at: row.updated_at,
});

const submitReview = async (req, res, next) => {
  try {
    const { code, language, review_type } = req.body;

    const validationErrors = validateReviewInput({ code, language, review_type });
    if (validationErrors.length > 0) {
      return res.status(400).json(
        formatErrorResponse('Validation failed', 'VALIDATION_ERROR', validationErrors)
      );
    }

    const aiReview = await getAIReview(code.trim(), language?.trim() || 'unknown');

    const result = await query(
      `INSERT INTO reviews (user_id, code, language, review_type, score, issues, optimized_code, summary)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, user_id, code, language, review_type, score, issues, optimized_code, summary, created_at, updated_at`,
      [
        req.user.id,
        code.trim(),
        language?.trim() || 'unknown',
        review_type || 'full',
        aiReview.score,
        JSON.stringify(aiReview.issues),
        aiReview.optimizedCode,
        aiReview.summary,
      ]
    );

    res.status(201).json({
      success: true,
      data: {
        ...formatReview(result.rows[0]),
        isFallback: aiReview.isFallback,
      },
    });
  } catch (err) {
    console.error('[ReviewController] submitReview error:', err.message);
    next(err);
  }
};

const getReviews = async (req, res, next) => {
  try {
    const { limit, offset } = parsePagination(req.query);

    const countResult = await query(
      'SELECT COUNT(*)::int AS total FROM reviews WHERE user_id = $1',
      [req.user.id]
    );

    const total = countResult.rows[0].total;

    const result = await query(
      `SELECT id, user_id, code, language, review_type, score, issues, optimized_code, summary, created_at, updated_at
       FROM reviews
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [req.user.id, limit, offset]
    );

    res.status(200).json({
      success: true,
      data: {
        reviews: result.rows.map(formatReview),
        pagination: {
          total,
          limit,
          offset,
          hasMore: offset + result.rows.length < total,
        },
      },
    });
  } catch (err) {
    console.error('[ReviewController] getReviews error:', err.message);
    next(err);
  }
};

const getReviewById = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!isValidUUID(id)) {
      return res.status(400).json(
        formatErrorResponse('Invalid review ID format', 'VALIDATION_ERROR')
      );
    }

    const result = await query(
      `SELECT id, user_id, code, language, review_type, score, issues, optimized_code, summary, created_at, updated_at
       FROM reviews
       WHERE id = $1 AND user_id = $2`,
      [id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json(
        formatErrorResponse('Review not found', 'NOT_FOUND')
      );
    }

    res.status(200).json({
      success: true,
      data: formatReview(result.rows[0]),
    });
  } catch (err) {
    console.error('[ReviewController] getReviewById error:', err.message);
    next(err);
  }
};

const deleteReview = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!isValidUUID(id)) {
      return res.status(400).json(
        formatErrorResponse('Invalid review ID format', 'VALIDATION_ERROR')
      );
    }

    const result = await query(
      'DELETE FROM reviews WHERE id = $1 AND user_id = $2 RETURNING id',
      [id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json(
        formatErrorResponse('Review not found', 'NOT_FOUND')
      );
    }

    res.status(200).json({
      success: true,
      message: 'Review deleted successfully',
      data: { id: result.rows[0].id },
    });
  } catch (err) {
    console.error('[ReviewController] deleteReview error:', err.message);
    next(err);
  }
};

module.exports = {
  submitReview,
  getReviews,
  getReviewById,
  deleteReview,
};
