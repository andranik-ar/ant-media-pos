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
  const [useScreenShare, setUseScreenShare] = useState(false);
  const [screenShareSupported, setScreenShareSupported] = useState(false);
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [selectedCamera, setSelectedCamera] = useState<string>("");
  const [stats, setStats] = useState<{ bitrate: string; resolution: string } | null>(null);
  const [useTestStream, setUseTestStream] = useState(false);
  const [testStreamAvailable, setTestStreamAvailable] = useState(false);
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
        setTestStreamAvailable(false);
      } else {
        // No cameras available, offer test stream
        setTestStreamAvailable(true);
        setError(
          "No camera/microphone devices found. You can use Test Stream mode for testing."
        );
        setUseTestStream(true);
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

  // Initialize WebRTC Adaptor
  useEffect(() => {
    const websocketUrl = formatWebSocketUrl(settings.serverUrl, settings.appName);

    const handleCallback = (info: string, obj?: any) => {
      console.log("WebRTC Callback:", info, obj);

      switch (info) {
        case "initialized":
          setStatus(useTestStream && !cameras.length ? "Ready to broadcast (Test Stream Mode)" : "Initialized - Ready to publish");
          setAdaptorInitialized(true);
          setError(null);
          break;
        case "publish_started":
          setIsPublishing(true);
          setStatus(
            `Publishing stream: ${streamId}${useTestStream ? " (Test Stream)" : ""}`
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
          setUseScreenShare(false);
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
      
      // Suppress and ignore "no input device" errors when using test stream
      if (useTestStream && (error.includes("No input device") || error.includes("NotFoundError"))) {
        console.log("Suppressed device error - using test stream");
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

    // Only request media if not using test stream or if we have cameras available
    if (useTestStream && !cameras.length) {
      // Don't request any media at all when using test stream with no cameras
      // This prevents getUserMedia from being called
      mediaConstraints = undefined;
    } else if (useTestStream) {
      // Test stream available but cameras also available - request camera as fallback
      mediaConstraints = {
        video: {
          width: { ideal: 320 },
          height: { ideal: 240 },
          deviceId: selectedCamera ? { exact: selectedCamera } : undefined,
        },
        audio: true,
      };
    } else if (useScreenShare) {
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
  }, [settings.serverUrl, settings.appName, streamId, useScreenShare, selectedCamera, useTestStream]);

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

  const handleStartBroadcast = async () => {
    if (!adaptorRef.current) {
      setError("WebRTC adaptor not initialized");
      return;
    }

    try {
      setError(null);
      setStatus("Starting broadcast...");

      // For test stream mode, we need to inject our custom stream
      if (useTestStream && !cameras.length) {
        // Create test video stream if not already created
        if (!testStreamRef.current) {
          testStreamRef.current = createTestVideoStream();
        }
        
        // Display on video element
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = testStreamRef.current;
        }

        // Manually add the test stream tracks to peer connection
        // This bypasses the normal getUserMedia flow
        const mediaManager = (adaptorRef.current as any).mediaManager;
        if (mediaManager) {
          mediaManager.localStream = testStreamRef.current;
        }
      } else if (useTestStream && testStreamRef.current) {
        // Update video element if already created
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = testStreamRef.current;
        }
      } else if (useScreenShare && screenShareSupported) {
        // Switch to screen sharing
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
      if (useTestStream && testStreamRef.current) {
        const cleanup = (testStreamRef.current as any).cleanup;
        if (cleanup) cleanup();
        testStreamRef.current = null;
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to stop broadcast";
      setError(errorMessage);
    }
  };

  const handleSwitchScreenShare = async () => {
    if (!adaptorRef.current || !isPublishing) return;

    try {
      setError(null);
      if (!useScreenShare && screenShareSupported) {
        adaptorRef.current.switchDesktopCapture(streamId);
        setUseScreenShare(true);
        setStatus("Switched to screen sharing");
      } else if (useScreenShare) {
        await adaptorRef.current.switchVideoCameraCapture(streamId, selectedCamera, undefined);
        setUseScreenShare(false);
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
            <title>WebRTC Broadcast - {streamId} - Ant Media POS</title>
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
              {/* Camera Selection */}
              {!useScreenShare && cameras.length > 0 && (
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

              {/* Test Stream Toggle */}
              {testStreamAvailable && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={useTestStream}
                      onChange={(e) => {
                        setUseTestStream(e.target.checked);
                        setError(null);
                      }}
                      disabled={isPublishing}
                      className="w-4 h-4 rounded border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                    <div>
                      <p className="text-sm font-semibold text-amber-800">
                        🧪 Use Test Stream Mode
                      </p>
                      <p className="text-xs text-amber-600">
                        Broadcast animated test content instead of camera (for testing without devices)
                      </p>
                    </div>
                  </label>
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
              </div>

              {/* Screen Share Controls */}
              {screenShareSupported && (
                <div className="bg-white rounded-lg shadow-md border border-gray-200 p-4">
                  <button
                    onClick={handleSwitchScreenShare}
                    disabled={!isPublishing}
                    className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-semibold py-2 px-4 rounded-lg transition-colors"
                  >
                    {useScreenShare ? "Switch to Camera" : "Share Screen"}
                  </button>
                </div>
              )}

              {/* Info Box */}
              <div className="bg-white rounded-lg shadow-md border border-gray-200 p-4">
                <h3 className="text-sm font-semibold text-gray-900 mb-2">Info</h3>
                <ul className="text-xs text-gray-600 space-y-1">
                  <li>• Start broadcast to begin streaming</li>
                  {useTestStream ? (
                    <li>• 🧪 Using animated test video source</li>
                  ) : (
                    <>
                      <li>• Camera feed shown in preview</li>
                      {screenShareSupported && <li>• Switch to screen sharing anytime</li>}
                    </>
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
