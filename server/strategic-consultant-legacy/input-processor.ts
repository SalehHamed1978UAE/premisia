import Anthropic from '@anthropic-ai/sdk';
import mammoth from 'mammoth';
import * as XLSX from 'xlsx';
import { readFileSync } from 'fs';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const pdf = require('pdf-parse');

export interface ProcessedInput {
  type: 'text' | 'pdf' | 'docx' | 'xlsx' | 'image';
  content: string;
  metadata?: {
    pageCount?: number;
    fileName?: string;
    fileSize?: number;
    sheets?: string[];
  };
}

export class InputProcessor {
  private anthropic: Anthropic;

  constructor() {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY environment variable is required');
    }
    this.anthropic = new Anthropic({ apiKey });
  }

  async processText(text: string): Promise<ProcessedInput> {
    return {
      type: 'text',
      content: text.trim(),
    };
  }

  async processPDF(filePath: string): Promise<ProcessedInput> {
    const dataBuffer = readFileSync(filePath);
    const data = await pdf(dataBuffer);

    return {
      type: 'pdf',
      content: data.text,
      metadata: {
        pageCount: data.total,
        fileName: filePath.split('/').pop(),
      },
    };
  }

  async processDOCX(filePath: string): Promise<ProcessedInput> {
    const result = await mammoth.extractRawText({ path: filePath });

    return {
      type: 'docx',
      content: result.value,
      metadata: {
        fileName: filePath.split('/').pop(),
      },
    };
  }

  async processExcel(filePath: string): Promise<ProcessedInput> {
    const workbook = XLSX.readFile(filePath);
    const sheets: string[] = [];
    let content = '';

    for (const sheetName of workbook.SheetNames) {
      sheets.push(sheetName);
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
      
      content += `\n\n## Sheet: ${sheetName}\n`;
      content += JSON.stringify(jsonData, null, 2);
    }

    return {
      type: 'xlsx',
      content: content.trim(),
      metadata: {
        fileName: filePath.split('/').pop(),
        sheets,
      },
    };
  }

  async processImage(filePath: string, mimeType: string): Promise<ProcessedInput> {
    const imageBuffer = readFileSync(filePath);
    const base64Image = imageBuffer.toString('base64');

    const response = await this.anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4000,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mimeType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
                data: base64Image,
              },
            },
            {
              type: 'text',
              text: `Extract all text, data, diagrams, and strategic information from this image. 
              
If this appears to be a:
- Whiteboard/sketch: Describe the strategy, key points, connections, and insights
- Screenshot: Extract all visible text and data
- Chart/graph: Describe the data, trends, and implications
- Presentation slide: Extract title, bullet points, and key messages
- Document photo: OCR all text content

Provide a comprehensive extraction that captures the strategic essence.`,
            },
          ],
        },
      ],
    });

    const extractedText = response.content
      .filter((block) => block.type === 'text')
      .map((block) => (block as Anthropic.TextBlock).text)
      .join('\n');

    return {
      type: 'image',
      content: extractedText,
      metadata: {
        fileName: filePath.split('/').pop(),
      },
    };
  }

  async processFile(filePath: string, mimeType: string): Promise<ProcessedInput> {
    if (mimeType === 'application/pdf') {
      return this.processPDF(filePath);
    } else if (
      mimeType ===
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ) {
      return this.processDOCX(filePath);
    } else if (
      mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
      mimeType === 'application/vnd.ms-excel'
    ) {
      return this.processExcel(filePath);
    } else if (mimeType.startsWith('image/')) {
      return this.processImage(filePath, mimeType);
    } else {
      throw new Error(`Unsupported file type: ${mimeType}`);
    }
  }

  async combineInputs(inputs: ProcessedInput[]): Promise<string> {
    let combinedContent = '';

    for (const input of inputs) {
      combinedContent += `\n\n=== ${input.type.toUpperCase()} INPUT ===\n`;
      if (input.metadata?.fileName) {
        combinedContent += `File: ${input.metadata.fileName}\n`;
      }
      if (input.metadata?.pageCount) {
        combinedContent += `Pages: ${input.metadata.pageCount}\n`;
      }
      if (input.metadata?.sheets) {
        combinedContent += `Sheets: ${input.metadata.sheets.join(', ')}\n`;
      }
      combinedContent += `\n${input.content}\n`;
    }

    return combinedContent.trim();
  }
}
