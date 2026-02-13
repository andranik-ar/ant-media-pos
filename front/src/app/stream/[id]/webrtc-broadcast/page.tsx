"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { WebRTCAdaptor } from "@antmedia/webrtc_adaptor";
import {
  createPublishAdaptor,
  formatWebSocketUrl,
  disposeAdaptor,
  parseWebRTCError,
  isScreenShareSupported,
  getMediaDevices,
  createTestVideoStream,
} from "@/app/lib/webrtc";
import { AntMediaClient } from "@/app/client";

interface Settings {
  serverUrl: string;
  appName: string;
}

export default function WebRTCBroadcastPage() {
  const params = useParams();
  const router = useRouter();
  const streamId = params.id as string;

  const [settings] = useState<Settings>({
    serverUrl: "http://localhost:5080",
    appName: "LiveApp",
  });

  // State management
  const [isPublishing, setIsPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string>("Ready to broadcast");
  const [inputSource, setInputSource] = useState<'camera' | 'screen' | 'test'>('camera');
  const [screenShareSupported, setScreenShareSupported] = useState(false);
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [selectedCamera, setSelectedCamera] = useState<string>("");
  const [stats, setStats] = useState<{ bitrate: string; resolution: string } | null>(null);
  const [adaptorInitialized, setAdaptorInitialized] = useState(false);

  // Refs
  const adaptorRef = useRef<WebRTCAdaptor | null>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const statsIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const testStreamRef = useRef<MediaStream | null>(null);

  // Check screen share support and get media devices
  useEffect(() => {
    setScreenShareSupported(isScreenShareSupported());

    getMediaDevices().then((devices) => {
      setCameras(devices.cameras);
      if (devices.cameras.length > 0) {
        setSelectedCamera(devices.cameras[0].deviceId);
        setInputSource('camera');
      } else {
        setInputSource('test');
      }
    });

    return () => {
      if (statsIntervalRef.current) {
        clearInterval(statsIntervalRef.current);
      }
      // Cleanup test stream
      if (testStreamRef.current) {
        const cleanup = (testStreamRef.current as any).cleanup;
        if (cleanup) cleanup();
        testStreamRef.current = null;
      }
    };
  }, []);

  // Helper functions for stats collection
  const startStatsCollection = () => {
    if (statsIntervalRef.current) clearInterval(statsIntervalRef.current);
    // Stats are collected through the 'updated_stats' callback
  };

  const stopStatsCollection = () => {
    if (statsIntervalRef.current) {
      clearInterval(statsIntervalRef.current);
      statsIntervalRef.current = null;
    }
    setStats(null);
  };

  // Initialize WebRTC Adaptor
  useEffect(() => {
    const websocketUrl = formatWebSocketUrl(settings.serverUrl, settings.appName);

    const handleCallback = (info: string, obj?: any) => {
      console.log("WebRTC Callback:", info, obj);

      switch (info) {
        case "initialized":
          setStatus(inputSource === 'test' ? "Ready to broadcast (Test Source Mode)" : "Initialized - Ready to publish");
          setAdaptorInitialized(true);
          setError(null);
          break;
        case "publish_started":
          setIsPublishing(true);
          setStatus(
            `Publishing stream: ${streamId}${inputSource === 'test' ? " (Test Source)" : ""}`
          );
          setError(null);
          startStatsCollection();
          break;
        case "publish_finished":
          setIsPublishing(false);
          setStatus("Broadcast stopped");
          stopStatsCollection();
          break;
        case "browser_screen_share_supported":
          setScreenShareSupported(true);
          break;
        case "screen_share_stopped":
          setInputSource('camera');
          setStatus("Screen sharing stopped");
          break;
        case "closed":
          setIsPublishing(false);
          setStatus("Connection closed");
          stopStatsCollection();
          break;
        case "ice_connection_state_changed":
          console.log("ICE Connection State:", obj);
          break;
        case "updated_stats":
          if (obj && isPublishing) {
            const bitrate = obj.currentOutgoingBitrate
              ? (obj.currentOutgoingBitrate / 1000).toFixed(1)
              : "0";
            setStats({
              bitrate: `${bitrate} kbps`,
              resolution: `${obj.videoWidth}x${obj.videoHeight}` || "N/A",
            });
          }
          break;
      }
    };

    const handleCallbackError = (error: string, message?: string) => {
      console.error("WebRTC Error:", error, message);
      
      // Suppress and ignore "no input device" errors when using test source
      if (inputSource === 'test' && (error.includes("No input device") || error.includes("NotFoundError"))) {
        console.log("Suppressed device error - using test source");
        return;
      }
      
      // Handle specific error types
      if (error === "highResourceUsage" || (message && message.includes("resource"))) {
        setError("🔴 Server resource limit reached. Unable to broadcast. Please try again later.");
        setStatus("Broadcast failed - Server busy");
        // Stop publishing to prevent reconnection attempts
        if (isPublishing) {
          adaptorRef.current?.stop(streamId);
          setIsPublishing(false);
          stopStatsCollection();
        }
        return;
      }
      
      const userFriendlyError = parseWebRTCError(error);
      setError(userFriendlyError);
      setStatus("Error occurred");
    };

    let mediaConstraints;
    let localStream: MediaStream | undefined;

    // Set media constraints based on input source
    if (inputSource === 'test') {
      // Always use test stream - create it now
      if (!testStreamRef.current) {
        testStreamRef.current = createTestVideoStream();
      }
      localStream = testStreamRef.current;
      
      // Display on video element
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = testStreamRef.current;
      }
      
      // Don't request camera/mic - use test stream only
      mediaConstraints = undefined;
    } else if (inputSource === 'screen') {
      mediaConstraints = {
        video: true,
        audio: true,
      };
    } else {
      // Regular camera mode
      mediaConstraints = {
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          deviceId: selectedCamera ? { exact: selectedCamera } : undefined,
        },
        audio: true,
      };
    }

    const adaptor = createPublishAdaptor({
      websocketUrl,
      localVideoElement: localVideoRef.current || undefined,
      mediaConstraints: mediaConstraints as any,
      localStream,
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
  }, [settings.serverUrl, settings.appName, streamId, inputSource, selectedCamera]);

  // Check current stream status and update publishing state after adaptor is ready
  useEffect(() => {
    if (!adaptorInitialized) return;

    const checkStreamStatus = async () => {
      try {
        const broadcast = await AntMediaClient.getBroadcast(
          settings.serverUrl,
          settings.appName,
          streamId
        );
        
        // If stream is already broadcasting, update the state
        if (broadcast.status === "broadcasting" && broadcast.publishType === "WebRTC") {
          setIsPublishing(true);
          setStatus(`Stream is already broadcasting: ${streamId}`);
          // Start stats collection for existing broadcast
          startStatsCollection();
        }
      } catch (error) {
        console.log("Stream status check:", error);
        // Stream might not exist yet, which is fine for new broadcasts
      }
    };

    checkStreamStatus();
  }, [settings.serverUrl, settings.appName, streamId, adaptorInitialized]);

  const handleStartBroadcast = async () => {
    if (!adaptorRef.current) {
      setError("WebRTC adaptor not initialized");
      return;
    }

    try {
      setError(null);
      setStatus("Starting broadcast...");

      // For screen share, we need to switch to desktop capture
      if (inputSource === 'screen' && screenShareSupported) {
        adaptorRef.current.switchDesktopCapture(streamId);
      }

      // Start publishing
      adaptorRef.current.publish(streamId);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to start broadcast";
      setError(errorMessage);
      setStatus("Broadcast failed");
    }
  };

  const handleStopBroadcast = () => {
    if (!adaptorRef.current) return;

    try {
      adaptorRef.current.stop(streamId);
      setIsPublishing(false);
      setStatus("Broadcast stopped");
      stopStatsCollection();

      // Cleanup test stream if used
      if (inputSource === 'test' && testStreamRef.current) {
        const cleanup = (testStreamRef.current as any).cleanup;
        if (cleanup) cleanup();
        testStreamRef.current = null;
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to stop broadcast";
      setError(errorMessage);
    }
  };

  const handleSwitchInputSource = async () => {
    if (!adaptorRef.current || !isPublishing) return;

    try {
      setError(null);
      if (inputSource === 'camera' && screenShareSupported) {
        adaptorRef.current.switchDesktopCapture(streamId);
        setInputSource('screen');
        setStatus("Switched to screen sharing");
      } else if (inputSource === 'screen') {
        await adaptorRef.current.switchVideoCameraCapture(streamId, selectedCamera, undefined);
        setInputSource('camera');
        setStatus("Switched back to camera");
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to switch source";
      setError(errorMessage);
    }
  };

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
              <li className="text-gray-600 font-medium">WebRTC Broadcast</li>
            </ol>
          </nav>

          {/* Header */}
          <header className="mb-6">
            <title>{`WebRTC Broadcast - ${streamId} - Ant Media POS`}</title>
            <h1 className="text-4xl font-bold text-gray-900 mb-2">WebRTC Broadcast - {streamId}</h1>
            <p className="text-gray-600 mt-2">Stream ID: <span className="font-mono text-gray-700">{streamId}</span></p>
          </header>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Video Section */}
            <div className="lg:col-span-2 space-y-4">
              <div className="bg-white rounded-lg shadow-md border border-gray-200 overflow-hidden">
                <video
                  ref={localVideoRef}
                  autoPlay
                  muted
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

              {/* Stats */}
              {stats && isPublishing && (
                <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-lg">
                  <p className="text-sm">
                    Bitrate: <span className="font-mono font-semibold">{stats.bitrate}</span> | 
                    Resolution: <span className="font-mono font-semibold">{stats.resolution}</span>
                  </p>
                </div>
              )}
            </div>

            {/* Controls Section */}
            <div className="space-y-4">
              {/* Input Source Selection */}
              <div className="bg-white rounded-lg shadow-md border border-gray-200 p-4">
                <label className="block text-sm font-semibold text-gray-900 mb-3">Input Source</label>
                <div className="space-y-2">
                  <label className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${inputSource === 'camera' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}>
                    <input
                      type="radio"
                      name="inputSource"
                      value="camera"
                      checked={inputSource === 'camera'}
                      onChange={() => setInputSource('camera')}
                      disabled={isPublishing || cameras.length === 0}
                      className="w-4 h-4 text-blue-600"
                    />
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-gray-900">📷 Camera</p>
                      <p className="text-xs text-gray-500">Use your webcam</p>
                    </div>
                  </label>
                  
                  {screenShareSupported && (
                    <label className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${inputSource === 'screen' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}>
                      <input
                        type="radio"
                        name="inputSource"
                        value="screen"
                        checked={inputSource === 'screen'}
                        onChange={() => setInputSource('screen')}
                        disabled={isPublishing}
                        className="w-4 h-4 text-blue-600"
                      />
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-gray-900">🖥️ Screen Share</p>
                        <p className="text-xs text-gray-500">Share your screen</p>
                      </div>
                    </label>
                  )}
                  
                  <label className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${inputSource === 'test' ? 'border-amber-500 bg-amber-50' : 'border-gray-200 hover:border-gray-300'}`}>
                    <input
                      type="radio"
                      name="inputSource"
                      value="test"
                      checked={inputSource === 'test'}
                      onChange={() => setInputSource('test')}
                      disabled={isPublishing}
                      className="w-4 h-4 text-amber-600"
                    />
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-gray-900">🧪 Test Source</p>
                      <p className="text-xs text-gray-500">Animated test pattern</p>
                    </div>
                  </label>
                </div>
              </div>

              {/* Camera Selection (only shown when camera is selected) */}
              {inputSource === 'camera' && cameras.length > 0 && (
                <div className="bg-white rounded-lg shadow-md border border-gray-200 p-4">
                  <label className="block text-sm font-semibold text-gray-900 mb-2">Camera</label>
                  <select
                    value={selectedCamera}
                    onChange={(e) => setSelectedCamera(e.target.value)}
                    disabled={isPublishing}
                    className="w-full px-3 py-2 border border-gray-300 text-gray-900 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {cameras.map((camera) => (
                      <option key={camera.deviceId} value={camera.deviceId}>
                        {camera.label || `Camera ${camera.deviceId.slice(0, 5)}`}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Broadcast Controls */}
              <div className="bg-white rounded-lg shadow-md border border-gray-200 p-4 space-y-3">
                <button
                  onClick={handleStartBroadcast}
                  disabled={isPublishing}
                  className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-semibold py-2 px-4 rounded-lg transition-colors"
                >
                  {isPublishing ? "Broadcasting..." : "Start Broadcast"}
                </button>
                <button
                  onClick={handleStopBroadcast}
                  disabled={!isPublishing}
                  className="w-full bg-red-600 hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-semibold py-2 px-4 rounded-lg transition-colors"
                >
                  Stop Broadcast
                </button>
                <button
                  onClick={() => window.open(`/stream/${streamId}/webrtc-playback`, '_blank')}
                  className="w-full bg-gradient-to-r from-green-600 to-green-700 text-white font-semibold py-2 px-4 rounded-lg transition-all hover:from-green-700 hover:to-green-800 flex items-center justify-center gap-2"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                    <path fillRule="evenodd" d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm0 18a8 8 0 100-16 8 8 0 000 16z" clipRule="evenodd" />
                  </svg>
                  👁️ Watch WebRTC Stream
                </button>
              </div>

              {/* Switch Source (while publishing) */}
              {screenShareSupported && isPublishing && inputSource !== 'test' && (
                <div className="bg-white rounded-lg shadow-md border border-gray-200 p-4">
                  <button
                    onClick={handleSwitchInputSource}
                    disabled={!isPublishing}
                    className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-semibold py-2 px-4 rounded-lg transition-colors"
                  >
                    {inputSource === 'camera' ? "Switch to Screen Share" : "Switch to Camera"}
                  </button>
                </div>
              )}

              {/* Info Box */}
              <div className="bg-white rounded-lg shadow-md border border-gray-200 p-4">
                <h3 className="text-sm font-semibold text-gray-900 mb-2">Info</h3>
                <ul className="text-xs text-gray-600 space-y-1">
                  <li>• Start broadcast to begin streaming</li>
                  {inputSource === 'test' ? (
                    <li>• 🧪 Using animated test video source</li>
                  ) : inputSource === 'screen' ? (
                    <li>• 🖥️ Sharing your screen</li>
                  ) : (
                    <li>• Camera feed shown in preview</li>
                  )}
                  <li>• View stats while broadcasting</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
