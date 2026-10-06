/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';

// Exact image assets provided by user
const DESKTOP_DEFAULT = 'https://www.image2url.com/r2/default/images/1791198763999-694e09e5-f446-4599-8a25-1622a538db67.png';
const MOBILE_DEFAULT = 'https://www.image2url.com/r2/default/images/1791199144369-c8c97b81-d4c2-4e84-857e-e3a0d0a14b90.png';

// Audio sources
const MOO_AUDIO_URL = 'https://www.image2url.com/r2/default/files/1791272248737-83614268-3141-49dc-8a5e-d4ead723fa7d.mp3';
const LOCAL_MOO_AUDIO = '/moo.mp3';

// Local bundled fallbacks for images
const LOCAL_DESKTOP_DEFAULT = '/desktop_default.png';
const LOCAL_MOBILE_DEFAULT = '/mobile_default.png';

export default function App() {
  const [isPressed, setIsPressed] = useState(false);

  const audioContextRef = useRef<AudioContext | null>(null);
  const decodedBufferRef = useRef<AudioBuffer | null>(null);
  const htmlAudioPoolRef = useRef<HTMLAudioElement[]>([]);
  const poolIndexRef = useRef(0);

  // Preload and decode audio into RAM for ultra-low latency playback using XMLHttpRequest
  useEffect(() => {
    // 1. Create HTML5 Audio backup pool
    htmlAudioPoolRef.current = Array.from({ length: 8 }, () => {
      const audio = new Audio(LOCAL_MOO_AUDIO);
      audio.preload = 'auto';
      return audio;
    });

    // 2. Fetch and decode audio buffer via XHR (avoids browser extension fetch wrappers)
    const loadAudioBuffer = (url: string, onDone: (buffer: AudioBuffer) => void, onFail?: () => void) => {
      try {
        const xhr = new XMLHttpRequest();
        xhr.open('GET', url, true);
        xhr.responseType = 'arraybuffer';
        xhr.onload = () => {
          if (xhr.status === 200 || xhr.status === 0) {
            const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
            if (!audioContextRef.current) {
              audioContextRef.current = new AudioCtx();
            }
            audioContextRef.current.decodeAudioData(
              xhr.response,
              (decoded) => onDone(decoded),
              () => onFail?.()
            );
          } else {
            onFail?.();
          }
        };
        xhr.onerror = () => onFail?.();
        xhr.send();
      } catch {
        onFail?.();
      }
    };

    // Load local copy first, fallback to remote URL
    loadAudioBuffer(
      LOCAL_MOO_AUDIO,
      (buf) => {
        decodedBufferRef.current = buf;
      },
      () => {
        loadAudioBuffer(MOO_AUDIO_URL, (buf) => {
          decodedBufferRef.current = buf;
        });
      }
    );

    // Preload images into memory
    [DESKTOP_DEFAULT, MOBILE_DEFAULT, LOCAL_DESKTOP_DEFAULT, LOCAL_MOBILE_DEFAULT].forEach((src) => {
      const img = new Image();
      img.src = src;
    });
  }, []);

  // Lightning-fast Moo trigger (< 1ms latency)
  const triggerMoo = useCallback(() => {
    // 1. Play from decoded Web Audio buffer if ready
    if (audioContextRef.current && decodedBufferRef.current) {
      try {
        const ctx = audioContextRef.current;
        if (ctx.state === 'suspended') {
          ctx.resume();
        }
        const source = ctx.createBufferSource();
        source.buffer = decodedBufferRef.current;
        source.connect(ctx.destination);
        source.start(0);
      } catch {
        // Fallback to HTMLAudioElement
      }
    } else if (htmlAudioPoolRef.current.length > 0) {
      // 2. HTML5 Audio fallback
      try {
        const audio = htmlAudioPoolRef.current[poolIndexRef.current];
        poolIndexRef.current = (poolIndexRef.current + 1) % htmlAudioPoolRef.current.length;
        audio.currentTime = 0;
        audio.play().catch(() => {});
      } catch {
        // ignore
      }
    }

    // 3. Tactile bounce
    setIsPressed(true);
    setTimeout(() => setIsPressed(false), 160);
  }, []);

  // Keyboard shortcut triggers (Space, Enter, M)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (e.code === 'Space' || e.code === 'Enter' || e.key.toLowerCase() === 'm') {
        e.preventDefault();
        triggerMoo();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [triggerMoo]);

  return (
    <main
      className="relative w-screen h-screen overflow-hidden select-none cursor-pointer bg-black"
      onPointerDown={triggerMoo}
      role="button"
      tabIndex={0}
      aria-label="Click anywhere to moo!"
    >
      {/* ================= DESKTOP & TABLET VIEW (md and up) ================= */}
      <img
        src={DESKTOP_DEFAULT}
        alt="Desktop Cow Background"
        className={`hidden md:block absolute inset-0 w-full h-full object-cover object-center pointer-events-none transition-transform duration-100 ease-out will-change-transform ${
          isPressed ? 'scale-[1.015]' : 'scale-100'
        }`}
        onError={(e) => {
          if (e.currentTarget.src !== LOCAL_DESKTOP_DEFAULT) {
            e.currentTarget.src = LOCAL_DESKTOP_DEFAULT;
          }
        }}
      />

      {/* ================= MOBILE VIEW (small screens) ================= */}
      <img
        src={MOBILE_DEFAULT}
        alt="Mobile Cow Background"
        className={`block md:hidden absolute inset-0 w-full h-full object-cover object-center pointer-events-none transition-transform duration-100 ease-out will-change-transform ${
          isPressed ? 'scale-[1.015]' : 'scale-100'
        }`}
        onError={(e) => {
          if (e.currentTarget.src !== LOCAL_MOBILE_DEFAULT) {
            e.currentTarget.src = LOCAL_MOBILE_DEFAULT;
          }
        }}
      />
    </main>
  );
}
