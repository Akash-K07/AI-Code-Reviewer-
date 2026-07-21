const aiService = require("../services/ai.service");

module.exports.getReview = async (req, res) => {
    const { code } = req.body;

    if (!code || typeof code !== 'string' || !code.trim()) {
        return res.status(400).json({ 
            success: false, 
            error: "Code snippet is required and must be a non-empty string." 
        });
    }

    try {
        const review = await aiService(code);
        return res.status(200).json({
            success: true,
            review: review
        });
    } catch (error) {
        console.error("Error in getReview controller:", error.message);
        return res.status(500).json({
            success: false,
            error: error.message || "Internal server error while processing code review."
        });
    }
};