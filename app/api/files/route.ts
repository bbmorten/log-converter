import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET() {
  try {
    const loggingDir = path.join(process.cwd(), 'logging');

    // Check if logging directory exists
    if (!fs.existsSync(loggingDir)) {
      return NextResponse.json({ files: [], message: 'No logging directory found' });
    }

    // Read all files in the logging directory
    const allFiles = fs.readdirSync(loggingDir);

    // Get file details
    const files = allFiles.map(fileName => {
      const filePath = path.join(loggingDir, fileName);
      const stats = fs.statSync(filePath);
      const extension = path.extname(fileName).toLowerCase();

      return {
        name: fileName,
        size: stats.size,
        modified: stats.mtime.toISOString(),
        type: extension === '.log' ? 'log' :
              extension === '.cast' ? 'cast' :
              'other',
        extension: extension
      };
    });

    // Sort by modified date (newest first)
    files.sort((a, b) => new Date(b.modified).getTime() - new Date(a.modified).getTime());

    return NextResponse.json({ files, count: files.length });
  } catch (error) {
    console.error('Error reading directory:', error);
    return NextResponse.json(
      { error: 'Failed to read directory' },
      { status: 500 }
    );
  }
}