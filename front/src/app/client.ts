/**
 * Broadcast object interface based on OpenAPI schema
 */
export interface Broadcast {
    streamId?: string;
    status?: "finished" | "broadcasting" | "created" | "preparing" | "error" | "failed";
    type?: "liveStream" | "ipCamera" | "streamSource" | "VoD" | "playlist";
    publishType?: "WebRTC" | "RTMP" | "Pull" | "SRT";
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

/**
 * Ant Media Server Client
 * Implements endpoints from broadcast.open-api.json
 */
export class AntMediaClient {
    /**
     * Build fetch headers with optional JWT token
     * @param jwtToken - Optional JWT token to include in ProxyAuthorization header
     * @returns Headers object
     */
    private static buildHeaders(jwtToken?: string): Record<string, string> {
        const headers: Record<string, string> = {
            "Content-Type": "application/json",
        };

        if (jwtToken) {
            headers["ProxyAuthorization"] = jwtToken;
        }

        return headers;
    }

    /**
     * Authenticate user with the server
     * @param serverUrl - Base server URL
     * @param appName - Application name
     * @param email - User email
     * @param password - User password
     * @param jwtToken - (Optional) JWT token for authorization
     * @returns Authentication response
     */
    public static async authenticate(
        serverUrl: string,
        appName: string,
        email: string,
        password: string,
        jwtToken?: string
    ) {
        const response = await fetch(
            `${serverUrl}/rest/v2/users/authenticate`,
            {
                method: "POST",
                headers: this.buildHeaders(undefined),
                body: JSON.stringify({
                    email,
                    password,
                }),
            }
        );

        if (!response.ok) {
            throw new Error("Failed to authenticate");
        }

        return await response.json();
    }

