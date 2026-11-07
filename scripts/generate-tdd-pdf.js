const fs = require("fs");
const path = require("path");
const PDFDocument = require("pdfkit");

function generatePdf() {
  const mdPath = path.resolve(__dirname, "../TDD.md");
  const pdfPath = path.resolve(__dirname, "../TDD.pdf");

  const mdContent = fs.readFileSync(mdPath, "utf-8");
  const lines = mdContent.split("\n");

  const doc = new PDFDocument({
    margin: 50,
    size: "A4",
    info: {
      Title: "Technical Design Document — FeeFlow",
      Author: "Vedant Vinod Kulkarni",
      Subject: "Coaching Institute Fee Tracking System and Parent Portal",
    },
  });

  const writeStream = fs.createWriteStream(pdfPath);
  doc.pipe(writeStream);

  // Styling palette
  const ink = "#17191A";
  const teal = "#0B5D5A";
  const gray = "#505A66";
  const lightGray = "#E8E4DB";

  lines.forEach((line) => {
    const trimmed = line.trim();

    if (!trimmed) {
      doc.moveDown(0.4);
      return;
    }

    if (trimmed.startsWith("# ")) {
      doc.moveDown(0.5);
      doc
        .font("Helvetica-Bold")
        .fontSize(20)
        .fillColor(teal)
        .text(trimmed.replace("# ", ""));
      doc.moveDown(0.3);
      // Horizontal separator line
      const y = doc.y;
      doc.strokeColor(lightGray).lineWidth(1).moveTo(50, y).lineTo(545, y).stroke();
      doc.moveDown(0.5);
    } else if (trimmed.startsWith("## ")) {
      doc.moveDown(0.6);
      doc
        .font("Helvetica-Bold")
        .fontSize(13)
        .fillColor(teal)
        .text(trimmed.replace("## ", ""));
      doc.moveDown(0.2);
    } else if (trimmed.startsWith("### ")) {
      doc.moveDown(0.4);
      doc
        .font("Helvetica-Bold")
        .fontSize(11)
        .fillColor(ink)
        .text(trimmed.replace("### ", ""));
      doc.moveDown(0.2);
    } else if (trimmed.startsWith("- ")) {
      const text = trimmed.replace("- ", "");
      doc
        .font("Helvetica")
        .fontSize(9.5)
        .fillColor(ink)
        .text("•  " + text.replace(/\*\*/g, ""), {
          indent: 12,
          lineGap: 2.5,
        });
    } else if (/^\d+\.\s/.test(trimmed)) {
      const numMatch = trimmed.match(/^(\d+\.)\s/)[0];
      const text = trimmed.replace(/^\d+\.\s/, "");
      doc
        .font("Helvetica")
        .fontSize(9.5)
        .fillColor(ink)
        .text(numMatch + "  " + text.replace(/\*\*/g, ""), {
          indent: 12,
          lineGap: 2.5,
        });
    } else {
      doc
        .font("Helvetica")
        .fontSize(9.5)
        .fillColor(ink)
        .text(trimmed.replace(/\*\*/g, ""), {
          lineGap: 2.5,
        });
    }
  });

  doc.end();

  writeStream.on("finish", () => {
    console.log("TDD.pdf generated successfully at:", pdfPath);
  });
}

generatePdf();

