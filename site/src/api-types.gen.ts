// Generated from api/openapi.json by `pnpm codegen`. Do not edit by hand.

export interface paths {
    "/health": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Health check
         * @description For load balancers and the Docker healthcheck.
         */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description The server is up. */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            /** @enum {boolean} */
                            ok: true;
                        };
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/auth/discord/start": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Start Discord sign-in
         * @description Opened by the browser, not fetched. Sets a short-lived state cookie and redirects to Discord's consent screen.
         */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Redirect to Discord's consent screen. */
                302: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description Server misconfiguration or bug. */
                500: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/auth/discord/callback": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Finish Discord sign-in
         * @description Where Discord sends the browser after consent (verified with the state cookie). Creates the user on first sign-in, then redirects to the site at `#/auth?token=…` with a new web session token.
         */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Redirect to the site with a session token in the URL fragment. */
                302: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description The request was invalid. */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Server misconfiguration or bug. */
                500: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description An upstream service (Discord) failed. */
                502: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/auth/dev-login": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Sign in by name (development only)
         * @description Returns 404 unless the server runs with `ENVIRONMENT=dev`.
         */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": components["schemas"]["DevLoginRequest"];
                };
            };
            responses: {
                /** @description A web session token. */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Token"];
                    };
                };
                /** @description The request was invalid. */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Not found, or you're not a member of this game. */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/auth/logout": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Sign out
         * @description Revokes the token used to make this request.
         */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Signed out. */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Ok"];
                    };
                };
                /** @description Missing or expired token. */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/me": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get the signed-in user */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description The signed-in user. */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["User"];
                    };
                };
                /** @description Missing or expired token. */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/device/start": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Start linking the mod (step 1)
         * @description The mod calls this and shows `userCode` to the player, then polls `/device/poll`.
         */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description A new link code. */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["DeviceStart"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/device/approve": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Approve a link code (step 2)
         * @description The player enters the code shown in-game on the website.
         */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": components["schemas"]["DeviceApproveRequest"];
                };
            };
            responses: {
                /** @description Approved. The mod picks up its token on its next poll. */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Ok"];
                    };
                };
                /** @description The request was invalid. */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Missing or expired token. */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Not found, or you're not a member of this game. */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/device/poll": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Poll for the mod token (step 3)
         * @description The mod calls this every `intervalSeconds`; the `deviceCode` is the credential. Returns `pending` until the player approves, then hands out a long-lived mod token exactly once.
         */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": components["schemas"]["DevicePollRequest"];
                };
            };
            responses: {
                /** @description Pending, or approved with the token. */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["DevicePoll"];
                    };
                };
                /** @description The request was invalid. */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description No longer available. */
                410: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/games": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List the caller's games
         * @description Every game the caller is in, including finished ones, with their role in each.
         */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Newest first. */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["GameSummary"][];
                    };
                };
                /** @description Missing or expired token. */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        put?: never;
        /**
         * Create a game
         * @description The game starts in setup. The caller becomes its owner and first admin.
         */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": components["schemas"]["CreateGameRequest"];
                };
            };
            responses: {
                /** @description Created. */
                201: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["CreatedGame"];
                    };
                };
                /** @description The request was invalid. */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Missing or expired token. */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/games/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get a game
         * @description Everything the game page shows. Non-members get 404.
         */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description The game. */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["GameDetail"];
                    };
                };
                /** @description Missing or expired token. */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Not found, or you're not a member of this game. */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        /**
         * Update settings or status
         * @description Only the fields sent are changed. Status can go running ↔ paused, or to finished. Unpausing restarts the waiting player's start window. Changing `orderMode` re-picks who the waiting turn belongs to. World and character names can only change during setup.
         */
        patch: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": components["schemas"]["UpdateGameRequest"];
                };
            };
            responses: {
                /** @description The updated game. */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Game"];
                    };
                };
                /** @description The request was invalid. */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Missing or expired token. */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Signed in, but not allowed to do this. */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Not found, or you're not a member of this game. */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Conflicts with the game or turn's current state. */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        trace?: never;
    };
    "/games/{id}/invite": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Reset the invite link
         * @description Replaces the invite code. Old invite links stop working.
         */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description The new invite code. */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Invite"];
                    };
                };
                /** @description Missing or expired token. */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Signed in, but not allowed to do this. */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Not found, or you're not a member of this game. */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/join/{code}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Join a game
         * @description Joins from an invite link, at the end of the turn order. Joining a game you're already in does nothing.
         */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    code: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Joined. */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Joined"];
                    };
                };
                /** @description Missing or expired token. */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Not found, or you're not a member of this game. */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Conflicts with the game or turn's current state. */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/games/{id}/order": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        /**
         * Set the turn order
         * @description In strict order, the waiting turn is reassigned if the change affects who's next.
         */
        put: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": components["schemas"]["OrderRequest"];
                };
            };
            responses: {
                /** @description Order saved. */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Ok"];
                    };
                };
                /** @description The request was invalid. */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Missing or expired token. */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Signed in, but not allowed to do this. */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Not found, or you're not a member of this game. */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/games/{id}/players/{userId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        /**
         * Update a player
         * @description Lets a player sit out or rejoin, or changes their role. Players sitting out are skipped by the rotation. The owner is always an admin.
         */
        patch: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                    userId: string;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": components["schemas"]["UpdatePlayerRequest"];
                };
            };
            responses: {
                /** @description Player updated. */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Ok"];
                    };
                };
                /** @description The request was invalid. */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Missing or expired token. */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Signed in, but not allowed to do this. */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Not found, or you're not a member of this game. */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        trace?: never;
    };
    "/games/{id}/snapshots/initial": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        /**
         * Upload the starting save
         * @description Called by the mod. Uploads or replaces the starting save; only allowed during setup.
         */
        put: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            /** @description A save bundle zip. Send its hex SHA-256 in the X-Content-SHA256 header to detect corruption. */
            requestBody: {
                content: {
                    "application/zip": string;
                };
            };
            responses: {
                /** @description Stored. */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Uploaded"];
                    };
                };
                /** @description The request was invalid. */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Missing or expired token. */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Signed in, but not allowed to do this. */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Not found, or you're not a member of this game. */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Conflicts with the game or turn's current state. */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Upload is too large. */
                413: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/games/{id}/start": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Start the game
         * @description Moves the game from setup to running and opens turn 1. Requires a starting save.
         */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Started. */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Started"];
                    };
                };
                /** @description Missing or expired token. */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Signed in, but not allowed to do this. */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Not found, or you're not a member of this game. */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Conflicts with the game or turn's current state. */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/games/{id}/turns/current/skip": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Skip the current turn
         * @description Ends the current turn early. An active turn with a checkpoint and `keepProgress` expires, and its last checkpoint becomes the next turn's starting save. Otherwise the turn is skipped and its progress discarded. Either way the next turn opens.
         */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody?: {
                content: {
                    "application/json": components["schemas"]["SkipRequest"];
                };
            };
            responses: {
                /** @description Turn ended. */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Ok"];
                    };
                };
                /** @description The request was invalid. */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Missing or expired token. */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Signed in, but not allowed to do this. */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Not found, or you're not a member of this game. */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Conflicts with the game or turn's current state. */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/games/{id}/rollback": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Roll back to an earlier save
         * @description Makes an earlier save the starting point for the next turn. Not allowed while a turn is being played.
         */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": components["schemas"]["RollbackRequest"];
                };
            };
            responses: {
                /** @description Rolled back. */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Ok"];
                    };
                };
                /** @description The request was invalid. */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Missing or expired token. */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Signed in, but not allowed to do this. */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Not found, or you're not a member of this game. */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Conflicts with the game or turn's current state. */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/games/{id}/snapshots/{sid}/download": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Download a save */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                    sid: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description The save bundle zip. Its hex SHA-256 is in the X-Content-SHA256 header. */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/zip": string;
                    };
                };
                /** @description Missing or expired token. */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Not found, or you're not a member of this game. */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/mod/games": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Status for the in-game menu
         * @description The caller's unfinished games, each with its current turn and whether the caller can start or resume it.
         */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description The caller's games. */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ModGames"];
                    };
                };
                /** @description Missing or expired token. */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/turns/{id}/claim": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Start or resume a turn
         * @description Starts a waiting turn, or resumes your own active one (after a crash, quit or PC switch). Requires a player in the rotation and a running game. Strict order: only the turn's owner can claim. Open order: anyone except whoever played last. Claiming starts the wall clock; resuming doesn't pause or reset it.
         */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description The turn, its deadline, and which save to download. */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Claim"];
                    };
                };
                /** @description Missing or expired token. */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Signed in, but not allowed to do this. */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Not found, or you're not a member of this game. */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Conflicts with the game or turn's current state. */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/turns/{id}/heartbeat": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Heartbeat while playing
         * @description The mod calls this every minute while the turn's player is in the world, and uses the reply to resync its countdown. A 403/409 means the turn was skipped or expired; the mod then leaves the world without saving.
         */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Current deadline and server time. */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Heartbeat"];
                    };
                };
                /** @description Missing or expired token. */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Signed in, but not allowed to do this. */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Not found, or you're not a member of this game. */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Conflicts with the game or turn's current state. */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/turns/{id}/checkpoint": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        /**
         * Upload a checkpoint
         * @description A mid-turn save. If the turn expires without a final upload, its latest checkpoint is kept. Only the turn's player, while active and until the deadline plus grace.
         */
        put: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            /** @description A save bundle zip. Send its hex SHA-256 in the X-Content-SHA256 header to detect corruption. */
            requestBody: {
                content: {
                    "application/zip": string;
                };
            };
            responses: {
                /** @description Stored. */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Uploaded"];
                    };
                };
                /** @description The request was invalid. */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Missing or expired token. */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Signed in, but not allowed to do this. */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Not found, or you're not a member of this game. */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Conflicts with the game or turn's current state. */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Upload is too large. */
                413: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/turns/{id}/finish": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        /**
         * Upload the final save and end the turn
         * @description The upload becomes the next turn's starting save and the next turn opens. Only the turn's player, while active and until the deadline plus grace.
         */
        put: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            /** @description A save bundle zip. Send its hex SHA-256 in the X-Content-SHA256 header to detect corruption. */
            requestBody: {
                content: {
                    "application/zip": string;
                };
            };
            responses: {
                /** @description Stored; turn completed. */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Uploaded"];
                    };
                };
                /** @description The request was invalid. */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Missing or expired token. */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Signed in, but not allowed to do this. */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Not found, or you're not a member of this game. */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Conflicts with the game or turn's current state. */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Upload is too large. */
                413: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
}
export type webhooks = Record<string, never>;
export interface components {
    schemas: {
        /** @description Every error response has this shape. */
        Error: {
            /** @example It is not your turn yet */
            error: string;
        };
        Token: {
            token: string;
        };
        DevLoginRequest: {
            name: string;
        };
        Ok: {
            /** @enum {boolean} */
            ok: true;
        };
        User: {
            /** @example 3f6c2a9e-8d1b-4c7e-9a52-0f4e1d2b7c88 */
            id: string;
            /** @example Sam */
            displayName: string;
        };
        DeviceStart: {
            /** @description The mod's secret for polling. Never shown to the player. */
            deviceCode: string;
            /**
             * @description What the player types on the site.
             * @example KXQP-7M2R
             */
            userCode: string;
            /** @description Site page with the code pre-filled. */
            verifyUrl: string;
            /** @example 5 */
            intervalSeconds: number;
            /**
             * @description Seconds until the code expires.
             * @example 600
             */
            expiresIn: number;
        };
        DeviceApproveRequest: {
            /**
             * @description Case and dashes don't matter.
             * @example KXQP-7M2R
             */
            userCode: string;
        };
        DevicePoll: {
            /** @enum {string} */
            status: "pending";
        } | {
            /** @enum {string} */
            status: "approved";
            token: string;
            user: components["schemas"]["User"];
        };
        DevicePollRequest: {
            deviceCode: string;
        };
        GameSummary: components["schemas"]["Game"] & {
            role: components["schemas"]["Role"];
        };
        /** @enum {string} */
        GameStatus: "setup" | "running" | "paused" | "finished";
        /**
         * @description strict: fixed rotation. open: anyone except whoever played last.
         * @enum {string}
         */
        OrderMode: "strict" | "open";
        /** @enum {string} */
        Role: "admin" | "player";
        Game: {
            /** @example 3f6c2a9e-8d1b-4c7e-9a52-0f4e1d2b7c88 */
            id: string;
            name: string;
            status: components["schemas"]["GameStatus"];
            worldName: string;
            playerName: string;
            turnMinutes: number;
            orderMode: components["schemas"]["OrderMode"];
            startWindowHours: number | null;
            /**
             * @description The save the next turn starts from.
             * @example 3f6c2a9e-8d1b-4c7e-9a52-0f4e1d2b7c88
             */
            headSnapshotId: string | null;
            /**
             * Format: int64
             * @description Unix epoch milliseconds
             * @example 1763164800000
             */
            createdAt: number;
            /** @description Admins only. */
            inviteCode?: string | null;
            /** @description Admins only. */
            discordWebhookUrl?: string | null;
        };
        CreatedGame: {
            /** @example 3f6c2a9e-8d1b-4c7e-9a52-0f4e1d2b7c88 */
            id: string;
        };
        CreateGameRequest: {
            /** @example Moon Lord or Bust */
            name: string;
            /**
             * @description In-game world name.
             * @example Shared Isle
             */
            worldName: string;
            /**
             * @description In-game character name.
             * @example Hero
             */
            playerName: string;
            /** @default 60 */
            turnMinutes: number;
            orderMode?: components["schemas"]["OrderMode"];
            /**
             * @description Strict order: auto-skip a turn not started within this many hours. null = never.
             * @default 24
             */
            startWindowHours: number | null;
            /**
             * Format: uri
             * @default null
             */
            discordWebhookUrl: string | null;
        };
        GameDetail: {
            game: components["schemas"]["Game"];
            me: {
                /** @example 3f6c2a9e-8d1b-4c7e-9a52-0f4e1d2b7c88 */
                userId: string;
                role: components["schemas"]["Role"];
            };
            players: components["schemas"]["Player"][];
            /** @example 3f6c2a9e-8d1b-4c7e-9a52-0f4e1d2b7c88 */
            currentTurnId: string | null;
            /** @description Latest 100, newest first. */
            turns: components["schemas"]["Turn"][];
            /** @description Latest 100, newest first. */
            snapshots: (components["schemas"]["Snapshot"] & {
                /** @example 3f6c2a9e-8d1b-4c7e-9a52-0f4e1d2b7c88 */
                turnId: string | null;
            })[];
        };
        Player: {
            /** @example 3f6c2a9e-8d1b-4c7e-9a52-0f4e1d2b7c88 */
            userId: string;
            displayName: string;
            /** @description 0 goes first. */
            position: number;
            role: components["schemas"]["Role"];
            /** @description false = sitting out; skipped by the rotation. */
            active: boolean;
        };
        Turn: {
            /** @example 3f6c2a9e-8d1b-4c7e-9a52-0f4e1d2b7c88 */
            id: string;
            /** @description Turn number, starting at 1. */
            seq: number;
            status: components["schemas"]["TurnStatus"];
            /**
             * @description null while an open-order turn is unclaimed.
             * @example 3f6c2a9e-8d1b-4c7e-9a52-0f4e1d2b7c88
             */
            userId: string | null;
            userName: string | null;
            /**
             * Format: int64
             * @description Unix epoch milliseconds
             * @example 1763164800000
             */
            availableAt: number;
            /**
             * Format: int64
             * @description Unix epoch milliseconds
             * @example 1763164800000
             */
            claimedAt: number | null;
            /**
             * Format: int64
             * @description Unix epoch milliseconds
             * @example 1763164800000
             */
            deadlineAt: number | null;
            /**
             * Format: int64
             * @description Unix epoch milliseconds
             * @example 1763164800000
             */
            endedAt: number | null;
        };
        /** @enum {string} */
        TurnStatus: "waiting" | "active" | "completed" | "skipped" | "expired";
        /** @enum {string} */
        SnapshotKind: "initial" | "checkpoint" | "final";
        Snapshot: {
            /** @example 3f6c2a9e-8d1b-4c7e-9a52-0f4e1d2b7c88 */
            id: string;
            /** @description Hex SHA-256 of the zip. */
            sha256: string;
            /**
             * Format: int64
             * @description Bytes.
             */
            size: number;
            kind: components["schemas"]["SnapshotKind"];
            /**
             * Format: int64
             * @description Unix epoch milliseconds
             * @example 1763164800000
             */
            createdAt: number;
        };
        /** @description Only the fields sent are changed. */
        UpdateGameRequest: {
            /** @example Moon Lord or Bust */
            name?: string;
            /**
             * @description In-game world name.
             * @example Shared Isle
             */
            worldName?: string;
            /**
             * @description In-game character name.
             * @example Hero
             */
            playerName?: string;
            turnMinutes?: number;
            orderMode?: components["schemas"]["OrderMode"];
            /** @description Strict order: auto-skip a turn not started within this many hours. null = never. */
            startWindowHours?: number | null;
            /** Format: uri */
            discordWebhookUrl?: string | null;
            /** @enum {string} */
            status?: "running" | "paused" | "finished";
        };
        Invite: {
            inviteCode: string;
        };
        Joined: {
            /** @example 3f6c2a9e-8d1b-4c7e-9a52-0f4e1d2b7c88 */
            gameId: string;
        };
        OrderRequest: {
            /** @description Every player exactly once, first player first. */
            userIds: string[];
        };
        UpdatePlayerRequest: {
            active?: boolean;
            role?: components["schemas"]["Role"];
        };
        Uploaded: {
            snapshot: components["schemas"]["Snapshot"];
        };
        Started: {
            /** @example 3f6c2a9e-8d1b-4c7e-9a52-0f4e1d2b7c88 */
            turnId: string | null;
        };
        SkipRequest: {
            /**
             * @description For an active turn with a checkpoint: keep that checkpoint as the next turn's starting save.
             * @default true
             */
            keepProgress: boolean;
        };
        RollbackRequest: {
            /** @example 3f6c2a9e-8d1b-4c7e-9a52-0f4e1d2b7c88 */
            snapshotId: string;
        };
        ModGames: {
            /**
             * Format: int64
             * @description Server clock, so the mod can correct for drift.
             * @example 1763164800000
             */
            serverNow: number;
            user: components["schemas"]["User"];
            games: components["schemas"]["ModGame"][];
        };
        ModGame: {
            /** @example 3f6c2a9e-8d1b-4c7e-9a52-0f4e1d2b7c88 */
            id: string;
            name: string;
            status: components["schemas"]["GameStatus"];
            worldName: string;
            playerName: string;
            isAdmin: boolean;
            needsInitialSave: boolean;
            hasInitialSave: boolean;
            /** @description The caller can start or resume the current turn. */
            canClaim: boolean;
            currentTurn: components["schemas"]["Turn"] & (Record<string, never> | null);
        };
        Claim: {
            /** @example 3f6c2a9e-8d1b-4c7e-9a52-0f4e1d2b7c88 */
            gameId: string;
            turn: components["schemas"]["Turn"];
            /**
             * Format: int64
             * @description Unix epoch milliseconds
             * @example 1763164800000
             */
            deadlineAt: number;
            /**
             * Format: int64
             * @description How long after the deadline uploads are still accepted.
             */
            graceMs: number;
            /**
             * Format: int64
             * @description Unix epoch milliseconds
             * @example 1763164800000
             */
            serverNow: number;
            snapshot: components["schemas"]["Snapshot"] & unknown;
            resumed: boolean;
        };
        Heartbeat: {
            /**
             * Format: int64
             * @description Unix epoch milliseconds
             * @example 1763164800000
             */
            deadlineAt: number;
            /**
             * Format: int64
             * @description Unix epoch milliseconds
             * @example 1763164800000
             */
            serverNow: number;
        };
    };
    responses: never;
    parameters: never;
    requestBodies: never;
    headers: never;
    pathItems: never;
}
export type $defs = Record<string, never>;
export type operations = Record<string, never>;