    /**
     * Create a new broadcast
     * POST /v2/broadcasts/create
     * Creates a Broadcast, IP Camera or Stream Source and returns the full broadcast object
     * @param serverUrl - Base server URL
     * @param appName - Application name
     * @param broadcast - Broadcast object with configuration
     * @param autoStart - (Optional) Only effective for IP Camera or Stream Source. If true, starts automatically. Default: false
     * @param jwtToken - (Optional) JWT token for authorization
     * @returns Created broadcast object with streamId, rtmpAddress, etc.
     */
    public static async createBroadcast(
        serverUrl: string,
        appName: string,
        broadcast: Broadcast = {},
        autoStart: boolean = false,
        jwtToken?: string
    ) {
        const url = new URL(`${serverUrl}/${appName}/rest/v2/broadcasts/create`);
        url.searchParams.append("autoStart", autoStart.toString());

        const response = await fetch(url.toString(), {
            method: "POST",
            headers: this.buildHeaders(undefined),
            body: JSON.stringify(broadcast),
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(
                error?.message || `Failed to create broadcast (HTTP ${response.status})`
            );
        }

        return await response.json();
    }

    /**
     * Fetch broadcasts list with pagination
     * GET /v2/broadcasts/list/{offset}/{size}
     * Gets the broadcast list from database. It returns max 50 items at a time
     * @param serverUrl - Base server URL
     * @param appName - Application name
     * @param offset - Starting point of the list (for pagination)
     * @param size - Number of items to fetch (max 50)
     * @param options - (Optional) Additional query parameters
     * @param options.type_by - Type of stream ("liveStream", "ipCamera", "streamSource", "VoD")
     * @param options.sort_by - Field to sort by ("name", "date", "status")
     * @param options.order_by - Sort order ("asc" or "desc")
     * @param options.search - Search parameter to filter results
     * @param jwtToken - (Optional) JWT token for authorization
     * @returns Array of broadcast objects
     */
    public static async fetchBroadcasts(
        serverUrl: string,
        appName: string,
        offset: number = 0,
        size: number = 50,
        options?: {
            type_by?: string;
            sort_by?: string;
            order_by?: string;
            search?: string;
        },
        jwtToken?: string
    ) {
        const url = new URL(
            `${serverUrl}/${appName}/rest/v2/broadcasts/list/${offset}/${size}`
        );

        // Add optional query parameters
        if (options?.type_by) url.searchParams.append("type_by", options.type_by);
        if (options?.sort_by) url.searchParams.append("sort_by", options.sort_by);
        if (options?.order_by) url.searchParams.append("order_by", options.order_by);
        if (options?.search) url.searchParams.append("search", options.search);

        const response = await fetch(url.toString(), {
            method: "GET",
            headers: this.buildHeaders(undefined),
        });

        if (!response.ok) {
            throw new Error(
                `Failed to fetch broadcasts (HTTP ${response.status})`
            );
        }

        return await response.json();
    }

    /**
     * Get a specific broadcast by ID
     * GET /v2/broadcasts/{id}
     * @param serverUrl - Base server URL
     * @param appName - Application name
     * @param streamId - The ID of the broadcast to retrieve
     * @param jwtToken - (Optional) JWT token for authorization
     * @returns Broadcast object
     */
    public static async getBroadcast(
        serverUrl: string,
        appName: string,
        streamId: string,
        jwtToken?: string
    ) {
        const response = await fetch(
            `${serverUrl}/${appName}/rest/v2/broadcasts/${streamId}`,
            {
                method: "GET",
                headers: this.buildHeaders(undefined),
            }
        );

        if (!response.ok) {
            throw new Error(
                response.status === 404
                    ? `Broadcast not found: ${streamId}`
                    : `Failed to get broadcast (HTTP ${response.status})`
            );
        }

        return await response.json();
    }

    /**
     * Update a broadcast
     * PUT /v2/broadcasts/{id}
     * Updates the Broadcast object fields. Only non-null fields are updated.
     * @param serverUrl - Base server URL
     * @param appName - Application name
     * @param streamId - The ID of the broadcast to update
     * @param broadcast - Broadcast object with fields to update
     * @param jwtToken - (Optional) JWT token for authorization
     * @returns Update result
     */
    public static async updateBroadcast(
        serverUrl: string,
        appName: string,
        streamId: string,
        broadcast: Partial<Broadcast>,
        jwtToken?: string
    ) {
        const response = await fetch(
            `${serverUrl}/${appName}/rest/v2/broadcasts/${streamId}`,
            {
                method: "PUT",
                headers: this.buildHeaders(undefined),
                body: JSON.stringify(broadcast),
            }
        );

        if (!response.ok) {
            throw new Error(
                `Failed to update broadcast (HTTP ${response.status})`
            );
        }

        return await response.json();
    }

    /**
     * Delete a broadcast
     * DELETE /v2/broadcasts/{id}
     * Delete broadcast from data store and stop if it's broadcasting
     * @param serverUrl - Base server URL
     * @param appName - Application name
     * @param streamId - The ID of the broadcast to delete
     * @param deleteSubtracks - (Optional) Also delete subtracks. Default: false
     * @param jwtToken - (Optional) JWT token for authorization
     * @returns Delete result
     */
    public static async deleteBroadcast(
        serverUrl: string,
        appName: string,
        streamId: string,
        deleteSubtracks: boolean = false,
        jwtToken?: string
    ) {
        const url = new URL(
            `${serverUrl}/${appName}/rest/v2/broadcasts/${streamId}`
        );

        if (deleteSubtracks) {
            url.searchParams.append("deleteSubtracks", "true");
        }

        const response = await fetch(url.toString(), {
            method: "DELETE",
            headers: this.buildHeaders(undefined),
        });

        if (!response.ok) {
            throw new Error(
                `Failed to delete broadcast (HTTP ${response.status})`
            );
        }

        return await response.json();
    }

    /**
     * Get total number of broadcasts
     * GET /v2/broadcasts/count
     * @param serverUrl - Base server URL
     * @param appName - Application name
     * @param jwtToken - (Optional) JWT token for authorization
     * @returns Object with total count
     */
    public static async getBroadcastCount(
        serverUrl: string,
        appName: string,
        jwtToken?: string
    ) {
        const response = await fetch(
            `${serverUrl}/${appName}/rest/v2/broadcasts/count`,
            {
                method: "GET",
                headers: this.buildHeaders(undefined),
            }
        );

        if (!response.ok) {
            throw new Error(
                `Failed to get broadcast count (HTTP ${response.status})`
            );
        }

        return await response.json();
    }

    /**
     * Get application settings
     * GET /v2/applications/settings/{appname}
     * @param serverUrl - Base server URL
     * @param appName - Application name
     * @param jwtToken - (Optional) JWT token for authorization
     * @returns Application settings object
     */
    public static async getSettings(
        serverUrl: string,
        appName: string,
        jwtToken?: string
    ) {
        const response = await fetch(
            `${serverUrl}/rest/v2/applications/settings/${appName}`,
            {
                method: "GET",
                headers: this.buildHeaders(jwtToken),
            }
        );

        if (!response.ok) {
            throw new Error(
                `Failed to get application settings (HTTP ${response.status})`
            );
        }

        return await response.json();
    }

    /**
     * Update application settings
     * POST /v2/applications/settings/{appname}
     * Changes the application settings. Only non-null fields are updated.
     * @param serverUrl - Base server URL
     * @param appName - Application name
     * @param settings - Settings object with fields to update
     * @param jwtToken - (Optional) JWT token for authorization
     * @returns Update result
     */
    public static async updateSettings(
        serverUrl: string,
        appName: string,
        settings: Record<string, any>,
        jwtToken?: string
    ) {
        const response = await fetch(
            `${serverUrl}/rest/v2/applications/settings/${appName}`,
            {
                method: "POST",
                headers: this.buildHeaders(jwtToken),
                body: JSON.stringify(settings),
            }
        );

        if (!response.ok) {
            const error = await response.json();
            throw new Error(
                error?.message || `Failed to update settings (HTTP ${response.status})`
            );
        }

        return await response.json();
    }

    /**
     * Enable or disable MP4 recording
     * @param serverUrl - Base server URL
     * @param appName - Application name
     * @param enabled - Whether to enable (true) or disable (false) MP4 recording
     * @param jwtToken - (Optional) JWT token for authorization
     * @returns Update result
     */
    public static async setMp4RecordingEnabled(
        serverUrl: string,
        appName: string,
        enabled: boolean,
        jwtToken?: string
    ) {
        return this.updateSettings(
            serverUrl,
            appName,
            {
                mp4MuxingEnabled: enabled,
            },
            jwtToken
        );
    }

    /**
     * Get encoder settings for transcoding
     * @param serverUrl - Base server URL
     * @param appName - Application name
     * @param jwtToken - (Optional) JWT token for authorization
     * @returns Promise with encoder settings array
     */
    public static async getEncoderSettings(
        serverUrl: string,
        appName: string,
        jwtToken?: string
    ) {
        const settings = await this.getSettings(serverUrl, appName, jwtToken);
        return settings.encoderSettings || [];
    }

    /**
     * Add a new transcoding bitrate profile
     * @param serverUrl - Base server URL
     * @param appName - Application name
     * @param height - Resolution height in pixels
     * @param videoBitrate - Video bitrate in kbps
     * @param audioBitrate - Audio bitrate in kbps
     * @param forceEncode - Whether to force encoding
     * @param jwtToken - (Optional) JWT token for authorization
     * @returns Update result
     */
    public static async addEncoderBitrate(
        serverUrl: string,
        appName: string,
        height: number,
        videoBitrate: number,
        audioBitrate: number,
        forceEncode: boolean = false,
        jwtToken?: string
    ) {
        const settings = await this.getSettings(serverUrl, appName, jwtToken);
        const encoderSettings = settings.encoderSettings || [];

        // Check if bitrate profile already exists for this height
        const existingIndex = encoderSettings.findIndex(
            (e: any) => e.height === height
        );

        if (existingIndex >= 0) {
            // Update existing
            encoderSettings[existingIndex] = {
                height,
                videoBitrate,
                audioBitrate,
                forceEncode,
            };
        } else {
            // Add new
            encoderSettings.push({
                height,
                videoBitrate,
                audioBitrate,
                forceEncode,
            });
        }

        return this.updateSettings(serverUrl, appName, {
            encoderSettings,
        }, jwtToken);
    }

    /**
     * Remove a transcoding bitrate profile
     * @param serverUrl - Base server URL
     * @param appName - Application name
     * @param height - Resolution height to remove
     * @param jwtToken - (Optional) JWT token for authorization
     * @returns Update result
     */
    public static async removeEncoderBitrate(
        serverUrl: string,
        appName: string,
        height: number,
        jwtToken?: string
    ) {
        const settings = await this.getSettings(serverUrl, appName, jwtToken);
        const encoderSettings = (settings.encoderSettings || []).filter(
            (e: any) => e.height !== height
        );

        return this.updateSettings(
            serverUrl,
            appName,
            {
                encoderSettings,
            },
            jwtToken
        );
    }

    /**
     * Get all encoder bitrate profiles
     * @param serverUrl - Base server URL
     * @param appName - Application name
     * @param jwtToken - (Optional) JWT token for authorization
     * @returns Array of encoder settings objects
     */
    public static async getAllEncoderBitrates(
        serverUrl: string,
        appName: string,
        jwtToken?: string
    ) {
        return this.getEncoderSettings(serverUrl, appName, jwtToken);
    }

    /**
     * Update encoder bitrate profile
     * @param serverUrl - Base server URL
     * @param appName - Application name
     * @param height - Resolution height to update
     * @param videoBitrate - New video bitrate in kbps
     * @param audioBitrate - New audio bitrate in kbps
     * @param forceEncode - Whether to force encoding
     * @param jwtToken - (Optional) JWT token for authorization
     * @returns Update result
     */
    public static async updateEncoderBitrate(
        serverUrl: string,
        appName: string,
        height: number,
        videoBitrate: number,
        audioBitrate: number,
        forceEncode: boolean = false,
        jwtToken?: string
    ) {
        const settings = await this.getSettings(serverUrl, appName, jwtToken);
        const encoderSettings = settings.encoderSettings || [];

        const index = encoderSettings.findIndex((e: any) => e.height === height);

        if (index < 0) {
            throw new Error(`Encoder bitrate profile for height ${height} not found`);
        }

        encoderSettings[index] = {
            height,
            videoBitrate,
            audioBitrate,
            forceEncode,
        };

        return this.updateSettings(
            serverUrl,
            appName,
            {
                encoderSettings,
            },
            jwtToken
        );
    }

    /**
     * Enable/disable stream recording for a specific broadcast
     * PUT /v2/broadcasts/{id}/recording/{recording-status}
     * @param serverUrl - Base server URL
     * @param appName - Application name
     * @param streamId - The ID of the broadcast
     * @param enabled - Whether to enable (true) or disable (false) recording
     * @param recordType - (Optional) Record type: 'mp4' or 'webm'. Default: mp4
     * @param resolutionHeight - (Optional) Resolution height of broadcast to record
     * @param fileName - (Optional) Base filename (without extension) for output VOD
     * @param jwtToken - (Optional) JWT token for authorization
     * @returns Result of recording setting
     */
    public static async setStreamRecording(
        serverUrl: string,
        appName: string,
        streamId: string,
        enabled: boolean,
        recordType: string = "mp4",
        resolutionHeight?: number,
        fileName?: string,
        jwtToken?: string
    ) {
        const url = new URL(
            `${serverUrl}/${appName}/rest/v2/broadcasts/${streamId}/recording/${enabled}`
        );

        if (recordType) {
            url.searchParams.append("recordType", recordType);
        }

        if (resolutionHeight) {
            url.searchParams.append("resolutionHeight", resolutionHeight.toString());
        }

        if (fileName) {
            url.searchParams.append("fileName", fileName);
        }

        const response = await fetch(url.toString(), {
            method: "PUT",
            headers: this.buildHeaders(undefined),
        });

        if (!response.ok) {
            throw new Error(
                `Failed to set stream recording (HTTP ${response.status})`
            );
        }

        return await response.json();
    }

    /**
     * Enable recording for a stream
     * @param serverUrl - Base server URL
     * @param appName - Application name
     * @param streamId - The ID of the broadcast
     * @param options - Additional options
     * @param jwtToken - (Optional) JWT token for authorization
     * @returns Result of recording setting
     */
    public static async enableRecording(
        serverUrl: string,
        appName: string,
        streamId: string,
        options?: {
            recordType?: string;
            resolutionHeight?: number;
            fileName?: string;
        },
        jwtToken?: string
    ) {
        return this.setStreamRecording(
            serverUrl,
            appName,
            streamId,
            true,
            options?.recordType || "mp4",
            options?.resolutionHeight,
            options?.fileName,
            jwtToken
        );
    }

    /**
     * Disable recording for a stream
     * @param serverUrl - Base server URL
     * @param appName - Application name
     * @param streamId - The ID of the broadcast
     * @param jwtToken - (Optional) JWT token for authorization
     * @returns Result of recording setting
     */
    public static async disableRecording(
        serverUrl: string,
        appName: string,
        streamId: string,
        jwtToken?: string
    ) {
        return this.setStreamRecording(serverUrl, appName, streamId, false, "mp4", undefined, undefined, jwtToken);
    }
}