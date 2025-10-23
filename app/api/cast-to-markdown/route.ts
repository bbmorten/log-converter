import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

interface CastHeader {
  version: number;
  width: number;
  height: number;
  timestamp?: number;
  env?: Record<string, string>;
  title?: string;
  theme?: Record<string, string>;
}

interface CastEvent {
  time: number;
  type: string;
  data: string;
}

export async function POST(request: Request) {
  try {
    const { files } = await request.json();
    const loggingDir = path.join(process.cwd(), 'logging');

    // Check if logging directory exists
    if (!fs.existsSync(loggingDir)) {
      return NextResponse.json({ markdowns: [], message: 'No logging directory found' });
    }

    // If no files specified, return empty
    if (!files || files.length === 0) {
      return NextResponse.json({ markdowns: [], message: 'No files selected' });
    }

    const markdownData = [];

    // Process only the selected .cast files
    const castFiles = files.filter((file: string) => file.endsWith('.cast'));

    for (const file of castFiles) {
      const filePath = path.join(loggingDir, file);

      // Check if file exists
      if (!fs.existsSync(filePath)) {
        continue;
      }

      const content = fs.readFileSync(filePath, 'utf-8');
      const markdown = convertCastToMarkdown(content, file);

      markdownData.push({
        fileName: file,
        markdown: markdown
      });
    }

    return NextResponse.json({ markdowns: markdownData, count: markdownData.length });
  } catch (error) {
    console.error('Error converting cast files to markdown:', error);
    return NextResponse.json(
      { error: 'Failed to convert cast files to markdown' },
      { status: 500 }
    );
  }
}

