/**
 * WebRTC Adaptor Utilities for Ant Media Server
 * Provides helpers for initializing and managing WebRTC connections
 */

// Only import WebRTCAdaptor in client environment
let WebRTCAdaptor: any;
if (typeof window !== "undefined") {
  const { WebRTCAdaptor: WRA } = require("@antmedia/webrtc_adaptor");
  WebRTCAdaptor = WRA;
}

export interface WebRTCAdaptorConfig {
  websocketUrl: string;
  localVideoElement?: HTMLVideoElement;
  remoteVideoElement?: HTMLVideoElement;
  mediaConstraints?: {
    video?: boolean | MediaTrackConstraints;
    audio?: boolean | MediaTrackConstraints;
  };
  callback?: (info: string, obj?: any) => void;
  callbackError?: (error: string, message?: string) => void;
}

export interface WebRTCAdaptorInstance {
  adaptor: any;
  streamId: string;
  mode: "publish" | "play";
}

/**
 * Initialize WebRTC Adaptor for publishing (broadcasting)
 */
export function createPublishAdaptor(config: WebRTCAdaptorConfig): any {
  if (typeof window === "undefined") {
    throw new Error("WebRTC Adaptor can only be used in browser environment");
  }

  const {
    websocketUrl,
    localVideoElement,
    mediaConstraints,
    callback,
    callbackError,
  } = config;

  // Build adaptor config
  const adaptorConfig: any = {
    websocket_url: websocketUrl,
    localVideoId: localVideoElement?.id,
    callback: callback || defaultCallback,
    callbackError: callbackError || defaultCallbackError,
  };

  // Only add mediaConstraints if they are explicitly provided
  if (mediaConstraints !== undefined) {
    adaptorConfig.mediaConstraints = mediaConstraints;
  }

  const adaptor = new WebRTCAdaptor(adaptorConfig);

  return adaptor;
}

/**
 * Initialize WebRTC Adaptor for playback (viewing)
 */
export function createPlaybackAdaptor(config: WebRTCAdaptorConfig): any {
  if (typeof window === "undefined") {
    throw new Error("WebRTC Adaptor can only be used in browser environment");
  }

  const { websocketUrl, remoteVideoElement, callback, callbackError } = config;

  const adaptor = new WebRTCAdaptor({
    websocket_url: websocketUrl,
    remoteVideoElement: remoteVideoElement,
    callback: callback || defaultCallback,
    callbackError: callbackError || defaultCallbackError,
    // Explicitly disable media access for playback
    mediaConstraints: {
      video: false,
      audio: false,
    },
    // Disable peer connection configuration that might trigger device access
    peerconnection_config: {
      iceServers: []
    },
    // Disable data channel to avoid any unnecessary media access
    dataChannelEnabled: false,
  });

  return adaptor;
}

/**
 * Default callback handler
 */
function defaultCallback(info: string, obj?: any) {
  console.log("WebRTC Callback:", info, obj);
}

/**
 * Default error callback handler
 */
function defaultCallbackError(error: string, message?: string) {
  console.error("WebRTC Error:", error, message);
}

/**
 * Generate a random stream ID
 */
export function generateStreamId(prefix: string = "stream"): string {
  return `${prefix}_${Math.floor(Math.random() * 999999)}`;
}

/**
 * Format WebSocket URL from server configuration
 */
export function formatWebSocketUrl(
  serverUrl: string,
  appName: string,
  protocol?: "ws" | "wss"
): string {
  // Remove protocol from serverUrl if present
  let baseUrl = serverUrl.replace(/^https?:\/\//, "");

  // Determine protocol based on serverUrl or parameter
  let wsProtocol = protocol || (serverUrl.startsWith("https") ? "wss" : "ws");

  // Extract host and port
  const urlObj = new URL(serverUrl);
  const host = urlObj.hostname;
  const port = urlObj.port || (urlObj.protocol === "https:" ? "5443" : "5080");

  return `${wsProtocol}://${host}:${port}/${appName}/websocket`;
}

/**
 * Check if browser supports screen sharing
 */
export function isScreenShareSupported(): boolean {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return false;
  }
  
  return !!(
    navigator.mediaDevices &&
    navigator.mediaDevices.getDisplayMedia
  );
}

/**
 * Get available media devices
 */
export async function getMediaDevices() {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return { cameras: [], microphones: [] };
  }

  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    return {
      cameras: devices.filter((device) => device.kind === "videoinput"),
      microphones: devices.filter((device) => device.kind === "audioinput"),
    };
  } catch (error) {
    console.error("Failed to get media devices:", error);
    return { cameras: [], microphones: [] };
  }
}

/**
 * Parse WebRTC Adaptor error messages into user-friendly text
 */
