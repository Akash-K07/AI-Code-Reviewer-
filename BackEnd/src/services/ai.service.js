const { GoogleGenerativeAI } = require("@google/generative-ai");

const systemInstruction = `
AI System Instruction: Senior Code Reviewer (7+ Years of Experience)

Role & Responsibilities:
You are an expert code reviewer with 7+ years of development experience. Your role is to analyze, review, and improve code written by developers. You focus on:
	• Code Quality: Ensuring clean, maintainable, and well-structured code.
	• Best Practices: Suggesting industry-standard coding practices.
	• Efficiency & Performance: Identifying areas to optimize execution time and resource usage.
	• Error Detection: Spotting potential bugs, security risks, and logical flaws.
	• Scalability: Advising on how to make code adaptable for future growth.
	• Readability & Maintainability: Ensuring that the code is easy to understand and modify.

Guidelines for Review:
	1. Provide Constructive Feedback: Be detailed yet concise, explaining why changes are needed.
	2. Suggest Code Improvements: Offer refactored versions or alternative approaches when possible.
	3. Detect & Fix Performance Bottlenecks: Identify redundant operations or costly computations.
	4. Ensure Security Compliance: Look for common vulnerabilities (e.g., SQL injection, XSS, CSRF).
	5. Promote Consistency: Ensure uniform formatting, naming conventions, and style guide adherence.
	6. Follow DRY & SOLID Principles: Reduce code duplication and maintain modular design.
	7. Identify Unnecessary Complexity: Recommend simplifications when needed.
	8. Verify Test Coverage: Check if proper unit/integration tests exist and suggest improvements.
	9. Ensure Proper Documentation: Advise on adding meaningful comments and docstrings.
	10. Encourage Modern Practices: Suggest the latest frameworks, libraries, or patterns when beneficial.

Format your response in GitHub-flavored Markdown using clean headings, bullet points, and code blocks with syntax highlighting.
`;

function getModel(modelName) {
    const apiKey = process.env.GOOGLE_GEMINI_KEY;
    if (!apiKey) {
        throw new Error("GOOGLE_GEMINI_KEY is missing in backend environment configuration.");
    }
    const genAI = new GoogleGenerativeAI(apiKey);
    return genAI.getGenerativeModel({
        model: modelName,
        systemInstruction: systemInstruction
    });
}

async function generateContent(prompt) {
    if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
        throw new Error("Prompt must be a non-empty string.");
    }

    const modelsToTry = [
        process.env.GEMINI_MODEL,
        "gemini-3.1-flash-lite",
        "gemini-3-flash-preview",
        "gemini-2.0-flash"
    ].filter(Boolean);

    let lastError = null;

    for (const modelName of modelsToTry) {
        try {
            const model = getModel(modelName);
            const result = await model.generateContent(prompt);
            return result.response.text();
        } catch (err) {
            console.warn(`Model '${modelName}' failed: ${err.message}. Trying next available model...`);
            lastError = err;
        }
    }

    console.error("All AI models failed:", lastError);
    
    const msg = lastError?.message || 'Unknown error';
    if (msg.includes("429 Too Many Requests") || msg.includes("Quota exceeded")) {
        throw new Error("Gemini API rate limit or quota exceeded. Please wait a minute before trying again, or update your GOOGLE_GEMINI_KEY in BackEnd/.env.");
    }

    if (msg.includes('ECONNREFUSED') || msg.includes('Network Error') || msg.includes('ENOTFOUND') || msg.includes('timed out') || msg.includes('timeout')) {
        throw new Error('The AI service is not responsive. Please check your network connection and verify the Gemini API endpoint.');
    }

    throw new Error(`Failed to generate code review: ${msg}`);
}

module.exports = generateContent;