// Strip ANSI escape codes and control characters
function stripAnsiCodes(text: string): string {
  let clean = text;

  // Remove OSC (Operating System Command) sequences - ]number;...BEL or ]number;...ST
  clean = clean.replace(/\x1B\][^\x07\x1B]*(?:\x07|\x1B\\)/g, '');
  clean = clean.replace(/\][0-9]{1,4};[^\x07]*\x07/g, '');

  // Remove CSI (Control Sequence Introducer) sequences
  clean = clean.replace(/\x1B\[[0-9;?]*[A-Za-z]/g, '');
  clean = clean.replace(/\[[\?><!][0-9;]*[A-Za-z]/g, '');

  // Remove other escape sequences
  clean = clean.replace(/\x1B[=>]/g, '');
  clean = clean.replace(/\x1B[\[\]()#;?]*[0-9;]*[A-Za-z@]/g, '');

  // Remove iTerm2 shell integration and proprietary sequences
  clean = clean.replace(/\x1B\]1337;[^\x07]*\x07/g, '');
  clean = clean.replace(/\x1B\]133;[^\x07]*\x07/g, '');
  clean = clean.replace(/\]133;[A-Z];?[0-9]*/g, '');
  clean = clean.replace(/\]1337;[^\n]*/g, '');

  // Remove sequences like [?1h=, [?2004h, [?25h, etc
  clean = clean.replace(/\[[\?>][0-9;]+[hlm]/g, '');

  // Remove sequences starting with <
  clean = clean.replace(/\[<[0-9;]+[A-Za-z]/g, '');

  // Remove Braille pattern characters (spinner/progress indicators)
  // Unicode range: U+2800 to U+28FF
  clean = clean.replace(/[\u2800-\u28FF]/g, '');

  // Remove common progress indicators and spinners
  clean = clean.replace(/[⠀-⣿]/g, '');

  // Remove control characters except newlines and tabs
  clean = clean.replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '');

  // Remove carriage returns
  clean = clean.replace(/\r/g, '');

  // Split into lines and filter
  const lines = clean.split('\n');

  // First pass: handle lines that were overwritten multiple times (CR without LF)
  const collapsed = [];
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];

    // Handle lines with prompt pattern: "%[spaces]➜  directory command"
    // Example: "%                                                                                ➜  ~ ls -la"
    const promptWithCommand = /^%\s+➜\s+\S+\s+(.+)$/.exec(line);
    if (promptWithCommand) {
      // Extract just the command part
      line = promptWithCommand[1].trim();
      if (line) {
        collapsed.push(line);
      }
      continue;
    }

    // Handle lines that are just the prompt: "%[spaces]➜  directory"
    const justPrompt = /^%\s+➜\s+\S+\s*$/.exec(line);
    if (justPrompt) {
      // Skip these - they're just prompts without commands
      continue;
    }

    // If line contains multiple repetitions of the same message (from CR overwrites)
    // Example: " Preparing nodes   Preparing nodes   Preparing nodes "
    const parts = line.split(/\s{2,}/); // Split by 2+ spaces
    if (parts.length > 3) {
      // Check if it's repeated messages
      const uniqueParts = [...new Set(parts.map(p => p.trim()).filter(p => p))];
      if (uniqueParts.length === 1 || uniqueParts.length === 2) {
        // Keep only the last occurrence (which is usually the final state)
        const lastPart = parts[parts.length - 1].trim();
        if (lastPart) {
          collapsed.push(lastPart);
        }
        continue;
      }
    }
    collapsed.push(line);
  }

  const filtered = collapsed.filter((line, index) => {
    const trimmed = line.trim();

    // Skip completely empty lines (keep them for spacing)
    if (trimmed === '') return true;

    // Skip lines that only contain control sequence remnants
    if (/^[>\[<\]]+$/.test(trimmed)) return false;
    if (/^%\s*$/.test(trimmed)) return false;

    // Skip Atuin history UI lines
    if (trimmed.includes('Atuin v') || trimmed.includes('<esc>: exit')) return false;
    if (trimmed.includes('Search│Inspect') || trimmed.includes('history count:')) return false;
    if (trimmed.includes('[GLOBAL]')) return false;

    // Skip lines that appear to be from history/autocomplete UI
    if (/^\d+ms\s+\d+[smh]\s+ago/.test(trimmed)) return false;
    if (/ago[a-z]+[A-Z]/.test(trimmed)) return false;

    // Skip progress lines without checkmarks (keep only the completed ones)
    const progressPattern = /^(Preparing|Writing|Starting|Installing|Joining)/;
    if (progressPattern.test(trimmed) && !trimmed.includes('✓')) {
      // Look ahead to see if there's a completed version
      for (let j = index + 1; j < collapsed.length; j++) {
        const nextTrimmed = collapsed[j].trim();
        if (nextTrimmed.includes('✓') && progressPattern.test(nextTrimmed)) {
          return false; // Skip this incomplete progress line
        }
        if (nextTrimmed && !progressPattern.test(nextTrimmed)) {
          break; // Stop looking if we hit different content
        }
      }
    }

    // Skip duplicate command lines (when same command appears twice in row)
    if (index > 0) {
      const prevTrimmed = collapsed[index - 1]?.trim();
      if (prevTrimmed === trimmed && trimmed.length > 10) return false;
    }

    // Skip lines that are just progress message followed by a path or typed command
    // Example: "➜  ~ /Users/bulent/git-repos/cilium-study/lets-install-cilium-on-kind"
    if (/^[➜→✗]\s+\S+\s+\//.test(trimmed)) {
      return false;
    }

    return true;
  });

  clean = filtered.join('\n');

  // Clean up excessive blank lines (more than 2 consecutive)
  clean = clean.replace(/\n{3,}/g, '\n\n');

  return clean;
}

