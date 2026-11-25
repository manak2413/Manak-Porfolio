
// api/chat.js
// Vercel Serverless Function - Gemini API

const SYSTEM_PROMPT = `Tum ek friendly AI Assistant ho jo ek portfolio website par baithe ho.

Tum users ke normal questions ka jawab do.
User English, Hindi ya Hinglish mein pooche, usi language mein reply karo.

Portfolio owner ke about, skills, projects aur contact info se related sawalon ka helpful jawab do.
Agar sawal general ho to bhi sahi aur seedha jawab do.

Jawab chota, clear aur conversational rakho.
Agar portfolio owner ki kisi information ka data available nahi hai,
to uske baare mein galat information mat banana.`;

// Apne actual website domains yahan add karo
const ALLOWED_ORIGINS = [
  "http://localhost:5500",
  "https://yourportfolio.com",
  "https://yourusername.github.io",
  "https://your-portfolio.vercel.app"
];

export default async function handler(req, res) {
  const origin = req.headers.origin;

  if (ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  }

  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({
      reply: "Method not allowed"
    });
  }

  try {
    const apiKey = process.env.GEMINI_API_KEY;
    const model = process.env.GEMINI_MODEL || "gemini-3.8-flash";

    if (!apiKey) {
      return res.status(500).json({
        reply: "GEMINI_API_KEY Vercel Environment Variables mein set nahi hai."
      });
    }

    const { messages } = req.body || {};

    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({
        reply: "Messages required hain."
      });
    }

    // Frontend messages ko Gemini format mein convert karo
    const contents = messages
      .filter((message) =>
        ["user", "assistant"].includes(message.role) &&
        typeof message.content === "string" &&
        message.content.trim()
      )
      .map((message) => ({
        role: message.role === "assistant" ? "model" : "user",
        parts: [{ text: message.content.trim() }]
      }));

    if (
      contents.length === 0 ||
      contents[contents.length - 1].role !== "user"
    ) {
      return res.status(400).json({
        reply: "Valid user message required hai."
      });
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey
        },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: SYSTEM_PROMPT }]
          },
          contents,
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 500
          }
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error("Gemini API Error:", data);

      return res.status(response.status).json({
        reply: data.error?.message || "Gemini API se response nahi mila."
      });
    }

    const reply =
      data.candidates?.[0]?.content?.parts
        ?.map((part) => part.text || "")
        .join("")
        .trim();

    if (!reply) {
      return res.status(500).json({
        reply: "Gemini ne empty response diya. Dobara try karo."
      });
    }

    return res.status(200).json({ reply });

  } catch (error) {
    console.error("Server Error:", error);

    return res.status(500).json({
      reply: "Server error aaya. Please dobara try karo."
    });
  }
}
