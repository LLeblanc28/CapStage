import fs from 'node:fs';
import path from 'node:path';
import PDFDocument from 'pdfkit';
import { config } from '../../config.js';
import {
  EXPERIENCE_KIND_LABELS,
  LANGUAGE_LABELS,
  LANGUAGE_SHORT,
  SEARCH_KIND_LABELS,
  contactLines,
  formatDate,
  fullName,
  lighten,
  period,
  readableText,
} from './helpers.js';

const TEXT = '#1b1f24';
const MUTED = '#5b6570';
const LINE = '#d8dee4';

/* ------------------------------------------------------------------ utils */

function bottom(doc) {
  return doc.page.height - doc.page.margins.bottom;
}

function ensure(doc, needed) {
  if (doc.y + needed > bottom(doc)) doc.addPage();
}

function contentWidth(doc) {
  return doc.page.width - doc.page.margins.left - doc.page.margins.right;
}

function paragraph(doc, text, options = {}) {
  if (!text) return;
  const { size = 9.5, color = TEXT, font = 'Helvetica', gap = 4, ...rest } = options;
  doc.font(font).fontSize(size).fillColor(color);
  doc.text(String(text), { width: contentWidth(doc), lineGap: 1.4, ...rest });
  doc.moveDown(0);
  doc.y += gap;
}

/** Rend une description : les lignes commencant par "-" ou "*" deviennent des puces. */
function description(doc, text, width) {
  if (!text) return;
  const lines = String(text).split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  for (const line of lines) {
    const isBullet = /^[-*•]\s?/.test(line);
    const content = line.replace(/^[-*•]\s?/, '');
    ensure(doc, 14);
    doc.font('Helvetica').fontSize(9).fillColor(MUTED);
    if (isBullet) {
      const x = doc.x;
      doc.text('•', x, doc.y, { width: 10, continued: false });
      doc.y -= doc.currentLineHeight();
      doc.text(content, x + 10, doc.y, { width: width - 10, lineGap: 1.2 });
      doc.x = x;
    } else {
      doc.text(content, { width, lineGap: 1.2 });
    }
    doc.y += 1.5;
  }
}

function sectionTitle(doc, label, accent, width) {
  ensure(doc, 34);
  doc.font('Helvetica-Bold').fontSize(10.5).fillColor(accent);
  doc.text(label.toUpperCase(), { width, characterSpacing: 0.8 });
  const y = doc.y + 3;
  doc
    .save()
    .moveTo(doc.x, y)
    .lineTo(doc.x + width, y)
    .lineWidth(1)
    .strokeColor(LINE)
    .stroke()
    .restore();
  doc.y = y + 8;
}

function levelDots(doc, x, y, level, accent) {
  for (let i = 0; i < 5; i += 1) {
    doc
      .circle(x + i * 8, y, 2.6)
      .fillColor(i < level ? accent : '#c9d1d9')
      .fill();
  }
}

function chip(doc, label, x, y, accent, textColor) {
  const w = doc.widthOfString(label) + 14;
  doc.roundedRect(x, y - 2, w, 15, 7).fillColor(lighten(accent, 0.86)).fill();
  doc.fillColor(textColor).text(label, x + 7, y + 1.5, { lineBreak: false });
  return w + 6;
}

function drawPhoto(doc, photoPath, x, y, size) {
  if (!photoPath) return false;
  const abs = path.join(config.uploadDir, path.basename(photoPath));
  if (!fs.existsSync(abs)) return false;
  try {
    doc.save();
    doc.circle(x + size / 2, y + size / 2, size / 2).clip();
    doc.image(abs, x, y, { cover: [size, size], align: 'center', valign: 'center' });
    doc.restore();
    return true;
  } catch {
    doc.restore();
    return false;
  }
}

/* ----------------------------------------------------------- blocs communs */

function experienceBlock(doc, items, accent, width) {
  for (const item of items) {
    ensure(doc, 46);
    const startX = doc.x;
    const dates = period(item.start_date, item.end_date, item.current);
    doc.font('Helvetica-Bold').fontSize(10.5).fillColor(TEXT);
    doc.text(item.position, startX, doc.y, { width: width - 120, continued: false });
    if (dates) {
      doc.font('Helvetica').fontSize(8.5).fillColor(MUTED);
      doc.text(dates, startX + width - 120, doc.y - doc.currentLineHeight(), {
        width: 120,
        align: 'right',
      });
      doc.x = startX;
    }
    const meta = [item.organisation, item.city].filter(Boolean).join(' - ');
    const kindLabel = EXPERIENCE_KIND_LABELS[item.kind];
    const subtitle = [meta, item.kind && item.kind !== 'experience' ? kindLabel : null]
      .filter(Boolean)
      .join('  ·  ');
    if (subtitle) {
      doc.font('Helvetica-Oblique').fontSize(9).fillColor(accent);
      doc.text(subtitle, startX, doc.y, { width });
    }
    doc.y += 2;
    description(doc, item.description, width);
    doc.y += 6;
    doc.x = startX;
  }
}