export function parseWebRTCError(error: string): string {
  if (error.includes("NotFoundError")) {
    return "Camera or microphone not found or denied.";
  } else if (error.includes("NotReadableError") || error.includes("TrackStartError")) {
    return "Camera or microphone is in use by another process.";
  } else if (error.includes("OverconstrainedError") || error.includes("ConstraintNotSatisfiedError")) {
    return "No device fits your video/audio constraints.";
  } else if (error.includes("NotAllowedError") || error.includes("PermissionDeniedError")) {
    return "Access to camera/microphone denied.";
  } else if (error.includes("TypeError")) {
    return "Video/Audio required.";
  } else if (error.includes("ScreenSharePermissionDenied")) {
    return "Screen share not allowed.";
  } else if (error.includes("WebSocketNotConnected")) {
    return "WebSocket connection disconnected.";
  } else if (error.includes("highResourceUsage")) {
    return "Server resource limit reached. Please try again later.";
  }
  return error || "An unknown error occurred.";
}

/**
 * Create a test video stream for testing without camera/microphone
 * Generates a lightweight canvas with animated content and fake audio
 */
export function createTestVideoStream(): MediaStream {
  if (typeof window === "undefined" || typeof document === "undefined") {
    throw new Error("Test video stream can only be created in browser environment");
  }

  const canvas = document.createElement("canvas");
  canvas.width = 640;
  canvas.height = 480;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not get canvas context");

  // Get canvas stream at lower FPS to reduce resource usage
  const canvasStream = canvas.captureStream(15); // 15 FPS instead of 30

  // Create animated content - optimized for performance
  let frameCount = 0;
  let lastGridDrawTime = 0;
  
  const animationInterval = setInterval(() => {
    frameCount++;

    // Background
    ctx.fillStyle = "#1a1a2e";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Title
    ctx.fillStyle = "#00d4ff";
    ctx.font = "bold 32px Arial";
    ctx.textAlign = "center";
    ctx.fillText("Test Stream", canvas.width / 2, 60);

    // Subtitle
    ctx.fillStyle = "#ff006e";
    ctx.font = "20px Arial";
    ctx.fillText("No Camera/Mic", canvas.width / 2, 100);

    // Animated shapes - simple pulsing circle
    ctx.fillStyle = `rgba(0, 212, 255, ${0.5 + Math.sin(frameCount * 0.05) * 0.3})`;
    const circleX = canvas.width / 2;
    const circleY = canvas.height / 2;
    const radius = 40 + Math.sin(frameCount * 0.03) * 15;
    ctx.beginPath();
    ctx.arc(circleX, circleY, radius, 0, Math.PI * 2);
    ctx.fill();

    // Draw grid less frequently (every 10 frames)
    if (frameCount % 10 === 0) {
      ctx.strokeStyle = "rgba(0, 212, 255, 0.1)";
      ctx.lineWidth = 1;
      for (let i = 0; i < canvas.width; i += 100) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i, canvas.height);
        ctx.stroke();
      }
      for (let i = 0; i < canvas.height; i += 100) {
        ctx.beginPath();
        ctx.moveTo(0, i);
        ctx.lineTo(canvas.width, i);
        ctx.stroke();
      }
    }

    // Counter - increment every frame
    const counter = Math.floor(frameCount / 15); // Increment every second (15 FPS)
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 48px monospace";
    ctx.textAlign = "center";
    ctx.fillText(`${counter}`, canvas.width / 2, canvas.height - 50);
    
    // Timestamp - update every 2 seconds
    if (frameCount % 30 === 0) {
      ctx.fillStyle = "#ffffff";
      ctx.font = "14px monospace";
      ctx.textAlign = "left";
      const timestamp = new Date().toLocaleTimeString();
      ctx.fillText(`${timestamp}`, 10, canvas.height - 10);
    }
  }, 1000 / 15); // Update every ~67ms for 15 FPS

  // Create fake audio track - simpler approach
  let audioTrack: MediaStreamTrack | null = null;
  try {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    // Create media stream destination for audio
    const audioStreamDestination = audioContext.createMediaStreamDestination();
    oscillator.connect(audioStreamDestination);

    // Set oscillator to inaudible frequency
    oscillator.frequency.value = 0.1;
    gainNode.gain.value = 0;
    oscillator.start();

    audioTrack = audioStreamDestination.stream.getAudioTracks()[0];
    if (audioTrack) {
      canvasStream.addTrack(audioTrack);
    }
  } catch (error) {
    console.warn("Could not create fake audio track:", error);
  }

  // Store cleanup function on the stream
  (canvasStream as any).cleanup = () => {
    clearInterval(animationInterval);
    canvasStream.getTracks().forEach((track) => track.stop());
  };

  return canvasStream;
}

