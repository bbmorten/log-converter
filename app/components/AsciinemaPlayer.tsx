'use client';

import { useEffect, useRef } from 'react';

interface AsciinemaPlayerProps {
  castContent: string;
  fileName: string;
}

interface AsciinemaPlayerType {
  create: (data: string | object, element: HTMLElement, options: object) => {
    dispose: () => void;
  };
}

declare global {
  interface Window {
    AsciinemaPlayer: AsciinemaPlayerType;
  }
}

export default function AsciinemaPlayer({ castContent, fileName }: AsciinemaPlayerProps) {
  const playerRef = useRef<HTMLDivElement>(null);
  const playerInstanceRef = useRef<{ dispose: () => void } | null>(null);

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
        try {
          playerInstanceRef.current.dispose();
        } catch (e) {
          console.warn('Error disposing previous player:', e);
        }
      }
      playerRef.current.innerHTML = '';

      try {
        // Parse the first line to get dimensions
        const lines = castContent.trim().split('\n');
        let header = { width: 80, height: 24 };

        if (lines.length > 0) {
          try {
            header = JSON.parse(lines[0]);
          } catch {
            console.warn('Could not parse header, using defaults');
          }
        }

        // Convert cast content to base64 data URL
        const base64Content = btoa(unescape(encodeURIComponent(castContent)));
        const dataUrl = `data:application/x-asciicast;base64,${base64Content}`;

        // Create player with data URL
        playerInstanceRef.current = window.AsciinemaPlayer.create(
          dataUrl,
          playerRef.current,
          {
            cols: header.width || 80,
            rows: header.height || 24,
            autoPlay: false,
            preload: true,
            loop: false,
            speed: 1,
            theme: 'asciinema',
            fit: 'width',
            idleTimeLimit: 2
          }
        );

      } catch (error) {
        console.error('Error creating cast player:', error);

        // Try alternative approach - directly with the parsed data
        try {
          const lines = castContent.trim().split('\n');
          if (lines.length > 0) {
            const header = JSON.parse(lines[0]);
            const events = [];

            for (let i = 1; i < lines.length; i++) {
              if (lines[i].trim()) {
                events.push(JSON.parse(lines[i]));
              }
            }

            const castData = {
              version: header.version || 2,
              width: header.width || 80,
              height: header.height || 24,
              timestamp: header.timestamp,
              env: header.env || {},
              events: events
            };

            // Create a new div for the player
            const playerDiv = document.createElement('div');
            playerRef.current.appendChild(playerDiv);

            // Try to create player with parsed data
            playerInstanceRef.current = window.AsciinemaPlayer.create(
              castData,
              playerDiv,
              {
                cols: castData.width,
                rows: castData.height,
                autoPlay: false,
                preload: true,
                loop: false,
                speed: 1,
                theme: 'asciinema',
                fit: 'width',
                idleTimeLimit: 2
              }
            );
          }
        } catch (fallbackError) {
          console.error('Fallback approach also failed:', fallbackError);

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