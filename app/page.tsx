"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";

const AsciinemaPlayer = dynamic(() => import("./components/AsciinemaPlayer"), {
  ssr: false,
});

const MarkdownViewer = dynamic(() => import("./components/MarkdownViewer"), {
  ssr: false,
});

interface LogEntry {
  id: string;
  fileName: string;
  timestamp: string;
  level: string;
  message: string;
  raw: string;
}

interface FileInfo {
  name: string;
  size: number;
  modified: string;
  type: "log" | "cast" | "other";
  extension: string;
}

interface CastData {
  fileName: string;
  content: string;
}

interface MarkdownData {
  fileName: string;
  markdown: string;
}

export default function Home() {
  const [files, setFiles] = useState<FileInfo[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<string[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [casts, setCasts] = useState<CastData[]>([]);
  const [markdowns, setMarkdowns] = useState<MarkdownData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedLevel, setSelectedLevel] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [viewMode, setViewMode] = useState<
    "files" | "logs" | "casts" | "markdown"
  >("files");

  useEffect(() => {
    fetchFiles();
  }, []);

  const fetchFiles = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/files");
      if (!response.ok) {
        throw new Error("Failed to fetch files");
      }
      const data = await response.json();
      setFiles(data.files || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = (fileName: string) => {
    setSelectedFiles((prev) =>
      prev.includes(fileName)
        ? prev.filter((f) => f !== fileName)
        : [...prev, fileName]
    );
  };

  const handleSelectAll = () => {
    if (selectedFiles.length === files.length) {
      setSelectedFiles([]);
    } else {
      setSelectedFiles(files.map((f) => f.name));
    }
  };

  const handleDisplay = async () => {
    if (selectedFiles.length === 0) {
      setError("Please select at least one file");
      return;
    }

    setLoading(true);
    setError(null);

    const logFiles = selectedFiles.filter((f) => f.endsWith(".log"));
    const castFiles = selectedFiles.filter((f) => f.endsWith(".cast"));

    try {
      // Fetch log files if any
      if (logFiles.length > 0) {
        const logResponse = await fetch("/api/logs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ files: logFiles }),
        });

        if (!logResponse.ok) {
          throw new Error("Failed to fetch logs");
        }

        const logData = await logResponse.json();
        setLogs(logData.logs || []);

        if (logData.logs && logData.logs.length > 0) {
          setViewMode("logs");
        }
      }

      // Fetch cast files if any
      if (castFiles.length > 0) {
        const castResponse = await fetch("/api/cast", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ files: castFiles }),
        });

        if (!castResponse.ok) {
          throw new Error("Failed to fetch cast files");
        }

        const castData = await castResponse.json();
        setCasts(castData.casts || []);

        if (
          castData.casts &&
          castData.casts.length > 0 &&
          logFiles.length === 0
        ) {
          setViewMode("casts");
        }
      }

      if (logFiles.length === 0 && castFiles.length === 0) {
        setError(
          "Selected files are not supported. Please select .log or .cast files."
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  const handleConvertToMarkdown = async () => {
    if (selectedFiles.length === 0) {
      setError("Please select at least one cast file");
      return;
    }

    const castFiles = selectedFiles.filter((f) => f.endsWith(".cast"));

    if (castFiles.length === 0) {
      setError("Please select at least one .cast file to convert");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/cast-to-markdown", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ files: castFiles }),
      });

      if (!response.ok) {
        throw new Error("Failed to convert cast files to markdown");
      }

      const data = await response.json();
      setMarkdowns(data.markdowns || []);
      setViewMode("markdown");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  const getLevelColor = (level: string): string => {
    switch (level.toUpperCase()) {
      case "ERROR":
        return "bg-red-100 text-red-800";
      case "WARNING":
      case "WARN":
        return "bg-yellow-100 text-yellow-800";
      case "INFO":
        return "bg-blue-100 text-blue-800";
      case "DEBUG":
        return "bg-gray-100 text-gray-800";
      case "ACCESS":
        return "bg-green-100 text-green-800";
      default:
        return "bg-gray-100 text-gray-600";
    }
  };

  const getFileIcon = (type: string) => {
    switch (type) {
      case "log":
        return "📄";
      case "cast":
        return "🎬";
      default:
        return "📁";
    }
  };

  const uniqueLevels = Array.from(new Set(logs.map((log) => log.level)));

  const filteredLogs = logs.filter((log) => {
    const matchesLevel = selectedLevel === "all" || log.level === selectedLevel;
    const matchesSearch =
      searchTerm === "" ||
      log.message.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.fileName.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesLevel && matchesSearch;
  });

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  };

  return (
    <main className="min-h-screen p-8 bg-gray-50">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">
          Log & Cast File Viewer
        </h1>

        {/* File Selection View */}
        {viewMode === "files" && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-gray-800">
                Select Files to Display
              </h2>
              <div className="flex gap-2">
                <button
                  onClick={handleSelectAll}
                  className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  {selectedFiles.length === files.length
                    ? "Deselect All"
                    : "Select All"}
                </button>
                <button
                  onClick={fetchFiles}
                  className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Refresh Files
                </button>
                <button
                  onClick={handleDisplay}
                  disabled={selectedFiles.length === 0}
                  className={`px-6 py-2 text-sm font-semibold text-white rounded-lg transition-colors ${
                    selectedFiles.length === 0
                      ? "bg-gray-400 cursor-not-allowed"
                      : "bg-blue-500 hover:bg-blue-600"
                  }`}
                >
                  Display Selected ({selectedFiles.length})
                </button>
                <button
                  onClick={handleConvertToMarkdown}
                  disabled={
                    selectedFiles.filter((f) => f.endsWith(".cast")).length ===
                    0
                  }
                  className={`px-6 py-2 text-sm font-semibold text-white rounded-lg transition-colors ${
                    selectedFiles.filter((f) => f.endsWith(".cast")).length ===
                    0
                      ? "bg-gray-400 cursor-not-allowed"
                      : "bg-green-500 hover:bg-green-600"
                  }`}
                >
                  Convert to Markdown (
                  {selectedFiles.filter((f) => f.endsWith(".cast")).length})
                </button>
              </div>
            </div>

            {error && (
              <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                {error}
              </div>
            )}

            {loading && (
              <div className="text-center py-8">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                <p className="mt-2 text-gray-600">Loading files...</p>
              </div>
            )}

            {!loading && files.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                No files found in the logging directory.
              </div>
            )}

            {!loading && files.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {files.map((file) => (
                  <div
                    key={file.name}
                    onClick={() => handleFileSelect(file.name)}
                    className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                      selectedFiles.includes(file.name)
                        ? "border-blue-500 bg-blue-50"
                        : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <span className="text-2xl">{getFileIcon(file.type)}</span>
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-800 break-all">
                          {file.name}
                        </h3>
                        <p className="text-sm text-gray-500 mt-1">
                          {formatFileSize(file.size)} •{" "}
                          {new Date(file.modified).toLocaleString()}
                        </p>
                        <span
                          className={`inline-block mt-2 px-2 py-1 text-xs font-semibold rounded ${
                            file.type === "log"
                              ? "bg-green-100 text-green-800"
                              : file.type === "cast"
                              ? "bg-purple-100 text-purple-800"
                              : "bg-gray-100 text-gray-600"
                          }`}
                        >
                          {file.extension || "unknown"}
                        </span>
                      </div>
                      <input
                        type="checkbox"
                        checked={selectedFiles.includes(file.name)}
                        onChange={(e) => e.stopPropagation()}
                        className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500"
                        aria-label={`Select ${file.name}`}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Navigation for logs/casts view */}
        {viewMode !== "files" && (
          <div className="mb-6 flex gap-2">
            <button
              onClick={() => setViewMode("files")}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
            >
              ← Back to File Selection
            </button>
            {logs.length > 0 && (
              <button
                onClick={() => setViewMode("logs")}
                className={`px-4 py-2 rounded-lg transition-colors ${
                  viewMode === "logs"
                    ? "bg-blue-500 text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                View Logs ({logs.length})
              </button>
            )}
            {casts.length > 0 && (
              <button
                onClick={() => setViewMode("casts")}
                className={`px-4 py-2 rounded-lg transition-colors ${
                  viewMode === "casts"
                    ? "bg-purple-500 text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                View Casts ({casts.length})
              </button>
            )}
            {markdowns.length > 0 && (
              <button
                onClick={() => setViewMode("markdown")}
                className={`px-4 py-2 rounded-lg transition-colors ${
                  viewMode === "markdown"
                    ? "bg-green-500 text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                View Markdown ({markdowns.length})
              </button>
            )}
          </div>
        )}

        {/* Logs View */}
        {viewMode === "logs" && logs.length > 0 && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex flex-col md:flex-row gap-4 mb-6">
              <div className="flex-1">
                <label
                  htmlFor="search"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  Search Logs
                </label>
                <input
                  id="search"
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search by message or file name..."
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div className="md:w-48">
                <label
                  htmlFor="level"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  Filter by Level
                </label>
                <select
                  id="level"
                  value={selectedLevel}
                  onChange={(e) => setSelectedLevel(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="all">All Levels</option>
                  {uniqueLevels.map((level) => (
                    <option key={level} value={level}>
                      {level}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mb-4 text-sm text-gray-600">
              Showing {filteredLogs.length} of {logs.length} log entries
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Timestamp
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Level
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      File
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Message
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {log.timestamp}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getLevelColor(
                            log.level
                          )}`}
                        >
                          {log.level}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {log.fileName}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        <div className="max-w-lg truncate" title={log.message}>
                          {log.message}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Cast View */}
        {viewMode === "casts" && casts.length > 0 && (
          <div className="space-y-6">
            {casts.map((cast, index) => (
              <div key={index} className="bg-white rounded-lg shadow-md p-6">
                <AsciinemaPlayer
                  castContent={cast.content}
                  fileName={cast.fileName}
                />
              </div>
            ))}
          </div>
        )}

        {/* Markdown View */}
        {viewMode === "markdown" && markdowns.length > 0 && (
          <div className="space-y-6">
            {markdowns.map((markdown, index) => (
              <MarkdownViewer
                key={index}
                fileName={markdown.fileName}
                markdown={markdown.markdown}
              />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