/**
 * Switch to desktop screen sharing
 */
export function switchToScreenShare(adaptor: any, streamId: string) {
  if (typeof window === "undefined") {
    throw new Error("Screen sharing can only be used in browser environment");
  }
  
  if (!adaptor || !adaptor.switchDesktopCapture) {
    throw new Error("WebRTC Adaptor does not support screen sharing");
  }
  
  return adaptor.switchDesktopCapture(streamId);
}

/**
 * Switch to screen share with camera (both simultaneously)
 */
export function switchToScreenShareWithCamera(adaptor: any, streamId: string) {
  if (typeof window === "undefined") {
    throw new Error("Screen sharing can only be used in browser environment");
  }
  
  if (!adaptor || !adaptor.switchDesktopCaptureWithCamera) {
    throw new Error("WebRTC Adaptor does not support screen sharing with camera");
  }
  
  return adaptor.switchDesktopCaptureWithCamera(streamId);
}

/**
 * Switch back to camera from screen sharing
 */
export function switchToCamera(adaptor: any, streamId: string, deviceId?: string) {
  if (typeof window === "undefined") {
    throw new Error("Camera switching can only be used in browser environment");
  }
  
  if (!adaptor || !adaptor.switchVideoCameraCapture) {
    throw new Error("WebRTC Adaptor does not support camera switching");
  }
  
  return adaptor.switchVideoCameraCapture(streamId, deviceId);
}

/**
 * Turn off local camera
 */
export function turnOffCamera(adaptor: any) {
  if (typeof window === "undefined") {
    throw new Error("Camera control can only be used in browser environment");
  }
  
  if (!adaptor || !adaptor.turnOffLocalCamera) {
    throw new Error("WebRTC Adaptor does not support camera control");
  }
  
  return adaptor.turnOffLocalCamera();
}

/**
 * Turn on local camera
 */
export function turnOnCamera(adaptor: any) {
  if (typeof window === "undefined") {
    throw new Error("Camera control can only be used in browser environment");
  }
  
  if (!adaptor || !adaptor.turnOnLocalCamera) {
    throw new Error("WebRTC Adaptor does not support camera control");
  }
  
  return adaptor.turnOnLocalCamera();
}

/**
 * Mute local microphone
 */
export function muteMicrophone(adaptor: any) {
  if (typeof window === "undefined") {
    throw new Error("Microphone control can only be used in browser environment");
  }
  
  if (!adaptor || !adaptor.muteLocalMic) {
    throw new Error("WebRTC Adaptor does not support microphone control");
  }
  
  return adaptor.muteLocalMic();
}

/**
 * Unmute local microphone
 */
export function unmuteMicrophone(adaptor: any) {
  if (typeof window === "undefined") {
    throw new Error("Microphone control can only be used in browser environment");
  }
  
  if (!adaptor || !adaptor.unmuteLocalMic) {
    throw new Error("WebRTC Adaptor does not support microphone control");
  }
  
  return adaptor.unmuteLocalMic();
}

/**
 * Get stream information
 */
export function getStreamInfo(adaptor: any, streamId: string) {
  if (!adaptor || !adaptor.getStreamInfo) {
    throw new Error("WebRTC Adaptor does not support getting stream info");
  }
  
  return adaptor.getStreamInfo(streamId);
}

/**
 * Change bandwidth for a stream
 */
export function changeBandwidth(adaptor: any, bandwidth: number | string, streamId?: string) {
  if (!adaptor || !adaptor.changeBandwidth) {
    throw new Error("WebRTC Adaptor does not support bandwidth change");
  }
  
  return adaptor.changeBandwidth(bandwidth, streamId);
}

/**
 * Get WebRTC statistics
 */
export function getStats(adaptor: any, streamId?: string) {
  if (!adaptor || !adaptor.getStats) {
    throw new Error("WebRTC Adaptor does not support stats");
  }
  
  return adaptor.getStats(streamId);
}

/**
 * Enable periodic statistics
 */
export function enableStats(adaptor: any, periodMs: number, streamId?: string) {
  if (!adaptor || !adaptor.enableStats) {
    throw new Error("WebRTC Adaptor does not support stats");
  }
  
  return adaptor.enableStats(streamId, periodMs);
}

/**
 * Dispose of WebRTC Adaptor resources
 */
export function disposeAdaptor(adaptor: any | null) {
  if (adaptor) {
    try {
      // Stop all tracks
      const localStream = (adaptor as any).localStream;
      if (localStream) {
        localStream.getTracks().forEach((track: MediaStreamTrack) => track.stop());
      }
    } catch (error) {
      console.error("Error disposing adaptor:", error);
    }
  }
}
