"use client";

import { useParams } from "next/navigation";
import { useState } from "react";

interface Settings {
  serverUrl: string;
  appName: string;
}

export default function HLSPlaybackPage() {
  const params = useParams();
  const streamId = params.id as string;

  const [settings] = useState<Settings>({
    serverUrl: "http://localhost:5080",
    appName: "LiveApp",
  });

  const hlsUrl = `${settings.serverUrl}/${settings.appName}/play.html?id=${streamId}`;

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
              <li className="text-gray-600 font-medium">HLS Playback</li>
            </ol>
          </nav>

          {/* Header */}
          <header className="mb-6">
            <title>{`HLS Playback - ${streamId} - Ant Media POS`}</title>
            <h1 className="text-4xl font-bold text-gray-900 mb-2">HLS Playback - {streamId}</h1>
            <p className="text-gray-600 mt-2">Stream ID: <span className="font-mono text-gray-700">{streamId}</span></p>
          </header>

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Video Section */}
            <div className="lg:col-span-3 space-y-4">
              <div className="bg-white rounded-lg shadow-md border border-gray-200 overflow-hidden">
                <iframe
                  width="100%"
                  height="500"
                  src={hlsUrl}
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  className="w-full aspect-video"
                />
              </div>

              {/* Info */}
              <div className="bg-blue-50 border border-blue-200 text-blue-800 px-4 py-3 rounded-lg">
                <p className="text-sm">
                  Watching stream: <span className="font-semibold font-mono">{streamId}</span> via HLS
                </p>
              </div>
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
                    <span>Protocol:</span>
                    <span className="font-semibold text-blue-600">HLS</span>
                  </div>
                </div>
              </div>

              {/* Playback Options */}
              <div className="bg-white rounded-lg shadow-md border border-gray-200 p-4 space-y-3">
                <button
                  onClick={() => window.open(`/stream/${streamId}/webrtc-playback`, '_blank')}
                  className="w-full px-3 py-2 bg-gradient-to-r from-green-600 to-green-700 text-white text-sm rounded-md hover:from-green-700 hover:to-green-800 transition-all font-semibold flex items-center justify-center gap-1.5"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                  </svg>
                  Watch WebRTC
                </button>
              </div>

              {/* Info Box */}
              <div className="bg-white rounded-lg shadow-md border border-gray-200 p-4">
                <h3 className="text-sm font-semibold text-gray-900 mb-2">Info</h3>
                <ul className="text-xs text-gray-600 space-y-1">
                  <li>• HLS provides wider compatibility</li>
                  <li>• Works on most devices and browsers</li>
                  <li>• Slightly higher latency than WebRTC</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
