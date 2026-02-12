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
     * Create initial user (one-time setup)
     * POST /v2/users/initial
     * Creates initial user. This is a one-time scenario when initial user creation is required and shouldn't be used otherwise.
     * @param serverUrl - Base server URL
     * @param email - User email
     * @param password - User password
     * @param userType - (Optional) User type. Default: "ADMIN"
     * @param firstName - (Optional) User first name
     * @param lastName - (Optional) User last name
     * @returns Creation result
     */
    public static async createInitialUser(
        serverUrl: string,
        email: string,
        password: string,
        userType: string = "ADMIN",
        firstName?: string,
        lastName?: string
    ) {
        const userObject: any = {
            email,
            password,
            userType,
        };

        if (firstName) userObject.firstName = firstName;
        if (lastName) userObject.lastName = lastName;

        const response = await fetch(
            `${serverUrl}/rest/v2/users/initial`,
            {
                method: "POST",
                headers: this.buildHeaders(undefined),
                body: JSON.stringify(userObject),
            }
        );

        if (!response.ok) {
            const error = await response.json();
            throw new Error(
                error?.message || `Failed to create initial user (HTTP ${response.status})`
            );
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

    /**
     * Get VOD list with pagination
     * GET /v2/vods/list/{offset}/{size}
     * Retrieves the list of VoD files from the database. Returns up to 50 items per page
     * @param serverUrl - Base server URL
     * @param appName - Application name
     * @param offset - Starting point of the list for pagination
     * @param size - Number of items to fetch (max 50)
     * @param options - (Optional) Additional query parameters
     * @param options.sort_by - Field to sort by ("name", "date")
     * @param options.order_by - Sort order ("asc" or "desc")
     * @param options.streamId - Filter results by stream ID
     * @param options.search - Search string to filter results
     * @param jwtToken - (Optional) JWT token for authorization
     * @returns Array of VOD objects
     */
    public static async getVodList(
        serverUrl: string,
        appName: string,
        offset: number = 0,
        size: number = 50,
        options?: {
            sort_by?: "name" | "date";
            order_by?: "asc" | "desc";
            streamId?: string;
            search?: string;
        },
        jwtToken?: string
    ) {
        const url = new URL(
            `${serverUrl}/${appName}/rest/v2/vods/list/${offset}/${size}`
        );

        // Add optional query parameters
        if (options?.sort_by) url.searchParams.append("sort_by", options.sort_by);
        if (options?.order_by) url.searchParams.append("order_by", options.order_by);
        if (options?.streamId) url.searchParams.append("streamId", options.streamId);
        if (options?.search) url.searchParams.append("search", options.search);

        const response = await fetch(url.toString(), {
            method: "GET",
            headers: this.buildHeaders(undefined),
        });

        if (!response.ok) {
            throw new Error(
                `Failed to get VOD list (HTTP ${response.status})`
            );
        }

        return await response.json();
    }

    /**
     * Get total number of VOD files
     * GET /v2/vods/count
     * @param serverUrl - Base server URL
     * @param appName - Application name
     * @param jwtToken - (Optional) JWT token for authorization
     * @returns Object with total VOD count
     */
    public static async getVodCount(
        serverUrl: string,
        appName: string,
        jwtToken?: string
    ) {
        const response = await fetch(
            `${serverUrl}/${appName}/rest/v2/vods/count`,
            {
                method: "GET",
                headers: this.buildHeaders(undefined),
            }
        );

        if (!response.ok) {
            throw new Error(
                `Failed to get VOD count (HTTP ${response.status})`
            );
        }

        return await response.json();
    }

    /**
     * Get VOD count filtered by search term
     * GET /v2/vods/count/{search}
     * @param serverUrl - Base server URL
     * @param appName - Application name
     * @param search - Search parameter to get the number of items including it
     * @param jwtToken - (Optional) JWT token for authorization
     * @returns Object with filtered VOD count
     */
    public static async getVodCountBySearch(
        serverUrl: string,
        appName: string,
        search: string,
        jwtToken?: string
    ) {
        const response = await fetch(
            `${serverUrl}/${appName}/rest/v2/vods/count/${encodeURIComponent(search)}`,
            {
                method: "GET",
                headers: this.buildHeaders(undefined),
            }
        );

        if (!response.ok) {
            throw new Error(
                `Failed to get VOD count by search (HTTP ${response.status})`
            );
        }

        return await response.json();
    }

    /**
     * Get a specific VOD by ID
     * GET /v2/vods/{id}
     * @param serverUrl - Base server URL
     * @param appName - Application name
     * @param vodId - The ID of the VOD to retrieve
     * @param jwtToken - (Optional) JWT token for authorization
     * @returns VOD object
     */
    public static async getVod(
        serverUrl: string,
        appName: string,
        vodId: string,
        jwtToken?: string
    ) {
        const response = await fetch(
            `${serverUrl}/${appName}/rest/v2/vods/${vodId}`,
            {
                method: "GET",
                headers: this.buildHeaders(undefined),
            }
        );

        if (!response.ok) {
            throw new Error(
                response.status === 404
                    ? `VOD not found: ${vodId}`
                    : `Failed to get VOD (HTTP ${response.status})`
            );
        }

        return await response.json();
    }

    /**
     * Delete a specific VOD by ID
     * DELETE /v2/vods/{id}
     * Deletes a specific VoD file from the database by its ID
     * @param serverUrl - Base server URL
     * @param appName - Application name
     * @param vodId - The ID of the VOD to delete
     * @param jwtToken - (Optional) JWT token for authorization
     * @returns Delete result
     */
    public static async deleteVod(
        serverUrl: string,
        appName: string,
        vodId: string,
        jwtToken?: string
    ) {
        const response = await fetch(
            `${serverUrl}/${appName}/rest/v2/vods/${vodId}`,
            {
                method: "DELETE",
                headers: this.buildHeaders(undefined),
            }
        );

        if (!response.ok) {
            throw new Error(
                `Failed to delete VOD (HTTP ${response.status})`
            );
        }

        return await response.json();
    }

    /**
     * Delete multiple VODs by their IDs
     * DELETE /v2/vods
     * Deletes multiple VoD files from the database by their IDs (bulk delete)
     * @param serverUrl - Base server URL
     * @param appName - Application name
     * @param vodIds - Array of VOD IDs to delete
     * @param jwtToken - (Optional) JWT token for authorization
     * @returns Delete result
     */
    public static async deleteVods(
        serverUrl: string,
        appName: string,
        vodIds: string[],
        jwtToken?: string
    ) {
        const url = new URL(`${serverUrl}/${appName}/rest/v2/vods`);
        url.searchParams.append("ids", vodIds.join(","));

        const response = await fetch(url.toString(), {
            method: "DELETE",
            headers: this.buildHeaders(undefined),
        });

        if (!response.ok) {
            throw new Error(
                `Failed to delete VODs (HTTP ${response.status})`
            );
        }

        return await response.json();
    }

    /**
     * Unlink VODs from a directory
     * DELETE /v2/vods/directory
     * Unlinks VoD path from streams directory and deletes the database record (does not delete actual files)
     * @param serverUrl - Base server URL
     * @param appName - Application name
     * @param directory - Full path of the directory from which imported VoD files will be deleted from database
     * @param jwtToken - (Optional) JWT token for authorization
     * @returns Unlink result
     */
    public static async unlinkVodDirectory(
        serverUrl: string,
        appName: string,
        directory: string,
        jwtToken?: string
    ) {
        const url = new URL(`${serverUrl}/${appName}/rest/v2/vods/directory`);
        url.searchParams.append("directory", directory);

        const response = await fetch(url.toString(), {
            method: "DELETE",
            headers: this.buildHeaders(undefined),
        });

        if (!response.ok) {
            throw new Error(
                `Failed to unlink VOD directory (HTTP ${response.status})`
            );
        }

        return await response.json();
    }

    /**
     * Upload an external VOD file
     * POST /v2/vods/create
     * Uploads an external VoD file to Ant Media Server
     * @param serverUrl - Base server URL
     * @param appName - Application name
     * @param file - VOD file to upload
     * @param name - Name of the VOD File
     * @param metadata - (Optional) Custom metadata for the VOD file
     * @param jwtToken - (Optional) JWT token for authorization
     * @returns Upload result
     */
    public static async uploadVod(
        serverUrl: string,
        appName: string,
        file: File,
        name: string,
        metadata?: Record<string, any>,
        jwtToken?: string
    ) {
        const formData = new FormData();
        formData.append("file", file);
        if (metadata) {
            formData.append("metadata", JSON.stringify(metadata));
        }

        const url = new URL(`${serverUrl}/${appName}/rest/v2/vods/create`);
        url.searchParams.append("name", name);

        const response = await fetch(url.toString(), {
            method: "POST",
            body: formData,
        });

        if (!response.ok) {
            throw new Error(
                `Failed to upload VOD (HTTP ${response.status})`
            );
        }

        return await response.json();
    }

    /**
     * Import VOD files from a directory
     * POST /v2/vods/directory
     * Imports VoD files from a directory to the datastore and links them to the streams
     * @param serverUrl - Base server URL
     * @param appName - Application name
     * @param directory - Full path of the directory that VoD files will be imported
     * @param jwtToken - (Optional) JWT token for authorization
     * @returns Import result
     */
    public static async importVodDirectory(
        serverUrl: string,
        appName: string,
        directory: string,
        jwtToken?: string
    ) {
        const url = new URL(`${serverUrl}/${appName}/rest/v2/vods/directory`);
        url.searchParams.append("directory", directory);

        const response = await fetch(url.toString(), {
            method: "POST",
            headers: this.buildHeaders(undefined),
        });

        if (!response.ok) {
            throw new Error(
                `Failed to import VOD directory (HTTP ${response.status})`
            );
        }

        return await response.json();
    }

    /**
     * Import VODs to Stalker Portal
     * POST /v2/vods/import-to-stalker
     * Imports VoDs to the Stalker Portal
     * @param serverUrl - Base server URL
     * @param appName - Application name
     * @param jwtToken - (Optional) JWT token for authorization
     * @returns Import result
     */
    public static async importVodsToStalker(
        serverUrl: string,
        appName: string,
        jwtToken?: string
    ) {
        const response = await fetch(
            `${serverUrl}/${appName}/rest/v2/vods/import-to-stalker`,
            {
                method: "POST",
                headers: this.buildHeaders(undefined),
            }
        );

        if (!response.ok) {
            throw new Error(
                `Failed to import VODs to Stalker (HTTP ${response.status})`
            );
        }

        return await response.json();
    }
}