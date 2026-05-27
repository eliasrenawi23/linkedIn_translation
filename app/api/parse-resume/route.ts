import { NextResponse } from 'next/server';
import { pathToFileURL } from 'url';
import path from 'path';
import { PDFParse, VerbosityLevel } from 'pdf-parse';
import mammoth from 'mammoth';

// Helper: extract all text from a PDF buffer using pdf-parse
async function extractPdfText(buffer: Buffer): Promise<string> {
  const workerPath = path.resolve(process.cwd(), 'node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs');
  const workerUrl = pathToFileURL(workerPath).href;

  // Set the worker path for pdfjs-dist
  PDFParse.setWorker(workerUrl);

  const parser = new PDFParse({
    data: new Uint8Array(buffer),
    verbosity: VerbosityLevel.ERRORS,
  });

  const result = await parser.getText();
  await parser.destroy();
  return result.text;
}

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const fileName = file.name.toLowerCase();
    const buffer = Buffer.from(await file.arrayBuffer());
    let text = '';

    if (fileName.endsWith('.pdf')) {
      text = await extractPdfText(buffer);
    } else if (fileName.endsWith('.docx')) {
      const result = await mammoth.extractRawText({ buffer });
      text = result.value || '';
    } else if (fileName.endsWith('.txt') || fileName.endsWith('.md')) {
      text = buffer.toString('utf-8');
    } else {
      return NextResponse.json(
        { error: 'Unsupported file type. Please upload a .pdf, .docx, .txt, or .md file.' },
        { status: 400 }
      );
    }

    if (!text.trim()) {
      return NextResponse.json(
        { error: 'Could not extract any text from the uploaded file. The file may be image-based or empty.' },
        { status: 400 }
      );
    }

    return NextResponse.json({ text: text.trim() });
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    console.error('Error parsing resume file:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to parse the uploaded file' },
      { status: 500 }
    );
  }
}
