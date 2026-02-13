"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { WebRTCAdaptor } from "@antmedia/webrtc_adaptor";
import {
  createPlaybackAdaptor,
  formatWebSocketUrl,
  disposeAdaptor,
  parseWebRTCError,
} from "@/app/lib/webrtc";

interface Settings {
  serverUrl: string;
  appName: string;
}

interface StreamStats {
  bitrate: string;
  resolution: string;
  frameRate: string;
  latency: string;
}

export default function WebRTCPlaybackPage() {
  const params = useParams();
  const router = useRouter();
  const streamId = params.id as string;

  const [settings] = useState<Settings>({
    serverUrl: "http://localhost:5080",
    appName: "LiveApp",
  });

  // State management
  const [isPlaying, setIsPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string>("Ready to play");
  const [stats, setStats] = useState<StreamStats | null>(null);
  const [duration, setDuration] = useState<string>("00:00");
  const [retryCount, setRetryCount] = useState(0);

  // Refs
  const adaptorRef = useRef<WebRTCAdaptor | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const statsIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(0);
  const retryIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize WebRTC Adaptor
  useEffect(() => {
    const websocketUrl = formatWebSocketUrl(settings.serverUrl, settings.appName);

    const handleCallback = (info: string, obj?: any) => {
      console.log("WebRTC Callback:", info, obj);

      switch (info) {
        case "initialized":
          setStatus("Initialized - Ready to play");
          setError(null);
          break;
        case "play_started":
          setIsPlaying(true);
          setStatus(`Playing stream: ${streamId}`);
          setError(null);
          setRetryCount(0);
          startTimeRef.current = Date.now();
          startStatsCollection();
          break;
        case "play_finished":
          setIsPlaying(false);
          setStatus("Stream stopped");
          stopStatsCollection();
          break;
        case "closed":
          setIsPlaying(false);
          setStatus("Connection closed");
          stopStatsCollection();
          break;
        case "ice_connection_state_changed":
          console.log("ICE Connection State:", obj);
          break;
        case "updated_stats":
          if (obj && isPlaying) {
            const bitrate = obj.currentIncomingBitrate
              ? (obj.currentIncomingBitrate / 1000).toFixed(1)
              : "0";
            const frameRate = obj.framesPerSecond || "N/A";
            const latency = obj.roundTripTime ? `${obj.roundTripTime}ms` : "N/A";

            setStats({
              bitrate: `${bitrate} kbps`,
              resolution: `${obj.videoWidth}x${obj.videoHeight}` || "N/A",
              frameRate: frameRate,
              latency: latency,
            });
          }
          break;
      }
    };

    const handleCallbackError = (error: string, message?: string) => {
      console.error("WebRTC Error:", error, message);
      const userFriendlyError = parseWebRTCError(error);
      setError(userFriendlyError);
      setStatus("Error occurred");
    };

    const adaptor = createPlaybackAdaptor({
      websocketUrl,
      remoteVideoElement: remoteVideoRef.current || undefined,
      callback: handleCallback,
      callbackError: handleCallbackError,
    });

    adaptorRef.current = adaptor;

    return () => {
      if (statsIntervalRef.current) {
        clearInterval(statsIntervalRef.current);
      }
      disposeAdaptor(adaptorRef.current);
    };
  }, [settings.serverUrl, settings.appName, streamId]);

  const startStatsCollection = () => {
    if (statsIntervalRef.current) clearInterval(statsIntervalRef.current);

    // Update duration every second
    statsIntervalRef.current = setInterval(() => {
      if (startTimeRef.current > 0) {
        const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
        const hours = Math.floor(elapsed / 3600);
        const minutes = Math.floor((elapsed % 3600) / 60);
        const seconds = elapsed % 60;

        const timeStr = [hours, minutes, seconds]
          .map((v) => v.toString().padStart(2, "0"))
          .filter((_, i) => i > 0 || hours > 0)
          .join(":");

        setDuration(timeStr || "00:00");
      }
    }, 1000);
  };

  const stopStatsCollection = () => {
    if (statsIntervalRef.current) {
      clearInterval(statsIntervalRef.current);
      statsIntervalRef.current = null;
    }
    setStats(null);
    setDuration("00:00");
  };

  const attemptPlayback = async () => {
    if (!adaptorRef.current) {
      setError("WebRTC adaptor not initialized");
      return;
    }

    try {
      setError(null);
      setStatus("Attempting to connect...");
      adaptorRef.current.play(streamId);
      setRetryCount(prev => prev + 1);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to start playback";
      setError(errorMessage);
      setStatus("Connection failed, retrying...");
    }
  };

  // Auto-retry mechanism
  useEffect(() => {
    if (!isPlaying && !error && adaptorRef.current) {
      // Retry every 3 seconds
      retryIntervalRef.current = setInterval(() => {
        attemptPlayback();
      }, 3000);
    } else {
      if (retryIntervalRef.current) {
        clearInterval(retryIntervalRef.current);
        retryIntervalRef.current = null;
      }
    }

    return () => {
      if (retryIntervalRef.current) {
        clearInterval(retryIntervalRef.current);
        retryIntervalRef.current = null;
      }
    };
  }, [isPlaying, error, streamId]);

  // Start playback automatically when adaptor is ready
  useEffect(() => {
    if (adaptorRef.current && !isPlaying) {
      // Initial delay to ensure adaptor is fully initialized
      const timer = setTimeout(() => {
        attemptPlayback();
      }, 1000);
      
      return () => clearTimeout(timer);
    }
  }, [adaptorRef.current]);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="p-4 lg:p-6">
        <div className="mx-auto max-w-6xl 2xl:max-w-7xl">
          {/* Breadcrumbs */}
          <nav className="mb-4">
            <ol className="flex items-center space-x-2 text-sm">
              <li>
                <a 
                  href="/"
                  className="text-blue-600 hover:text-blue-800 font-medium"
                >
                  Home
                </a>
              </li>
              <li className="text-gray-400">/</li>
              <li>
                <a 
                  href={`/stream/${streamId}`}
                  className="text-blue-600 hover:text-blue-800 font-medium"
                >
                  Streams
                </a>
              </li>
              <li className="text-gray-400">/</li>
              <li>
                <a 
                  href={`/stream/${streamId}`}
                  className="text-blue-600 hover:text-blue-800 font-medium"
                >
                  {streamId}
                </a>
              </li>
              <li className="text-gray-400">/</li>
              <li className="text-gray-600 font-medium">WebRTC Playback</li>
            </ol>
          </nav>

          {/* Header */}
          <header className="mb-6">
            <title>{`WebRTC Playback - ${streamId} - Ant Media POS`}</title>
            <h1 className="text-4xl font-bold text-gray-900 mb-2">WebRTC Playback - {streamId}</h1>
            <p className="text-gray-600 mt-2">Stream ID: <span className="font-mono text-gray-700">{streamId}</span></p>
          </header>

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Video Section */}
            <div className="lg:col-span-3 space-y-4">
              <div className="bg-white rounded-lg shadow-md border border-gray-200 overflow-hidden">
                <video
                  ref={remoteVideoRef}
                  autoPlay
                  controls
                  playsInline
                  className="w-full aspect-video bg-black"
                />
              </div>

              {/* Status Messages */}
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg">
                  <p className="font-semibold">Error</p>
                  <p className="text-sm">{error}</p>
                </div>
              )}

              <div className="bg-blue-50 border border-blue-200 text-blue-800 px-4 py-3 rounded-lg">
                <p className="text-sm">Status: <span className="font-semibold">{status}</span></p>
              </div>

              {/* Stats Grid */}
              {stats && isPlaying && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="bg-green-50 border border-green-200 text-green-800 px-3 py-2 rounded-lg">
                    <p className="text-xs text-gray-600">Bitrate</p>
                    <p className="font-mono font-semibold">{stats.bitrate}</p>
                  </div>
                  <div className="bg-green-50 border border-green-200 text-green-800 px-3 py-2 rounded-lg">
                    <p className="text-xs text-gray-600">Resolution</p>
                    <p className="font-mono font-semibold">{stats.resolution}</p>
                  </div>
                  <div className="bg-green-50 border border-green-200 text-green-800 px-3 py-2 rounded-lg">
                    <p className="text-xs text-gray-600">Frame Rate</p>
                    <p className="font-mono font-semibold">{stats.frameRate} fps</p>
                  </div>
                  <div className="bg-green-50 border border-green-200 text-green-800 px-3 py-2 rounded-lg">
                    <p className="text-xs text-gray-600">Latency</p>
                    <p className="font-mono font-semibold">{stats.latency}</p>
                  </div>
                </div>
              )}

              {/* Duration */}
              {isPlaying && (
                <div className="bg-purple-50 border border-purple-200 text-purple-800 px-4 py-3 rounded-lg">
                  <p className="text-sm">
                    Watch Time: <span className="font-mono font-semibold">{duration}</span>
                  </p>
                </div>
              )}
            </div>

            {/* Controls Section */}
            <div className="space-y-4">

              {/* Stream Info */}
              <div className="bg-white rounded-lg shadow-md border border-gray-200 p-4">
                <h3 className="text-sm font-semibold text-gray-900 mb-3">Stream Information</h3>
                <div className="space-y-2 text-xs text-gray-600">
                  <div className="flex justify-between">
                    <span>Stream ID:</span>
                    <span className="text-gray-700 font-mono">{streamId}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Status:</span>
                    <span className={`font-semibold ${isPlaying ? "text-green-600" : "text-gray-500"}`}>
                      {isPlaying ? "Live" : "Offline"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Connection Status */}
              <div className="bg-white rounded-lg shadow-md border border-gray-200 p-4">
                <h3 className="text-sm font-semibold text-gray-900 mb-3">Connection Status</h3>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Status:</span>
                    <span className={`font-semibold ${
                      isPlaying ? "text-green-600" : 
                      error ? "text-red-600" : "text-yellow-600"
                    }`}>
                      {isPlaying ? "Connected" : error ? "Failed" : "Connecting..."}
                    </span>
                  </div>
                  {!isPlaying && (
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">Retry Attempts:</span>
                      <span className="font-mono text-gray-700">{retryCount}</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Auto-retry:</span>
                    <span className="font-semibold text-blue-600">Enabled</span>
                  </div>
                </div>
              </div>

              {/* Tips */}
              <div className="bg-white rounded-lg shadow-md border border-gray-200 p-4">
                <h3 className="text-sm font-semibold text-gray-900 mb-2">Info</h3>
                <ul className="text-xs text-gray-600 space-y-1">
                  <li>• Playback starts automatically</li>
                  <li>• Auto-retries every 3 seconds</li>
                  <li>• Real-time stats when connected</li>
                  <li>• Video controls available</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