function educationBlock(doc, items, accent, width) {
  experienceBlock(
    doc,
    items.map((e) => ({
      position: e.degree,
      organisation: e.school,
      city: e.city,
      start_date: e.start_date,
      end_date: e.end_date,
      current: e.current,
      description: e.description,
      kind: 'experience',
    })),
    accent,
    width,
  );
}

function certificationBlock(doc, items, width) {
  for (const c of items) {
    ensure(doc, 20);
    doc.font('Helvetica-Bold').fontSize(9.5).fillColor(TEXT);
    doc.text(c.name, { width, continued: false });
    const meta = [c.issuer, formatDate(c.obtained_at), c.url].filter(Boolean).join('  ·  ');
    if (meta) {
      doc.font('Helvetica').fontSize(8.5).fillColor(MUTED);
      doc.text(meta, { width });
    }
    doc.y += 4;
  }
}

/* ------------------------------------------------------------- templates */

function renderClassique(doc, cv) {
  const accent = cv.accent || '#1f6feb';
  const width = contentWidth(doc);
  const left = doc.page.margins.left;
  const hasPhoto = !!cv.photo_path;
  const headerWidth = hasPhoto ? width - 92 : width;

  if (hasPhoto) drawPhoto(doc, cv.photo_path, left + width - 78, doc.y, 78);

  doc.font('Helvetica-Bold').fontSize(24).fillColor(TEXT);
  doc.text(fullName(cv).toUpperCase(), { width: headerWidth, characterSpacing: 0.5 });
  if (cv.headline) {
    doc.font('Helvetica').fontSize(12).fillColor(accent);
    doc.text(cv.headline, { width: headerWidth });
  }
  doc.y += 3;
  const infos = contactLines(cv);
  if (infos.length) {
    doc.font('Helvetica').fontSize(9).fillColor(MUTED);
    doc.text(infos.join('   ·   '), { width: headerWidth });
  }
  const links = (cv.links || []).map((l) => `${l.label} : ${l.url}`);
  if (links.length) {
    doc.font('Helvetica').fontSize(8.5).fillColor(MUTED);
    doc.text(links.join('   ·   '), { width: headerWidth });
  }

  doc.y = Math.max(doc.y, hasPhoto ? doc.page.margins.top + 84 : doc.y) + 8;
  doc.save().rect(left, doc.y, width, 2.5).fillColor(accent).fill().restore();
  doc.y += 16;

  if (cv.searching) {
    doc.font('Helvetica-Bold').fontSize(9).fillColor(readableText(lighten(accent, 0.86)));
    const label = `En recherche : ${SEARCH_KIND_LABELS[cv.search_kind] || cv.search_kind}${
      cv.available_from ? ` à partir du ${formatDate(cv.available_from)}` : ''
    }`;
    chip(doc, label, left, doc.y, accent, TEXT);
    doc.y += 24;
    doc.x = left;
  }

  if (cv.summary) {
    sectionTitle(doc, 'Profil', accent, width);
    paragraph(doc, cv.summary, { size: 9.5, color: MUTED, gap: 10 });
  }

  if (cv.experiences?.length) {
    sectionTitle(doc, 'Expériences', accent, width);
    experienceBlock(doc, cv.experiences, accent, width);
  }

  if (cv.educations?.length) {
    sectionTitle(doc, 'Formation', accent, width);
    educationBlock(doc, cv.educations, accent, width);
  }

  if (cv.skills?.length) {
    sectionTitle(doc, 'Compétences', accent, width);
    const colWidth = width / 2;
    let index = 0;
    for (const skill of cv.skills) {
      const col = index % 2;
      if (col === 0) ensure(doc, 16);
      const x = left + col * colWidth;
      const y = doc.y;
      doc.font('Helvetica').fontSize(9).fillColor(TEXT);
      doc.text(skill.name, x, y, { width: colWidth - 60, lineBreak: false });
      levelDots(doc, x + colWidth - 52, y + 4.5, skill.level, accent);
      if (col === 1 || index === cv.skills.length - 1) doc.y = y + 15;
      else doc.y = y;
      index += 1;
    }
    doc.x = left;
    doc.y += 6;
  }

  if (cv.languages?.length) {
    sectionTitle(doc, 'Langues', accent, width);
    doc.font('Helvetica').fontSize(9).fillColor(TEXT);
    const text = cv.languages
      .map((l) => `${l.name} (${LANGUAGE_LABELS[l.level] || l.level})`)
      .join('   ·   ');
    paragraph(doc, text, { gap: 10 });
  }

  if (cv.certifications?.length) {
    sectionTitle(doc, 'Certifications', accent, width);
    certificationBlock(doc, cv.certifications, width);
  }

  if (cv.interests?.length) {
    sectionTitle(doc, "Centres d'intérêt", accent, width);
    paragraph(doc, cv.interests.map((i) => i.label).join('   ·   '), { color: MUTED, gap: 6 });
  }
}

