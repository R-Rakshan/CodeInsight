import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import api, { parseApiError } from '../../services/api';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import {
  History as HistoryIcon, Loader2, Eye, Trash2,
  SearchCode, AlertCircle, AlertTriangle, Info, CheckCircle2,
  ChevronLeft, ChevronRight, X, Code2, Search, FileDown
} from 'lucide-react';

const PAGE_SIZE = 10;

const SEVERITY_STYLES = {
  critical: { bg: 'bg-red-100', text: 'text-red-800', border: 'border-red-200', icon: AlertCircle },
  high: { bg: 'bg-orange-100', text: 'text-orange-800', border: 'border-orange-200', icon: AlertTriangle },
  medium: { bg: 'bg-yellow-100', text: 'text-yellow-800', border: 'border-yellow-200', icon: Info },
  low: { bg: 'bg-blue-100', text: 'text-blue-800', border: 'border-blue-200', icon: CheckCircle2 },
};

const getScoreStyles = (score) => {
  if (score == null) return { ring: 'ring-gray-200', text: 'text-gray-500', bg: 'bg-gray-50', label: 'N/A' };
  if (score >= 80) return { ring: 'ring-green-200', text: 'text-green-600', bg: 'bg-green-50', label: 'Excellent' };
  if (score >= 60) return { ring: 'ring-yellow-200', text: 'text-yellow-600', bg: 'bg-yellow-50', label: 'Needs Improvement' };
  return { ring: 'ring-red-200', text: 'text-red-600', bg: 'bg-red-50', label: 'Critical Issues' };
};

const parseIssues = (issues) => {
  if (!issues) return [];
  if (Array.isArray(issues)) return issues;
  try {
    return JSON.parse(issues);
  } catch {
    return [];
  }
};

