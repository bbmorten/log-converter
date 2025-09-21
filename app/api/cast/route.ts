import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function POST(request: Request) {
  try {
    const { files } = await request.json();
    const loggingDir = path.join(process.cwd(), 'logging');

    // Check if logging directory exists
    if (!fs.existsSync(loggingDir)) {
      return NextResponse.json({ casts: [], message: 'No logging directory found' });
    }

    // If no files specified, return empty
    if (!files || files.length === 0) {
      return NextResponse.json({ casts: [], message: 'No files selected' });
    }

    const castData = [];

    // Process only the selected .cast files
    const castFiles = files.filter((file: string) => file.endsWith('.cast'));

    for (const file of castFiles) {
      const filePath = path.join(loggingDir, file);

      // Check if file exists
      if (!fs.existsSync(filePath)) {
        continue;
      }

      const content = fs.readFileSync(filePath, 'utf-8');

      castData.push({
        fileName: file,
        content: content
      });
    }

    return NextResponse.json({ casts: castData, count: castData.length });
  } catch (error) {
    console.error('Error reading cast files:', error);
    return NextResponse.json(
      { error: 'Failed to read cast files' },
      { status: 500 }
    );
  }
}