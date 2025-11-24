import PDFDocument from 'pdfkit';
import fs from 'fs';
import { FountainParser } from '../screenplay/fountain-parser';

export class PDFExporter {
  static async export(content: string, outputPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({
          size: 'LETTER',
          margins: {
            top: 72,    // 1 inch
            bottom: 72,
            left: 108,  // 1.5 inches
            right: 72,
          },
        });

        const stream = fs.createWriteStream(outputPath);
        doc.pipe(stream);

        // Set up screenplay font
        doc.font('Courier');
        doc.fontSize(12);

        const lines = content.split('\n');
        let currentY = doc.y;

        for (const line of lines) {
          const trimmed = line.trim();

          // Check if new page is needed
          if (currentY > doc.page.height - 100) {
            doc.addPage();
            currentY = doc.y;
          }

          if (FountainParser['isSceneHeading'](trimmed)) {
            // Scene heading
            doc.moveDown(1);
            doc.font('Courier-Bold');
            doc.text(trimmed.toUpperCase(), {
              align: 'left',
            });
            doc.font('Courier');
            doc.moveDown(0.5);
          } else if (this.isCharacterName(trimmed)) {
            // Character name
            doc.moveDown(0.5);
            doc.text(trimmed, {
              indent: 144, // 2 inches from left
              align: 'left',
            });
          } else if (this.isParenthetical(trimmed)) {
            // Parenthetical
            doc.text(trimmed, {
              indent: 108, // 1.5 inches from left
              align: 'left',
            });
          } else if (this.isTransition(trimmed)) {
            // Transition
            doc.moveDown(0.5);
            doc.text(trimmed, {
              align: 'right',
            });
            doc.moveDown(0.5);
          } else if (trimmed) {
            // Action or dialogue
            const isDialogue = this.isLikelyDialogue(trimmed, lines, lines.indexOf(line));
            
            if (isDialogue) {
              doc.text(trimmed, {
                indent: 72,  // 1 inch from left
                width: 252,  // 3.5 inches wide
                align: 'left',
              });
            } else {
              // Action
              doc.text(trimmed, {
                align: 'left',
              });
            }
          } else {
            // Empty line
            doc.moveDown(0.5);
          }

          currentY = doc.y;
        }

        doc.end();

        stream.on('finish', () => resolve());
        stream.on('error', reject);
      } catch (error) {
        reject(error);
      }
    });
  }

  private static isCharacterName(line: string): boolean {
    return line === line.toUpperCase() && line.length > 0 && line.length < 40 && !line.endsWith('TO:');
  }

  private static isParenthetical(line: string): boolean {
    return line.startsWith('(') && line.endsWith(')');
  }

  private static isTransition(line: string): boolean {
    return line.endsWith('TO:') || line === 'FADE IN:' || line === 'FADE OUT.';
  }

  private static isLikelyDialogue(line: string, allLines: string[], index: number): boolean {
    // Check if previous non-empty line was a character name or parenthetical
    for (let i = index - 1; i >= 0; i--) {
      const prevLine = allLines[i].trim();
      if (prevLine) {
        return this.isCharacterName(prevLine) || this.isParenthetical(prevLine);
      }
    }
    return false;
  }
}

