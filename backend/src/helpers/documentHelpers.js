import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import axios from 'axios';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const assetsPath = path.join(__dirname, '../../assets');
const defaultLogoPath = path.join(assetsPath, 'default-logo.png');

if (!fs.existsSync(assetsPath)) {
  fs.mkdirSync(assetsPath, { recursive: true });
}

const downloadImageFromURL = async (url, outputPath) => {
  try {
    const response = await axios.get(url, { responseType: 'arraybuffer' });
    fs.writeFileSync(outputPath, response.data);
    return outputPath;
  } catch (error) {
    console.error('Error downloading image from URL:', error);
    return null;
  }
};

  export const generateCertificatePdf = async (
    outputPath,
    referenceId,
    candidateName,
    courseName,
    institutionName,
    logoPath,
    verificationCode,
    verificationUrl,
    issuedDate = "",
    institutionLogo = "",
    cryptographicSignature = "",
    certificateId = "",
    additionalFields = {},
    certificateType = "COMPLETION",
    gpa = null
  ) => {
  return new Promise(async (resolve, reject) => {
    // Build frontend verification URL
    let frontendUrl;
    try {
      const urlObj = new URL(verificationUrl);
      const host = urlObj.host.replace(/:\d+$/, '') || urlObj.hostname;
      frontendUrl = `${urlObj.protocol}//${host}:5173/verify?code=${verificationCode}&auto=true`;
    } catch (error) {
      const baseUrl = verificationUrl.split('/api/')[0].replace(/:\d+(?=\/)/, '');
      frontendUrl = `${baseUrl}:5173/verify?code=${verificationCode}&auto=true`;
    }

    // Normalize certificate type
    const validTypes = ["ACHIEVEMENT", "COMPLETION", "PARTICIPATION"];
    certificateType = String(certificateType || 'COMPLETION').toUpperCase();
    if (!validTypes.includes(certificateType)) {
      certificateType = "COMPLETION";
    }

    // ── Accent: always dark blue ──────────────────────────────────────────
    const accentColor    = '#1e3a5f';   // deep navy
    const accentLight    = '#2d5a8e';   // slightly lighter navy for gradients
    const accentMid      = '#4a7ab5';   // mid blue for decorative lines
    const textDark       = '#1a202c';
    const textMid        = '#4a5568';
    const textLight      = '#718096';
    const bgWhite        = '#ffffff';
    const borderGray     = '#e2e8f0';

    try {
      const doc = new PDFDocument({
        size: 'A4',
        layout: 'landscape',
        margins: { top: 0, bottom: 0, left: 0, right: 0 },
        info: {
          Title: `Certificate of ${certificateType} - ${candidateName}`,
          Author: institutionName,
          Subject: courseName,
          Keywords: `certificate,blockchain,verification`,
          CreationDate: new Date(),
        }
      });

      const stream = fs.createWriteStream(outputPath);
      doc.pipe(stream);

      const W = doc.page.width;   // 841.89
      const H = doc.page.height;  // 595.28

      // ── Background ───────────────────────────────────────────────────────
      doc.rect(0, 0, W, H).fillColor(bgWhite).fill();

      // Outer border
      doc.rect(12, 12, W - 24, H - 24)
        .lineWidth(2.5)
        .strokeColor(accentColor)
        .stroke();

      // Inner border (thin)
      doc.rect(18, 18, W - 36, H - 36)
        .lineWidth(0.8)
        .strokeColor(accentMid)
        .stroke();

      // ── Header bar ───────────────────────────────────────────────────────
      const headerH = 95;
      doc.rect(18, 18, W - 36, headerH)
        .fillColor(accentColor)
        .fill();

      // Subtle diagonal accent strips on right side of header
      for (let i = 0; i < 4; i++) {
        const sx = W - 220 + i * 45;
        doc.save()
          .moveTo(sx, 18)
          .lineTo(sx + 35, 18)
          .lineTo(sx + 60, 18 + headerH)
          .lineTo(sx + 25, 18 + headerH)
          .closePath()
          .fillOpacity(0.12)
          .fill(accentLight)
          .restore();
      }
      doc.fillOpacity(1);

      // ── Logo (square with rounded corners) ───────────────────────────────
      let logoImagePath = null;
      if (institutionLogo && institutionLogo.startsWith('http')) {
        const tempLogoPath = path.join(assetsPath, `temp_logo_${Date.now()}.png`);
        logoImagePath = await downloadImageFromURL(institutionLogo, tempLogoPath);
      } else if (institutionLogo && fs.existsSync(institutionLogo)) {
        logoImagePath = institutionLogo;
      } else if (logoPath && fs.existsSync(logoPath)) {
        logoImagePath = logoPath;
      } else if (fs.existsSync(defaultLogoPath)) {
        logoImagePath = defaultLogoPath;
      }

      const logoSize = 65;
      const logoX    = 35;
      const logoY    = 18 + (headerH - logoSize) / 2;
      const radius   = 8; // soft rounded corners

      if (logoImagePath && fs.existsSync(logoImagePath)) {
        // Draw rounded-rect background (white) then clip the image into it
        doc.save()
          .roundedRect(logoX, logoY, logoSize, logoSize, radius)
          .fillColor(bgWhite)
          .fill()
          .roundedRect(logoX, logoY, logoSize, logoSize, radius)
          .clip()
          .image(logoImagePath, logoX, logoY, { width: logoSize, height: logoSize })
          .restore();
      }

      // ── Institution name in header ────────────────────────────────────────
      const instX = logoX + logoSize + 18;
      const instY = 18 + (headerH / 2) - 14;

      doc.fontSize(20)
        .font('Helvetica-Bold')
        .fillColor(bgWhite)
        .text(institutionName.toUpperCase(), instX, instY, { width: 420 });

      // ── Date + Reference ID top-right ─────────────────────────────────────
      const dateStr = issuedDate
        ? new Date(issuedDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).toUpperCase()
        : new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).toUpperCase();

      doc.fontSize(8.5)
        .font('Helvetica')
        .fillColor(bgWhite)
        .fillOpacity(0.85)
        .text(dateStr, W - 210, 18 + 22, { width: 185, align: 'right' });

      if (referenceId) {
        doc.fontSize(8.5)
          .font('Helvetica')
          .fillColor(bgWhite)
          .fillOpacity(0.85)
          .text(`REFERENCE ID: ${referenceId}`, W - 210, 18 + 38, { width: 185, align: 'right' });
      }
      doc.fillOpacity(1);

      // ── Main content area ─────────────────────────────────────────────────
      const contentTop = 18 + headerH + 28;
      const cx = W / 2;

      // "CERTIFICATE" in large navy
      doc.fontSize(52)
        .font('Helvetica-Bold')
        .fillColor(accentColor)
        .text('CERTIFICATE', 0, contentTop, { width: W, align: 'center', characterSpacing: 3 });

      // "OF COMPLETION" subtitle
      doc.fontSize(17)
        .font('Helvetica')
        .fillColor(textLight)
        .text(`OF ${certificateType}`, 0, contentTop + 58, { width: W, align: 'center', characterSpacing: 1.5 });

      // Decorative divider line with diamond
      const lineY = contentTop + 86;
      const lineLen = 100;
      doc.moveTo(cx - lineLen - 8, lineY).lineTo(cx - 8, lineY)
        .lineWidth(1.5).strokeColor(accentMid).stroke();
      // diamond shape
      doc.save()
        .moveTo(cx, lineY - 5)
        .lineTo(cx + 6, lineY)
        .lineTo(cx, lineY + 5)
        .lineTo(cx - 6, lineY)
        .closePath()
        .fillColor(accentMid)
        .fill()
        .restore();
      doc.moveTo(cx + 8, lineY).lineTo(cx + lineLen + 8, lineY)
        .lineWidth(1.5).strokeColor(accentMid).stroke();

      // "presented to"
      doc.fontSize(13)
        .font('Helvetica-Oblique')
        .fillColor(textLight)
        .text('presented to', 0, lineY + 14, { width: W, align: 'center' });

      // Recipient name
      const nameFontSize = candidateName.length > 28 ? 34 : 40;
      doc.fontSize(nameFontSize)
        .font('Times-Italic')
        .fillColor(textDark)
        .text(candidateName, 60, lineY + 34, {
          width: W - 120,
          align: 'center',
          characterSpacing: 0.5
        });

      // Underline for name
      const nameTextWidth = Math.min(candidateName.length * (nameFontSize * 0.52), W - 240);
      const nameLineY = lineY + 34 + nameFontSize + 6;
      doc.moveTo(cx - nameTextWidth / 2, nameLineY)
        .lineTo(cx + nameTextWidth / 2, nameLineY)
        .lineWidth(1)
        .strokeColor(borderGray)
        .stroke();

      // ── Description paragraph ─────────────────────────────────────────────
      // Safely parse GPA — only include if it's a valid finite number
      const gpaNum = parseFloat(gpa);
      const hasGpa = gpa !== null && gpa !== undefined && gpa !== '' && !isNaN(gpaNum) && isFinite(gpaNum);

      const certTypeWord = certificateType === 'COMPLETION'
        ? 'successfully completing'
        : certificateType === 'PARTICIPATION'
          ? 'active participation in'
          : 'outstanding achievement in';

      const paragraph = hasGpa
        ? `This is to certify that the above-named individual has demonstrated ${certTypeWord} the course "${courseName}" with a cumulative GPA of ${gpaNum.toFixed(2)} out of 4.00, and is hereby awarded this certificate in recognition of their dedication and academic excellence.`
        : `This is to certify that the above-named individual has demonstrated ${certTypeWord} the course "${courseName}", and is hereby awarded this certificate in recognition of their dedication and academic excellence.`;

      // Paragraph
const paraBoxPadX = 90;
const paraY = nameLineY + 28;
const paraWidth = W - paraBoxPadX * 2;

const normalFont = 'Times-Roman';
const boldFont = 'Times-Bold';

doc.font(normalFont)
  .fontSize(13)
  .fillColor('#374151');

// Start position
let x = paraBoxPadX;
let y = paraY;

// First text
doc.text(
  'This is to certify that the above-named individual has demonstrated successfully completing the course ',
  x,
  y,
  {
    continued: true,
    width: paraWidth,
    align: 'justify'
  }
);

// Bold course name
doc.font(boldFont)
  .text(`"${courseName}"`, {
    continued: true
  });

// Normal text
doc.font(normalFont)
  .text(' with a cumulative GPA of ', {
    continued: true
  });

// Bold GPA
doc.font(boldFont)
  .text(`${gpaNum.toFixed(2)} `, {
  continued: true
});

// Remaining text
doc.font(normalFont)
  .text(
    ' out of 4.00, and is hereby awarded this certificate in recognition of their dedication and academic excellence.',
    {
      width: paraWidth,
      align: 'justify'
    }
  );
      // ── Bottom accent bar ─────────────────────────────────────────────────
      const bottomBarH = 28;
      const bottomBarY = H - 18 - bottomBarH;
      doc.rect(18, bottomBarY, W - 36, bottomBarH)
        .fillColor(accentColor)
        .fill();

      // Verification code inside bottom bar
      doc.fontSize(8)
        .font('Helvetica')
        .fillColor(bgWhite)
        .fillOpacity(0.75)
        .text(`VERIFICATION CODE: ${verificationCode}   |   BLOCKCHAIN SECURED`, 0, bottomBarY + 8, {
          width: W,
          align: 'center'
        });
      doc.fillOpacity(1);

      // Finalize
      doc.end();

      stream.on('finish', () => {
        // Clean up temp logo
        if (logoImagePath && logoImagePath.includes('temp_logo_')) {
          try { if (fs.existsSync(logoImagePath)) fs.unlinkSync(logoImagePath); } catch (_) {}
        }
        resolve(outputPath);
      });

      stream.on('error', (err) => {
        if (logoImagePath && logoImagePath.includes('temp_logo_')) {
          try { if (fs.existsSync(logoImagePath)) fs.unlinkSync(logoImagePath); } catch (_) {}
        }
        reject(err);
      });

    } catch (error) {
      reject(error);
    }
  });
};