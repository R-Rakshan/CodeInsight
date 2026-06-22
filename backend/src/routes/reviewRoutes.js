const express = require('express');
const {
  submitReview,
  getReviews,
  getReviewById,
  deleteReview,
} = require('../controllers/reviewController');
const auth = require('../middleware/auth');

const router = express.Router();

router.use(auth);

router.post('/', submitReview);
router.get('/', getReviews);
router.get('/:id', getReviewById);
router.delete('/:id', deleteReview);

module.exports = router;
