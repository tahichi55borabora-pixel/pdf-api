const express = require("express");
const PDFDocument = require("pdfkit");
const fs = require("fs");
const path = require("path");

const app = express();
app.use(express.json({ limit: "5mb" }));

const PORT = process.env.PORT || 3000;
const BASE_URL = process.env.RENDER_EXTERNAL_URL || `http://localhost:${PORT}`;
const DOWNLOAD_DIR = path.join(__dirname, "downloads");

if (!fs.existsSync(DOWNLOAD_DIR)) {
  fs.mkdirSync(DOWNLOAD_DIR, { recursive: true });
}

app.use("/downloads", express.static(DOWNLOAD_DIR));

app.get("/", (req, res) => {
  res.send("PDF API is running");
});

function sanitizeFileName(name) {
  return String(name || "document")
    .replace(/[<>:"/\\|?*]+/g, "")
    .replace(/\s+/g, "_")
    .slice(0, 60) || "document";
}

function parseMarkdownToLines(markdown) {
  const lines = String(markdown || "").split("\n");

  return lines.map((line) => {
    const trimmed = line.trim();

    if (trimmed.startsWith("### ")) {
      return { type: "h3", text: trimmed.replace(/^### /, "") };
    }
    if (trimmed.startsWith("## ")) {
      return { type: "h2", text: trimmed.replace(/^## /, "") };
    }
    if (trimmed.startsWith("# ")) {
      return { type: "h1", text: trimmed.replace(/^# /, "") };
    }
    if (trimmed.startsWith("- ")) {
      return { type: "bullet", text: trimmed.replace(/^- /, "") };
    }
    if (trimmed === "---") {
      return { type: "hr", text: "" };
    }
    if (trimmed === "") {
      return { type: "blank", text: "" };
    }

    return { type: "p", text: trimmed };
  });
}

app.post("/generate-pdf", async (req, res) => {
  try {
    const {
      title,
      subtitle,
      content_markdown,
      file_name,
      paper_size = "A4",
      orientation = "portrait"
    } = req.body;

    if (!title || !content_markdown) {
      return res.status(400).json({
        success: false,
        error: "title と content_markdown は必須です"
      });
    }

    const safeTitle = String(title);
    const safeSubtitle = subtitle ? String(subtitle) : "";
    const safeFileNameBase = sanitizeFileName(file_name || title);
    const uniqueName = `${Date.now()}_${safeFileNameBase}.pdf`;
    const outputPath = path.join(DOWNLOAD_DIR, uniqueName);

    const doc = new PDFDocument({
      size: paper_size,
      layout: orientation,
      margin: 50
    });

    const stream = fs.createWriteStream(outputPath);
    doc.pipe(stream);

    doc.fontSize(20).text(safeTitle, { align: "left" });

    if (safeSubtitle) {
      doc.moveDown(0.3);
      doc.fontSize(11).fillColor("gray").text(safeSubtitle);
      doc.fillColor("black");
    }

    doc.moveDown(1);

    const items = parseMarkdownToLines(content_markdown);

    items.forEach((item) => {
      switch (item.type) {
        case "h1":
          doc.moveDown(0.8);
          doc.fontSize(18).text(item.text);
          doc.moveDown(0.3);
          break;

        case "h2":
          doc.moveDown(0.7);
          doc.fontSize(15).text(item.text);
          doc.moveDown(0.2);
          break;

        case "h3":
          doc.moveDown(0.5);
          doc.fontSize(13).text(item.text);
          doc.moveDown(0.2);
          break;

        case "bullet":
          doc.fontSize(11).text(`• ${item.text}`, {
            indent: 12
          });
          break;

        case "hr":
          doc.moveDown(0.4);
          {
            const y = doc.y;
            doc.moveTo(doc.page.margins.left, y)
              .lineTo(doc.page.width - doc.page.margins.right, y)
              .stroke();
          }
          doc.moveDown(0.6);
          break;

        case "blank":
          doc.moveDown(0.5);
          break;

        default:
          doc.fontSize(11).text(item.text, {
            align: "left",
            lineGap: 3
          });
          doc.moveDown(0.2);
      }
    });

    doc.end();

    stream.on("finish", () => {
      const downloadUrl = `${BASE_URL}/downloads/${uniqueName}`;

      res.json({
        success: true,
        download_url: downloadUrl,
        file_name: uniqueName
      });
    });

    stream.on("error", (error) => {
      res.status(500).json({
        success: false,
        error: "PDFファイル保存中にエラーが発生しました",
        detail: error.message
      });
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
