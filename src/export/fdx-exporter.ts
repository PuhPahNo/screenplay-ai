import fs from 'fs/promises';
import { FountainParser } from '../screenplay/fountain-parser';

export class FDXExporter {
  static async export(content: string, outputPath: string): Promise<void> {
    const parsed = FountainParser.parse(content);

    const fdx = this.buildFDX(content, parsed.title, parsed.author);

    await fs.writeFile(outputPath, fdx, 'utf-8');
  }

  private static buildFDX(content: string, title?: string, author?: string): string {
    const lines = content.split('\n');

    let fdxContent = `<?xml version="1.0" encoding="UTF-8"?>
<FinalDraft DocumentType="Script" Template="No" Version="5">
  <Content>
    <Paragraph Type="Title">
      <Text>${this.escapeXml(title || 'Untitled')}</Text>
    </Paragraph>
    <Paragraph Type="Author">
      <Text>${this.escapeXml(author || 'Unknown')}</Text>
    </Paragraph>
`;

    for (const line of lines) {
      const trimmed = line.trim();

      if (!trimmed) {
        continue;
      }

      if (FountainParser['isSceneHeading'](trimmed)) {
        fdxContent += `    <Paragraph Type="Scene Heading">
      <Text>${this.escapeXml(trimmed.toUpperCase())}</Text>
    </Paragraph>
`;
      } else if (this.isCharacterName(trimmed)) {
        fdxContent += `    <Paragraph Type="Character">
      <Text>${this.escapeXml(trimmed)}</Text>
    </Paragraph>
`;
      } else if (this.isParenthetical(trimmed)) {
        fdxContent += `    <Paragraph Type="Parenthetical">
      <Text>${this.escapeXml(trimmed)}</Text>
    </Paragraph>
`;
      } else if (this.isTransition(trimmed)) {
        fdxContent += `    <Paragraph Type="Transition">
      <Text>${this.escapeXml(trimmed)}</Text>
    </Paragraph>
`;
      } else {
        // Default to action
        fdxContent += `    <Paragraph Type="Action">
      <Text>${this.escapeXml(trimmed)}</Text>
    </Paragraph>
`;
      }
    }

    fdxContent += `  </Content>
</FinalDraft>`;

    return fdxContent;
  }

  private static escapeXml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
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
}