function renderModerne(doc, cv) {
  const accent = cv.accent || '#1f6feb';
  const sidebarWidth = 186;
  const sidebarPad = 20;
  const sideText = readableText(accent);

  const mainLeft = sidebarWidth + 28;

  // Chaque nouvelle page redessine le bandeau et reprend la marge de la colonne
  // principale : sans cela, la page 2 repartirait sous le bandeau.
  const startPage = () => {
    doc.save().rect(0, 0, sidebarWidth, doc.page.height).fillColor(accent).fill().restore();
    doc.page.margins.left = mainLeft;
    doc.x = mainLeft;
    doc.y = doc.page.margins.top;
  };
  startPage();
  doc.on('pageAdded', startPage);
  const mainWidth = contentWidth(doc);

  /* ---- barre laterale (page 1 uniquement) ---- */
  let sy = 34;
  const sx = sidebarPad;
  const sw = sidebarWidth - sidebarPad * 2;

  if (drawPhoto(doc, cv.photo_path, sx + (sw - 96) / 2, sy, 96)) sy += 112;

  doc.font('Helvetica-Bold').fontSize(17).fillColor(sideText);
  doc.text(fullName(cv), sx, sy, { width: sw });
  sy = doc.y + 4;
  if (cv.headline) {
    doc.font('Helvetica').fontSize(9.5).fillColor(sideText).opacity(0.9);
    doc.text(cv.headline, sx, sy, { width: sw });
    doc.opacity(1);
    sy = doc.y;
  }
  sy += 12;

  const sideSection = (label) => {
    doc.font('Helvetica-Bold').fontSize(9).fillColor(sideText).opacity(0.75);
    doc.text(label.toUpperCase(), sx, sy, { width: sw, characterSpacing: 0.8 });
    doc.opacity(1);
    sy = doc.y + 3;
    doc.save().moveTo(sx, sy).lineTo(sx + sw, sy).lineWidth(0.8).strokeColor(sideText).opacity(0.4).stroke().restore();
    doc.opacity(1);
    sy += 8;
  };

  const sideLines = (lines, size = 8.8) => {
    doc.font('Helvetica').fontSize(size).fillColor(sideText).opacity(0.95);
    for (const line of lines) {
      doc.text(line, sx, sy, { width: sw });
      sy = doc.y + 2;
    }
    doc.opacity(1);
    sy += 8;
  };

  const contact = contactLines(cv);
  if (contact.length) {
    sideSection('Contact');
    sideLines(contact);
  }

  if (cv.links?.length) {
    sideSection('Liens');
    sideLines(cv.links.map((l) => `${l.label} : ${l.url}`), 8);
  }

  if (cv.skills?.length) {
    sideSection('Compétences');
    for (const skill of cv.skills.slice(0, 14)) {
      doc.font('Helvetica').fontSize(8.8).fillColor(sideText);
      doc.text(skill.name, sx, sy, { width: sw });
      sy = doc.y + 3;
      doc.save().roundedRect(sx, sy, sw, 3.4, 1.7).fillColor(sideText).opacity(0.28).fill().restore();
      doc
        .save()
        .roundedRect(sx, sy, (sw * skill.level) / 5, 3.4, 1.7)
        .fillColor(sideText)
        .opacity(0.95)
        .fill()
        .restore();
      doc.opacity(1);
      sy += 10;
    }
    sy += 6;
  }

  if (cv.languages?.length) {
    sideSection('Langues');
    sideLines(cv.languages.map((l) => `${l.name} - ${LANGUAGE_LABELS[l.level] || l.level}`));
  }

  if (cv.interests?.length) {
    sideSection("Centres d'intérêt");
    sideLines(cv.interests.map((i) => i.label));
  }

  /* ---- colonne principale ---- */
  doc.x = doc.page.margins.left;
  doc.y = doc.page.margins.top;

  if (cv.searching) {
    const label = `En recherche : ${SEARCH_KIND_LABELS[cv.search_kind] || cv.search_kind}${
      cv.available_from ? ` à partir du ${formatDate(cv.available_from)}` : ''
    }`;
    doc.font('Helvetica-Bold').fontSize(8.5);
    chip(doc, label, doc.x, doc.y, accent, TEXT);
    doc.y += 26;
    doc.x = doc.page.margins.left;
  }

  if (cv.summary) {
    sectionTitle(doc, 'Profil', accent, mainWidth);
    paragraph(doc, cv.summary, { color: MUTED, gap: 10 });
  }
  if (cv.experiences?.length) {
    sectionTitle(doc, 'Expériences', accent, mainWidth);
    experienceBlock(doc, cv.experiences, accent, mainWidth);
  }
  if (cv.educations?.length) {
    sectionTitle(doc, 'Formation', accent, mainWidth);
    educationBlock(doc, cv.educations, accent, mainWidth);
  }
  if (cv.certifications?.length) {
    sectionTitle(doc, 'Certifications', accent, mainWidth);
    certificationBlock(doc, cv.certifications, mainWidth);
  }
}

