"use client";

import { useState, useEffect, useRef } from "react";
import { AntMediaClient } from "./client";

interface Settings {
  serverUrl: string;
  appName: string;
  email: string;
  password: string;
  jwtToken: string;
}

interface Stream {
  streamId: string;
  status: string;
  type: string;
  name?: string;
  rtmpUrl?: string;
  hlsViewerCount: number;
  webRTCViewerCount: number;
  rtmpViewerCount: number;
  startTime: number;
}

interface BitrateProfile {
  height: number;
  videoBitrate: number;
  audioBitrate: number;
  forceEncode?: boolean;
}

interface BitratePreset {
  name: string;
  height: number;
  videoBitrate: number;
  audioBitrate: number;
  description: string;
}

// Predefined bitrate presets for popular streaming configurations
const BITRATE_PRESETS: BitratePreset[] = [
  {
    name: "360p Low",
    height: 360,
    videoBitrate: 800,
    audioBitrate: 64,
    description: "Mobile, slow connections",
  },
  {
    name: "480p Standard",
    height: 480,
    videoBitrate: 1200,
    audioBitrate: 96,
    description: "Standard definition",
  },
  {
    name: "720p HD",
    height: 720,
    videoBitrate: 2500,
    audioBitrate: 128,
    description: "High definition",
  },
  {
    name: "1080p Full HD",
    height: 1080,
    videoBitrate: 5000,
    audioBitrate: 192,
    description: "Full high definition",
  },
  {
    name: "1440p QHD",
    height: 1440,
    videoBitrate: 8000,
    audioBitrate: 192,
    description: "Quad high definition",
  },
  {
    name: "2160p 4K",
    height: 2160,
    videoBitrate: 15000,
    audioBitrate: 256,
    description: "Ultra high definition",
  },
];

// Random stream name suggestions
const STREAM_NAME_SUGGESTIONS = [
  "Live Stream",
  "Conference Call",
  "Gaming Session",
  "Webinar",
  "Music Performance",
  "Tutorial Session",
  "News Broadcast",
  "Sports Event",
  "Tech Talk",
  "Comedy Show",
  "Movie Night",
  "Concert",
  "Workshop",
  "Presentation",
  "Documentary",
  "Gaming Marathon",
  "Fitness Class",
  "Cooking Show",
];

// Generate a random stream name with timestamp
const generateRandomStreamName = () => {
  const suggestion = STREAM_NAME_SUGGESTIONS[Math.floor(Math.random() * STREAM_NAME_SUGGESTIONS.length)];
  const timestamp = new Date().toLocaleTimeString().replace(/:/g, "");
  return `${suggestion} ${timestamp}`;
};

