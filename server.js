const express = require("express");

const app = express();
app.use(express.json({ limit: "2mb" }));

const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => {
  res.send("PDF API is running");
});

app.post("/generate-pdf", async (req, res) => {
  try {
    const { title, content_markdown } = req.body;

    if (!title || !content_markdown) {
      return res.status(400).json({
        success: false,
        error: "title と content_markdown は必須です"
      });
    }

    const safeTitle = String(title).replace(/[<>]/g, "");
    const safeContent = String(content_markdown)
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\n/g, "<br>");

    const html = `
      <!DOCTYPE html>
      <html lang="ja">
      <head>
        <meta charset="UTF-8" />
        <title>${safeTitle}</title>
        <style>
          body {
            font-family: sans-serif;
            line-height: 1.7;
            padding: 40px;
            max-width: 800px;
            margin: 0 auto;
          }
          h1 {
            border-bottom: 2px solid #333;
            padding-bottom: 8px;
          }
          .content {
            margin-top: 24px;
            white-space: normal;
            word-break: break-word;
          }
        </style>
      </head>
      <body>
        <h1>${safeTitle}</h1>
        <div class="content">${safeContent}</div>
      </body>
      </html>
    `;

    res.json({
      success: true,
      message: "今はテスト版。次の段階で本物のPDF出力を入れる",
      html_preview: html
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: "サーバーエラー",
      detail: error.message
    });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
