'use client';

import { useState } from 'react';

interface MarkdownViewerProps {
  fileName: string;
  markdown: string;
}

export default function MarkdownViewer({ fileName, markdown }: MarkdownViewerProps) {
  const [copied, setCopied] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(markdown);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xl font-semibold text-gray-800">{fileName}</h3>
        <div className="flex gap-2">
          <button
            onClick={() => setShowPreview(!showPreview)}
            className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
          >
            {showPreview ? 'Hide Preview' : 'Show Preview'}
          </button>
          <button
            onClick={handleCopy}
            className={`px-4 py-2 text-sm font-semibold text-white rounded-lg transition-colors ${
              copied ? 'bg-green-500' : 'bg-blue-500 hover:bg-blue-600'
            }`}
          >
            {copied ? '✓ Copied!' : 'Copy Markdown'}
          </button>
        </div>
      </div>

      {showPreview ? (
        <div className="prose max-w-none">
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 overflow-auto">
            <div dangerouslySetInnerHTML={{ __html: renderMarkdown(markdown) }} />
          </div>
        </div>
      ) : (
        <div className="bg-gray-900 text-gray-100 rounded-lg p-4 overflow-auto" style={{ maxHeight: '500px' }}>
          <pre className="text-sm font-mono whitespace-pre-wrap break-words">{markdown}</pre>
        </div>
      )}

      <div className="mt-4 text-sm text-gray-600">
        {markdown.split('\n').length} lines • {markdown.length} characters
      </div>
    </div>
  );
}

// Simple markdown to HTML renderer (basic implementation)
function renderMarkdown(markdown: string): string {
  let html = markdown;

  // Headers
  html = html.replace(/^### (.*$)/gim, '<h3 class="text-lg font-semibold mt-4 mb-2">$1</h3>');
  html = html.replace(/^## (.*$)/gim, '<h2 class="text-xl font-bold mt-6 mb-3">$1</h2>');
  html = html.replace(/^# (.*$)/gim, '<h1 class="text-2xl font-bold mt-6 mb-4">$1</h1>');

  // Bold and italic
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');

  // Code blocks
  html = html.replace(/```([\s\S]*?)```/g, '<pre class="bg-gray-800 text-gray-100 p-3 rounded overflow-x-auto my-2"><code>$1</code></pre>');
  html = html.replace(/`([^`]+)`/g, '<code class="bg-gray-200 px-1 py-0.5 rounded text-sm">$1</code>');

  // Lists
  html = html.replace(/^\- (.*$)/gim, '<li class="ml-4">$1</li>');
  html = html.replace(/(<li.*<\/li>)/s, '<ul class="list-disc my-2">$1</ul>');

  // Tables
  const tableRegex = /\|(.+)\|\n\|[-:\s|]+\|\n((?:\|.+\|\n?)+)/g;
  html = html.replace(tableRegex, (match, header, rows) => {
    const headers = header.split('|').filter((h: string) => h.trim()).map((h: string) =>
      `<th class="border border-gray-300 px-4 py-2 bg-gray-100">${h.trim()}</th>`
    ).join('');

    const rowsHtml = rows.trim().split('\n').map((row: string) => {
      const cells = row.split('|').filter((c: string) => c.trim()).map((c: string) =>
        `<td class="border border-gray-300 px-4 py-2">${c.trim()}</td>`
      ).join('');
      return `<tr>${cells}</tr>`;
    }).join('');

    return `<table class="border-collapse border border-gray-300 my-4 w-full"><thead><tr>${headers}</tr></thead><tbody>${rowsHtml}</tbody></table>`;
  });

  // Horizontal rules
  html = html.replace(/^---$/gim, '<hr class="my-4 border-t border-gray-300" />');

  // Line breaks
  html = html.replace(/\n\n/g, '</p><p class="mb-2">');
  html = '<p class="mb-2">' + html + '</p>';

  return html;
}
