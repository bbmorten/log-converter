'use client';

import { useEffect, useRef } from 'react';

interface AsciinemaPlayerProps {
  castContent: string;
  fileName: string;
}

declare global {
  interface Window {
    AsciinemaPlayer: any;
  }
}

export default function AsciinemaPlayer({ castContent, fileName }: AsciinemaPlayerProps) {
  const playerRef = useRef<HTMLDivElement>(null);
  const playerInstanceRef = useRef<any>(null);

  useEffect(() => {
    const loadAsciinemaPlayer = async () => {
      if (!playerRef.current) return;

      // Import asciinema-player CSS
      if (!document.querySelector('link[href*="asciinema-player.css"]')) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'https://cdn.jsdelivr.net/npm/asciinema-player@3.7.1/dist/bundle/asciinema-player.css';
        document.head.appendChild(link);
      }

      // Import asciinema-player JS
      if (!window.AsciinemaPlayer) {
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/asciinema-player@3.7.1/dist/bundle/asciinema-player.min.js';
        script.onload = () => {
          createPlayer();
        };
        document.head.appendChild(script);
      } else {
        createPlayer();
      }
    };

    const createPlayer = () => {
      if (!playerRef.current || !window.AsciinemaPlayer) return;

      // Clear existing player
      if (playerInstanceRef.current) {
        playerInstanceRef.current.dispose();
      }
      playerRef.current.innerHTML = '';

      try {
        // Create a blob URL for the cast content
        const blob = new Blob([castContent], { type: 'application/json' });
        const blobUrl = URL.createObjectURL(blob);

        // Parse the first line to get dimensions
        const lines = castContent.trim().split('\n');
        let header = { width: 80, height: 24 };

        if (lines.length > 0) {
          try {
            header = JSON.parse(lines[0]);
          } catch (e) {
            console.warn('Could not parse header, using defaults');
          }
        }

        // Create player with blob URL
        playerInstanceRef.current = window.AsciinemaPlayer.create(
          blobUrl,
          playerRef.current,
          {
            cols: header.width || 80,
            rows: header.height || 24,
            autoPlay: false,
            preload: true,
            loop: false,
            speed: 1,
            theme: 'asciinema',
            fit: 'width'
          }
        );

        // Clean up blob URL when component unmounts
        const currentPlayer = playerInstanceRef.current;
        if (currentPlayer) {
          const originalDispose = currentPlayer.dispose;
          currentPlayer.dispose = function() {
            URL.revokeObjectURL(blobUrl);
            if (originalDispose) {
              originalDispose.call(this);
            }
          };
        }

      } catch (error) {
        console.error('Error creating cast player:', error);

        // Show error message in the player area
        if (playerRef.current) {
          playerRef.current.innerHTML = `
            <div class="flex items-center justify-center h-64 bg-gray-100 rounded-lg">
              <div class="text-center text-gray-600">
                <div class="text-lg font-semibold mb-2">Error loading cast file</div>
                <div class="text-sm">${error instanceof Error ? error.message : 'Invalid cast file format'}</div>
                <div class="text-xs mt-2 text-gray-500">Please ensure the file is a valid asciinema recording</div>
              </div>
            </div>
          `;
        }
      }
    };

    loadAsciinemaPlayer();

    return () => {
      if (playerInstanceRef.current) {
        playerInstanceRef.current.dispose();
      }
    };
  }, [castContent]);

  return (
    <div className="w-full">
      <h3 className="text-lg font-semibold mb-2 text-gray-800">{fileName}</h3>
      <div
        ref={playerRef}
        className="w-full rounded-lg overflow-hidden shadow-lg bg-black"
        style={{ minHeight: '400px' }}
      />
    </div>
  );
}