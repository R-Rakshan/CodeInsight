const { GoogleGenerativeAI } = require('@google/generative-ai');

const MODEL_NAME = 'gemini-2.5-flash';

const VALID_CATEGORIES = ['security', 'performance', 'quality', 'bugs'];
const VALID_SEVERITIES = ['critical', 'high', 'medium', 'low'];

const SYSTEM_PROMPT = `You are a Senior Software Engineer with 10+ years of experience across multiple languages, frameworks, and production systems. You specialize in code review, security auditing, performance optimization, and mentoring developers.

Your role is to perform thorough, professional code reviews that are specific, actionable, and educational. Explain WHY each issue matters and HOW to fix it. Reference concrete line numbers whenever possible.

Review the submitted code across these four categories:
1. security — vulnerabilities, unsafe patterns, injection risks, auth flaws, data exposure
2. performance — inefficiencies, unnecessary allocations, blocking operations, scalability concerns
3. quality — readability, maintainability, naming, structure, SOLID principles, best practices
4. bugs — logic errors, edge cases, null/undefined handling, race conditions, incorrect assumptions

Be direct but constructive. Prioritize the most impactful issues first. If the code is strong in an area, you may return an empty issues list for that category or note strengths briefly in the summary.

You MUST respond with valid JSON only — no markdown, no prose outside the JSON object.`;

const OUTPUT_FORMAT_INSTRUCTIONS = `Return a single JSON object with this exact structure:
{
  "score": <number 0-100, overall code quality score>,
  "summary": "<2-4 sentence overview of the code and key findings>",
  "issues": [
    {
      "category": "<security|performance|quality|bugs>",
      "severity": "<critical|high|medium|low>",
      "lineNumber": <number or null if not line-specific>,
      "description": "<clear explanation of the issue>",
      "suggestion": "<specific, actionable fix recommendation>",
      "optimizedCode": "<corrected code snippet or empty string if not applicable>"
    }
  ]
}

Rules:
- score must be an integer from 0 to 100
- issues must be an array (use [] if no issues found)
- each issue MUST include all fields: category, severity, lineNumber, description, suggestion, optimizedCode
- category must be one of: security, performance, quality, bugs
- severity must be one of: critical, high, medium, low
- lineNumber must be a positive integer or null
- optimizedCode should contain a minimal fix snippet when relevant, otherwise ""
- Do not wrap the JSON in markdown code blocks`;

const buildReviewPrompt = (code, language = 'unknown') => {
  return `${SYSTEM_PROMPT}

${OUTPUT_FORMAT_INSTRUCTIONS}

Review the following ${language} code:

\`\`\`${language}
${code}
\`\`\`

Respond with JSON only.`;
};

function cleanAIResponse(rawText) {
  try {
    return JSON.parse(rawText);
  } catch (e) {
    let cleaned = rawText
      .replace(/```json\s*/gi, '')
      .replace(/```\s*/g, '')
      .trim();
    
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[0]);
      } catch (e2) {
        // Try to fix truncated JSON by closing open structures
        let fixed = jsonMatch[0];
        let openBraces = (fixed.match(/\{/g) || []).length;
        let closeBraces = (fixed.match(/\}/g) || []).length;
        while (closeBraces < openBraces) {
          fixed += '}';
          closeBraces++;
        }
        // Also close any open arrays in issues
        let openBrackets = (fixed.match(/\[/g) || []).length;
        let closeBrackets = (fixed.match(/\]/g) || []).length;
        while (closeBrackets < openBrackets) {
          fixed += ']';
          closeBrackets++;
        }
        try {
          return JSON.parse(fixed);
        } catch (e3) {
          console.error('JSON parse failed after fix:', e3.message);
          return null;
        }
      }
    }
    console.error('No JSON found in response');
    return null;
  }
}

const validateAIResponse = (parsed) => {
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return null;
  }

  const { score, summary, issues } = parsed;

  if (typeof score !== 'number' || Number.isNaN(score) || score < 0 || score > 100) {
    return null;
  }

  if (typeof summary !== 'string' || summary.trim().length === 0) {
    return null;
  }

  if (!Array.isArray(issues)) {
    return null;
  }

  const validatedIssues = [];

  for (const issue of issues) {
    if (!issue || typeof issue !== 'object') {
      return null;
    }

    const { category, severity, lineNumber, description, suggestion, optimizedCode } = issue;

    if (!VALID_CATEGORIES.includes(category)) {
      return null;
    }

    if (!VALID_SEVERITIES.includes(severity)) {
      return null;
    }

    if (lineNumber !== null && (typeof lineNumber !== 'number' || lineNumber < 1 || !Number.isInteger(lineNumber))) {
      return null;
    }

    if (typeof description !== 'string' || description.trim().length === 0) {
      return null;
    }

    if (typeof suggestion !== 'string' || suggestion.trim().length === 0) {
      return null;
    }

    if (typeof optimizedCode !== 'string') {
      return null;
    }

    validatedIssues.push({
      category,
      severity,
      lineNumber: lineNumber ?? null,
      description: description.trim(),
      suggestion: suggestion.trim(),
      optimizedCode: optimizedCode.trim(),
    });
  }

  return {
    score: Math.round(score),
    summary: summary.trim(),
    issues: validatedIssues,
    optimizedCode: extractPrimaryOptimizedCode(validatedIssues),
    isFallback: false,
  };
};

