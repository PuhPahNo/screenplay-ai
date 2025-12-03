import fs from 'fs';
import path from 'path';
import type { Scene, Character } from '../shared/types';

export interface ExportOptions {
  title?: string;
  author?: string;
  includeSceneNumbers?: boolean;
  includeCharacterList?: boolean;
}

export class ExportManager {
  /**
   * Export to Fountain format (.fountain)
   * Fountain is an industry-standard plain text markup for screenplays
   */
  async exportToFountain(
    scenes: Scene[],
    characters: Character[],
    outputPath: string,
    options: ExportOptions = {}
  ): Promise<void> {
    let content = '';
    
    // Title page (Fountain format)
    if (options.title) {
      content += `Title: ${options.title}\n`;
    }
    if (options.author) {
      content += `Author: ${options.author}\n`;
    }
    if (options.title || options.author) {
      content += '\n===\n\n'; // Page break after title
    }
    
    // Sort scenes by order/number
    const sortedScenes = [...scenes].sort((a, b) => (a.order || a.number) - (b.order || b.number));
    
    // Write each scene
    for (const scene of sortedScenes) {
      // Scene heading (must be uppercase, start with INT./EXT.)
      if (options.includeSceneNumbers && scene.number) {
        content += `#${scene.number}#\n`;
      }
      content += `${scene.heading.toUpperCase()}\n\n`;
      
      // Scene content
      if (scene.content) {
        content += scene.content;
        content += '\n\n';
      }
    }
    
    // Write to file
    fs.writeFileSync(outputPath, content, 'utf8');
    console.log(`[Export] Exported Fountain to: ${outputPath}`);
  }

  /**
   * Export to plain text (.txt)
   */
  async exportToText(
    scenes: Scene[],
    characters: Character[],
    outputPath: string,
    options: ExportOptions = {}
  ): Promise<void> {
    let content = '';
    
    // Title
    if (options.title) {
      content += `${options.title.toUpperCase()}\n`;
      content += '='.repeat(options.title.length) + '\n';
      if (options.author) {
        content += `by ${options.author}\n`;
      }
      content += '\n\n';
    }
    
    // Character list if requested
    if (options.includeCharacterList && characters.length > 0) {
      content += 'CHARACTERS\n';
      content += '-'.repeat(10) + '\n';
      for (const char of characters) {
        content += `${char.name}`;
        if (char.description) {
          content += ` - ${char.description}`;
        }
        content += '\n';
      }
      content += '\n\n';
    }
    
    // Sort scenes
    const sortedScenes = [...scenes].sort((a, b) => (a.order || a.number) - (b.order || b.number));
    
    // Write scenes
    for (const scene of sortedScenes) {
      if (options.includeSceneNumbers && scene.number) {
        content += `Scene ${scene.number}: `;
      }
      content += `${scene.heading}\n`;
      content += '-'.repeat(40) + '\n\n';
      
      if (scene.content) {
        content += scene.content;
        content += '\n\n';
      }
    }
    
    fs.writeFileSync(outputPath, content, 'utf8');
    console.log(`[Export] Exported Text to: ${outputPath}`);
  }

  /**
   * Export to Final Draft XML format (.fdx)
   */
  async exportToFinalDraft(
    scenes: Scene[],
    characters: Character[],
    outputPath: string,
    options: ExportOptions = {}
  ): Promise<void> {
    // FDX is XML-based format
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<FinalDraft DocumentType="Script" Template="No" Version="1">\n';
    
    // Document content
    xml += '  <Content>\n';
    
    // Title page
    if (options.title) {
      xml += '    <Paragraph Type="Scene Heading">\n';
      xml += `      <Text>${this.escapeXml(options.title.toUpperCase())}</Text>\n`;
      xml += '    </Paragraph>\n';
    }
    
    // Sort scenes
    const sortedScenes = [...scenes].sort((a, b) => (a.order || a.number) - (b.order || b.number));
    
    for (const scene of sortedScenes) {
      // Scene heading
      xml += '    <Paragraph Type="Scene Heading">\n';
      xml += `      <Text>${this.escapeXml(scene.heading.toUpperCase())}</Text>\n`;
      xml += '    </Paragraph>\n';
      
      // Parse scene content into FDX paragraphs
      if (scene.content) {
        const paragraphs = this.parseContentToParagraphs(scene.content);
        for (const para of paragraphs) {
          xml += `    <Paragraph Type="${para.type}">\n`;
          xml += `      <Text>${this.escapeXml(para.text)}</Text>\n`;
          xml += '    </Paragraph>\n';
        }
      }
    }
    
    xml += '  </Content>\n';
    
    // Title page info
    xml += '  <TitlePage>\n';
    if (options.title) {
      xml += `    <Content><Paragraph><Text>${this.escapeXml(options.title)}</Text></Paragraph></Content>\n`;
    }
    if (options.author) {
      xml += `    <Content><Paragraph><Text>Written by</Text></Paragraph></Content>\n`;
      xml += `    <Content><Paragraph><Text>${this.escapeXml(options.author)}</Text></Paragraph></Content>\n`;
    }
    xml += '  </TitlePage>\n';
    
    xml += '</FinalDraft>\n';
    
    fs.writeFileSync(outputPath, xml, 'utf8');
    console.log(`[Export] Exported Final Draft to: ${outputPath}`);
  }