function renderCompact(doc, cv) {
  const accent = cv.accent || '#1f6feb';
  const width = contentWidth(doc);
  const left = doc.page.margins.left;

  doc.save().rect(left, doc.y, 4, 46).fillColor(accent).fill().restore();
  const headX = left + 14;
  doc.font('Helvetica-Bold').fontSize(19).fillColor(TEXT);
  doc.text(fullName(cv), headX, doc.y, { width: width - 14 });
  if (cv.headline) {
    doc.font('Helvetica').fontSize(10).fillColor(accent);
    doc.text(cv.headline, headX, doc.y, { width: width - 14 });
  }
  const infos = contactLines(cv).concat((cv.links || []).map((l) => l.url));
  if (infos.length) {
    doc.font('Helvetica').fontSize(8.2).fillColor(MUTED);
    doc.text(infos.join('  ·  '), headX, doc.y + 2, { width: width - 14 });
  }
  doc.x = left;
  doc.y += 14;

  const tightSection = (label) => {
    ensure(doc, 26);
    doc.font('Helvetica-Bold').fontSize(9).fillColor(readableText(lighten(accent, 0.86)));
    doc.save().rect(left, doc.y - 2, width, 15).fillColor(lighten(accent, 0.86)).fill().restore();
    doc.fillColor(TEXT).text(label.toUpperCase(), left + 6, doc.y + 2, { width: width - 12, characterSpacing: 0.6 });
    doc.x = left;
    doc.y += 9;
  };

  if (cv.summary) {
    tightSection('Profil');
    paragraph(doc, cv.summary, { size: 9, color: MUTED, gap: 8 });
  }
  if (cv.experiences?.length) {
    tightSection('Expériences');
    experienceBlock(doc, cv.experiences, accent, width);
  }
  if (cv.educations?.length) {
    tightSection('Formation');
    educationBlock(doc, cv.educations, accent, width);
  }
  if (cv.skills?.length) {
    tightSection('Compétences');
    doc.font('Helvetica').fontSize(8.5);
    let x = left;
    ensure(doc, 20);
    for (const skill of cv.skills) {
      const label = `${skill.name}`;
      const w = doc.widthOfString(label) + 14;
      if (x + w > left + width) {
        x = left;
        doc.y += 19;
        ensure(doc, 20);
      }
      doc.font('Helvetica').fontSize(8.5);
      x += chip(doc, label, x, doc.y, accent, TEXT);
    }
    doc.x = left;
    doc.y += 26;
  }
  if (cv.languages?.length) {
    tightSection('Langues');
    const langs = cv.languages.map((l) => `${l.name} (${LANGUAGE_SHORT[l.level] || l.level})`);
    paragraph(doc, langs.join('   ·   '), {
      size: 8.8,
      gap: 8,
    });
  }
  if (cv.certifications?.length) {
    tightSection('Certifications');
    certificationBlock(doc, cv.certifications, width);
  }
  if (cv.interests?.length) {
    tightSection("Centres d'intérêt");
    paragraph(doc, cv.interests.map((i) => i.label).join('   ·   '), {
      size: 8.8,
      color: MUTED,
      gap: 4,
    });
  }
}

const RENDERERS = {
  classique: renderClassique,
  moderne: renderModerne,
  compact: renderCompact,
};

/**
 * Construit le PDF d'un CV et renvoie le flux PDFKit (deja termine).
 * @param {object} cv CV complet (getCvFull)
 */
export function renderCvPdf(cv) {
  const doc = new PDFDocument({
    size: 'A4',
    margins: { top: 46, left: 46, right: 46, bottom: 46 },
    info: {
      Title: `${fullName(cv)} - ${cv.title}`,
      Author: fullName(cv),
      Creator: 'CapStage',
      Subject: cv.headline || 'Curriculum vitae',
    },
  });

  const render = RENDERERS[cv.template] || RENDERERS.classique;
  render(doc, cv);
  doc.end();
  return doc;
}