// Detect if a line is likely a command (starts with $ or # or prompt patterns)
function isCommandLine(line: string): boolean {
  const trimmed = line.trim();

  // Empty lines are not commands
  if (!trimmed) return false;

  // Lines that look like output (starting with special chars or patterns)
  if (/^[🔮ℹ️✓🟥⚠️]/u.test(trimmed)) return false;
  if (/^(Creating|Set|You can|Have a|Total|Kubernetes|CoreDNS|To further|I\d{4})/i.test(trimmed)) return false;
  if (trimmed.startsWith('==>')|| trimmed.startsWith('---')) return false;

  // Lines that contain colons mid-sentence are likely output, not commands
  if (/^[A-Z][a-z]+.*:/.test(trimmed) && !trimmed.includes('$') && !trimmed.includes('#')) {
    // Exception: "cilium image (default): v1.18.1" should not be treated as command
    if (trimmed.includes('cilium image')) return false;
  }

  // Standard shell prompts
  if (/^[\$#]\s/.test(trimmed)) return true;

  // User@host style prompts (e.g., "user@host:~$" or "➜  dir $")
  if (/^[a-zA-Z_][a-zA-Z0-9_-]*@[a-zA-Z0-9_-]+[:#~]/.test(trimmed)) return true;

  // Oh-my-zsh style prompts (e.g., "➜  lets-install-cilium-on-kind")
  if (/^[➜→✗]\s+[a-zA-Z0-9_-]+\s+/.test(trimmed)) return true;

  // Common command patterns (commands usually start with lowercase letters or specific paths)
  const potentialCommand = trimmed.split(/\s+/)[0];
  const commonCommands = [
    'ls', 'cd', 'pwd', 'mkdir', 'rm', 'cp', 'mv', 'cat', 'echo', 'grep', 'find',
    'kubectl', 'docker', 'git', 'npm', 'yarn', 'curl', 'wget', 'make', 'go',
    'python', 'node', 'java', 'cargo', 'brew', 'apt', 'yum', 'systemctl',
    'kind', 'helm', 'cilium', 'terraform', 'ansible', 'ssh', 'scp', 'rsync',
    'vi', 'vim', 'nano', 'emacs', 'less', 'more', 'head', 'tail', 'awk', 'sed'
  ];

  // Only treat as command if it's the FIRST word and followed by space or nothing
  if (commonCommands.includes(potentialCommand) && !/^[A-Z]/.test(trimmed)) {
    // Make sure it's not part of output like "cilium image (default): v1.18.1"
    if (!trimmed.includes(':') || trimmed.includes('--')) return true;
  }

  // Lines that start with paths or ./
  if (/^[\.\/~]/.test(trimmed)) return true;

  return false;
}

// Extract actual command from prompt line
function extractCommand(line: string): string {
  let cmd = line.trim();

  // The prompt pattern is already handled in stripAnsiCodes, so at this point
  // we might just have the command, but check for any remaining prompt artifacts

  // Remove Oh-my-zsh style prompts if still present (➜  directory)
  cmd = cmd.replace(/^[➜→✗]\s+[^\s]+\s+/, '');

  // Remove user@host:path$ or user@host:path#
  cmd = cmd.replace(/^[a-zA-Z_][a-zA-Z0-9_-]*@[a-zA-Z0-9_-]+:[^\$#]*[\$#]\s*/, '');

  // Remove simple $ or # prompt
  cmd = cmd.replace(/^[\$#]\s*/, '');

  // Remove any leading "m " artifact (from your examples)
  cmd = cmd.replace(/^m\s+/, '');

  return cmd;
}

// Parse terminal output into command/output blocks
function parseTerminalOutput(output: string): Array<{type: 'command' | 'output', content: string}> {
  const lines = output.split('\n');
  const blocks: Array<{type: 'command' | 'output', content: string}> = [];
  let currentBlock: {type: 'command' | 'output', content: string} | null = null;

  for (const line of lines) {
    if (!line.trim()) {
      // Add blank lines to current block if it exists
      if (currentBlock && currentBlock.type === 'output') {
        currentBlock.content += '\n';
      }
      continue;
    }

    const isCommand = isCommandLine(line);

    if (isCommand) {
      // Save previous block
      if (currentBlock) {
        blocks.push(currentBlock);
      }
      // Extract and start new command block
      const command = extractCommand(line);
      if (command) {
        currentBlock = { type: 'command', content: '$ ' + command + '\n' };
      } else {
        currentBlock = null;
      }
    } else {
      // If we have a command block, switch to output
      if (currentBlock && currentBlock.type === 'command') {
        blocks.push(currentBlock);
        currentBlock = { type: 'output', content: line + '\n' };
      } else if (currentBlock && currentBlock.type === 'output') {
        currentBlock.content += line + '\n';
      } else {
        // Start output block if no current block
        currentBlock = { type: 'output', content: line + '\n' };
      }
    }
  }

  // Add final block
  if (currentBlock) {
    blocks.push(currentBlock);
  }

  return blocks;
}

function convertCastToMarkdown(castContent: string, fileName: string): string {
  try {
    const lines = castContent.trim().split('\n');

    if (lines.length === 0) {
      return '```\nEmpty cast file\n```';
    }

    // Parse header
    let header: CastHeader;
    try {
      header = JSON.parse(lines[0]);
    } catch (e) {
      return '```\nInvalid cast file format: Could not parse header\n```';
    }

    // Parse events
    const events: CastEvent[] = [];
    for (let i = 1; i < lines.length; i++) {
      if (lines[i].trim()) {
        try {
          const event = JSON.parse(lines[i]);
          events.push({
            time: event[0],
            type: event[1],
            data: event[2]
          });
        } catch (e) {
          console.warn(`Skipping invalid event on line ${i + 1}`);
        }
      }
    }

    // Build markdown
    let markdown = `# Terminal Recording: ${header.title || fileName}\n\n`;
    markdown += `## Recording Information\n\n`;
    markdown += `- **File**: ${fileName}\n`;
    markdown += `- **Version**: ${header.version}\n`;
    markdown += `- **Dimensions**: ${header.width} × ${header.height}\n`;

    if (header.timestamp) {
      const date = new Date(header.timestamp * 1000);
      markdown += `- **Recorded**: ${date.toLocaleString()}\n`;
    }

    if (header.env) {
      markdown += `- **Environment**:\n`;
      Object.entries(header.env).forEach(([key, value]) => {
        markdown += `  - ${key}: ${value}\n`;
      });
    }

    // Aggregate output events and strip ANSI codes
    let terminalOutput = '';
    for (const event of events) {
      if (event.type === 'o') {
        terminalOutput += event.data;
      }
    }

    // Clean the output
    const cleanOutput = stripAnsiCodes(terminalOutput);

    // Parse into command/output blocks
    const blocks = parseTerminalOutput(cleanOutput);

    // Generate markdown for terminal session
    markdown += `\n## Terminal Session\n\n`;

    for (const block of blocks) {
      if (block.type === 'command') {
        // Commands in shell syntax highlighting
        markdown += '```bash\n';
        markdown += block.content.trim() + '\n';
        markdown += '```\n\n';
      } else {
        // Output in plain code block
        markdown += '```\n';
        markdown += block.content.trim() + '\n';
        markdown += '```\n\n';
      }
    }

    // Add timeline section
    markdown += `## Timeline\n\n`;
    markdown += `Total events: ${events.length}\n\n`;

    // Group events by approximate second
    const eventsBySecond: { [key: number]: number } = {};
    events.forEach(event => {
      const second = Math.floor(event.time);
      eventsBySecond[second] = (eventsBySecond[second] || 0) + 1;
    });

    markdown += '| Time (s) | Events |\n';
    markdown += '|----------|--------|\n';

    const timeSlots = Object.keys(eventsBySecond).map(Number).sort((a, b) => a - b);
    timeSlots.forEach(time => {
      markdown += `| ${time.toFixed(1)} | ${eventsBySecond[time]} |\n`;
    });

    markdown += `\n---\n\n`;
    markdown += `*Generated from asciinema cast file*\n`;

    return markdown;
  } catch (error) {
    console.error('Error in convertCastToMarkdown:', error);
    return '```\nError converting cast file to markdown\n```';
  }
}