const formatDate = (dateStr) => {
  return new Date(dateStr).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const truncateSummary = (text, max = 80) => {
  if (!text) return 'No summary available';
  return text.length > max ? `${text.slice(0, max)}…` : text;
};

const SeverityBadge = ({ severity }) => {
  const style = SEVERITY_STYLES[severity] || SEVERITY_STYLES.low;
  const Icon = style.icon;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold capitalize ${style.bg} ${style.text} ${style.border}`}>
      <Icon size={12} />
      {severity || 'unknown'}
    </span>
  );
};

const LoadingSpinner = ({ label = 'Loading...' }) => (
  <div className="flex flex-col items-center justify-center py-20">
    <Loader2 className="h-10 w-10 animate-spin text-indigo-600" />
    <p className="mt-4 text-sm font-medium text-gray-500 animate-pulse">{label}</p>
  </div>
);

const EmptyState = () => (
  <motion.div
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-300 bg-white/50 backdrop-blur-sm py-20 px-6 text-center"
  >
    <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 shadow-sm ring-1 ring-indigo-100">
      <HistoryIcon size={32} />
    </div>
    <h3 className="text-xl font-bold tracking-tight text-gray-900">No reviews yet</h3>
    <p className="mt-2 max-w-sm text-sm text-gray-500">
      Your code review history will appear here once you submit your first review.
    </p>
    <Link
      to="/dashboard"
      className="mt-6 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-indigo-700 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
    >
      <SearchCode size={18} />
      Review your first code
    </Link>
  </motion.div>
);

const DeleteDialog = ({ review, onConfirm, onCancel, deleting }) => (
  <AnimatePresence>
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onCancel}
        aria-hidden="true"
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-dialog-title"
        className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl ring-1 ring-black/5"
      >
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100 mb-4 ring-8 ring-red-50">
          <AlertTriangle className="h-6 w-6 text-red-600" aria-hidden="true" />
        </div>
        <h3 id="delete-dialog-title" className="text-center text-lg font-bold text-gray-900">
          Delete review?
        </h3>
        <p className="mt-2 text-center text-sm text-gray-600">
          This will permanently delete the <span className="font-semibold text-gray-900">{review?.language}</span> review from{' '}
          {review?.created_at ? formatDate(review.created_at) : 'your history'}. This action cannot be
          undone.
        </p>
        <div className="mt-6 flex flex-col-reverse sm:flex-row justify-center gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={deleting}
            className="sm:flex-1 rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 shadow-sm transition hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={deleting}
            className="sm:flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-red-700 hover:shadow-md disabled:opacity-50"
          >
            {deleting ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Deleting...
              </>
            ) : (
              <>
                <Trash2 size={16} />
                Delete Review
              </>
            )}
          </button>
        </div>
      </motion.div>
    </div>
  </AnimatePresence>
);

const ReviewDetailModal = ({ review, loading, onClose }) => {
  if (!review && !loading) return null;

  const issues = review ? parseIssues(review.issues) : [];
  const scoreStyles = getScoreStyles(review?.score);

  const handleExportPDF = () => {
    if (!review) return;

    const issuesList = issues
      .map(
        (issue, i) => `
        <div class="issue">
          <div class="issue-header">
            <span class="issue-num">${i + 1}</span>
            <span class="badge severity-${issue.severity || 'low'}">${(issue.severity || 'unknown').toUpperCase()}</span>
            <span class="badge category">${issue.category || 'general'}</span>
            ${(issue.lineNumber ?? issue.line_number) != null ? `<span class="line-num">Line ${issue.lineNumber ?? issue.line_number}</span>` : ''}
          </div>
          <p class="label">Problem</p>
          <p class="description">${issue.description || ''}</p>
          <p class="label">Suggestion</p>
          <p class="suggestion">${issue.suggestion || ''}</p>
          ${(issue.optimizedCode || issue.optimized_code) ? `<p class="label">Optimized Snippet</p><pre><code>${issue.optimizedCode || issue.optimized_code}</code></pre>` : ''}
        </div>`
      )
      .join('');

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>CodeInsight Review — ${(review.language || '').toUpperCase()}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Segoe UI', Inter, sans-serif; color: #111; background: #fff; padding: 40px; font-size: 14px; line-height: 1.6; }
    h1 { font-size: 22px; font-weight: 800; margin-bottom: 4px; color: #1e1b4b; }
    .meta { font-size: 12px; color: #6b7280; margin-bottom: 24px; }
    .score-box { display: inline-flex; align-items: center; gap: 12px; border: 2px solid #6366f1; border-radius: 12px; padding: 10px 18px; margin-bottom: 20px; background: #eef2ff; }
    .score-value { font-size: 28px; font-weight: 900; color: #4f46e5; }
    .score-label { font-size: 12px; color: #4f46e5; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; }
    .section-title { font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #6366f1; margin: 24px 0 8px; border-bottom: 1px solid #e5e7eb; padding-bottom: 4px; }
    .summary-box { background: #f5f3ff; border-left: 4px solid #6366f1; padding: 12px 16px; border-radius: 6px; font-size: 14px; color: #374151; }
    .issue { border: 1px solid #e5e7eb; border-radius: 10px; padding: 16px; margin-bottom: 16px; page-break-inside: avoid; }
    .issue-header { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; flex-wrap: wrap; }
    .issue-num { width: 22px; height: 22px; border-radius: 50%; background: #f3f4f6; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 700; color: #6b7280; }
    .badge { display: inline-block; border-radius: 999px; padding: 2px 8px; font-size: 11px; font-weight: 700; }
    .severity-critical { background: #fee2e2; color: #991b1b; }
    .severity-high { background: #ffedd5; color: #9a3412; }
    .severity-medium { background: #fef9c3; color: #854d0e; }
    .severity-low { background: #dbeafe; color: #1e40af; }
    .category { background: #f3f4f6; color: #374151; }
    .line-num { margin-left: auto; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 4px; padding: 2px 6px; font-family: monospace; font-size: 11px; color: #6b7280; }
    .label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #9ca3af; margin: 8px 0 3px; }
    .description { background: #f9fafb; border: 1px solid #f3f4f6; border-radius: 6px; padding: 8px 12px; font-size: 13px; color: #374151; }
    .suggestion { font-size: 13px; color: #4b5563; }
    pre { background: #f3f4f6; border: 1px solid #d1d5db; border-radius: 6px; padding: 12px; font-size: 11px; overflow-wrap: break-word; white-space: pre-wrap; margin-top: 4px; }
    code { font-family: 'Courier New', Consolas, monospace; }
    @page { margin: 20mm; }
    @media print { body { padding: 0; } }
  </style>
</head>
<body>
  <h1>CodeInsight Review — ${(review.language || '').toUpperCase()}</h1>
  <p class="meta">${formatDate(review.created_at)}${review.review_type ? ' · ' + review.review_type.replace('_', ' ') : ''}</p>

  ${review.score != null ? `
  <div class="score-box">
    <span class="score-value">${review.score}</span>
    <div><div class="score-label">Overall Score</div><div style="font-size:12px;color:#4f46e5">${review.score}/100</div></div>
  </div>` : ''}

  ${review.summary ? `
  <div class="section-title">Summary</div>
  <div class="summary-box">${review.summary}</div>` : ''}

  ${issues.length > 0 ? `
  <div class="section-title">Detailed Findings (${issues.length})</div>
  ${issuesList}` : ''}

  ${review.optimized_code ? `
  <div class="section-title">Full Optimized Code</div>
  <pre><code>${review.optimized_code}</code></pre>` : ''}
</body>
</html>`;

    const printWindow = window.open('', '_blank', 'width=900,height=700');
    if (!printWindow) {
      alert('Pop-up blocked. Please allow pop-ups for this site and try again.');
      return;
    }
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    // Wait for resources to load, then print
    //printWindow.onload = () => {
    //printWindow.print();
    //printWindow.close();
    //};
    // Fallback for browsers where onload may not fire for about:blank
    setTimeout(() => {
      //if (!printWindow.closed) {
      printWindow.print();
      // printWindow.close();
      //}
    }, 300);
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/40 backdrop-blur-sm"
          onClick={onClose}
          aria-hidden="true"
        />
        <motion.div
          initial={{ opacity: 0, y: 100 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 100 }}
          role="dialog"
          aria-modal="true"
          className="relative flex h-[90vh] sm:h-auto max-h-[95vh] w-full max-w-4xl flex-col rounded-t-3xl sm:rounded-3xl bg-white shadow-2xl"
        >
          <div className="flex items-center justify-between border-b border-gray-200 bg-gray-50/80 backdrop-blur-sm px-4 py-4 sm:px-6 rounded-t-3xl sm:rounded-t-3xl">
            <div>
              <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <SearchCode className="text-indigo-600" size={20} />
                Review Details
              </h3>
              {review && (
                <div className="mt-1.5 flex items-center gap-2 text-xs text-gray-500 font-medium">
                  <span className="inline-flex rounded-md bg-gray-100 px-2 py-0.5 text-gray-700 capitalize">
                    {review.language}
                  </span>
                  <span>•</span>
                  <span>{formatDate(review.created_at)}</span>
                  {review.review_type && (
                    <>
                      <span>•</span>
                      <span className="capitalize">{review.review_type.replace('_', ' ')}</span>
                    </>
                  )}
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              {review && (
                <button
                  type="button"
                  onClick={handleExportPDF}
                  className="print:hidden inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 shadow-sm transition hover:bg-indigo-50 hover:border-indigo-300 hover:text-indigo-700"
                >
                  <FileDown size={14} />
                  Export PDF
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                className="rounded-full p-2 text-gray-400 border border-transparent transition hover:bg-white hover:border-gray-200 hover:text-gray-600 hover:shadow-sm bg-gray-100"
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-5 custom-scrollbar pb-10">
            {loading ? (
              <LoadingSpinner label="Loading review details..." />
            ) : (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="space-y-6"
              >
                {review.score != null && (
                  <div className={`inline-flex items-center gap-3 rounded-2xl px-4 py-3 ring-1 ring-inset shadow-sm ${scoreStyles.ring} ${scoreStyles.bg}`}>
                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white shadow-sm ring-1 ring-inset ${scoreStyles.ring}`}>
                      <span className={`text-lg font-black ${scoreStyles.text}`}>
                        {review.score}
                      </span>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Overall Score</p>
                      <p className={`text-sm font-bold ${scoreStyles.text}`}>{scoreStyles.label}</p>
                    </div>
                  </div>
                )}

                {review.summary && (
                  <div className="rounded-2xl border border-indigo-100 bg-white/50 backdrop-blur-sm p-4 shadow-sm">
                    <h4 className="text-sm font-bold uppercase tracking-wider text-indigo-900 mb-2 flex items-center gap-2">
                      <Info size={16} className="text-indigo-600" />
                      Summary
                    </h4>
                    <p className="text-sm leading-relaxed text-gray-700">{review.summary}</p>
                  </div>
                )}

                {review.code && review.optimized_code && (
                  <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                    <div className="space-y-2">
                      <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500 flex items-center gap-1.5">
                        <AlertCircle size={14} className="text-red-400" />
                        Original Code
                      </h4>
                      <pre className="max-h-64 overflow-auto rounded-xl border border-gray-200 bg-[#1e1e1e] p-4 text-xs text-gray-300 shadow-inner">
                        <code>{review.code}</code>
                      </pre>
                    </div>
                    <div className="space-y-2">
                      <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500 flex items-center gap-1.5">
                        <CheckCircle2 size={14} className="text-green-500" />
                        Optimized Code
                      </h4>
                      <pre className="max-h-64 overflow-auto rounded-xl border border-gray-200 bg-[#1e1e1e] p-4 text-xs text-emerald-400 shadow-inner">
                        <code>{review.optimized_code}</code>
                      </pre>
                    </div>
                  </div>
                )}

                {!review.optimized_code && review.code && (
                  <div className="space-y-2">
                    <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Analyzed Code
                    </h4>
                    <pre className="overflow-x-auto rounded-xl border border-gray-200 bg-[#1e1e1e] p-4 text-xs leading-relaxed text-gray-300 shadow-inner">
                      <code>{review.code}</code>
                    </pre>
                  </div>
                )}

                {issues.length > 0 && (
                  <div className="pt-2 border-t border-gray-100">
                    <h4 className="mb-4 text-lg font-bold text-gray-900 flex items-center gap-2">
                      Detailed Findings
                      <span className="text-sm font-normal text-gray-500">({issues.length})</span>
                    </h4>
                    <div className="grid gap-4">
                      {issues.map((issue, index) => {
                        const lineNumber = issue.lineNumber ?? issue.line_number;
                        return (
                          <div
                            key={index}
                            className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
                          >
                            <div className="mb-3 flex flex-wrap items-center gap-2">
                              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-gray-100 text-[10px] font-bold text-gray-500">
                                {index + 1}
                              </span>
                              <SeverityBadge severity={issue.severity} />
                              <span className="rounded-md bg-gray-50 px-2 py-0.5 text-xs font-medium capitalize text-gray-600 ring-1 ring-inset ring-gray-200">
                                {issue.category}
                              </span>
                              {lineNumber != null && (
                                <span className="ml-auto inline-flex items-center gap-1 rounded bg-gray-50 px-2 py-1 text-xs font-mono font-medium text-gray-600 ring-1 ring-inset ring-gray-200">
                                  Line {lineNumber}
                                </span>
                              )}
                            </div>

                            <div className="space-y-3">
                              <div>
                                <h5 className="text-[10px] uppercase font-bold text-gray-400 mb-1">Problem</h5>
                                <p className="text-sm text-gray-800 bg-gray-50 rounded-lg p-3 border border-gray-100">{issue.description}</p>
                              </div>
                              <div>
                                <h5 className="text-[10px] uppercase font-bold text-gray-400 mb-1">Suggestion</h5>
                                <p className="text-sm text-gray-700">{issue.suggestion}</p>
                              </div>
                            </div>

                            {(issue.optimizedCode || issue.optimized_code) && (
                              <div className="mt-3">
                                <div className="flex items-center gap-2 mb-1">
                                  <h5 className="text-[10px] uppercase font-bold text-gray-400">Optimized Snippet</h5>
                                  <button
                                    onClick={() => {
                                      navigator.clipboard.writeText(issue.optimizedCode || issue.optimized_code);
                                      toast.success('Copied to clipboard!');
                                    }}
                                    className="inline-flex items-center gap-1 rounded-md bg-gray-100 px-2 py-1 text-xs font-medium text-gray-600 hover:bg-indigo-100 hover:text-indigo-700 transition"
                                  >
                                    Copy
                                  </button>
                                </div>
                                <pre className="overflow-x-auto rounded-lg bg-gray-900 p-3 text-xs text-green-400 shadow-inner">
                                  <code>{issue.optimizedCode || issue.optimized_code}</code>
                                </pre>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </motion.div>
            )}
          </div>

          {/* Hidden print-only content */}
          {review && (
            <div id="print-review-content" style={{ display: 'none' }}>
              <h1 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '8px' }}>
                CodeInsight Review — {review.language?.toUpperCase()}
              </h1>
              <p style={{ fontSize: '12px', color: '#555', marginBottom: '16px' }}>
                {formatDate(review.created_at)} · {review.review_type?.replace('_', ' ')}
              </p>
              {review.score != null && (
                <p style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '12px' }}>
                  Score: {review.score}/100
                </p>
              )}
              {review.summary && (
                <div style={{ marginBottom: '16px' }}>
                  <h2 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '4px' }}>Summary</h2>
                  <p style={{ fontSize: '13px' }}>{review.summary}</p>
                </div>
              )}
              {issues.length > 0 && (
                <div>
                  <h2 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '8px' }}>Issues ({issues.length})</h2>
                  {issues.map((issue, i) => (
                    <div key={i} style={{ marginBottom: '16px', paddingLeft: '12px', borderLeft: '3px solid #6366f1' }}>
                      <p style={{ fontWeight: '600', fontSize: '13px' }}>{i + 1}. [{issue.severity}] {issue.category}</p>
                      <p style={{ fontSize: '12px', marginTop: '4px' }}><strong>Problem:</strong> {issue.description}</p>
                      <p style={{ fontSize: '12px', marginTop: '4px' }}><strong>Suggestion:</strong> {issue.suggestion}</p>
                      {(issue.optimizedCode || issue.optimized_code) && (
                        <pre style={{ marginTop: '8px' }}><code>{issue.optimizedCode || issue.optimized_code}</code></pre>
                      )}
                    </div>
                  ))}
                </div>
              )}
              {review.optimized_code && (
                <div style={{ marginTop: '16px' }}>
                  <h2 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '8px' }}>Full Optimized Code</h2>
                  <pre><code>{review.optimized_code}</code></pre>
                </div>
              )}
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

const History = () => {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({
    total: 0,
    limit: PAGE_SIZE,
    offset: 0,
    hasMore: false,
  });

  // Search & filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [filterLanguage, setFilterLanguage] = useState('all');
  const [filterScore, setFilterScore] = useState('all');

  const [selectedReview, setSelectedReview] = useState(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const currentPage = Math.floor(pagination.offset / pagination.limit) + 1;
  const totalPages = Math.max(1, Math.ceil(pagination.total / pagination.limit));

  const fetchReviews = useCallback(async (offset = 0) => {
    setLoading(true);

    try {
      const response = await api.get('/review', {
        params: { limit: PAGE_SIZE, offset },
      });

      const { reviews: reviewList, pagination: paginationData } = response.data.data;

      setReviews(reviewList || []);
      setPagination(paginationData || { total: 0, limit: PAGE_SIZE, offset, hasMore: false });
    } catch (err) {
      if (err.isRateLimited) {
        toast.error(`Rate limited: ${err.userMessage || parseApiError(err)}`);
      } else {
        toast.error(err.userMessage || parseApiError(err));
      }
      setReviews([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReviews(0);
  }, [fetchReviews]);

  const handlePrevious = () => {
    const newOffset = Math.max(0, pagination.offset - pagination.limit);
    fetchReviews(newOffset);
  };

  const handleNext = () => {
    if (pagination.hasMore) {
      fetchReviews(pagination.offset + pagination.limit);
    }
  };

  const handleView = async (id) => {
    setShowModal(true);
    setModalLoading(true);
    setSelectedReview(null);

    try {
      const response = await api.get(`/review/${id}`);
      setSelectedReview(response.data.data);
    } catch (err) {
      toast.error(err.userMessage || parseApiError(err));
      setShowModal(false);
    } finally {
      setModalLoading(false);
    }
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setTimeout(() => setSelectedReview(null), 300); // Wait for exit animation
  };

  const handleDeleteClick = (review) => {
    setDeleteTarget(review);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;

    setDeleting(true);

    try {
      await api.delete(`/review/${deleteTarget.id}`);

      if (selectedReview?.id === deleteTarget.id) {
        handleCloseModal();
      }

      setDeleteTarget(null);
      toast.success('Review deleted successfully');

      const remainingOnPage = reviews.length - 1;
      const newOffset =
        remainingOnPage === 0 && pagination.offset > 0
          ? pagination.offset - pagination.limit
          : pagination.offset;

      await fetchReviews(newOffset);
    } catch (err) {
      toast.error(err.userMessage || parseApiError(err));
    } finally {
      setDeleting(false);
    }
  };

  // Derived: filtered reviews
  const filteredReviews = reviews.filter((r) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      !q ||
      (r.summary && r.summary.toLowerCase().includes(q)) ||
      (r.code && r.code.toLowerCase().includes(q));

    const matchesLang =
      filterLanguage === 'all' || r.language?.toLowerCase() === filterLanguage;

    let matchesScore = true;
    if (filterScore === '0-39') matchesScore = r.score != null && r.score <= 39;
    else if (filterScore === '40-69') matchesScore = r.score != null && r.score >= 40 && r.score <= 69;
    else if (filterScore === '70-100') matchesScore = r.score != null && r.score >= 70;

    return matchesSearch && matchesLang && matchesScore;
  });

  // Stagger animation variants
  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 15 },
    show: { opacity: 1, y: 0, transition: { duration: 0.4 } }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 custom-scrollbar">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between border-b border-gray-200 pb-5"
      >
        <div>
          <h2 className="text-2xl font-black tracking-tight text-gray-900 sm:text-3xl flex items-center gap-3">
            <div className="p-2 bg-indigo-100 text-indigo-700 rounded-xl shadow-inner">
              <HistoryIcon size={24} />
            </div>
            Review History
          </h2>
          <p className="mt-2 text-sm text-gray-500 font-medium">
            Browse, manage, and revisit your past AI code analyses.
          </p>
        </div>
        {!loading && pagination.total > 0 && (
          <div className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 shadow-sm ring-1 ring-inset ring-gray-200">
            <span className="flex h-2 w-2 rounded-full bg-indigo-500 animate-pulse"></span>
            <p className="text-xs font-bold text-gray-600 uppercase tracking-wider">
              {pagination.total} total reviews
            </p>
          </div>
        )}
      </motion.div>

      {/* Search & Filter Bar */}
      {!loading && reviews.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center"
        >
          {/* Search input */}
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Search by summary or code..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-xl border border-gray-300 bg-white py-2.5 pl-9 pr-4 text-sm text-gray-900 shadow-sm transition focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>

          {/* Language filter */}
          <select
            value={filterLanguage}
            onChange={(e) => setFilterLanguage(e.target.value)}
            className="rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-700 shadow-sm transition focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
          >
            <option value="all">All Languages</option>
            <option value="javascript">JavaScript</option>
            <option value="python">Python</option>
            <option value="java">Java</option>
            <option value="cpp">C++</option>
            <option value="typescript">TypeScript</option>
          </select>

          {/* Score range filter */}
          <select
            value={filterScore}
            onChange={(e) => setFilterScore(e.target.value)}
            className="rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-700 shadow-sm transition focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
          >
            <option value="all">All Scores</option>
            <option value="70-100">70–100 (Good)</option>
            <option value="40-69">40–69 (Fair)</option>
            <option value="0-39">0–39 (Poor)</option>
          </select>
        </motion.div>
      )}

      {loading ? (
        <div className="rounded-3xl border border-gray-200 bg-white/50 backdrop-blur-sm p-12 shadow-sm">
          <LoadingSpinner label="Fetching your history..." />
        </div>
      ) : reviews.length === 0 ? (
        <EmptyState />
      ) : filteredReviews.length === 0 ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-300 bg-white/50 py-16 px-6 text-center"
        >
          <Search size={36} className="text-gray-300 mb-3" />
          <h3 className="text-base font-bold text-gray-700">No reviews match your filters</h3>
          <p className="text-sm text-gray-400 mt-1">Try adjusting your search or filter criteria.</p>
        </motion.div>
      ) : (
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="show"
          className="space-y-6"
        >
          {/* Desktop table */}
          <div className="hidden overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-xl shadow-indigo-100/50 md:block ring-1 ring-black/5">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50/80 backdrop-blur-sm">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-gray-500">Date</th>
                  <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-gray-500">Language</th>
                  <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-gray-500">Score</th>
                  <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-gray-500">Summary</th>
                  <th className="px-6 py-4 text-right text-xs font-bold uppercase tracking-wider text-gray-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {filteredReviews.map((review) => {
                  const scoreStyles = getScoreStyles(review.score);
                  return (
                    <motion.tr variants={itemVariants} key={review.id} className="transition-colors hover:bg-indigo-50/30 group">
                      <td className="whitespace-nowrap px-6 py-5 text-sm font-medium text-gray-600">
                        {formatDate(review.created_at)}
                      </td>
                      <td className="whitespace-nowrap px-6 py-5">
                        <span className="inline-flex items-center gap-1.5 rounded-lg bg-gray-100 px-2.5 py-1 text-xs font-semibold uppercase tracking-wider text-gray-700 ring-1 ring-inset ring-gray-200">
                          <Code2 size={12} />
                          {review.language}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-6 py-5">
                        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 border text-xs font-bold transition-transform group-hover:scale-105 ${scoreStyles.bg} ${scoreStyles.text} ${scoreStyles.border}`}>
                          {review.score != null ? `${review.score}/100` : '—'}
                        </span>
                      </td>
                      <td className="max-w-md px-6 py-5 text-sm text-gray-500">
                        {truncateSummary(review.summary, 60)}
                      </td>
                      <td className="whitespace-nowrap px-6 py-5 text-right text-sm">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => handleView(review.id)}
                            className="inline-flex items-center justify-center gap-1 rounded-lg bg-white px-3 py-1.5 font-semibold text-indigo-600 shadow-sm ring-1 ring-inset ring-gray-300 transition hover:bg-indigo-50 hover:ring-indigo-300"
                          >
                            <Eye size={14} /> View
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteClick(review)}
                            className="inline-flex items-center justify-center gap-1 rounded-lg bg-white px-3 py-1.5 font-semibold text-red-600 shadow-sm ring-1 ring-inset ring-gray-300 transition hover:bg-red-50 hover:ring-red-300"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="space-y-4 md:hidden">
            {filteredReviews.map((review) => {
              const scoreStyles = getScoreStyles(review.score);
              return (
                <motion.article
                  variants={itemVariants}
                  key={review.id}
                  className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition-all hover:shadow-md hover:border-indigo-200"
                >
                  <div className="flex flex-col gap-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1 rounded-lg bg-gray-100 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-gray-700 ring-1 ring-inset ring-gray-200">
                        <Code2 size={10} />
                        {review.language}
                      </span>
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 border text-xs font-bold ${scoreStyles.bg} ${scoreStyles.text} ${scoreStyles.border}`}>
                        {review.score != null ? `${review.score}/100` : '—'}
                      </span>
                    </div>

                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">Reviewed On</p>
                      <p className="text-sm font-semibold text-gray-800">{formatDate(review.created_at)}</p>
                    </div>

                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">Summary</p>
                      <p className="text-sm text-gray-600 leading-relaxed bg-gray-50 p-3 rounded-xl border border-gray-100">
                        {truncateSummary(review.summary, 80)}
                      </p>
                    </div>
                  </div>

                  <div className="mt-5 flex gap-3 pt-4 border-t border-gray-100">
                    <button
                      type="button"
                      onClick={() => handleView(review.id)}
                      className="flex-1 inline-flex justify-center items-center gap-2 rounded-xl bg-indigo-50 py-2.5 text-sm font-bold text-indigo-700 transition hover:bg-indigo-100"
                    >
                      <Eye size={16} /> View
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteClick(review)}
                      className="inline-flex justify-center items-center gap-2 rounded-xl bg-red-50 px-4 py-2.5 text-sm font-bold text-red-700 transition hover:bg-red-100"
                      aria-label="Delete review"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </motion.article>
              );
            })}
          </div>

          {/* Pagination */}
          <motion.div variants={itemVariants} className="mt-8 flex flex-col items-center justify-between gap-4 rounded-2xl border border-gray-200 bg-white px-5 py-4 sm:flex-row shadow-sm ring-1 ring-black/5">
            <p className="text-sm font-medium text-gray-500">
              Page <span className="font-bold text-gray-900">{currentPage}</span> of <span className="font-bold text-gray-900">{totalPages}</span>
              <span className="hidden sm:inline">
                {' '}— Showing <span className="font-bold text-gray-900">{pagination.offset + 1}</span> to <span className="font-bold text-gray-900">{Math.min(pagination.offset + reviews.length, pagination.total)}</span>
              </span>
            </p>
            <div className="flex gap-2 w-full sm:w-auto">
              <button
                type="button"
                onClick={handlePrevious}
                disabled={pagination.offset === 0 || loading}
                className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1 rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-bold text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ChevronLeft size={16} /> Previous
              </button>
              <button
                type="button"
                onClick={handleNext}
                disabled={!pagination.hasMore || loading}
                className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1 rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-bold text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Next <ChevronRight size={16} />
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}

      {showModal && (
        <ReviewDetailModal
          review={selectedReview}
          loading={modalLoading}
          onClose={handleCloseModal}
        />
      )}

      {deleteTarget && (
        <DeleteDialog
          review={deleteTarget}
          onConfirm={handleDeleteConfirm}
          onCancel={() => setDeleteTarget(null)}
          deleting={deleting}
        />
      )}
    </div>
  );
};

export default History;
