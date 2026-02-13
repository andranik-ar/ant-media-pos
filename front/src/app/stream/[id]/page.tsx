"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { AntMediaClient } from "@/app/client";

interface Settings {
  serverUrl: string;
  appName: string;
}

interface Broadcast {
  streamId?: string;
  status?: string;
  type?: string;
  name?: string;
  description?: string;
  publish?: boolean;
  date?: number;
  ipAddr?: string;
  username?: string;
  password?: string;
  streamUrl?: string;
  [key: string]: any;
}

interface VodFile {
  streamId: string;
  name: string;
  filePath?: string;
  size?: number;
  date?: number;
  duration?: number;
  [key: string]: any;
}

export default function StreamDetailPage() {
  const params = useParams();
  const router = useRouter();
  const streamId = params.id as string;

  const [settings] = useState<Settings>({
    serverUrl: "http://localhost:5080",
    appName: "LiveApp",
  });

  const [broadcast, setBroadcast] = useState<Broadcast | null>(null);
  const [vods, setVods] = useState<VodFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [vodsLoading, setVodsLoading] = useState(false);
  const [deletingVodId, setDeletingVodId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isJsonOpen, setIsJsonOpen] = useState(false);

  const fetchBroadcast = async (isAutoRefresh = false) => {
    if (isAutoRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);
    try {
      const data = await AntMediaClient.getBroadcast(
        settings.serverUrl,
        settings.appName,
        streamId
      );
      setBroadcast(data);
    } catch (err) {
      console.error("Error fetching broadcast:", err);
      setError(err instanceof Error ? err.message : "Failed to fetch broadcast");
    } finally {
      if (isAutoRefresh) {
        setRefreshing(false);
      } else {
        setLoading(false);
      }
    }
  };

  const fetchVods = async () => {
    setVodsLoading(true);
    try {
      const data = await AntMediaClient.getVodList(
        settings.serverUrl,
        settings.appName,
        0,
        50,
        {
          streamId: streamId,
          sort_by: "date",
          order_by: "desc",
        }
      );
      setVods(data || []);
    } catch (err) {
      console.error("Error fetching VODs:", err);
    } finally {
      setVodsLoading(false);
    }
  };

  const handleDeleteVod = async (vodId: string, vodName: string) => {
    const confirmed = window.confirm(
      `Are you sure you want to delete the VOD "${vodName || vodId}"? This action cannot be undone.`
    );
    
    if (!confirmed) return;

    setDeletingVodId(vodId);
    try {
      await AntMediaClient.deleteVod(
        settings.serverUrl,
        settings.appName,
        vodId
      );
      // Refresh the VOD list after deletion
      await fetchVods();
    } catch (err) {
      console.error("Error deleting VOD:", err);
      alert("Failed to delete VOD. Please check the console for details.");
    } finally {
      setDeletingVodId(null);
    }
  };

  useEffect(() => {
    if (streamId) {
      fetchBroadcast(false);
    }
  }, [streamId, settings.serverUrl, settings.appName]);

  useEffect(() => {
    if (broadcast && broadcast.streamId) {
      fetchVods();
    }
  }, [broadcast?.streamId, settings.serverUrl, settings.appName]);

  // Auto-refresh every 5 seconds (always enabled)
  useEffect(() => {
    if (!streamId) return;

    const interval = setInterval(() => {
      fetchBroadcast(true);
    }, 5000);

    return () => {
      clearInterval(interval);
    };
  }, [streamId, settings.serverUrl, settings.appName]);

  const handleDeleteStream = async () => {
    const streamName = broadcast?.name || broadcast?.streamId;
    const confirmed = window.confirm(
      `Are you sure you want to delete the stream "${streamName}"? This action cannot be undone.`
    );
    
    if (!confirmed) return;

    setDeleting(true);
    try {
      await AntMediaClient.deleteBroadcast(
        settings.serverUrl,
        settings.appName,
        streamId
      );
      // After successful deletion, navigate back to streams list
      router.push("/");
    } catch (err) {
      console.error("Error deleting broadcast:", err);
      alert("Failed to delete stream. Please check the console for details.");
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading stream details...</p>
        </div>
      </div>
    );
  }

  if (error || !broadcast) {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="max-w-4xl mx-auto">
          <button
            onClick={() => router.back()}
            className="mb-4 px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
          >
            ← Back
          </button>
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <h1 className="text-xl font-bold text-red-800 mb-2">Error</h1>
            <p className="text-red-700">{error || "Stream not found"}</p>
          </div>
        </div>
      </div>
    );
  }

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
                  href="/"
                  className="text-blue-600 hover:text-blue-800 font-medium"
                >
                  Streams
                </a>
              </li>
              <li className="text-gray-400">/</li>
              <li className="text-gray-600 font-medium">{streamId}</li>
            </ol>
          </nav>

          {/* Header */}
          <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6 mb-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                Stream Management - {broadcast.name || broadcast.streamId}
              </h1>
              <p className="text-gray-600">Stream ID: {broadcast.streamId}</p>
             </div>
          </div>

          {/* Content */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content Area */}
          <div className="lg:col-span-2 space-y-6">
            {/* Status and Actions */}
            <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
                <div className="flex items-center gap-3">
                  <span
                    className={`px-4 py-2 rounded-full font-semibold text-sm ${
                      broadcast.status === "broadcasting"
                        ? "bg-green-100 text-green-800"
                        : broadcast.status === "created"
                        ? "bg-yellow-100 text-yellow-800"
                        : broadcast.status === "finished"
                        ? "bg-gray-100 text-gray-800"
                        : "bg-red-100 text-red-800"
                    }`}
                  >
                    {broadcast.status}
                  </span>
                </div>
                
                {/* WebRTC Action Buttons */}
                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={() => router.push(`/stream/${streamId}/webrtc-broadcast`)}
                    className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 transition-all font-semibold text-sm flex items-center gap-2 shadow-lg hover:shadow-xl"
                  >
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M3 12a9 9 0 1118 0 9 9 0 01-18 0z" />
                    </svg>
                    <span>🎥 Go Live</span>
                  </button>
                  <button
                    onClick={() => window.open(`/stream/${streamId}/webrtc-playback`, '_blank')}
                    className="px-5 py-2.5 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-lg hover:from-green-700 hover:to-green-800 transition-all font-semibold text-sm flex items-center gap-2 shadow-lg hover:shadow-xl"
                  >
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                      <path fillRule="evenodd" d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm0 18a8 8 0 100-16 8 8 0 000 16z" clipRule="evenodd" />
                    </svg>
                    <span>👁️ Watch Stream</span>
                  </button>
                  <button
                    onClick={() => fetchBroadcast(false)}
                    disabled={loading || refreshing}
                    className="px-5 py-2.5 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg hover:from-blue-600 hover:to-blue-700 disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed transition-all font-semibold text-sm flex items-center gap-2 shadow-lg hover:shadow-xl"
                  >
                    <svg 
                      className={`w-5 h-5 ${loading || refreshing ? 'animate-spin' : ''}`} 
                      fill="none" 
                      stroke="currentColor" 
                      viewBox="0 0 24 24"
                    >
                      <path 
                        strokeLinecap="round" 
                        strokeLinejoin="round" 
                        strokeWidth={2} 
                        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" 
                      />
                    </svg>
                    <span>{refreshing ? "Refreshing..." : "🔄 Refresh"}</span>
                  </button>
                  <button
                    onClick={handleDeleteStream}
                    disabled={deleting}
                    className="px-5 py-2.5 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-lg hover:from-red-700 hover:to-red-800 disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed transition-all font-semibold text-sm flex items-center gap-2 shadow-lg hover:shadow-xl"
                  >
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                      <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h12a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0015 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    <span>{deleting ? "Deleting..." : "🗑️ Delete Stream"}</span>
                  </button>
                </div>
              </div>

              {/* Description */}
              {broadcast.description && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Description</h3>
                  <p className="text-gray-700 whitespace-pre-wrap">{broadcast.description}</p>
                </div>
              )}
            </div>

            {/* Overview Cards */}
            <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Stream Statistics</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-gray-50 rounded-lg p-4 border-l-4 border-blue-500">
                  <p className="text-gray-600 text-sm font-medium mb-1">Type</p>
                  <p className="text-2xl font-bold text-gray-900">{broadcast.type}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-4 border-l-4 border-green-500">
                  <p className="text-gray-600 text-sm font-medium mb-1">HLS Viewers</p>
                  <p className="text-2xl font-bold text-gray-900">{broadcast.hlsViewerCount || 0}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-4 border-l-4 border-purple-500">
                  <p className="text-gray-600 text-sm font-medium mb-1">WebRTC Viewers</p>
                  <p className="text-2xl font-bold text-gray-900">{broadcast.webRTCViewerCount || 0}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-4 border-l-4 border-orange-500">
                  <p className="text-gray-600 text-sm font-medium mb-1">RTMP Viewers</p>
                  <p className="text-2xl font-bold text-gray-900">{broadcast.rtmpViewerCount || 0}</p>
                </div>
              </div>
            </div>

            {/* VODs Section */}
            <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Recorded VODs</h3>
                <button
                  onClick={fetchVods}
                  disabled={vodsLoading}
                  className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center gap-1.5"
                >
                  <svg 
                    className={`w-4 h-4 ${vodsLoading ? 'animate-spin' : ''}`} 
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Refresh
                </button>
              </div>
              
              {vodsLoading && vods.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                  <p>Loading VODs...</p>
                </div>
              ) : vods.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <svg className="w-12 h-12 mx-auto mb-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M3 12a9 9 0 1118 0 9 9 0 01-18 0z" />
                  </svg>
                  <p>No VODs recorded for this stream</p>
                  <p className="text-sm mt-1">Enable recording to capture stream content</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {vods.map((vod, index) => (
                    <div
                      key={vod.filePath || `${vod.streamId}-${vod.date}-${index}`}
                      className="flex items-center justify-between bg-gray-50 rounded-lg p-4 border border-gray-200 hover:border-blue-300 transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <svg className="w-5 h-5 text-blue-600 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                            <path fillRule="evenodd" d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm0 18a8 8 0 100-16 8 8 0 000 16z" clipRule="evenodd" />
                          </svg>
                          <span className="font-medium text-gray-900 truncate">
                            {vod.name || vod.streamId}
                          </span>
                        </div>
                        <div className="text-sm text-gray-500 mt-1 ml-7">
                          {vod.filePath && (
                            <p className="truncate">Path: {vod.filePath}</p>
                          )}
                          <div className="flex gap-4 mt-1">
                            {vod.duration && (
                              <span>Duration: {Math.floor(vod.duration / 60)}:{String(vod.duration % 60).padStart(2, '0')}</span>
                            )}
                            {vod.size && (
                              <span>Size: {(vod.size / (1024 * 1024)).toFixed(2)} MB</span>
                            )}
                            {vod.date && (
                              <span>Recorded: {new Date(vod.date).toLocaleString()}</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 ml-4">
                        <button
                          onClick={() => {
                            const playUrl = `${settings.serverUrl}/${settings.appName}/play.html?name=${vod.streamId}`;
                            window.open(playUrl, '_blank');
                          }}
                          className="px-3 py-1.5 bg-green-600 text-white text-sm rounded-md hover:bg-green-700 transition-colors flex items-center gap-1.5"
                        >
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M8 5v14l11-7z" />
                          </svg>
                          Play
                        </button>
                        <button
                          onClick={() => handleDeleteVod(vod.streamId, vod.name)}
                          disabled={deletingVodId === vod.streamId}
                          className="px-3 py-1.5 bg-red-600 text-white text-sm rounded-md hover:bg-red-700 disabled:opacity-50 transition-colors flex items-center gap-1.5"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                          {deletingVodId === vod.streamId ? "Deleting..." : "Delete"}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            </div>

            {/* Description Section */}
            {broadcast.description && (
              <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Description</h3>
                <p className="text-gray-700 whitespace-pre-wrap">{broadcast.description}</p>
              </div>
            )}

            {/* JSON Viewer Section */}
            <div className="bg-white rounded-lg shadow-md border border-gray-200">
              <button
                onClick={() => setIsJsonOpen(!isJsonOpen)}
                className="w-full px-6 py-4 text-left flex justify-between items-center hover:bg-gray-50 rounded-t-lg transition-colors border-b border-gray-200"
              >
                <h3 className="text-lg font-semibold text-gray-900">Stream Details (JSON)</h3>
                <svg
                  className={`w-5 h-5 transform transition-transform ${isJsonOpen ? "rotate-180" : ""}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {isJsonOpen && (
                <div className="p-6">
                  <div className="bg-gray-900 rounded-lg p-4 overflow-x-auto">
                    <pre className="text-gray-100 text-sm font-mono leading-relaxed">
                      {JSON.stringify(broadcast, null, 2)}
                    </pre>
                  </div>
                </div>
                )}
          </div>
         </div>
       </div>
     </div>
   </div>
  );
}