const extractPrimaryOptimizedCode = (issues) => {
  const withCode = issues.find((issue) => issue.optimizedCode && issue.optimizedCode.length > 0);
  return withCode ? withCode.optimizedCode : null;
};

const createFallbackResponse = (reason = 'AI review unavailable') => {
  return {
    score: null,
    summary:
      'Unable to complete the AI code review at this time. Please verify your API configuration and try again. ' +
      'In the meantime, manually check for common issues: input validation, error handling, security vulnerabilities, and performance bottlenecks.',
    issues: [
      {
        category: 'quality',
        severity: 'medium',
        lineNumber: null,
        description: reason,
        suggestion: 'Retry the review in a few moments. If the problem persists, check your GEMINI_API_KEY and network connection.',
        optimizedCode: '',
      },
    ],
    optimizedCode: null,
    isFallback: true,
  };
};

const parseGeminiError = (error) => {
  const message = error?.message || String(error);
  const status = error?.status || error?.response?.status;

  if (status === 429 || /rate limit|quota|too many requests/i.test(message)) {
    return {
      type: 'RATE_LIMIT',
      message: 'Gemini API rate limit exceeded. Please wait and try again.',
    };
  }

  if (
    status === 401 ||
    status === 403 ||
    /api key|invalid key|permission denied|unauthenticated/i.test(message)
  ) {
    return {
      type: 'INVALID_API_KEY',
      message: 'Invalid or unauthorized Gemini API key. Please check GEMINI_API_KEY in your environment.',
    };
  }

  if (/model.*not found|not supported|deprecated/i.test(message)) {
    return {
      type: 'MODEL_ERROR',
      message: `Gemini model "${MODEL_NAME}" is unavailable. Verify model access for your API key.`,
    };
  }

  if (/network|fetch|timeout|ECONNREFUSED|ENOTFOUND/i.test(message)) {
    return {
      type: 'NETWORK_ERROR',
      message: 'Network error while contacting Gemini API. Please check your connection and try again.',
    };
  }

  return {
    type: 'UNKNOWN_ERROR',
    message: message || 'An unexpected error occurred during AI review.',
  };
};

const getAIReview = async (code, language = 'unknown') => {
  try {
    if (!code || typeof code !== 'string' || code.trim().length === 0) {
      throw new Error('Code is required for AI review');
    }

    if (!process.env.GEMINI_API_KEY) {
      console.error('[GeminiService] GEMINI_API_KEY is not configured');
      return createFallbackResponse('GEMINI_API_KEY is not configured on the server.');
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

    const model = genAI.getGenerativeModel({
      model: MODEL_NAME,
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 8192,
        responseMimeType: 'application/json',
      },
    });

    const prompt = buildReviewPrompt(code.trim(), language);
    const result = await model.generateContent(prompt);
    const response = result.response;

    if (!response) {
      console.error('[GeminiService] Empty response from Gemini API');
      return createFallbackResponse('Received an empty response from the AI service.');
    }

    const rawText = response.text();
    console.log('========== RAW AI RESPONSE ==========');
    console.log(rawText);
    console.log('=====================================');

    let parsed = cleanAIResponse(rawText);

    if (!parsed) {
      console.error('[GeminiService] Could not parse AI response');
      console.error('[GeminiService] Raw response:', rawText.substring(0, 500));
      return createFallbackResponse('Could not parse the AI response.');
    }

    const validated = validateAIResponse(parsed);

    if (!validated) {
      console.error('[GeminiService] Response failed validation');
      console.error('[GeminiService] Parsed response:', JSON.stringify(parsed).substring(0, 500));
      return createFallbackResponse('AI response did not match the expected review format. Please try again.');
    }

    return validated;
  } catch (error) {
    const parsedError = parseGeminiError(error);
    console.error(`[GeminiService] ${parsedError.type}:`, parsedError.message);
    console.error('[GeminiService] Full error:', error);

    return createFallbackResponse(parsedError.message);
  }
};

module.exports = {
  getAIReview,
  buildReviewPrompt,
  cleanAIResponse,
  validateAIResponse,
  createFallbackResponse,
  VALID_CATEGORIES,
  VALID_SEVERITIES,
};