  /**
   * Export to PDF format
   * Note: This creates a basic PDF. For production use, consider a proper PDF library.
   */
  async exportToPDF(
    scenes: Scene[],
    characters: Character[],
    outputPath: string,
    options: ExportOptions = {}
  ): Promise<void> {
    // For now, we'll create a simple PDF using a basic approach
    // In a real implementation, you'd use pdfkit or similar
    
    // Build the content first
    let content = '';
    
    if (options.title) {
      content += options.title.toUpperCase() + '\n\n';
      if (options.author) {
        content += 'Written by\n' + options.author + '\n\n';
      }
      content += '\n\n\n';
    }
    
    const sortedScenes = [...scenes].sort((a, b) => (a.order || a.number) - (b.order || b.number));
    
    for (const scene of sortedScenes) {
      content += scene.heading.toUpperCase() + '\n\n';
      if (scene.content) {
        content += scene.content + '\n\n';
      }
    }
    
    // Create a simple PDF
    // This is a minimal PDF structure - for better quality, use pdfkit
    const pdfContent = this.createSimplePDF(content, options.title || 'Screenplay');
    
    fs.writeFileSync(outputPath, pdfContent);
    console.log(`[Export] Exported PDF to: ${outputPath}`);
  }

  /**
   * Helper: Escape XML special characters
   */
  private escapeXml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  /**
   * Helper: Parse screenplay content into paragraph types
   */
  private parseContentToParagraphs(content: string): { type: string; text: string }[] {
    const paragraphs: { type: string; text: string }[] = [];
    const lines = content.split('\n');
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      // Detect paragraph type based on Fountain conventions
      if (line.match(/^(INT\.|EXT\.|INT\/EXT\.|I\/E\.)/i)) {
        paragraphs.push({ type: 'Scene Heading', text: line });
      } else if (line.match(/^[A-Z][A-Z\s]+$/)) {
        // All caps = character name
        paragraphs.push({ type: 'Character', text: line });
      } else if (line.startsWith('(') && line.endsWith(')')) {
        // Parenthetical
        paragraphs.push({ type: 'Parenthetical', text: line });
      } else if (line.startsWith('>') || line.endsWith('<')) {
        // Transition
        paragraphs.push({ type: 'Transition', text: line.replace(/[><]/g, '').trim() });
      } else {
        // Check if previous was character name = this is dialogue
        const prevPara = paragraphs[paragraphs.length - 1];
        if (prevPara && (prevPara.type === 'Character' || prevPara.type === 'Parenthetical')) {
          paragraphs.push({ type: 'Dialogue', text: line });
        } else {
          paragraphs.push({ type: 'Action', text: line });
        }
      }
    }
    
    return paragraphs;
  }

  /**
   * Create a simple PDF (minimal implementation)
   * For production, use pdfkit or puppeteer
   */
  private createSimplePDF(content: string, title: string): Buffer {
    // This creates a very basic PDF structure
    // The text is embedded as-is without proper formatting
    
    const textLines = content.split('\n');
    let objects: string[] = [];
    let objectOffsets: number[] = [];
    let currentOffset = 0;
    
    // PDF header
    let pdf = '%PDF-1.4\n';
    currentOffset = pdf.length;
    
    // Object 1: Catalog
    objectOffsets.push(currentOffset);
    const obj1 = '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n';
    pdf += obj1;
    currentOffset += obj1.length;
    
    // Object 2: Pages
    objectOffsets.push(currentOffset);
    const obj2 = '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n';
    pdf += obj2;
    currentOffset += obj2.length;
    
    // Object 3: Page
    objectOffsets.push(currentOffset);
    const obj3 = '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n';
    pdf += obj3;
    currentOffset += obj3.length;
    
    // Object 4: Content stream
    let stream = 'BT\n/F1 10 Tf\n72 720 Td\n12 TL\n';
    
    // Add text lines (limit to fit on page)
    const maxLines = 50;
    for (let i = 0; i < Math.min(textLines.length, maxLines); i++) {
      const line = textLines[i]
        .replace(/\\/g, '\\\\')
        .replace(/\(/g, '\\(')
        .replace(/\)/g, '\\)');
      stream += `(${line}) Tj T*\n`;
    }
    
    if (textLines.length > maxLines) {
      stream += '([...continued...]) Tj T*\n';
    }
    
    stream += 'ET';
    
    objectOffsets.push(currentOffset);
    const obj4 = `4 0 obj\n<< /Length ${stream.length} >>\nstream\n${stream}\nendstream\nendobj\n`;
    pdf += obj4;
    currentOffset += obj4.length;
    
    // Object 5: Font
    objectOffsets.push(currentOffset);
    const obj5 = '5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>\nendobj\n';
    pdf += obj5;
    currentOffset += obj5.length;
    
    // Cross-reference table
    const xrefOffset = currentOffset;
    pdf += 'xref\n';
    pdf += `0 6\n`;
    pdf += '0000000000 65535 f \n';
    for (const offset of objectOffsets) {
      pdf += offset.toString().padStart(10, '0') + ' 00000 n \n';
    }
    
    // Trailer
    pdf += 'trailer\n';
    pdf += '<< /Size 6 /Root 1 0 R >>\n';
    pdf += 'startxref\n';
    pdf += xrefOffset + '\n';
    pdf += '%%EOF';
    
    return Buffer.from(pdf, 'utf8');
  }
}

