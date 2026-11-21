const HEADING = /^(#{1,6})\s+(.+?)\s*#*\s*$/;

function splitLongParagraph(paragraph, maxChars) {
  // Titik di dalam angka atau singkatan ("10.000", "No.1") bukan akhir kalimat: hanya pecah bila diikuti spasi.
  const sentences = paragraph.split(/(?<=[.!?]\s+)/);
  const parts = [];
  let current = '';
  for (const sentence of sentences) {
    if (current && current.length + sentence.length > maxChars) {
      parts.push(current.trim());
      current = '';
    }
    current += sentence;
    while (current.length > maxChars) {
      parts.push(current.slice(0, maxChars).trim());
      current = current.slice(maxChars);
    }
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}

function packParagraphs(paragraphs, maxChars) {
  const chunks = [];
  let current = '';
  for (const paragraph of paragraphs) {
    const pieces = paragraph.length > maxChars ? splitLongParagraph(paragraph, maxChars) : [paragraph];
    for (const piece of pieces) {
      if (current && current.length + piece.length + 2 > maxChars) {
        chunks.push(current);
        current = '';
      }
      current = current ? `${current}\n\n${piece}` : piece;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

/**
 * Memecah dokumen Markdown menjadi potongan per bagian (heading), lalu per paragraf
 * bila satu bagian lebih panjang dari `maxChars`.
 */
export function chunkMarkdown(markdown, { maxChars = 1200, fallbackTitle = 'Tanpa judul' } = {}) {
  const lines = markdown.replace(/\r\n?/g, '\n').split('\n');
  let title = '';
  const sections = [];
  const path = [];
  let current = { heading: '', lines: [] };
  let inCodeFence = false;

  for (const line of lines) {
    if (/^\s*(```|~~~)/.test(line)) inCodeFence = !inCodeFence;
    const match = inCodeFence ? null : line.match(HEADING);
    if (!match) {
      current.lines.push(line);
      continue;
    }
    const level = match[1].length;
    const text = match[2].trim();
    if (level === 1 && !title) {
      title = text;
      continue;
    }
    sections.push(current);
    path.length = Math.max(0, level - 2);
    path[Math.max(0, level - 2)] = text;
    current = { heading: path.filter(Boolean).join(' > '), lines: [] };
  }
  sections.push(current);

  const chunks = [];
  for (const section of sections) {
    const paragraphs = section.lines
      .join('\n')
      .split(/\n{2,}/)
      .map((paragraph) => paragraph.trim())
      .filter(Boolean);
    for (const content of packParagraphs(paragraphs, maxChars)) {
      chunks.push({ heading: section.heading, content });
    }
  }

  return { title: title || fallbackTitle, chunks };
}

/** Teks yang di-embed: judul dan heading ikut agar potongan pendek tetap punya konteks. */
export function chunkToEmbeddingText(title, chunk) {
  const label = [title, chunk.heading].filter(Boolean).join(' — ');
  return `${label}\n${chunk.content}`;
}
