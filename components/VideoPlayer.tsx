import React, { useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';

interface VideoPlayerProps {
  url: string;
  poster?: string | null;
  autoPlay?: boolean;
}

const VideoPlayer: React.FC<VideoPlayerProps> = ({ url, poster, autoPlay = true }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [isUsingProxy, setIsUsingProxy] = useState(false);

  // Reset proxy state when URL changes
  useEffect(() => {
    setIsUsingProxy(false);
    setError(null);
  }, [url]);

  useEffect(() => {
    let hls: Hls | null = null;
    const video = videoRef.current;
    let networkRetryCount = 0;
    const MAX_RETRIES = 3;

    // Clear error only if we aren't in the middle of a proxy switch
    if (!isUsingProxy) setError(null);

    if (!video) return;

    // Determine the actual URL to play
    let playUrl = url;

    if (isUsingProxy) {
        // Fallback: Use a public CORS proxy to bypass browser restrictions
        playUrl = `https://corsproxy.io/?${encodeURIComponent(url)}`;
    } else if (window.location.protocol === 'https:' && url.startsWith('http:')) {
        // Standard Fix: Upgrade HTTP to HTTPS to avoid Mixed Content
        playUrl = url.replace(/^http:/, 'https:');
    }

    if (Hls.isSupported()) {
      hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
        manifestLoadingTimeOut: 20000,
        manifestLoadingMaxRetry: 2,
        levelLoadingTimeOut: 20000,
        fragLoadingTimeOut: 20000,
      });
      hlsRef.current = hls;

      hls.loadSource(playUrl);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        networkRetryCount = 0; // Reset retries on success
        if (autoPlay) {
          video.play().catch((e) => console.warn('Autoplay blocked:', e));
        }
      });

      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              console.warn('HLS Network error details:', data);
              
              // Handle CORS / Mixed Content (Code 0)
              if (data.response?.code === 0) {
                  if (!isUsingProxy) {
                      console.log("CORS/Blocked detected. Switching to Proxy mode...");
                      setIsUsingProxy(true); // Triggers re-render with proxy URL
                      hls?.destroy();
                      return;
                  } else {
                      hls?.destroy();
                      setError("Stream Unavailable: Source blocked even with Proxy.");
                      return;
                  }
              }

              if (networkRetryCount < MAX_RETRIES) {
                networkRetryCount++;
                console.log(`Network recovery attempt ${networkRetryCount}/${MAX_RETRIES}`);
                hls?.startLoad();
              } else {
                hls?.destroy();
                setError("Network error: Unable to connect to stream source.");
              }
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              console.warn('HLS Media error details:', data);
              hls?.recoverMediaError();
              break;
            default:
              console.error('HLS Fatal error:', data);
              hls?.destroy();
              setError("Fatal stream error.");
              break;
          }
        }
      });
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      // Native HLS support (Safari)
      video.src = playUrl;
      
      const onLoadedMetadata = () => {
        if (autoPlay) {
          video.play().catch((e) => console.warn('Autoplay blocked:', e));
        }
      };
      
      const onError = () => {
        if (!isUsingProxy) {
             setIsUsingProxy(true);
        } else {
             setError("Error loading stream (Native Player). Likely CORS or format issue.");
        }
      };

      video.addEventListener('loadedmetadata', onLoadedMetadata);
      video.addEventListener('error', onError);

      // Cleanup listener for native HLS
      return () => {
        video.removeEventListener('loadedmetadata', onLoadedMetadata);
        video.removeEventListener('error', onError);
      };
    } else {
      setError("HLS is not supported in this browser.");
    }

    return () => {
      if (hls) {
        hls.destroy();
      }
      if (video) {
        // Stop fetching video data
        video.removeAttribute('src');
        video.load(); 
      }
    };
  }, [url, autoPlay, isUsingProxy]);

  return (
    <div className="relative w-full h-full bg-black flex items-center justify-center overflow-hidden rounded-lg shadow-2xl">
      {/* Proxy Indicator */}
      {isUsingProxy && !error && (
        <div className="absolute top-2 right-2 bg-yellow-600/50 text-white text-[10px] px-2 py-1 rounded backdrop-blur-md z-10 border border-yellow-500/30">
          <i className="fas fa-shield-alt mr-1"></i> Proxy Active
        </div>
      )}

      {error ? (
        <div className="text-center p-8 bg-gray-900/80 rounded-xl border border-red-500/50 backdrop-blur-sm max-w-md mx-4">
          <i className="fas fa-exclamation-triangle text-4xl text-red-500 mb-4"></i>
          <p className="text-white text-lg font-medium mb-2">Stream Unavailable</p>
          <p className="text-gray-400 text-sm">{error}</p>
          <button 
            onClick={() => window.open(url, '_blank')}
            className="mt-4 text-xs text-blue-400 hover:text-blue-300 underline"
          >
            Try opening stream directly
          </button>
        </div>
      ) : (
        <video
          ref={videoRef}
          className="w-full h-full object-contain"
          controls
          poster={poster || undefined}
          playsInline
        />
      )}
    </div>
  );
};

export default VideoPlayer;