import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { ApiError } from '../utils/apiError.js';

const router = Router();
router.use(authenticate);

// POST /api/ai/caption  { imageUrl, mediaType, contentType, clientName }
router.post('/caption', async (req, res, next) => {
  try {
    const { imageUrl, mediaType = 'image', contentType = 'image', clientName = '' } = req.body;

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw ApiError.badRequest('OpenAI API key not configured. Please add it in Settings.');

    const postLabel = contentType === 'story' ? 'Instagram/Facebook Story' : 'Instagram and Facebook post';
    const systemPrompt = `You are a social media content writer for ${clientName || 'a business'}.
Write engaging captions for ${postLabel}.
Rules:
- Write in a friendly, engaging tone
- Add 5-8 relevant hashtags at the end
- Keep caption under 300 words
- Use emojis appropriately
- Just return the caption text, nothing else`;

    let messages;
    if (mediaType === 'video' || !imageUrl) {
      // Text-only generation for videos
      messages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Write an engaging caption for a ${contentType === 'reel' ? 'Reel/video' : 'video'} post for ${clientName || 'this business'}.` },
      ];
    } else {
      // Vision-based generation for images
      messages = [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: [
            { type: 'image_url', image_url: { url: imageUrl, detail: 'low' } },
            { type: 'text', text: 'Analyze this image and write an engaging social media caption for it.' },
          ],
        },
      ];
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ model: 'gpt-4o-mini', max_tokens: 500, messages }),
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
