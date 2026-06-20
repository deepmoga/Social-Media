import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { ApiError } from '../utils/apiError.js';

const router = Router();
router.use(authenticate);

// POST /api/ai/caption  { imageUrl, contentType, clientName }
router.post('/caption', async (req, res, next) => {
  try {
    const { imageUrl, contentType = 'image', clientName = '' } = req.body;
    if (!imageUrl) throw ApiError.badRequest('imageUrl required');

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw ApiError.badRequest('OpenAI API key not configured. Please add it in Settings.');

    const systemPrompt = `You are a social media content writer for ${clientName || 'a business'}.
Write engaging captions for ${contentType === 'story' ? 'Instagram/Facebook Stories' : 'Instagram and Facebook posts'}.
Rules:
- Write in a friendly, engaging tone
- Add 5-8 relevant hashtags at the end
- Keep caption under 300 words
- Use emojis appropriately
- Caption should be in the same language style as the image content suggests
- Just return the caption text, nothing else`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        max_tokens: 500,
        messages: [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: [
              {
                type: 'image_url',
                image_url: { url: imageUrl, detail: 'low' },
              },
              {
                type: 'text',
                text: 'Analyze this image and write an engaging social media caption for it.',
              },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error?.message || `OpenAI error: ${response.status}`);
    }

    const data = await response.json();
    const caption = data.choices?.[0]?.message?.content?.trim();
    if (!caption) throw new Error('No caption generated');

    res.json({ success: true, caption });
  } catch (err) { next(err); }
});

export default router;
