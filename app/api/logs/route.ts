import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

interface LogEntry {
  id: string;
  fileName: string;
  timestamp: string;
  level: string;
  message: string;
  raw: string;
}

function parseLogLine(line: string, fileName: string, lineIndex: number): LogEntry | null {
  if (!line.trim()) return null;

  // Try to parse standard log format: timestamp level message
  const standardLogPattern = /^(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2})\s+(\w+)\s+(.*)$/;
  const match = line.match(standardLogPattern);

  if (match) {
    return {
      id: `${fileName}-${lineIndex}`,
      fileName,
      timestamp: match[1],
      level: match[2],
      message: match[3],
      raw: line
    };
  }

  // Try to parse access log format
  const accessLogPattern = /^([\d.]+)\s+-\s+-\s+\[(.*?)\]\s+"(.*?)"\s+(\d+)\s+(\d+)$/;
  const accessMatch = line.match(accessLogPattern);

  if (accessMatch) {
    return {
      id: `${fileName}-${lineIndex}`,
      fileName,
      timestamp: accessMatch[2],
      level: 'ACCESS',
      message: `${accessMatch[1]} - ${accessMatch[3]} - Status: ${accessMatch[4]} - Size: ${accessMatch[5]}`,
      raw: line
    };
  }

  // Fallback for unstructured logs
  return {
    id: `${fileName}-${lineIndex}`,
    fileName,
    timestamp: new Date().toISOString(),
    level: 'UNKNOWN',
    message: line,
    raw: line
  };
}

export async function POST(request: Request) {
  try {
    const { files } = await request.json();
    const loggingDir = path.join(process.cwd(), 'logging');

    // Check if logging directory exists
    if (!fs.existsSync(loggingDir)) {
      return NextResponse.json({ logs: [], message: 'No logging directory found' });
    }

    // If no files specified, return empty
    if (!files || files.length === 0) {
      return NextResponse.json({ logs: [], message: 'No files selected' });
    }

    const allLogs: LogEntry[] = [];

    // Process only the selected log files
    const logFiles = files.filter((file: string) => file.endsWith('.log'));

    for (const file of logFiles) {
      const filePath = path.join(loggingDir, file);

      // Check if file exists
      if (!fs.existsSync(filePath)) {
        continue;
      }

      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.split('\n');

      lines.forEach((line, index) => {
        const logEntry = parseLogLine(line, file, index);
        if (logEntry) {
          allLogs.push(logEntry);
        }
      });
    }

    // Sort logs by timestamp (newest first)
    allLogs.sort((a, b) => {
      const dateA = new Date(a.timestamp).getTime();
      const dateB = new Date(b.timestamp).getTime();
      return dateB - dateA;
    });

    return NextResponse.json({ logs: allLogs, count: allLogs.length });
  } catch (error) {
    console.error('Error reading log files:', error);
    return NextResponse.json(
      { error: 'Failed to read log files' },
      { status: 500 }
    );
  }
}