export default function Home() {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isCreateStreamOpen, setIsCreateStreamOpen] = useState(false);
  const [streamName, setStreamName] = useState("");
  const [generatedStreamName, setGeneratedStreamName] = useState("");
  const [settings, setSettings] = useState<Settings>({
    serverUrl: "http://localhost:5080",
    appName: "LiveApp",
    email: "andranik@titanhub.io",
    password: "andranik@titanhub.io",
    jwtToken: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiYWRtaW4iOnRydWUsImlhdCI6MTUxNjIzOTAyMn0.hedxYa_2_G9alb8oIQJhDyV0D-G-L2-KvRHvOLZL3cU",
  });

  const [streams, setStreams] = useState<Stream[]>([]);
  const [loading, setLoading] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authStatus, setAuthStatus] = useState<string>("Not authenticated");
  const [authAttempted, setAuthAttempted] = useState(false);
  const authTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Transcoding and Recording Settings
  const [bitrates, setBitrates] = useState<BitrateProfile[]>([]);
  const [mp4RecordingEnabled, setMp4RecordingEnabled] = useState(false);
  const [loadingSettings, setLoadingSettings] = useState(false);
  const [usePreset, setUsePreset] = useState(true);
  const [selectedPreset, setSelectedPreset] = useState<BitratePreset | null>(BITRATE_PRESETS[2]); // Default to 720p
  const [newBitrate, setNewBitrate] = useState({
    height: 720,
    videoBitrate: 2500,
    audioBitrate: 128,
  });

  // Auto-authenticate on app mount
  useEffect(() => {
    const autoAuthenticate = async () => {
      // Only attempt auth once on mount
      if (authAttempted) return;
      
      setAuthAttempted(true);
      setLoading(true);
      try {
        const result = await AntMediaClient.authenticate(
          settings.serverUrl,
          settings.appName,
          settings.email,
          settings.password,
          settings.jwtToken
        );
        if (result.success) {
          setIsAuthenticated(true);
          setAuthStatus("Authenticated ✓");
          // Automatically fetch broadcasts after successful authentication
          await fetchBroadcasts();
          // Automatically load app settings
          await loadAppSettings();
        } else {
          setIsAuthenticated(false);
          setAuthStatus("Authentication failed");
        }
      } catch (error) {
        console.error("Error authenticating on app load:", error);
        setIsAuthenticated(false);
        setAuthStatus("Authentication error");
      } finally {
        setLoading(false);
      }
    };

    autoAuthenticate();
  }, []); // Empty dependency array ensures this runs only once on mount

  const authenticate = async () => {
    setLoading(true);
    try {
      const result = await AntMediaClient.authenticate(
        settings.serverUrl,
        settings.appName,
        settings.email,
        settings.password,
        settings.jwtToken
      );
      if (result.success) {
        setIsAuthenticated(true);
        setAuthStatus("Authenticated ✓");
        // Automatically fetch broadcasts after successful authentication
        await fetchBroadcasts();
      } else {
        setIsAuthenticated(false);
        setAuthStatus("Authentication failed");
      }
    } catch (error) {
      console.error("Error authenticating:", error);
      setIsAuthenticated(false);
      setAuthStatus("Authentication error");
    } finally {
      setLoading(false);
    }
  };

  // Update settings without triggering auto-auth
  const handleSettingsChange = (key: keyof Settings, value: string) => {
    setSettings({ ...settings, [key]: value });
  };

  const createBroadcast = async () => {
    setLoading(true);
    try {
      const newStream = await AntMediaClient.createBroadcast(
        settings.serverUrl,
        settings.appName
      );
      // After creating broadcast, fetch the updated list
      await fetchBroadcasts();
    } catch (error) {
      console.error("Error creating broadcast:", error);
    } finally {
      setLoading(false);
    }
  };

  // Open create stream modal with generated name
  const openCreateStreamModal = () => {
    const generatedName = generateRandomStreamName();
    setGeneratedStreamName(generatedName);
    setStreamName(generatedName);
    setIsCreateStreamOpen(true);
  };

  // Close create stream modal
  const closeCreateStreamModal = () => {
    setIsCreateStreamOpen(false);
    setStreamName("");
    setGeneratedStreamName("");
  };

  // Create stream with specified name
  const handleCreateStream = async () => {
    if (!streamName.trim()) {
      alert("Please enter a stream name");
      return;
    }

    setLoading(true);
    try {
      const broadcast = {
        name: streamName.trim(),
      };
      await AntMediaClient.createBroadcast(
        settings.serverUrl,
        settings.appName,
        broadcast
      );
      // After creating broadcast, fetch the updated list
      await fetchBroadcasts();
      closeCreateStreamModal();
    } catch (error) {
      console.error("Error creating broadcast:", error);
      alert("Failed to create stream. Please check the console for details.");
    } finally {
      setLoading(false);
    }
  };

  // Delete stream with confirmation
  const handleDeleteStream = async (streamId: string, streamName: string) => {
    const confirmed = window.confirm(
      `Are you sure you want to delete the stream "${streamName || streamId}"? This action cannot be undone.`
    );
    
    if (!confirmed) return;

    setLoading(true);
    try {
      await AntMediaClient.deleteBroadcast(
        settings.serverUrl,
        settings.appName,
        streamId
      );
      // After deleting, fetch the updated list
      await fetchBroadcasts();
    } catch (error) {
      console.error("Error deleting broadcast:", error);
      alert("Failed to delete stream. Please check the console for details.");
    } finally {
      setLoading(false);
    }
  };

  const fetchBroadcasts = async () => {
    setLoading(true);
    try {
      const data = await AntMediaClient.fetchBroadcasts(
        settings.serverUrl,
        settings.appName,
        0,
        50,
        undefined,
        settings.jwtToken
      );
      setStreams(data || []);
    } catch (error) {
      console.error("Error fetching broadcasts:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadAppSettings = async () => {
    setLoadingSettings(true);
    try {
      const appBitrates = await AntMediaClient.getAllEncoderBitrates(
        settings.serverUrl,
        settings.appName,
        settings.jwtToken
      );
      setBitrates(appBitrates);

      // Get MP4 recording setting
      const appSettings = await AntMediaClient.getSettings(
        settings.serverUrl,
        settings.appName,
        settings.jwtToken
      );
      setMp4RecordingEnabled(appSettings.mp4MuxingEnabled || false);
    } catch (error) {
      console.error("Error loading app settings:", error);
    } finally {
      setLoadingSettings(false);
    }
  };

  const handleAddBitrate = async () => {
    setLoadingSettings(true);
    try {
      await AntMediaClient.addEncoderBitrate(
        settings.serverUrl,
        settings.appName,
        newBitrate.height,
        newBitrate.videoBitrate,
        newBitrate.audioBitrate,
        false,
        settings.jwtToken
      );
      await loadAppSettings();
      setNewBitrate({
        height: 720,
        videoBitrate: 2500,
        audioBitrate: 128,
      });
    } catch (error) {
      console.error("Error adding bitrate:", error);
    } finally {
      setLoadingSettings(false);
    }
  };

  const handleAddPresetBitrate = async (preset: BitratePreset) => {
    setLoadingSettings(true);
    try {
      await AntMediaClient.addEncoderBitrate(
        settings.serverUrl,
        settings.appName,
        preset.height,
        preset.videoBitrate,
        preset.audioBitrate,
        false,
        settings.jwtToken
      );
      await loadAppSettings();
    } catch (error) {
      console.error("Error adding bitrate:", error);
    } finally {
      setLoadingSettings(false);
    }
  };

  const handleRemoveBitrate = async (height: number) => {
    setLoadingSettings(true);
    try {
      await AntMediaClient.removeEncoderBitrate(
        settings.serverUrl,
        settings.appName,
        height,
        settings.jwtToken
      );
      await loadAppSettings();
    } catch (error) {
      console.error("Error removing bitrate:", error);
    } finally {
      setLoadingSettings(false);
    }
  };

  const handleToggleMp4Recording = async () => {
    setLoadingSettings(true);
    try {
      await AntMediaClient.setMp4RecordingEnabled(
        settings.serverUrl,
        settings.appName,
        !mp4RecordingEnabled,
        settings.jwtToken
      );
      setMp4RecordingEnabled(!mp4RecordingEnabled);
    } catch (error) {
      console.error("Error toggling MP4 recording:", error);
    } finally {
      setLoadingSettings(false);
    }
  };

  const handleReload = async () => {
    setLoading(true);
    try {
      const result = await AntMediaClient.authenticate(
        settings.serverUrl,
        settings.appName,
        settings.email,
        settings.password,
        settings.jwtToken
      );
      if (result.success) {
        setIsAuthenticated(true);
        setAuthStatus("Authenticated ✓");
        // Load app settings after successful authentication
        setLoadingSettings(true);
        try {
          await loadAppSettings();
        } finally {
          setLoadingSettings(false);
        }
        // Also refresh streams list
        await fetchBroadcasts();
      } else {
        setIsAuthenticated(false);
        setAuthStatus("Authentication failed");
      }
    } catch (error) {
      console.error("Error authenticating:", error);
      setIsAuthenticated(false);
      setAuthStatus("Authentication error");
    } finally {
      setLoading(false);
    }
  };

  const getStreamUrl = (streamId: string) => {
    return `${settings.serverUrl}/${settings.appName}/play.html?name=${streamId}`;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <style>{`
        @keyframes modalFadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
        @keyframes modalSlideIn {
          from {
            opacity: 0;
            transform: scale(0.95);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
        .modal-overlay {
          animation: modalFadeIn 0.3s ease-out;
        }
        .modal-content {
          animation: modalSlideIn 0.3s ease-out;
        }
      `}</style>
      <div className="p-4 lg:p-6">
        <div className="mx-auto max-w-6xl 2xl:max-w-7xl">
          {/* Header */}
          <header className="mb-6">
            <title>Stream Management Dashboard - Ant Media POS</title>
            <h1 className="text-4xl font-bold text-gray-900 mb-2">Stream Management Dashboard</h1>
            <p className="text-gray-600">Live Stream Management and Broadcasting Interface</p>
          </header>

          {/* Authentication Status Card */}
          <div className="mb-6 bg-white rounded-lg shadow-md border border-gray-200">
            <div className="p-6">
              {/* Status Row */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 flex-1">
                  <div className={`w-4 h-4 rounded-full ${isAuthenticated ? "bg-green-500" : "bg-yellow-500"}`}></div>
                  <div>
                    <p className="text-xs font-semibold text-gray-600 uppercase">Authentication Status</p>
                    <p className={`text-lg font-bold ${isAuthenticated ? "text-green-800" : "text-yellow-800"}`}>
                      {authStatus}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleReload}
                    disabled={loading || loadingSettings}
                    className="px-4 py-2 bg-blue-600 text-white font-semibold rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    {loading || loadingSettings ? "Reloading..." : "Reload"}
                  </button>
                  <button
                    onClick={() => setIsSettingsOpen(!isSettingsOpen)}
                    className="p-2 hover:bg-gray-100 rounded-md transition-colors"
                    aria-expanded={isSettingsOpen}
                  >
                    <svg 
                      className={`w-5 h-5 text-gray-600 transform transition-transform ${isSettingsOpen ? "rotate-180" : ""}`}
                      fill="currentColor" 
                      viewBox="0 0 24 24"
                    >
                      <path d="M19.14,12.94c.04,-0.3 .06,-0.61 .06,-0.94c0,-0.32 -0.02,-0.64 -0.07,-0.94l2.03,-1.58c.18,-0.14 .23,-0.41 .12,-0.64l-1.92,-3.32c-0.12,-0.22 -0.37,-0.29 -0.59,-0.22l-2.39,0.96c-0.5,-0.38 -1.03,-0.7 -1.62,-0.94L14.4,2.81c-0.04,-0.24 -0.24,-0.41 -0.48,-0.41h-3.84c-0.24,0 -0.43,0.17 -0.47,0.41L9.25,5.35C8.66,5.59 8.12,5.92 7.63,6.29L5.24,5.33c-0.22,-0.08 -0.47,0 -0.59,0.22L2.74,8.87C2.62,9.08 2.66,9.34 2.86,9.48l2.03,1.58C4.84,11.36 4.8,11.69 4.8,12s0.02,0.64 0.07,0.94l-2.03,1.58c-0.18,0.14 -0.23,0.41 -0.12,0.64l1.92,3.32c0.12,0.22 0.37,0.29 0.59,0.22l2.39,-0.96c0.5,0.38 1.03,0.7 1.62,0.94l0.36,2.54c0.05,0.24 0.24,0.41 0.48,0.41h3.84c0.24,0 0.44,-0.17 0.47,-0.41l0.36,-2.54c0.59,-0.24 1.13,-0.56 1.62,-0.94l2.39,0.96c0.22,0.08 0.47,0 0.59,-0.22l1.92,-3.32c0.12,-0.22 0.07,-0.5 -0.12,-0.64L19.14,12.94zM12,15.6c-1.98,0 -3.6,-1.62 -3.6,-3.6s1.62,-3.6 3.6,-3.6s3.6,1.62 3.6,3.6S13.98,15.6 12,15.6z" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Settings Modal */}
          {isSettingsOpen && (
            <div className="modal-overlay fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <div className="modal-content bg-white rounded-xl shadow-2xl max-w-4xl w-full h-[90vh] flex flex-col overflow-hidden">
                {/* Modal Header */}
                <div className="sticky top-0 bg-gradient-to-r from-blue-50 to-blue-100 border-b border-blue-200 px-8 py-6 flex items-center justify-between flex-shrink-0">
                  <h2 className="text-3xl font-bold text-gray-900">Settings</h2>
                  <button
                    onClick={() => setIsSettingsOpen(false)}
                    className="p-2 hover:bg-white rounded-lg transition-colors"
                  >
                    <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                {/* Modal Content - Scrollable */}
                <div className="flex-1 overflow-y-auto px-8 py-6 space-y-8">
                  {/* Basic Settings */}
                  <div>
                    <h3 className="text-2xl font-bold text-gray-900 mb-6">Connection Settings</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      <div>
                        <label className="block text-sm font-semibold text-gray-800 mb-2">
                          Server URL
                        </label>
                        <input
                          type="text"
                          value={settings.serverUrl}
                          onChange={(e) => setSettings({ ...settings, serverUrl: e.target.value })}
                          className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 font-medium bg-white"
                          placeholder="http://localhost:5080"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-semibold text-gray-800 mb-2">
                          App Name
                        </label>
                        <input
                          type="text"
                          value={settings.appName}
                          onChange={(e) => setSettings({ ...settings, appName: e.target.value })}
                          className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 font-medium bg-white"
                          placeholder="LiveApp"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-gray-800 mb-2">
                          Email
                        </label>
                        <input
                          type="email"
                          value={settings.email}
                          onChange={(e) => handleSettingsChange("email", e.target.value)}
                          className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 font-medium bg-white"
                          placeholder="andranik@titanhub.io"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-gray-800 mb-2">
                          Password
                        </label>
                        <input
                          type="text"
                          value={settings.password}
                          onChange={(e) => handleSettingsChange("password", e.target.value)}
                          className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 font-medium bg-white"
                          placeholder="Enter password"
                        />
                      </div>

                      <div className="lg:col-span-2">
                        <label className="block text-sm font-semibold text-gray-800 mb-2">
                          JWT Auth Token
                        </label>
                        <input
                          type="text"
                          value={settings.jwtToken}
                          onChange={(e) => handleSettingsChange("jwtToken", e.target.value)}
                          className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 font-medium bg-white font-mono text-xs"
                          placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                        />
                        <p className="text-xs text-gray-500 mt-1">Optional JWT token for authentication</p>
                      </div>
                    </div>
                  </div>

                  {/* Transcoding Bitrates Section */}
                  {isAuthenticated && (
                    <div className="border-t border-gray-200 pt-8">
                      <h3 className="text-2xl font-bold text-gray-900 mb-6">Transcoding Bitrates</h3>
                      
                      {/* Current Bitrates */}
                      {bitrates.length > 0 && (
                        <div className="mb-8">
                          <h4 className="text-lg font-semibold text-gray-800 mb-4">Current Profiles</h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {bitrates.map((bitrate) => (
                              <div
                                key={bitrate.height}
                                className="flex items-center justify-between bg-gradient-to-r from-gray-50 to-gray-100 p-5 rounded-lg border border-gray-300"
                              >
                                <div className="flex-1">
                                  <p className="font-bold text-gray-900 text-lg">
                                    {bitrate.height}p
                                  </p>
                                  <p className="text-sm text-gray-600 mt-1">
                                    <span className="font-semibold">{bitrate.videoBitrate}</span> kbps video | <span className="font-semibold">{bitrate.audioBitrate}</span> kbps audio
                                  </p>
                                </div>
                                <button
                                  onClick={() => handleRemoveBitrate(bitrate.height)}
                                  disabled={loadingSettings}
                                  className="ml-4 px-4 py-2 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors font-semibold"
                                >
                                  Remove
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Add New Bitrate */}
                      <div className="bg-gradient-to-r from-blue-50 to-blue-100 p-6 rounded-lg border border-blue-300">
                        <h4 className="text-lg font-bold text-gray-900 mb-6">Add New Profile</h4>

                        {/* Preset vs Custom Toggle */}
                        <div className="mb-6 flex gap-3">
                          <button
                            onClick={() => setUsePreset(true)}
                            className={`px-6 py-3 rounded-lg font-semibold transition-colors ${
                              usePreset
                                ? "bg-blue-600 text-white shadow-lg"
                                : "bg-white text-gray-800 hover:bg-gray-100 border border-gray-300"
                            }`}
                          >
                            Use Preset
                          </button>
                          <button
                            onClick={() => setUsePreset(false)}
                            className={`px-6 py-3 rounded-lg font-semibold transition-colors ${
                              !usePreset
                                ? "bg-blue-600 text-white shadow-lg"
                                : "bg-white text-gray-800 hover:bg-gray-100 border border-gray-300"
                            }`}
                          >
                            Custom Values
                          </button>
                        </div>

                        {/* Preset Selection */}
                        {usePreset && (
                          <div className="mb-6">
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-6 gap-3">
                              {BITRATE_PRESETS.map((preset) => (
                                <button
                                  key={preset.name}
                                  onClick={() => handleAddPresetBitrate(preset)}
                                  disabled={loadingSettings}
                                  className={`p-3 rounded-lg border-2 text-left transition-all font-semibold ${
                                    selectedPreset?.name === preset.name
                                      ? "border-blue-600 bg-blue-100 shadow-md"
                                      : "border-gray-300 bg-white hover:border-blue-400 hover:shadow"
                                  } disabled:opacity-50`}
                                >
                                  <p className="text-gray-900 text-sm">{preset.name}</p>
                                  <p className="text-xs text-gray-600 mt-1">
                                    {preset.videoBitrate}k/{preset.audioBitrate}k
                                  </p>
                                </button>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Custom Values Input */}
                        {!usePreset && (
                          <div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                              <div>
                                <label className="block text-sm font-semibold text-gray-800 mb-2">
                                  Height (pixels)
                                </label>
                                <input
                                  type="number"
                                  value={newBitrate.height}
                                  onChange={(e) =>
                                    setNewBitrate({
                                      ...newBitrate,
                                      height: parseInt(e.target.value) || 0,
                                    })
                                  }
                                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                                  placeholder="720"
                                />
                              </div>
                              <div>
                                <label className="block text-sm font-semibold text-gray-800 mb-2">
                                  Video Bitrate (kbps)
                                </label>
                                <input
                                  type="number"
                                  value={newBitrate.videoBitrate}
                                  onChange={(e) =>
                                    setNewBitrate({
                                      ...newBitrate,
                                      videoBitrate: parseInt(e.target.value) || 0,
                                    })
                                  }
                                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                                  placeholder="2500"
                                />
                              </div>
                              <div>
                                <label className="block text-sm font-semibold text-gray-800 mb-2">
                                  Audio Bitrate (kbps)
                                </label>
                                <input
                                  type="number"
                                  value={newBitrate.audioBitrate}
                                  onChange={(e) =>
                                    setNewBitrate({
                                      ...newBitrate,
                                      audioBitrate: parseInt(e.target.value) || 0,
                                    })
                                  }
                                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                                  placeholder="128"
                                />
                              </div>
                            </div>
                            <button
                              onClick={handleAddBitrate}
                              disabled={loadingSettings}
                              className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors font-semibold text-lg"
                            >
                              {loadingSettings ? "Adding..." : "Add Custom Profile"}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* MP4 Recording Section */}
                  {isAuthenticated && (
                    <div className="border-t border-gray-200 pt-8">
                      <h3 className="text-2xl font-bold text-gray-900 mb-6">Recording Settings</h3>
                      <div className="bg-gradient-to-r from-green-50 to-green-100 p-6 rounded-lg border border-green-200">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-bold text-gray-900 text-lg">MP4 Recording</p>
                            <p className="text-sm text-gray-600 mt-1">
                              Enable/disable MP4 recording for all streams
                            </p>
                          </div>
                          <button
                            onClick={handleToggleMp4Recording}
                            disabled={loadingSettings}
                            className={`px-8 py-3 rounded-lg font-semibold text-white transition-colors disabled:opacity-50 text-lg ${
                              mp4RecordingEnabled
                                ? "bg-green-600 hover:bg-green-700 shadow-lg"
                                : "bg-gray-400 hover:bg-gray-500"
                            }`}
                          >
                            {mp4RecordingEnabled ? "Enabled" : "Disabled"}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Modal Footer */}
                <div className="border-t border-gray-200 px-8 py-6 flex justify-end gap-3 bg-gray-50 flex-shrink-0">
                  <button
                    onClick={() => setIsSettingsOpen(false)}
                    className="px-6 py-3 text-gray-700 font-semibold hover:bg-gray-200 rounded-lg transition-colors"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Create Stream Modal */}
          {isCreateStreamOpen && (
            <div className="modal-overlay fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <div className="modal-content bg-white rounded-xl shadow-2xl max-w-md w-full overflow-hidden">
                {/* Modal Header */}
                <div className="bg-gradient-to-r from-blue-50 to-blue-100 border-b border-blue-200 px-8 py-6 flex items-center justify-between">
                  <h2 className="text-2xl font-bold text-gray-900">Create New Stream</h2>
                  <button
                    onClick={closeCreateStreamModal}
                    className="p-2 hover:bg-white rounded-lg transition-colors"
                  >
                    <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                {/* Modal Content */}
                <div className="px-8 py-6 space-y-6">
                  <div>
                    <label className="block text-sm font-semibold text-gray-800 mb-3">
                      Stream Name
                    </label>
                    <input
                      type="text"
                      value={streamName}
                      onChange={(e) => setStreamName(e.target.value)}
                      onKeyPress={(e) => e.key === "Enter" && handleCreateStream()}
                      placeholder="Enter stream name or use suggested one"
                      className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 font-medium bg-white"
                      autoFocus
                    />
                    <p className="text-xs text-gray-500 mt-2">
                      💡 Suggested: <span className="font-semibold text-gray-700">{generatedStreamName}</span>
                    </p>
                  </div>

                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <p className="text-sm text-gray-700">
                      <span className="font-semibold text-blue-900">Quick Tip:</span> You can use the suggested stream name above or enter your own custom name.
                    </p>
                  </div>
                </div>

                {/* Modal Footer */}
                <div className="border-t border-gray-200 px-8 py-6 flex justify-end gap-3 bg-gray-50">
                  <button
                    onClick={closeCreateStreamModal}
                    className="px-6 py-3 text-gray-700 font-semibold hover:bg-gray-200 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCreateStream}
                    disabled={loading}
                    className="px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                  >
                    {loading ? "Creating..." : "Create Stream"}
                  </button>
                </div>
              </div>
            </div>
          )}

        {/* Stream Management Section */}
        <section className="bg-white rounded-lg shadow-md p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-semibold text-gray-900">Stream Management</h2>
            <button
              onClick={openCreateStreamModal}
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {loading ? "Creating..." : "Create New Stream"}
            </button>
          </div>

          {streams.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <p>No streams available. Create your first stream to get started.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {streams.map((stream) => (
                <div
                  key={stream.streamId}
                  className="border border-gray-200 rounded-lg p-4 hover:shadow-lg hover:border-blue-400 transition-all bg-white hover:bg-blue-50 flex flex-col"
                >
                  <div className="flex-1">
                    <div className="flex justify-between items-start mb-2 gap-2">
                      <h3 className="font-semibold text-gray-900 truncate flex-1">
                        {stream.name || stream.streamId}
                      </h3>
                      <span className={`px-2 py-1 text-xs rounded-full whitespace-nowrap ${
                        stream.status === "live" 
                          ? "bg-green-100 text-green-800" 
                          : stream.status === "created"
                          ? "bg-yellow-100 text-yellow-800"
                          : "bg-gray-100 text-gray-800"
                      }`}>
                        {stream.status}
                      </span>
                    </div>
                    
                    <div className="text-sm text-gray-600 space-y-1 mb-3">
                      <p><span className="font-medium">Stream ID:</span> {stream.streamId}</p>
                      <p><span className="font-medium">Type:</span> {stream.type}</p>
                      {stream.rtmpUrl && (
                        <p className="text-xs truncate"><span className="font-medium">RTMP:</span> {stream.rtmpUrl}</p>
                      )}
                    </div>
                    
                    <div className="flex justify-between text-xs text-gray-500">
                      <span>HLS: {stream.hlsViewerCount}</span>
                      <span>WebRTC: {stream.webRTCViewerCount}</span>
                      <span>RTMP: {stream.rtmpViewerCount}</span>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 mt-4 pt-4 border-t border-gray-200">
                    <div className="flex gap-2">
                      <button
                        onClick={() => window.location.href = `/stream/${stream.streamId}`}
                        className="flex-1 px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors font-semibold"
                      >
                        Details
                      </button>
                      <button
                        onClick={() => handleDeleteStream(stream.streamId, stream.name || stream.streamId)}
                        disabled={loading}
                        className="p-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 transition-colors flex items-center justify-center"
                        title="Delete stream"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => window.location.href = `/stream/${stream.streamId}/webrtc-broadcast`}
                        className="flex-1 px-3 py-2 bg-gradient-to-r from-blue-500 to-blue-600 text-white text-sm rounded-md hover:from-blue-600 hover:to-blue-700 transition-all font-semibold flex items-center justify-center gap-1.5 shadow-md hover:shadow-lg"
                        title="Start broadcasting"
                      >
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M3 12a9 9 0 1118 0 9 9 0 01-18 0z" />
                        </svg>
                        🎥 Broadcast
                      </button>
                      <button
                        onClick={() => window.open(`/stream/${stream.streamId}/webrtc-playback`, '_blank')}
                        className="flex-1 px-3 py-2 bg-gradient-to-r from-green-600 to-green-700 text-white text-sm rounded-md hover:from-green-700 hover:to-green-800 transition-all font-semibold flex items-center justify-center gap-1.5 shadow-md hover:shadow-lg"
                        title="Watch stream"
                      >
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                          <path fillRule="evenodd" d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm0 18a8 8 0 100-16 8 8 0 000 16z" clipRule="evenodd" />
                        </svg>
                        👁️ Watch
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
        </div>
      </div>
    </div>
  );
}
