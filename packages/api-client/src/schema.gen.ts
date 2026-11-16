// Generated from apps/api/openapi.json by scripts/generate.mjs. Do not edit.
// Regenerate with `just api-openapi` (or `pnpm --filter @claimforge/api-client generate`).

export interface paths {
    "/healthz": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Liveness probe
         * @description The process is up. Never touches dependencies, so it can't cascade failures.
         */
        get: operations["healthz"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/readyz": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Readiness probe
         * @description Ready to serve traffic: the database answers a trivial query and storage is usable.
         */
        get: operations["readyz"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/auth/login": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Sign in with email and password */
        post: operations["login"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/auth/logout": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Sign out of this session */
        post: operations["logout"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/auth/refresh": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Exchange a refresh token for a new token pair */
        post: operations["refresh"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/invitations/accept": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Accept an invitation and sign in */
        post: operations["accept_invitation"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/me": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** The signed-in user and their organizations */
        get: operations["me"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/organizations": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List organizations */
        get: operations["list_organizations"];
        put?: never;
        /** Create an organization */
        post: operations["create_organization"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/organizations/{organization_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get an organization */
        get: operations["get_organization"];
        put?: never;
        post?: never;
        /** Delete an organization (soft delete) */
        delete: operations["delete_organization"];
        options?: never;
        head?: never;
        /** Update an organization */
        patch: operations["update_organization"];
        trace?: never;
    };
    "/v1/organizations/{organization_id}/audit-events": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Audit timeline for an organization */
        get: operations["list_audit_events"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/organizations/{organization_id}/claims": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List claims */
        get: operations["list_claims"];
        put?: never;
        /**
         * Create a claim
         * @description Give `property_id`, or an inline `property`; an inline address the organization already has reuses that property. The claim number is assigned here.
         */
        post: operations["create_claim"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/organizations/{organization_id}/claims/by-number/{number}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get a claim by its number */
        get: operations["get_claim_by_number"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/organizations/{organization_id}/claims/{claim_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get a claim */
        get: operations["get_claim"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        /**
         * Edit a claim's details
         * @description Omitted fields are unchanged; `null` clears an optional field. The number never changes, and status, property and contacts have their own endpoints.
         */
        patch: operations["update_claim"];
        trace?: never;
    };
    "/v1/organizations/{organization_id}/claims/{claim_id}/assignments": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Assign a member to a claim
         * @description Adjusters need `claims:write` in the organization; contractors and field technicians need `field_data:write`. A claim has one adjuster: assigning another replaces the current one.
         */
        post: operations["assign_claim_member"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/organizations/{organization_id}/claims/{claim_id}/assignments/{user_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        /** Unassign a member from a claim */
        delete: operations["unassign_claim_member"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/organizations/{organization_id}/claims/{claim_id}/contacts": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Link a contact to a claim */
        post: operations["link_claim_contact"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/organizations/{organization_id}/claims/{claim_id}/contacts/{contact_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        /** Unlink a contact from a claim */
        delete: operations["unlink_claim_contact"];
        options?: never;
        head?: never;
        /**
         * Change a contact's role on a claim
         * @description `is_primary: true` makes this the primary contact and demotes the previous one.
         */
        patch: operations["update_claim_contact"];
        trace?: never;
    };
    "/v1/organizations/{organization_id}/claims/{claim_id}/damage-items": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List a claim's damage items
         * @description Grouped by room, in the order the rooms were added.
         */
        get: operations["list_damage_items"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/organizations/{organization_id}/claims/{claim_id}/damage-items/{damage_item_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get a damage item */
        get: operations["get_damage_item"];
        put?: never;
        post?: never;
        /**
         * Delete a damage item
         * @description Needs `field_data:write`. Closed and cancelled claims are read-only (`claim_locked`).
         */
        delete: operations["delete_damage_item"];
        options?: never;
        head?: never;
        /**
         * Update or move a damage item
         * @description Needs `field_data:write`. Closed and cancelled claims are read-only (`claim_locked`).
         */
        patch: operations["update_damage_item"];
        trace?: never;
    };
    "/v1/organizations/{organization_id}/claims/{claim_id}/document-uploads": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Start attaching a document
         * @description Needs `field_data:write`. Describe the file; the response holds a link to send it to, with the method and headers to use (the link works for 30 minutes). Then complete the upload. The title defaults to the file name without its extension. Files larger than the limit are refused (`document_too_large`, with `limit`). Closed and cancelled claims are read-only (`claim_locked`).
         */
        post: operations["start_document_upload"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/organizations/{organization_id}/claims/{claim_id}/document-uploads/{upload_id}/complete": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Complete attaching a document
         * @description Call once the file is sent. The stored file must match the size and type that were described: if it doesn't, it is deleted (`upload_mismatch`) and can be sent again. Not sent yet: `upload_not_received`. Completing an upload that is already a document returns that document with 200, so retries are safe.
         */
        post: operations["complete_document_upload"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/organizations/{organization_id}/claims/{claim_id}/documents": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List a claim's documents
         * @description Newest first. Each document's links work for an hour. Filter by category: `category=estimate&category=invoice` finds either.
         */
        get: operations["list_documents"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/organizations/{organization_id}/claims/{claim_id}/documents/{document_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get a document, with fresh links */
        get: operations["get_document"];
        put?: never;
        post?: never;
        /**
         * Delete a document
         * @description Needs `field_data:write`. The file is deleted too.
         */
        delete: operations["delete_document"];
        options?: never;
        head?: never;
        /**
         * Rename or recategorize a document
         * @description Needs `field_data:write`. Only the fields sent change; neither can be null.
         */
        patch: operations["update_document"];
        trace?: never;
    };
    "/v1/organizations/{organization_id}/claims/{claim_id}/drying-log": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * The claim's drying log
         * @description The monitoring table: points down the side (grouped by room), visits across the top (oldest first), each point's value per visit, or null where it wasn't read. Then the air: outdoors, unaffected, rooms and dehumidifier exhausts, with grains per pound, dew point and each dehumidifier's grain depression. With `room_id`, only that room's points, air and dehumidifiers (with outdoors and unaffected to compare), and the visits that read something there.
         */
        get: operations["get_drying_log"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/organizations/{organization_id}/claims/{claim_id}/drying-status": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Drying status and alerts
         * @description How many points are dry, drying, without a goal or not read yet, and what needs attention: points read without a dry standard, points that stopped improving, a gap of over 24 hours in monitoring while points are still drying, and equipment still running in rooms where every point is dry (days a carrier won't pay for). Worked out from the current records each time.
         */
        get: operations["get_drying_status"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/organizations/{organization_id}/claims/{claim_id}/equipment-days": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Equipment-days by kind
         * @description What the claim's estimate bills: placements, units still running, and billable days per kind (every started 24 hours; running units counted up to now).
         */
        get: operations["get_equipment_days"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/organizations/{organization_id}/claims/{claim_id}/equipment-placements": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List a claim's equipment placements
         * @description In the order units were placed. `running=true` for what's on site now.
         */
        get: operations["list_equipment_placements"];
        put?: never;
        /**
         * Place equipment in a room
         * @description Needs `field_data:write`. The unit must be in service (`equipment_unavailable`) and not running elsewhere (`equipment_running`, with the claim's id and number). `placed_at` defaults to now and can be earlier, not later (`time_in_future`). Closed and cancelled claims are read-only (`claim_locked`).
         */
        post: operations["place_equipment"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/organizations/{organization_id}/claims/{claim_id}/equipment-placements/{placement_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        /**
         * Delete an equipment placement
         * @description For placements entered by mistake; they no longer count towards billing.
         */
        delete: operations["delete_equipment_placement"];
        options?: never;
        head?: never;
        /**
         * Correct an equipment placement
         * @description Only the fields sent change. `removed_at: null` puts a unit pulled by mistake back to running, if it isn't running elsewhere.
         */
        patch: operations["update_equipment_placement"];
        trace?: never;
    };
    "/v1/organizations/{organization_id}/claims/{claim_id}/equipment-placements/{placement_id}/remove": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Remove equipment
         * @description Records when the unit was pulled (default now). Works on closed claims too, so a unit is never stranded on a finished job. Already removed: `already_removed`.
         */
        post: operations["remove_equipment"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/organizations/{organization_id}/claims/{claim_id}/estimates": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List a claim's estimates
         * @description By number.
         */
        get: operations["list_estimates"];
        put?: never;
        /**
         * Start an estimate
         * @description Needs `estimates:write`. Numbered on the claim; priced from the organization's default list unless `price_list_id` says otherwise. Closed and cancelled claims are read-only (`claim_locked`).
         */
        post: operations["create_estimate"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/organizations/{organization_id}/claims/{claim_id}/estimates/{estimate_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get an estimate, with its lines */
        get: operations["get_estimate"];
        put?: never;
        post?: never;
        /**
         * Delete a draft estimate
         * @description Drafts only: what went to a carrier stays on record.
         */
        delete: operations["delete_estimate"];
        options?: never;
        head?: never;
        /**
         * Edit a draft estimate
         * @description Drafts only (`estimate_not_draft`). A new price list prices new lines; existing lines keep their prices.
         */
        patch: operations["update_estimate"];
        trace?: never;
    };
    "/v1/organizations/{organization_id}/claims/{claim_id}/estimates/{estimate_id}/lines": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Add a line
         * @description From a price item (`price_item_id`: its code, description, unit and price are copied) or by hand (`description`, `unit`, `unit_price`). `position` inserts it there; by default it goes last. Answers with the whole estimate.
         */
        post: operations["add_estimate_line"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/organizations/{organization_id}/claims/{claim_id}/estimates/{estimate_id}/lines/{line_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        /**
         * Delete a line
         * @description Later lines move up. Answers with the whole estimate.
         */
        delete: operations["delete_estimate_line"];
        options?: never;
        head?: never;
        /**
         * Edit a line
         * @description Only the fields sent change; `position` moves it. Answers with the whole estimate.
         */
        patch: operations["update_estimate_line"];
        trace?: never;
    };
    "/v1/organizations/{organization_id}/claims/{claim_id}/estimates/{estimate_id}/status": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Move an estimate along its workflow
         * @description draft → submitted (needs a line) → approved or rejected; submitted or rejected → draft to change it; approved → draft to reopen. Submitting, withdrawing and reworking need `estimates:write`; approving, rejecting and reopening need `estimates:approve`. Other moves: `estimate_transition`, with `allowed`.
         */
        post: operations["change_estimate_status"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/organizations/{organization_id}/claims/{claim_id}/moisture-logs": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List a claim's moisture logs
         * @description Monitoring visits, most recent first, each with its readings.
         */
        get: operations["list_moisture_logs"];
        put?: never;
        /**
         * Log moisture readings
         * @description Needs `field_data:write`. One visit: a reading for each point read, on the point's own scale, and the air (temperature and relative humidity) outdoors, in an unaffected area, in rooms and at dehumidifier exhausts. Either can be left out, not both. Grains per pound and dew point are calculated, assuming sea-level air pressure. `taken_at` defaults to now and can be earlier when readings are entered later, but not in the future (`taken_in_future`). Points, rooms and dehumidifier placements must be on this claim (`unknown_moisture_point`, `unknown_room`, `unknown_dehumidifier`).
         */
        post: operations["create_moisture_log"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/organizations/{organization_id}/claims/{claim_id}/moisture-logs/{log_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get a moisture log */
        get: operations["get_moisture_log"];
        put?: never;
        post?: never;
        /** Delete a moisture log and its readings */
        delete: operations["delete_moisture_log"];
        options?: never;
        head?: never;
        /**
         * Correct a moisture log
         * @description Only the fields sent change. Each entry in `readings` sets a point's value on this visit (adding it if the point wasn't read); `value: null` removes it. `atmosphere`, when sent, replaces the visit's atmospheric readings. A visit keeps at least one reading of either kind (`no_readings`): delete it instead.
         */
        patch: operations["update_moisture_log"];
        trace?: never;
    };
    "/v1/organizations/{organization_id}/claims/{claim_id}/moisture-points": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List a claim's moisture points
         * @description Room by room (in the order rooms were added), then by label: 2 before 10.
         */
        get: operations["list_moisture_points"];
        put?: never;
        /**
         * Map a moisture point
         * @description Needs `field_data:write`. The room must be on this claim (`unknown_room`). Without a label the point gets the next number; labels are unique on the claim (`label_taken`). Closed and cancelled claims are read-only (`claim_locked`).
         */
        post: operations["create_moisture_point"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/organizations/{organization_id}/claims/{claim_id}/moisture-points/{point_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get a moisture point */
        get: operations["get_moisture_point"];
        put?: never;
        post?: never;
        /** Delete a moisture point */
        delete: operations["delete_moisture_point"];
        options?: never;
        head?: never;
        /**
         * Edit a moisture point
         * @description Only the fields sent change. The scale can't change: readings taken on two scales don't compare, so map a new point instead.
         */
        patch: operations["update_moisture_point"];
        trace?: never;
    };
    "/v1/organizations/{organization_id}/claims/{claim_id}/notes": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List a claim's notes
         * @description Newest first.
         */
        get: operations["list_notes"];
        put?: never;
        /**
         * Write a note
         * @description Needs `field_data:write`. Mention members with `<@user-id>` tokens; anyone who isn't a member makes the request fail (`unknown_mention`). Closed and cancelled claims are read-only (`claim_locked`).
         */
        post: operations["create_note"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/organizations/{organization_id}/claims/{claim_id}/notes/{note_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        /**
         * Delete a note
         * @description The author or an admin (`claims:delete`) can delete a note.
         */
        delete: operations["delete_note"];
        options?: never;
        head?: never;
        /**
         * Edit a note
         * @description Only the author can edit a note (`not_note_author`). Mentions are re-read from the new body and `edited_at` is set; sending the same text changes nothing.
         */
        patch: operations["update_note"];
        trace?: never;
    };
    "/v1/organizations/{organization_id}/claims/{claim_id}/photo-uploads": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Start a photo upload
         * @description Needs `field_data:write`. Describe the file; the response holds a link to send it to, with the method and headers to use (the link works for 30 minutes). Then complete the upload. Caption, tags and room can be given now or edited later; a room must be on this claim (`unknown_room`). Photos larger than the limit are refused (`photo_too_large`, with `limit`). Closed and cancelled claims are read-only (`claim_locked`).
         */
        post: operations["start_photo_upload"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/organizations/{organization_id}/claims/{claim_id}/photo-uploads/{upload_id}/complete": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Complete a photo upload
         * @description Call once the file is sent. The stored file must match the size and type that were described: if it doesn't, it is deleted (`upload_mismatch`) and can be sent again. Not sent yet: `upload_not_received`. Completing an upload that is already a photo returns that photo with 200, so retries are safe.
         */
        post: operations["complete_photo_upload"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/organizations/{organization_id}/claims/{claim_id}/photos": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List a claim's photos
         * @description Newest first. Each photo's links work for an hour. Filter by `room_id`, by photos in no room (`unassigned=true`), or by tags: `tag=before&tag=ceiling` finds photos with both.
         */
        get: operations["list_photos"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/organizations/{organization_id}/claims/{claim_id}/photos/{photo_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get a photo, with fresh links */
        get: operations["get_photo"];
        put?: never;
        post?: never;
        /**
         * Delete a photo
         * @description Needs `field_data:write`. The file is deleted too.
         */
        delete: operations["delete_photo"];
        options?: never;
        head?: never;
        /**
         * Edit a photo's caption, tags or room
         * @description Needs `field_data:write`. Only the fields sent change: `room_id: null` takes the photo out of its room, `tags: []` removes every tag, a blank caption clears it. Tags are stored lowercase, without repeats, in alphabetical order.
         */
        patch: operations["update_photo"];
        trace?: never;
    };
    "/v1/organizations/{organization_id}/claims/{claim_id}/reports": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List a claim's reports
         * @description Newest first.
         */
        get: operations["list_reports"];
        put?: never;
        /**
         * Request a report
         * @description Needs `reports:generate`. The report is made in the background, from the organization's default template for the kind (or the built-in one), with the requester's access. Follow `Location` to poll, waiting `Retry-After` seconds between requests. Closed claims can have reports.
         */
        post: operations["request_report"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/organizations/{organization_id}/claims/{claim_id}/reports/{job_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get a report
         * @description While it's `queued` the answer carries `Retry-After`. When `ready` it has a `download_url`; when `failed`, the reason in `error`.
         */
        get: operations["get_report"];
        put?: never;
        post?: never;
        /**
         * Delete a report
         * @description Needs `reports:generate`. Deletes the PDF too; a queued report won't be made.
         */
        delete: operations["delete_report"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/organizations/{organization_id}/claims/{claim_id}/reports/{job_id}/shares": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List a report's links
         * @description Newest first, with how often each was opened. Links can't be shown again.
         */
        get: operations["list_report_shares"];
        put?: never;
        /**
         * Share a report by link
         * @description Needs `reports:generate`. A link to this ready report (`report_not_ready` otherwise) that works without signing in, for `expires_in_days` (1 to 30, default 7). The `url` is in this answer only: keep it or make another.
         */
        post: operations["share_report"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/organizations/{organization_id}/claims/{claim_id}/reports/{job_id}/shares/{share_id}/revoke": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Revoke a link
         * @description Needs `reports:generate`. The link stops working at once.
         */
        post: operations["revoke_report_share"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/organizations/{organization_id}/claims/{claim_id}/rooms/{room_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get a room */
        get: operations["get_room"];
        put?: never;
        post?: never;
        /**
         * Delete a room
         * @description Needs `field_data:write`. Closed and cancelled claims are read-only (`claim_locked`).
         */
        delete: operations["delete_room"];
        options?: never;
        head?: never;
        /**
         * Update or move a room
         * @description Only the fields sent change; `null` clears a dimension or the level. `structure_id` moves the room to another structure of the same claim. Needs `field_data:write`. Closed and cancelled claims are read-only (`claim_locked`).
         */
        patch: operations["update_room"];
        trace?: never;
    };
    "/v1/organizations/{organization_id}/claims/{claim_id}/rooms/{room_id}/damage-items": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Record damage in a room
         * @description Needs `field_data:write`. Closed and cancelled claims are read-only (`claim_locked`).
         */
        post: operations["create_damage_item"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/organizations/{organization_id}/claims/{claim_id}/status": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Change a claim's status
         * @description Moves along the status workflow; the claim's `next_statuses` lists where it can go. Putting a claim on hold, cancelling, reopening and reinstating need a `reason`. Reopening a closed claim or reinstating a cancelled one needs `claims:reopen`. Closed and cancelled claims are read-only until then.
         */
        post: operations["change_claim_status"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/organizations/{organization_id}/claims/{claim_id}/status-history": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** A claim's status changes, oldest first */
        get: operations["get_claim_status_history"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/organizations/{organization_id}/claims/{claim_id}/structures": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List a claim's structures and rooms
         * @description Structures and the rooms in each, in the order they were added.
         */
        get: operations["list_structures"];
        put?: never;
        /**
         * Add a structure
         * @description Names are unique per claim, ignoring case. Needs `field_data:write`. Closed and cancelled claims are read-only (`claim_locked`).
         */
        post: operations["create_structure"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/organizations/{organization_id}/claims/{claim_id}/structures/{structure_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        /**
         * Delete a structure and its rooms
         * @description Needs `field_data:write`. Closed and cancelled claims are read-only (`claim_locked`).
         */
        delete: operations["delete_structure"];
        options?: never;
        head?: never;
        /**
         * Rename a structure
         * @description Needs `field_data:write`. Closed and cancelled claims are read-only (`claim_locked`).
         */
        patch: operations["update_structure"];
        trace?: never;
    };
    "/v1/organizations/{organization_id}/claims/{claim_id}/structures/{structure_id}/rooms": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Add a room to a structure
         * @description Names are unique per structure, ignoring case. Dimensions are in feet, to the hundredth; floor area, wall area and volume are derived from them. Needs `field_data:write`. Closed and cancelled claims are read-only (`claim_locked`).
         */
        post: operations["create_room"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/organizations/{organization_id}/claims/{claim_id}/tasks": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List a claim's tasks
         * @description Open tasks first, then done ones; each group soonest due first, with tasks that have no due date last.
         */
        get: operations["list_tasks"];
        put?: never;
        /**
         * Add a task
         * @description Needs `field_data:write`. Closed and cancelled claims are read-only (`claim_locked`). The assignee must be a member who can do field work.
         */
        post: operations["create_task"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/organizations/{organization_id}/claims/{claim_id}/tasks/{task_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        /**
         * Delete a task
         * @description The creator or an admin (`claims:delete`) can delete a task.
         */
        delete: operations["delete_task"];
        options?: never;
        head?: never;
        /**
         * Update, reassign, complete or reopen a task
         * @description Needs `field_data:write`. Closed and cancelled claims are read-only (`claim_locked`). Anyone who can write may change any task on the claim.
         */
        patch: operations["update_task"];
        trace?: never;
    };
    "/v1/organizations/{organization_id}/claims/{claim_id}/timeline": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * A claim's timeline
         * @description Everything that happened on the claim and the records under it, newest first, each with a one-line summary. Needs `claims:read` (the raw audit log needs `audit:read`).
         */
        get: operations["claim_timeline"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/organizations/{organization_id}/contacts": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List contacts (alphabetical) */
        get: operations["list_contacts"];
        put?: never;
        /** Create a contact */
        post: operations["create_contact"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/organizations/{organization_id}/contacts/{contact_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get a contact */
        get: operations["get_contact"];
        put?: never;
        post?: never;
        /** Delete a contact (soft delete) */
        delete: operations["delete_contact"];
        options?: never;
        head?: never;
        /** Update a contact */
        patch: operations["update_contact"];
        trace?: never;
    };
    "/v1/organizations/{organization_id}/equipment": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List equipment
         * @description By asset tag.
         */
        get: operations["list_equipment"];
        put?: never;
        /**
         * Add equipment
         * @description Needs `field_data:write`. Asset tags are unique in the organization, ignoring case (`asset_tag_taken`).
         */
        post: operations["create_equipment"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/organizations/{organization_id}/equipment/{equipment_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get equipment */
        get: operations["get_equipment"];
        put?: never;
        post?: never;
        /**
         * Delete equipment
         * @description For units added by mistake; retire units that are leaving the fleet.
         */
        delete: operations["delete_equipment"];
        options?: never;
        head?: never;
        /**
         * Edit equipment
         * @description Only the fields sent change. Set `status` to `maintenance` while a unit is being repaired and `retired` when it leaves the fleet.
         */
        patch: operations["update_equipment"];
        trace?: never;
    };
    "/v1/organizations/{organization_id}/invitations": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List pending invitations */
        get: operations["list_invitations"];
        put?: never;
        /** Invite someone */
        post: operations["create_invitation"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/organizations/{organization_id}/invitations/{invitation_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        /** Revoke an invitation */
        delete: operations["revoke_invitation"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/organizations/{organization_id}/notes/mentioning-me": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Notes that mention me
         * @description Notes on the organization's claims that mention the signed-in member, newest first. Each note carries its claim's id and number.
         */
        get: operations["notes_mentioning_me"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/organizations/{organization_id}/photo-tags": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Tags in use on photos
         * @description The organization's photo tags with how many photos carry each, most used first: suggestions while someone types a tag.
         */
        get: operations["list_photo_tags"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/organizations/{organization_id}/price-lists": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List price lists
         * @description The default first, then by name.
         */
        get: operations["list_price_lists"];
        put?: never;
        /**
         * Create a price list
         * @description Needs `estimates:write`. Names are unique in the organization, ignoring case (`price_list_name_taken`). `is_default: true` takes over from the current default.
         */
        post: operations["create_price_list"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/organizations/{organization_id}/price-lists/{list_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get a price list */
        get: operations["get_price_list"];
        put?: never;
        post?: never;
        /** Delete a price list and its items */
        delete: operations["delete_price_list"];
        options?: never;
        head?: never;
        /** Edit a price list */
        patch: operations["update_price_list"];
        trace?: never;
    };
    "/v1/organizations/{organization_id}/price-lists/{list_id}/import": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Import items from CSV
         * @description Send the CSV as the request body (`text/csv`, UTF-8, up to 5 MB and 50,000 rows). The header row names the columns, in any order and case: `code`, `description`, `unit`, `unit_price` (or `price`) and optional `category`; others are ignored and listed back. Commas, semicolons or tabs; prices may be written `$1,234.50`. Every row is checked first: any problem (or a repeated code) answers `import_invalid` with `row_errors` by line, and nothing changes. `merge` adds new codes and updates changed ones; `replace` also removes codes the file doesn't have. `dry_run=true` reports what would happen without doing it.
         */
        post: operations["import_price_items"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/organizations/{organization_id}/price-lists/{list_id}/items": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List a price list's items
         * @description By code. `q` matches code or description; `category` filters exactly.
         */
        get: operations["list_price_items"];
        put?: never;
        /**
         * Add a price item
         * @description Needs `estimates:write`. Codes are unique in the list, ignoring case (`price_code_taken`). Prices are decimal strings to the cent.
         */
        post: operations["create_price_item"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/organizations/{organization_id}/price-lists/{list_id}/items/{item_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get a price item */
        get: operations["get_price_item"];
        put?: never;
        post?: never;
        /** Delete a price item */
        delete: operations["delete_price_item"];
        options?: never;
        head?: never;
        /** Edit a price item */
        patch: operations["update_price_item"];
        trace?: never;
    };
    "/v1/organizations/{organization_id}/properties": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List properties (newest first) */
        get: operations["list_properties"];
        put?: never;
        /**
         * Create a property
         * @description Returns 409 `property_exists`, with `existing_property_id`, when the organization already has a property at the same normalized address.
         */
        post: operations["create_property"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/organizations/{organization_id}/properties/{property_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get a property */
        get: operations["get_property"];
        put?: never;
        post?: never;
        /** Delete a property (soft delete) */
        delete: operations["delete_property"];
        options?: never;
        head?: never;
        /** Update a property */
        patch: operations["update_property"];
        trace?: never;
    };
    "/v1/organizations/{organization_id}/report-templates": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List report templates
         * @description By kind, each kind's default first.
         */
        get: operations["list_report_templates"];
        put?: never;
        /**
         * Create a report template
         * @description Needs `reports:generate`. Names are unique in the organization, ignoring case (`template_name_taken`); `options` are checked against the kind.
         */
        post: operations["create_report_template"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/organizations/{organization_id}/report-templates/effective": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * The template a kind of report uses
         * @description The kind's default template, or the built-in one (`built_in: true`) when none is set up.
         */
        get: operations["get_effective_report_template"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/organizations/{organization_id}/report-templates/{template_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get a report template */
        get: operations["get_report_template"];
        put?: never;
        post?: never;
        /** Delete a report template */
        delete: operations["delete_report_template"];
        options?: never;
        head?: never;
        /**
         * Edit a report template
         * @description Only the fields sent change; `options` replaces them all (left-out options go back to their defaults). The kind is fixed.
         */
        patch: operations["update_report_template"];
        trace?: never;
    };
    "/v1/organizations/{organization_id}/report-templates/{template_id}/logo": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        /**
         * Set a template's logo
         * @description Needs `reports:generate`. Send the image as the request body: PNG, JPEG or WebP, up to 2 MB. It's shrunk to fit 1200 by 600 pixels and stored as PNG; anything that isn't a readable image is refused (`logo_invalid`). Replaces any earlier logo.
         */
        put: operations["set_report_template_logo"];
        post?: never;
        /** Remove a template's logo */
        delete: operations["remove_report_template_logo"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/organizations/{organization_id}/search": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Search claims and contacts
         * @description Every word must appear, as a prefix, somewhere on a result: for a claim that includes its property, linked contacts and notes. Typing a claim number (ours or the carrier's) puts that claim first. Claims need `claims:read`, contacts `contacts:read`.
         */
        get: operations["search"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/organizations/{organization_id}/tasks/assigned-to-me": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Tasks assigned to me
         * @description Tasks on the organization's claims assigned to the signed-in member, soonest due first. Open tasks unless `status` says otherwise.
         */
        get: operations["tasks_assigned_to_me"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/shared-reports/{token}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Open a shared report
         * @description No sign-in: the link is the permission. Redirects to a download that works for five minutes. Expired, revoked and unknown links all answer 404.
         */
        get: operations["open_shared_report"];
        put?: never;
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
        /**
         * AddressInput
         * @description An address as typed. Validation normalizes it; errors name the offending field.
         */
        AddressInput: {
            /** City */
            city: string;
            /**
             * Country
             * @default US
             */
            country?: string;
            /** Line1 */
            line1: string;
            /** Line2 */
            line2?: string | null;
            /** Postal Code */
            postal_code?: string | null;
            /** Region */
            region?: string | null;
        };
        /** AddressRead */
        AddressRead: {
            /** City */
            city: string;
            /** Country */
            country: string;
            /**
             * Formatted
             * @description One line, e.g. "123 N Main St Apt 4B, Austin, TX 78701"
             */
            formatted: string;
            /** Line1 */
            line1: string;
            /** Line2 */
            line2: string | null;
            /** Postal Code */
            postal_code: string | null;
            /** Region */
            region: string | null;
        };
        /** AlertEquipment */
        AlertEquipment: {
            /** Asset Tag */
            asset_tag: string;
            /**
             * Placement Id
             * Format: uuid
             */
            placement_id: string;
        };
        /**
         * AlertKind
         * @enum {string}
         */
        AlertKind: "no_goal" | "stalled" | "monitoring_gap" | "equipment_in_dry_room";
        /** AlertPoint */
        AlertPoint: {
            /**
             * Id
             * Format: uuid
             */
            id: string;
            /** Label */
            label: string;
        };
        /**
         * AssignmentRole
         * @description What a member does on a claim. A claim has at most one adjuster.
         * @enum {string}
         */
        AssignmentRole: "adjuster" | "contractor" | "field_technician";
        /**
         * AtmosphereIn
         * @description One place's air. ``room_id`` for a room; ``placement_id`` for a dehumidifier's exhaust.
         */
        AtmosphereIn: {
            location: components["schemas"]["AtmosphereLocation"];
            /**
             * Placement Id
             * @description With `location: dehumidifier`: the unit's placement
             */
            placement_id?: string | null;
            /**
             * Relative Humidity
             * @description Relative humidity in percent, to a tenth
             * @example 55
             */
            relative_humidity: number;
            /**
             * Room Id
             * @description With `location: room`
             */
            room_id?: string | null;
            /**
             * Temperature F
             * @description Degrees Fahrenheit, to a tenth
             * @example 72.5
             */
            temperature_f: number;
        };
        /**
         * AtmosphereLocation
         * @description Where the air was read. Comparing them is what shows drying working.
         * @enum {string}
         */
        AtmosphereLocation: "outdoors" | "unaffected" | "room" | "dehumidifier";
        /** AtmosphereRead */
        AtmosphereRead: {
            dehumidifier: components["schemas"]["AtmosphereUnit"] | null;
            /**
             * Dew Point F
             * @description Null for bone-dry air (0% RH)
             */
            dew_point_f: number | null;
            /**
             * Grains Per Pound
             * @description Grains of water per pound of dry air
             */
            grains_per_pound: number;
            location: components["schemas"]["AtmosphereLocation"];
            /**
             * Relative Humidity
             * @description Relative humidity in percent, to a tenth
             * @example 55
             */
            relative_humidity: number;
            room: components["schemas"]["AtmosphereRoom"] | null;
            /**
             * Temperature F
             * @description Degrees Fahrenheit, to a tenth
             * @example 72.5
             */
            temperature_f: number;
        };
        /** AtmosphereRoom */
        AtmosphereRoom: {
            /**
             * Id
             * Format: uuid
             */
            id: string;
            /** Name */
            name: string;
        };
        /** AtmosphereUnit */
        AtmosphereUnit: {
            /** Asset Tag */
            asset_tag: string;
            /**
             * Placement Id
             * Format: uuid
             */
            placement_id: string;
        };
        /** AuditActor */
        AuditActor: {
            /** Full Name */
            full_name: string;
            /**
             * Id
             * Format: uuid
             */
            id: string;
        };
        /** AuditEventRead */
        AuditEventRead: {
            /** Action */
            action: string;
            actor: components["schemas"]["AuditActor"] | null;
            /** Changes */
            changes: {
                [key: string]: unknown;
            };
            /**
             * Created At
             * Format: date-time
             */
            created_at: string;
            /**
             * Entity Id
             * Format: uuid
             */
            entity_id: string;
            /** Entity Type */
            entity_type: string;
            /**
             * Id
             * Format: uuid
             */
            id: string;
            /** Request Id */
            request_id: string | null;
        };
        /**
         * CapacityUnit
         * @enum {string}
         */
        CapacityUnit: "pints_per_day" | "cfm" | "btu_per_hour";
        /** ClaimActor */
        ClaimActor: {
            /** Full Name */
            full_name: string;
            /**
             * Id
             * Format: uuid
             */
            id: string;
        };
        /**
         * ClaimAssignmentCreate
         * @description Assign a member to a claim. Assigning an adjuster replaces the current one.
         */
        ClaimAssignmentCreate: {
            role: components["schemas"]["AssignmentRole"];
            /**
             * User Id
             * Format: uuid
             */
            user_id: string;
        };
        /** ClaimAssignmentRead */
        ClaimAssignmentRead: {
            /**
             * Assigned At
             * Format: date-time
             */
            assigned_at: string;
            /** Assigned By Id */
            assigned_by_id: string | null;
            role: components["schemas"]["AssignmentRole"];
            user: components["schemas"]["ClaimActor"];
        };
        /** ClaimContactLink */
        ClaimContactLink: {
            /**
             * Contact Id
             * Format: uuid
             */
            contact_id: string;
            /**
             * Is Primary
             * @default false
             */
            is_primary?: boolean;
            role: components["schemas"]["ClaimContactRole"];
        };
        /**
         * ClaimContactLinkUpdate
         * @description Change a contact's role on a claim, or whether they are the primary contact.
         *
         *     Promoting a contact to primary demotes the previous primary contact.
         */
        ClaimContactLinkUpdate: {
            /** Is Primary */
            is_primary?: boolean | null;
            role?: components["schemas"]["ClaimContactRole"] | null;
        };
        /** ClaimContactRead */
        ClaimContactRead: {
            contact: components["schemas"]["ContactRead"];
            /** Is Primary */
            is_primary: boolean;
            role: components["schemas"]["ClaimContactRole"];
        };
        /**
         * ClaimContactRole
         * @enum {string}
         */
        ClaimContactRole: "insured" | "co_insured" | "tenant" | "property_manager" | "public_adjuster" | "insurance_agent" | "carrier_adjuster" | "other";
        /**
         * ClaimCreate
         * @description Give either ``property_id`` or an inline ``property``.
         *
         *     An inline property at an address the organization already has reuses that property.
         */
        ClaimCreate: {
            /** Carrier Claim Number */
            carrier_claim_number?: string | null;
            /** Carrier Name */
            carrier_name?: string | null;
            /** Contacts */
            contacts?: components["schemas"]["ClaimContactLink"][];
            /** Description */
            description?: string | null;
            /** Loss Date */
            loss_date?: string | null;
            loss_type: components["schemas"]["LossType"];
            /** Policy Number */
            policy_number?: string | null;
            property?: components["schemas"]["PropertyCreate"] | null;
            /** Property Id */
            property_id?: string | null;
        };
        /** ClaimHit */
        ClaimHit: {
            claim: components["schemas"]["ClaimSummary"];
            /**
             * Matched In
             * @description Where any of the words were found: on the claim itself, its property, a linked contact or a note
             */
            matched_in: components["schemas"]["MatchedIn"][];
        };
        /** ClaimRead */
        ClaimRead: {
            /** Assignments */
            assignments: components["schemas"]["ClaimAssignmentRead"][];
            /** Carrier Claim Number */
            carrier_claim_number: string | null;
            /** Carrier Name */
            carrier_name: string | null;
            /** Contacts */
            contacts: components["schemas"]["ClaimContactRead"][];
            /**
             * Created At
             * Format: date-time
             */
            created_at: string;
            /** Created By Id */
            created_by_id: string | null;
            /** Description */
            description: string | null;
            /**
             * Id
             * Format: uuid
             */
            id: string;
            /** Loss Date */
            loss_date: string | null;
            loss_type: components["schemas"]["LossType"];
            /**
             * Next Statuses
             * @description Statuses the workflow allows next. Leaving `closed` or `cancelled` also needs the `claims:reopen` permission.
             */
            readonly next_statuses: components["schemas"]["ClaimStatus"][];
            /**
             * Number
             * @description Unique per organization, e.g. "2026-00042"
             */
            number: string;
            /** Policy Number */
            policy_number: string | null;
            property: components["schemas"]["PropertyRead"];
            status: components["schemas"]["ClaimStatus"];
            /**
             * Updated At
             * Format: date-time
             */
            updated_at: string;
        };
        /**
         * ClaimRef
         * @description Enough to link to a claim from a record shown outside it (a note, a task).
         */
        ClaimRef: {
            /**
             * Id
             * Format: uuid
             */
            id: string;
            /** Number */
            number: string;
        };
        /**
         * ClaimSort
         * @description Sort orders for the claim list. A leading "-" means newest/latest first.
         * @enum {string}
         */
        ClaimSort: "-created_at" | "created_at" | "-updated_at" | "-loss_date" | "loss_date";
        /**
         * ClaimStatus
         * @description Lifecycle states. Which transitions are allowed is defined by the status workflow.
         * @enum {string}
         */
        ClaimStatus: "new" | "inspected" | "in_progress" | "on_hold" | "completed" | "closed" | "cancelled";
        /**
         * ClaimStatusChangeCreate
         * @description Move a claim to another status (see ``claims.workflow`` for the allowed moves).
         */
        ClaimStatusChangeCreate: {
            /** @description The status the client last saw. If the claim has moved on since, the change is refused with 409 `status_changed` instead of acting on a stale view. */
            expected_status?: components["schemas"]["ClaimStatus"] | null;
            /**
             * Reason
             * @description Required to put a claim on hold, cancel it, or reopen or reinstate it
             */
            reason?: string | null;
            status: components["schemas"]["ClaimStatus"];
        };
        /** ClaimStatusChangeRead */
        ClaimStatusChangeRead: {
            /**
             * Changed At
             * Format: date-time
             */
            changed_at: string;
            /** @description None once the user is deleted */
            changed_by: components["schemas"]["ClaimActor"] | null;
            from_status: components["schemas"]["ClaimStatus"];
            /**
             * Id
             * Format: uuid
             */
            id: string;
            /** Reason */
            reason: string | null;
            to_status: components["schemas"]["ClaimStatus"];
        };
        /**
         * ClaimSummary
         * @description A claim as the list shows it: the property, the person to call first and who owns it.
         */
        ClaimSummary: {
            adjuster: components["schemas"]["ClaimActor"] | null;
            /** Carrier Claim Number */
            carrier_claim_number: string | null;
            /** Carrier Name */
            carrier_name: string | null;
            /**
             * Created At
             * Format: date-time
             */
            created_at: string;
            /**
             * Id
             * Format: uuid
             */
            id: string;
            /** Loss Date */
            loss_date: string | null;
            loss_type: components["schemas"]["LossType"];
            /** Number */
            number: string;
            /** Policy Number */
            policy_number: string | null;
            primary_contact: components["schemas"]["ClaimContactRead"] | null;
            property: components["schemas"]["PropertyRead"];
            status: components["schemas"]["ClaimStatus"];
            /**
             * Updated At
             * Format: date-time
             */
            updated_at: string;
        };
        /**
         * ClaimUpdate
         * @description Partial update: omitted fields are unchanged, ``null`` (or "") clears optional ones.
         *
         *     The number never changes; status, property and contacts have their own operations.
         */
        ClaimUpdate: {
            /** Carrier Claim Number */
            carrier_claim_number?: string | null;
            /** Carrier Name */
            carrier_name?: string | null;
            /** Description */
            description?: string | null;
            /** Loss Date */
            loss_date?: string | null;
            loss_type?: components["schemas"]["LossType"] | null;
            /** Policy Number */
            policy_number?: string | null;
        };
        /** ContactCreate */
        ContactCreate: {
            /** Company Name */
            company_name?: string | null;
            /** Email */
            email?: string | null;
            /** Full Name */
            full_name: string;
            /** @default policyholder */
            kind?: components["schemas"]["ContactKind"];
            /** Notes */
            notes?: string | null;
            /** Phone */
            phone?: string | null;
            preferred_contact_method?: components["schemas"]["ContactMethod"] | null;
        };
        /** ContactHit */
        ContactHit: {
            contact: components["schemas"]["ContactRead"];
        };
        /**
         * ContactKind
         * @description Who the contact usually is. A claim records each contact's role on that claim.
         * @enum {string}
         */
        ContactKind: "policyholder" | "tenant" | "property_manager" | "public_adjuster" | "insurance_agent" | "carrier_adjuster" | "contractor" | "other";
        /**
         * ContactMethod
         * @enum {string}
         */
        ContactMethod: "email" | "phone" | "text";
        /** ContactRead */
        ContactRead: {
            /** Company Name */
            company_name: string | null;
            /**
             * Created At
             * Format: date-time
             */
            created_at: string;
            /** Email */
            email: string | null;
            /** Full Name */
            full_name: string;
            /**
             * Id
             * Format: uuid
             */
            id: string;
            kind: components["schemas"]["ContactKind"];
            /** Notes */
            notes: string | null;
            /** Phone */
            phone: string | null;
            preferred_contact_method: components["schemas"]["ContactMethod"] | null;
            /**
             * Updated At
             * Format: date-time
             */
            updated_at: string;
        };
        /**
         * ContactUpdate
         * @description Partial update: omitted fields are unchanged, ``null`` (or "") clears optional ones.
         */
        ContactUpdate: {
            /** Company Name */
            company_name?: string | null;
            /** Email */
            email?: string | null;
            /** Full Name */
            full_name?: string | null;
            kind?: components["schemas"]["ContactKind"] | null;
            /** Notes */
            notes?: string | null;
            /** Phone */
            phone?: string | null;
            preferred_contact_method?: components["schemas"]["ContactMethod"] | null;
        };
        /** CurrentPlacement */
        CurrentPlacement: {
            claim: components["schemas"]["ClaimRef"];
            /**
             * Id
             * Format: uuid
             */
            id: string;
            /**
             * Placed At
             * Format: date-time
             */
            placed_at: string;
            /**
             * Room Id
             * Format: uuid
             */
            room_id: string;
        };
        /** CursorPage[AuditEventRead] */
        CursorPage_AuditEventRead_: {
            /** Has More */
            has_more: boolean;
            /** Items */
            items: components["schemas"]["AuditEventRead"][];
            /** Next Cursor */
            next_cursor: string | null;
        };
        /** CursorPage[ClaimSummary] */
        CursorPage_ClaimSummary_: {
            /** Has More */
            has_more: boolean;
            /** Items */
            items: components["schemas"]["ClaimSummary"][];
            /** Next Cursor */
            next_cursor: string | null;
        };
        /** CursorPage[ContactRead] */
        CursorPage_ContactRead_: {
            /** Has More */
            has_more: boolean;
            /** Items */
            items: components["schemas"]["ContactRead"][];
            /** Next Cursor */
            next_cursor: string | null;
        };
        /** CursorPage[DocumentRead] */
        CursorPage_DocumentRead_: {
            /** Has More */
            has_more: boolean;
            /** Items */
            items: components["schemas"]["DocumentRead"][];
            /** Next Cursor */
            next_cursor: string | null;
        };
        /** CursorPage[EquipmentRead] */
        CursorPage_EquipmentRead_: {
            /** Has More */
            has_more: boolean;
            /** Items */
            items: components["schemas"]["EquipmentRead"][];
            /** Next Cursor */
            next_cursor: string | null;
        };
        /** CursorPage[MoistureLogRead] */
        CursorPage_MoistureLogRead_: {
            /** Has More */
            has_more: boolean;
            /** Items */
            items: components["schemas"]["MoistureLogRead"][];
            /** Next Cursor */
            next_cursor: string | null;
        };
        /** CursorPage[NoteRead] */
        CursorPage_NoteRead_: {
            /** Has More */
            has_more: boolean;
            /** Items */
            items: components["schemas"]["NoteRead"][];
            /** Next Cursor */
            next_cursor: string | null;
        };
        /** CursorPage[OrganizationRead] */
        CursorPage_OrganizationRead_: {
            /** Has More */
            has_more: boolean;
            /** Items */
            items: components["schemas"]["OrganizationRead"][];
            /** Next Cursor */
            next_cursor: string | null;
        };
        /** CursorPage[PhotoRead] */
        CursorPage_PhotoRead_: {
            /** Has More */
            has_more: boolean;
            /** Items */
            items: components["schemas"]["PhotoRead"][];
            /** Next Cursor */
            next_cursor: string | null;
        };
        /** CursorPage[PriceItemRead] */
        CursorPage_PriceItemRead_: {
            /** Has More */
            has_more: boolean;
            /** Items */
            items: components["schemas"]["PriceItemRead"][];
            /** Next Cursor */
            next_cursor: string | null;
        };
        /** CursorPage[PropertyRead] */
        CursorPage_PropertyRead_: {
            /** Has More */
            has_more: boolean;
            /** Items */
            items: components["schemas"]["PropertyRead"][];
            /** Next Cursor */
            next_cursor: string | null;
        };
        /** CursorPage[TaskRead] */
        CursorPage_TaskRead_: {
            /** Has More */
            has_more: boolean;
            /** Items */
            items: components["schemas"]["TaskRead"][];
            /** Next Cursor */
            next_cursor: string | null;
        };
        /** CursorPage[TimelineEntry] */
        CursorPage_TimelineEntry_: {
            /** Has More */
            has_more: boolean;
            /** Items */
            items: components["schemas"]["TimelineEntry"][];
            /** Next Cursor */
            next_cursor: string | null;
        };
        /**
         * DamageItemCreate
         * @description One damaged material in a room. Water category and class apply only to water, flood, sewage and storm damage. Sewage and flood water are always Category 3, which is the default for them.
         */
        DamageItemCreate: {
            /** @description Defaults to the claim's loss type */
            cause?: components["schemas"]["LossType"] | null;
            /**
             * Description
             * @example Wet to 24 in. along the north wall
             */
            description?: string | null;
            /**
             * Material
             * @example Drywall
             */
            material: string;
            surface: components["schemas"]["Surface"];
            /** Water Category */
            water_category?: number | null;
            /** Water Class */
            water_class?: number | null;
        };
        /** DamageItemRead */
        DamageItemRead: {
            cause: components["schemas"]["LossType"];
            /**
             * Created At
             * Format: date-time
             */
            created_at: string;
            /** Created By Id */
            created_by_id: string | null;
            /** Description */
            description: string | null;
            /**
             * Id
             * Format: uuid
             */
            id: string;
            /** Material */
            material: string;
            /**
             * Room Id
             * Format: uuid
             */
            room_id: string;
            surface: components["schemas"]["Surface"];
            /**
             * Updated At
             * Format: date-time
             */
            updated_at: string;
            /** Water Category */
            water_category: number | null;
            /** Water Class */
            water_class: number | null;
        };
        /**
         * DamageItemUpdate
         * @description Only the fields sent change; `null` clears the description or a water detail. `room_id` moves the item to another room of the claim. Water category and class apply only to water, flood, sewage and storm damage. Sewage and flood water are always Category 3, which is the default for them.
         */
        DamageItemUpdate: {
            cause?: components["schemas"]["LossType"] | null;
            /** Description */
            description?: string | null;
            /** Material */
            material?: string | null;
            /** Room Id */
            room_id?: string | null;
            surface?: components["schemas"]["Surface"] | null;
            /** Water Category */
            water_category?: number | null;
            /** Water Class */
            water_class?: number | null;
        };
        /**
         * DocumentCategory
         * @enum {string}
         */
        DocumentCategory: "authorization" | "correspondence" | "estimate" | "invoice" | "policy" | "report" | "other";
        /** DocumentRead */
        DocumentRead: {
            category: components["schemas"]["DocumentCategory"];
            /**
             * Claim Id
             * Format: uuid
             */
            claim_id: string;
            content_type: components["schemas"]["DocumentType"];
            /**
             * Created At
             * Format: date-time
             * @description When the upload was completed
             */
            created_at: string;
            /**
             * Download Url
             * @description Saves the file under its name; works for an hour.
             */
            download_url: string;
            /** Filename */
            filename: string;
            /**
             * Id
             * Format: uuid
             */
            id: string;
            /** Size Bytes */
            size_bytes: number;
            /** Title */
            title: string;
            /**
             * Updated At
             * Format: date-time
             */
            updated_at: string;
            /** @description Null once the account is gone */
            uploaded_by: components["schemas"]["ClaimActor"] | null;
            /**
             * View Url
             * @description Opens PDFs, text and images in the browser; works for an hour. Null for types browsers can't show (Word, Excel, CSV, email): use `download_url`.
             */
            view_url: string | null;
        };
        /**
         * DocumentType
         * @description What can be attached. Nothing a browser would run as a page (no HTML, no SVG).
         * @enum {string}
         */
        DocumentType: "application/pdf" | "application/msword" | "application/vnd.openxmlformats-officedocument.wordprocessingml.document" | "application/vnd.ms-excel" | "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" | "text/csv" | "text/plain" | "message/rfc822" | "image/jpeg" | "image/png" | "image/webp" | "image/heic";
        /**
         * DocumentUpdate
         * @description Only the fields sent change.
         */
        DocumentUpdate: {
            category?: components["schemas"]["DocumentCategory"] | null;
            /** Title */
            title?: string | null;
        };
        /**
         * DocumentUploadCreate
         * @description What the client is about to upload. The stored file must match it.
         */
        DocumentUploadCreate: {
            /** @default other */
            category?: components["schemas"]["DocumentCategory"];
            content_type: components["schemas"]["DocumentType"];
            /**
             * Filename
             * @description The file's name; downloads use it.
             * @example WA-1042 signed.pdf
             */
            filename: string;
            /**
             * Size Bytes
             * @description Exact size of the file in bytes.
             */
            size_bytes: number;
            /**
             * Title
             * @description Defaults to the file name without its extension.
             */
            title?: string | null;
        };
        /** DocumentUploadRead */
        DocumentUploadRead: {
            /**
             * Id
             * Format: uuid
             * @description Also the id of the document once the upload is completed.
             */
            id: string;
            upload: components["schemas"]["SignedUploadRead"];
        };
        /** DryingAlert */
        DryingAlert: {
            /** Details */
            details: {
                [key: string]: number;
            };
            equipment: components["schemas"]["AlertEquipment"] | null;
            /** @description `no_goal`: read but no dry standard; `stalled`: no improvement over the last 3 readings; `monitoring_gap`: still drying, not read for over 24 hours; `equipment_in_dry_room`: equipment running where every point is dry */
            kind: components["schemas"]["AlertKind"];
            /** Message */
            message: string;
            point: components["schemas"]["AlertPoint"] | null;
            room: components["schemas"]["AtmosphereRoom"] | null;
            /**
             * Since
             * @description Since when it holds, where that's known
             */
            since: string | null;
        };
        /**
         * DryingLog
         * @description The monitoring table: points down the side, visits across the top.
         */
        DryingLog: {
            /**
             * Atmosphere
             * @description Outdoors, unaffected, rooms, then dehumidifiers
             */
            atmosphere: components["schemas"]["DryingLogAir"][];
            /**
             * Rooms
             * @description Rooms with points, in the points' order
             */
            rooms: components["schemas"]["DryingLogRoom"][];
            /**
             * Visits
             * @description Oldest first
             */
            visits: components["schemas"]["DryingLogVisit"][];
        };
        /** DryingLogAir */
        DryingLogAir: {
            dehumidifier: components["schemas"]["AtmosphereUnit"] | null;
            location: components["schemas"]["AtmosphereLocation"];
            room: components["schemas"]["AtmosphereRoom"] | null;
            /**
             * Values
             * @description One per visit, in the visits' order; null where it wasn't read
             */
            values: (components["schemas"]["DryingLogAirValue"] | null)[];
        };
        /** DryingLogAirValue */
        DryingLogAirValue: {
            /** Dew Point F */
            dew_point_f: number | null;
            /**
             * Grain Depression
             * @description Dehumidifiers: the room's GPP minus the exhaust's on this visit; null without a room reading. Low or negative: the unit isn't pulling water out.
             */
            grain_depression: number | null;
            /** Grains Per Pound */
            grains_per_pound: number;
            /**
             * Relative Humidity
             * @description Relative humidity in percent, to a tenth
             * @example 55
             */
            relative_humidity: number;
            /**
             * Temperature F
             * @description Degrees Fahrenheit, to a tenth
             * @example 72.5
             */
            temperature_f: number;
        };
        /** DryingLogPoint */
        DryingLogPoint: {
            /**
             * Dried At
             * @description When the point's current run of dry readings began
             */
            dried_at: string | null;
            /** Dry Standard */
            dry_standard: number | null;
            dry_standard_basis: components["schemas"]["GoalBasis"] | null;
            /**
             * Id
             * Format: uuid
             */
            id: string;
            /** Label */
            label: string;
            /** Material */
            material: string;
            scale: components["schemas"]["MoistureScale"];
            /** @description `dry`: latest reading at or below the goal; `drying`; `no_goal`; `not_read` */
            status: components["schemas"]["DryingStatus"];
            surface: components["schemas"]["Surface"];
            /**
             * Values
             * @description One per visit, in the visits' order; null where the point wasn't read
             */
            values: (number | null)[];
        };
        /** DryingLogRoom */
        DryingLogRoom: {
            /**
             * Id
             * Format: uuid
             */
            id: string;
            /** Name */
            name: string;
            /** Points */
            points: components["schemas"]["DryingLogPoint"][];
        };
        /** DryingLogVisit */
        DryingLogVisit: {
            /**
             * Id
             * Format: uuid
             */
            id: string;
            /**
             * Taken At
             * Format: date-time
             */
            taken_at: string;
            taken_by: components["schemas"]["ClaimActor"] | null;
        };
        /** DryingReportOptions */
        DryingReportOptions: {
            /**
             * Include Alerts
             * @default true
             */
            include_alerts?: boolean;
            /**
             * Include Atmosphere
             * @default true
             */
            include_atmosphere?: boolean;
            /**
             * Include Equipment
             * @default true
             */
            include_equipment?: boolean;
        };
        /**
         * DryingStatus
         * @enum {string}
         */
        DryingStatus: "dry" | "drying" | "no_goal" | "not_read";
        /** DryingStatusRead */
        DryingStatusRead: {
            /** Alerts */
            alerts: components["schemas"]["DryingAlert"][];
            summary: components["schemas"]["DryingSummary"];
        };
        /** DryingSummary */
        DryingSummary: {
            /**
             * All Dry
             * @description There are points, and every one is dry
             */
            all_dry: boolean;
            /** Dry */
            dry: number;
            /** Drying */
            drying: number;
            /** Last Visit At */
            last_visit_at: string | null;
            /** No Goal */
            no_goal: number;
            /** Not Read */
            not_read: number;
            /** Points */
            points: number;
        };
        /** EquipmentCreate */
        EquipmentCreate: {
            /**
             * Asset Tag
             * @description As printed on the unit; unique in the organization.
             * @example D-12
             */
            asset_tag: string;
            /**
             * Capacity
             * @description Pints per day for dehumidifiers, CFM for desiccants, air movers and scrubbers, BTU per hour for heaters (see `capacity_unit`).
             */
            capacity?: number | null;
            kind: components["schemas"]["EquipmentKind"];
            /**
             * Name
             * @example Phoenix 200 MAX
             */
            name: string;
            /** Notes */
            notes?: string | null;
            /** Serial Number */
            serial_number?: string | null;
            /** @default in_service */
            status?: components["schemas"]["EquipmentStatus"];
        };
        /**
         * EquipmentDays
         * @description A claim's equipment use for one kind: what estimates bill.
         */
        EquipmentDays: {
            /**
             * Days
             * @description Billable days, running placements counted up to now
             */
            days: number;
            kind: components["schemas"]["EquipmentKind"];
            /** Placements */
            placements: number;
            /**
             * Running
             * @description Placements still running
             */
            running: number;
        };
        /**
         * EquipmentKind
         * @enum {string}
         */
        EquipmentKind: "dehumidifier" | "desiccant_dehumidifier" | "air_mover" | "air_scrubber" | "heater" | "other";
        /** EquipmentRead */
        EquipmentRead: {
            /** Asset Tag */
            asset_tag: string;
            /** Capacity */
            capacity: number | null;
            /** @description Set by the kind */
            capacity_unit: components["schemas"]["CapacityUnit"] | null;
            /**
             * Created At
             * Format: date-time
             */
            created_at: string;
            /** @description Where it's running now */
            current_placement: components["schemas"]["CurrentPlacement"] | null;
            /**
             * Id
             * Format: uuid
             */
            id: string;
            kind: components["schemas"]["EquipmentKind"];
            /** Name */
            name: string;
            /** Notes */
            notes: string | null;
            /** Serial Number */
            serial_number: string | null;
            status: components["schemas"]["EquipmentStatus"];
            /**
             * Updated At
             * Format: date-time
             */
            updated_at: string;
        };
        /**
         * EquipmentStatus
         * @enum {string}
         */
        EquipmentStatus: "in_service" | "maintenance" | "retired";
        /**
         * EquipmentUpdate
         * @description Only the fields sent change.
         */
        EquipmentUpdate: {
            /** Asset Tag */
            asset_tag?: string | null;
            /**
             * Capacity
             * @description Pints per day for dehumidifiers, CFM for desiccants, air movers and scrubbers, BTU per hour for heaters (see `capacity_unit`).
             */
            capacity?: number | null;
            kind?: components["schemas"]["EquipmentKind"] | null;
            /** Name */
            name?: string | null;
            /** Notes */
            notes?: string | null;
            /** Serial Number */
            serial_number?: string | null;
            status?: components["schemas"]["EquipmentStatus"] | null;
        };
        /** EstimateCreate */
        EstimateCreate: {
            /** Notes */
            notes?: string | null;
            /**
             * Overhead Percent
             * @description Defaults to the organization's
             */
            overhead_percent?: string | null;
            /**
             * Price List Id
             * @description Defaults to the organization's default price list
             */
            price_list_id?: string | null;
            /**
             * Profit Percent
             * @description Defaults to the organization's
             */
            profit_percent?: string | null;
            /**
             * Tax Percent
             * @description Sales tax on taxable lines; defaults to the organization's
             */
            tax_percent?: string | null;
            /**
             * Title
             * @example Mitigation
             */
            title: string;
        };
        /** EstimatePriceList */
        EstimatePriceList: {
            /**
             * Id
             * Format: uuid
             */
            id: string;
            /** Name */
            name: string;
        };
        /** EstimateRead */
        EstimateRead: {
            /**
             * Claim Id
             * Format: uuid
             */
            claim_id: string;
            /**
             * Created At
             * Format: date-time
             */
            created_at: string;
            created_by: components["schemas"]["ClaimActor"] | null;
            /**
             * Id
             * Format: uuid
             */
            id: string;
            /** Lines */
            lines: components["schemas"]["LineRead"][];
            /**
             * Next Statuses
             * @description Where the estimate can go from here (permissions permitting)
             */
            next_statuses: components["schemas"]["EstimateStatus"][];
            /** Notes */
            notes: string | null;
            /** Number */
            number: number;
            /**
             * Overhead Percent
             * @description Percent, as a decimal string to a thousandth
             * @example 8.25
             */
            overhead_percent: string;
            price_list: components["schemas"]["EstimatePriceList"] | null;
            /**
             * Profit Percent
             * @description Percent, as a decimal string to a thousandth
             * @example 8.25
             */
            profit_percent: string;
            /**
             * Rooms
             * @description Subtotal per room, in the lines' order; lines without a room last
             */
            rooms: components["schemas"]["RoomSubtotal"][];
            status: components["schemas"]["EstimateStatus"];
            /**
             * Tax Percent
             * @description Percent, as a decimal string to a thousandth
             * @example 8.25
             */
            tax_percent: string;
            /** Title */
            title: string;
            /**
             * Total
             * @description Dollars as a decimal string, to the cent
             * @example 42.15
             */
            total: string;
            totals: components["schemas"]["EstimateTotals"];
            /**
             * Updated At
             * Format: date-time
             */
            updated_at: string;
        };
        /**
         * EstimateStatus
         * @enum {string}
         */
        EstimateStatus: "draft" | "submitted" | "approved" | "rejected";
        /** EstimateStatusChange */
        EstimateStatusChange: {
            status: components["schemas"]["EstimateStatus"];
        };
        /** EstimateSummary */
        EstimateSummary: {
            /**
             * Claim Id
             * Format: uuid
             */
            claim_id: string;
            /**
             * Created At
             * Format: date-time
             */
            created_at: string;
            /**
             * Id
             * Format: uuid
             */
            id: string;
            /** Number */
            number: number;
            status: components["schemas"]["EstimateStatus"];
            /** Title */
            title: string;
            /**
             * Total
             * @description Dollars as a decimal string, to the cent
             * @example 42.15
             */
            total: string;
            /**
             * Updated At
             * Format: date-time
             */
            updated_at: string;
        };
        /** EstimateTotals */
        EstimateTotals: {
            /**
             * Overhead
             * @description (Subtotal + tax) times the overhead rate
             * @example 42.15
             */
            overhead: string;
            /**
             * Profit
             * @description (Subtotal + tax) times the profit rate
             * @example 42.15
             */
            profit: string;
            /**
             * Subtotal
             * @description The lines' totals
             * @example 42.15
             */
            subtotal: string;
            /**
             * Tax
             * @description Taxable subtotal times the tax rate
             * @example 42.15
             */
            tax: string;
            /**
             * Taxable Subtotal
             * @description The taxable lines' totals
             * @example 42.15
             */
            taxable_subtotal: string;
            /**
             * Total
             * @description Subtotal + tax + overhead + profit
             * @example 42.15
             */
            total: string;
        };
        /**
         * EstimateUpdate
         * @description Drafts only. ``price_list_id`` changes where new lines are priced from, not old ones.
         */
        EstimateUpdate: {
            /** Notes */
            notes?: string | null;
            /** Overhead Percent */
            overhead_percent?: string | null;
            /** Price List Id */
            price_list_id?: string | null;
            /** Profit Percent */
            profit_percent?: string | null;
            /** Tax Percent */
            tax_percent?: string | null;
            /** Title */
            title?: string | null;
        };
        /**
         * FieldError
         * @description One invalid input field.
         */
        FieldError: {
            /**
             * Loc
             * @description Path to the field, e.g. ["body", "email"]
             */
            loc: (string | number)[];
            /** Message */
            message: string;
            /** Type */
            type: string;
        };
        /**
         * GoalBasis
         * @description How a point's dry standard was set: carriers ask.
         * @enum {string}
         */
        GoalBasis: "reference" | "published" | "manual";
        /** HealthResponse */
        HealthResponse: {
            /**
             * Status
             * @constant
             */
            status: "ok";
            /** Version */
            version: string;
        };
        /**
         * ImportMode
         * @enum {string}
         */
        ImportMode: "merge" | "replace";
        /** ImportResult */
        ImportResult: {
            /** Added */
            added: number;
            /**
             * Dry Run
             * @description True: nothing was changed
             */
            dry_run: boolean;
            /** Ignored Columns */
            ignored_columns: string[];
            /** Mode */
            mode: string;
            /**
             * Removed
             * @description Codes missing from the file; only in `replace` mode
             */
            removed: number;
            /** Rows */
            rows: number;
            /** Unchanged */
            unchanged: number;
            /** Updated */
            updated: number;
        };
        /** InvitationAccept */
        InvitationAccept: {
            /** Full Name */
            full_name?: string | null;
            /** Password */
            password?: string | null;
            /** Token */
            token: string;
        };
        /** InvitationCreate */
        InvitationCreate: {
            /**
             * Email
             * Format: email
             */
            email: string;
            role: components["schemas"]["Role"];
        };
        /**
         * InvitationRead
         * @description Never includes the token: links only travel by email.
         */
        InvitationRead: {
            /**
             * Created At
             * Format: date-time
             */
            created_at: string;
            /** Email */
            email: string;
            /**
             * Expires At
             * Format: date-time
             */
            expires_at: string;
            /**
             * Id
             * Format: uuid
             */
            id: string;
            role: components["schemas"]["Role"];
        };
        /**
         * JobStatus
         * @enum {string}
         */
        JobStatus: "queued" | "ready" | "failed";
        /**
         * LineCreate
         * @description From a price item (``price_item_id``), or by hand (description, unit and price).
         */
        LineCreate: {
            /** Code */
            code?: string | null;
            /** Description */
            description?: string | null;
            /** Notes */
            notes?: string | null;
            /**
             * Position
             * @description Defaults to the end
             */
            position?: number | null;
            /** Price Item Id */
            price_item_id?: string | null;
            /**
             * Quantity
             * @description In the line's unit, as a decimal string, to a hundredth
             * @example 125.50
             */
            quantity: string;
            /**
             * Room Id
             * @description A room of this claim
             */
            room_id?: string | null;
            /**
             * Taxable
             * @description Sales tax applies
             * @default true
             */
            taxable?: boolean;
            /** Unit */
            unit?: string | null;
            /** Unit Price */
            unit_price?: string | null;
        };
        /** LineRead */
        LineRead: {
            /** Code */
            code: string | null;
            /** Description */
            description: string;
            /**
             * Id
             * Format: uuid
             */
            id: string;
            /** Notes */
            notes: string | null;
            /** Position */
            position: number;
            /**
             * Price Item Id
             * @description Where it was priced from; null by hand
             */
            price_item_id: string | null;
            /**
             * Quantity
             * @description In the line's unit, as a decimal string, to a hundredth
             * @example 125.50
             */
            quantity: string;
            room: components["schemas"]["LineRoom"] | null;
            /** Taxable */
            taxable: boolean;
            /**
             * Total
             * @description Quantity times unit price, to the cent
             * @example 42.15
             */
            total: string;
            /** Unit */
            unit: string;
            /**
             * Unit Price
             * @description Dollars as a decimal string, to the cent
             * @example 42.15
             */
            unit_price: string;
        };
        /** LineRoom */
        LineRoom: {
            /**
             * Id
             * Format: uuid
             */
            id: string;
            /** Name */
            name: string;
        };
        /**
         * LineUpdate
         * @description Drafts only. Only the fields sent change.
         */
        LineUpdate: {
            /** Code */
            code?: string | null;
            /** Description */
            description?: string | null;
            /** Notes */
            notes?: string | null;
            /** Position */
            position?: number | null;
            /** Quantity */
            quantity?: string | null;
            /** Room Id */
            room_id?: string | null;
            /** Taxable */
            taxable?: boolean | null;
            /** Unit */
            unit?: string | null;
            /** Unit Price */
            unit_price?: string | null;
        };
        /** LoginRequest */
        LoginRequest: {
            /**
             * Email
             * Format: email
             */
            email: string;
            /** Password */
            password: string;
        };
        /**
         * LossType
         * @enum {string}
         */
        LossType: "water" | "fire" | "smoke" | "mold" | "wind" | "hail" | "storm" | "flood" | "sewage" | "impact" | "vandalism" | "other";
        /**
         * MatchedIn
         * @description Where on a claim the search words were found.
         * @enum {string}
         */
        MatchedIn: "claim" | "property" | "contact" | "note";
        /** MeResponse */
        MeResponse: {
            /** Email */
            email: string;
            /** Full Name */
            full_name: string;
            /**
             * Id
             * Format: uuid
             */
            id: string;
            /** Memberships */
            memberships: components["schemas"]["MembershipRead"][];
        };
        /** MembershipOrganization */
        MembershipOrganization: {
            /**
             * Id
             * Format: uuid
             */
            id: string;
            /** Name */
            name: string;
            /** Slug */
            slug: string;
        };
        /** MembershipRead */
        MembershipRead: {
            organization: components["schemas"]["MembershipOrganization"];
            /** Permissions */
            permissions: components["schemas"]["Permission"][];
            role: components["schemas"]["Role"];
        };
        /** MoistureLogCreate */
        MoistureLogCreate: {
            /** Atmosphere */
            atmosphere?: components["schemas"]["AtmosphereIn"][];
            /** Notes */
            notes?: string | null;
            /** Readings */
            readings?: components["schemas"]["ReadingIn"][];
            /**
             * Taken At
             * @description When the readings were taken. Defaults to now.
             */
            taken_at?: string | null;
        };
        /** MoistureLogRead */
        MoistureLogRead: {
            /**
             * Atmosphere
             * @description Outdoors, unaffected, rooms, then dehumidifiers
             */
            atmosphere: components["schemas"]["AtmosphereRead"][];
            /**
             * Created At
             * Format: date-time
             */
            created_at: string;
            /**
             * Id
             * Format: uuid
             */
            id: string;
            /** Notes */
            notes: string | null;
            /**
             * Readings
             * @description In the points' order
             */
            readings: components["schemas"]["ReadingRead"][];
            /**
             * Readings Edited At
             * @description When readings were last corrected
             */
            readings_edited_at: string | null;
            /**
             * Taken At
             * Format: date-time
             */
            taken_at: string;
            /** @description Null once the account is gone */
            taken_by: components["schemas"]["ClaimActor"] | null;
            /**
             * Updated At
             * Format: date-time
             */
            updated_at: string;
        };
        /**
         * MoistureLogUpdate
         * @description Only the fields sent change. ``readings`` sets, adds or (with null) removes values;
         *     ``atmosphere``, when sent, replaces the visit's atmospheric readings.
         */
        MoistureLogUpdate: {
            /** Atmosphere */
            atmosphere?: components["schemas"]["AtmosphereIn"][] | null;
            /** Notes */
            notes?: string | null;
            /** Readings */
            readings?: components["schemas"]["ReadingChange"][];
            /** Taken At */
            taken_at?: string | null;
        };
        /** MoisturePointCreate */
        MoisturePointCreate: {
            /**
             * Dry Standard
             * @description The goal on the point's scale: at or below it is dry.
             */
            dry_standard?: number | null;
            /** @description How the goal was set; required with `dry_standard`. */
            dry_standard_basis?: components["schemas"]["GoalBasis"] | null;
            /**
             * Label
             * @description Defaults to the next number not yet used on the claim.
             */
            label?: string | null;
            /**
             * Material
             * @example Drywall
             */
            material: string;
            /** Notes */
            notes?: string | null;
            /**
             * Room Id
             * Format: uuid
             * @description A room of this claim.
             */
            room_id: string;
            /** @description `percent` for moisture content, `reference` for a meter's own scale. */
            scale: components["schemas"]["MoistureScale"];
            surface: components["schemas"]["Surface"];
        };
        /** MoisturePointRead */
        MoisturePointRead: {
            /**
             * Created At
             * Format: date-time
             */
            created_at: string;
            /** Dry Standard */
            dry_standard: number | null;
            dry_standard_basis: components["schemas"]["GoalBasis"] | null;
            /**
             * Id
             * Format: uuid
             */
            id: string;
            /** Label */
            label: string;
            /** Material */
            material: string;
            /** Notes */
            notes: string | null;
            room: components["schemas"]["MoisturePointRoom"];
            scale: components["schemas"]["MoistureScale"];
            surface: components["schemas"]["Surface"];
            /**
             * Updated At
             * Format: date-time
             */
            updated_at: string;
        };
        /** MoisturePointRoom */
        MoisturePointRoom: {
            /**
             * Id
             * Format: uuid
             */
            id: string;
            /** Name */
            name: string;
        };
        /**
         * MoisturePointUpdate
         * @description Only the fields sent change. The scale is fixed: readings on two scales don't compare.
         */
        MoisturePointUpdate: {
            /**
             * Dry Standard
             * @description Send with `dry_standard_basis`; both null clear the goal.
             */
            dry_standard?: number | null;
            dry_standard_basis?: components["schemas"]["GoalBasis"] | null;
            /** Label */
            label?: string | null;
            /** Material */
            material?: string | null;
            /** Notes */
            notes?: string | null;
            /** Room Id */
            room_id?: string | null;
            surface?: components["schemas"]["Surface"] | null;
        };
        /**
         * MoistureScale
         * @description What a point's readings mean.
         * @enum {string}
         */
        MoistureScale: "percent" | "reference";
        /** NoteCreate */
        NoteCreate: {
            /**
             * Body
             * @description Plain text. Mention a member with `<@user-id>`; each must belong to the organization, at most 20 per note.
             * @example Moisture mapped in the kitchen. <@0192f3a4-5b6c-7d8e-9f01-23456789abcd> please review before the carrier call.
             */
            body: string;
        };
        /** NoteRead */
        NoteRead: {
            /** @description Null once the author's account is gone */
            author: components["schemas"]["ClaimActor"] | null;
            /**
             * Body
             * @description As written, with `<@user-id>` mention tokens
             */
            body: string;
            claim: components["schemas"]["ClaimRef"];
            /**
             * Created At
             * Format: date-time
             */
            created_at: string;
            /** Edited At */
            edited_at: string | null;
            /**
             * Id
             * Format: uuid
             */
            id: string;
            /** Mentions */
            mentions: components["schemas"]["ClaimActor"][];
            /**
             * Text
             * @description The body with mentions shown as `@Full Name`
             */
            readonly text: string;
            /**
             * Updated At
             * Format: date-time
             */
            updated_at: string;
        };
        /**
         * NoteUpdate
         * @description Only the author can edit a note. Mentions are re-read from the new body.
         */
        NoteUpdate: {
            /**
             * Body
             * @description Plain text. Mention a member with `<@user-id>`; each must belong to the organization, at most 20 per note.
             * @example Moisture mapped in the kitchen. <@0192f3a4-5b6c-7d8e-9f01-23456789abcd> please review before the carrier call.
             */
            body: string;
        };
        /** OrganizationCreate */
        OrganizationCreate: {
            /** Name */
            name: string;
            /**
             * Slug
             * @description Derived from the name when omitted
             */
            slug?: string | null;
            /**
             * Timezone
             * @default UTC
             */
            timezone?: string;
        };
        /** OrganizationRead */
        OrganizationRead: {
            /**
             * Created At
             * Format: date-time
             */
            created_at: string;
            /**
             * Default Overhead Percent
             * @description Percent, as a decimal string to a thousandth
             * @example 8.25
             */
            default_overhead_percent: string;
            /**
             * Default Profit Percent
             * @description Percent, as a decimal string to a thousandth
             * @example 8.25
             */
            default_profit_percent: string;
            /**
             * Default Tax Percent
             * @description Percent, as a decimal string to a thousandth
             * @example 8.25
             */
            default_tax_percent: string;
            /**
             * Id
             * Format: uuid
             */
            id: string;
            /** Name */
            name: string;
            /** Slug */
            slug: string;
            /** Timezone */
            timezone: string;
            /**
             * Updated At
             * Format: date-time
             */
            updated_at: string;
        };
        /**
         * OrganizationUpdate
         * @description Partial update; omitted fields are unchanged. The slug is immutable to keep URLs stable.
         */
        OrganizationUpdate: {
            /** Default Overhead Percent */
            default_overhead_percent?: string | null;
            /** Default Profit Percent */
            default_profit_percent?: string | null;
            /**
             * Default Tax Percent
             * @description Sales tax new estimates start with
             */
            default_tax_percent?: string | null;
            /** Name */
            name?: string | null;
            /** Timezone */
            timezone?: string | null;
        };
        /**
         * Permission
         * @enum {string}
         */
        Permission: "org:read" | "org:update" | "org:delete" | "members:read" | "members:manage" | "claims:read" | "claims:write" | "claims:delete" | "claims:reopen" | "contacts:read" | "contacts:write" | "field_data:write" | "estimates:write" | "estimates:approve" | "reports:generate" | "audit:read";
        /** PhotoRead */
        PhotoRead: {
            /** Caption */
            caption: string | null;
            /**
             * Claim Id
             * Format: uuid
             */
            claim_id: string;
            content_type: components["schemas"]["PhotoType"];
            /**
             * Created At
             * Format: date-time
             * @description When the upload was completed
             */
            created_at: string;
            /**
             * Download Url
             * @description Saves the photo under its file name; works for an hour.
             */
            download_url: string;
            /** Filename */
            filename: string;
            /** Height */
            height: number | null;
            /**
             * Id
             * Format: uuid
             */
            id: string;
            /**
             * Preview Url
             * @description A JPEG at most 1600 px on its longest side, once processed. Show this rather than `url`: most browsers can't display HEIC originals.
             */
            preview_url: string | null;
            /** @description Thumbnails are made in the background: `pending` until then, `failed` when the file can't be read (the original can still be downloaded). */
            processing: components["schemas"]["ProcessingStatus"];
            room: components["schemas"]["PhotoRoom"] | null;
            /** Size Bytes */
            size_bytes: number;
            /** Tags */
            tags: string[];
            /** Taken At */
            taken_at: string | null;
            /**
             * Thumbnail Url
             * @description A JPEG at most 400 px on its longest side, once processed.
             */
            thumbnail_url: string | null;
            /** @description Null once the account is gone */
            uploaded_by: components["schemas"]["ClaimActor"] | null;
            /**
             * Url
             * @description Shows the photo; works for an hour. Fetch the photo again for a fresh one.
             */
            url: string;
            /**
             * Width
             * @description Of the original, upright; once processed.
             */
            width: number | null;
        };
        /** PhotoReportOptions */
        PhotoReportOptions: {
            /**
             * Group By Room
             * @default true
             */
            group_by_room?: boolean;
            /**
             * Photos Per Page
             * @default 2
             * @enum {integer}
             */
            photos_per_page?: 1 | 2 | 4 | 6;
            /**
             * Show Captions
             * @default true
             */
            show_captions?: boolean;
            /**
             * Show Tags
             * @default false
             */
            show_tags?: boolean;
            /**
             * Show Taken At
             * @default true
             */
            show_taken_at?: boolean;
        };
        /** PhotoRoom */
        PhotoRoom: {
            /**
             * Id
             * Format: uuid
             */
            id: string;
            /** Name */
            name: string;
        };
        /**
         * PhotoType
         * @description Image formats phones and cameras produce, which browsers or the thumbnailer read.
         * @enum {string}
         */
        PhotoType: "image/jpeg" | "image/png" | "image/webp" | "image/heic" | "image/heif";
        /**
         * PhotoUpdate
         * @description Only the fields sent change. ``room_id: null`` takes the photo out of its room.
         */
        PhotoUpdate: {
            /**
             * Caption
             * @description Free text. Blank clears it.
             * @example Stain spreading from the vent
             */
            caption?: string | null;
            /** Room Id */
            room_id?: string | null;
            /** Tags */
            tags?: string[] | null;
        };
        /**
         * PhotoUploadCreate
         * @description What the client is about to upload. The stored file must match it.
         */
        PhotoUploadCreate: {
            /**
             * Caption
             * @description Free text. Blank clears it.
             * @example Stain spreading from the vent
             */
            caption?: string | null;
            content_type: components["schemas"]["PhotoType"];
            /**
             * Filename
             * @description The file's name on the device; downloads use it.
             * @example IMG_0412.HEIC
             */
            filename: string;
            /**
             * Room Id
             * @description A room of this claim.
             */
            room_id?: string | null;
            /**
             * Size Bytes
             * @description Exact size of the file in bytes.
             */
            size_bytes: number;
            /**
             * Tags
             * @description Short labels, at most 20: letters, digits, spaces and hyphens. Stored lowercase, without repeats, in alphabetical order.
             * @example [
             *       "before",
             *       "ceiling"
             *     ]
             */
            tags?: string[];
            /**
             * Taken At
             * @description When the picture was taken, from the photo's metadata.
             */
            taken_at?: string | null;
        };
        /** PhotoUploadRead */
        PhotoUploadRead: {
            /**
             * Id
             * Format: uuid
             * @description Also the id of the photo once the upload is completed.
             */
            id: string;
            upload: components["schemas"]["SignedUploadRead"];
        };
        /** PlacedEquipment */
        PlacedEquipment: {
            /** Asset Tag */
            asset_tag: string;
            /**
             * Id
             * Format: uuid
             */
            id: string;
            kind: components["schemas"]["EquipmentKind"];
            /** Name */
            name: string;
        };
        /** PlacementCreate */
        PlacementCreate: {
            /**
             * Equipment Id
             * Format: uuid
             */
            equipment_id: string;
            /**
             * Placed At
             * @description Defaults to now.
             */
            placed_at?: string | null;
            /**
             * Room Id
             * Format: uuid
             * @description A room of this claim.
             */
            room_id: string;
        };
        /** PlacementRead */
        PlacementRead: {
            /**
             * Days
             * @description Billable days: every started 24 hours (so far, if running)
             */
            days: number;
            equipment: components["schemas"]["PlacedEquipment"];
            /**
             * Id
             * Format: uuid
             */
            id: string;
            /**
             * Placed At
             * Format: date-time
             */
            placed_at: string;
            placed_by: components["schemas"]["ClaimActor"] | null;
            /** Removed At */
            removed_at: string | null;
            removed_by: components["schemas"]["ClaimActor"] | null;
            room: components["schemas"]["PlacementRoom"];
            /** Running */
            running: boolean;
        };
        /** PlacementRemove */
        PlacementRemove: {
            /**
             * Removed At
             * @description Defaults to now.
             */
            removed_at?: string | null;
        };
        /** PlacementRoom */
        PlacementRoom: {
            /**
             * Id
             * Format: uuid
             */
            id: string;
            /** Name */
            name: string;
        };
        /**
         * PlacementUpdate
         * @description Corrections. ``removed_at: null`` puts a unit pulled by mistake back to running.
         */
        PlacementUpdate: {
            /** Placed At */
            placed_at?: string | null;
            /** Removed At */
            removed_at?: string | null;
            /** Room Id */
            room_id?: string | null;
        };
        /** PriceItemCreate */
        PriceItemCreate: {
            /** Category */
            category?: string | null;
            /**
             * Code
             * @example WTR DHM
             */
            code: string;
            /**
             * Description
             * @example Dehumidifier (per 24 hour period) - Large
             */
            description: string;
            /**
             * Unit
             * @description Letters only, stored in capitals: EA, SF, LF, HR, DA …
             * @example DA
             */
            unit: string;
            /**
             * Unit Price
             * @description Dollars as a decimal string, to the cent
             * @example 42.15
             */
            unit_price: string;
        };
        /** PriceItemRead */
        PriceItemRead: {
            /** Category */
            category: string | null;
            /** Code */
            code: string;
            /** Description */
            description: string;
            /**
             * Id
             * Format: uuid
             */
            id: string;
            /** Unit */
            unit: string;
            /**
             * Unit Price
             * @description Dollars as a decimal string, to the cent
             * @example 42.15
             */
            unit_price: string;
            /**
             * Updated At
             * Format: date-time
             */
            updated_at: string;
        };
        /** PriceItemUpdate */
        PriceItemUpdate: {
            /** Category */
            category?: string | null;
            /** Code */
            code?: string | null;
            /** Description */
            description?: string | null;
            /** Unit */
            unit?: string | null;
            /** Unit Price */
            unit_price?: string | null;
        };
        /** PriceListCreate */
        PriceListCreate: {
            /** Description */
            description?: string | null;
            /**
             * Effective On
             * @description When the prices are from
             */
            effective_on?: string | null;
            /**
             * Is Default
             * @description The list new estimates use; replaces the current default.
             * @default false
             */
            is_default?: boolean;
            /** Name */
            name: string;
        };
        /** PriceListRead */
        PriceListRead: {
            /**
             * Created At
             * Format: date-time
             */
            created_at: string;
            /** Description */
            description: string | null;
            /** Effective On */
            effective_on: string | null;
            /**
             * Id
             * Format: uuid
             */
            id: string;
            /**
             * Imported At
             * @description When items last came in from a file
             */
            imported_at: string | null;
            /** Is Default */
            is_default: boolean;
            /** Item Count */
            item_count: number;
            /** Name */
            name: string;
            /**
             * Updated At
             * Format: date-time
             */
            updated_at: string;
        };
        /** PriceListUpdate */
        PriceListUpdate: {
            /** Description */
            description?: string | null;
            /** Effective On */
            effective_on?: string | null;
            /** Is Default */
            is_default?: boolean | null;
            /** Name */
            name?: string | null;
        };
        /**
         * Problem
         * @description RFC 9457 problem details, plus ClaimForge extensions.
         */
        Problem: {
            /**
             * Code
             * @description Stable, machine-readable error code
             */
            code: string;
            /** Detail */
            detail: string;
            /**
             * Errors
             * @description Validation errors
             */
            errors?: components["schemas"]["FieldError"][] | null;
            /**
             * Instance
             * @description Path of the request that failed
             */
            instance: string;
            /** Request Id */
            request_id?: string | null;
            /** Status */
            status: number;
            /** Title */
            title: string;
            /**
             * Type
             * @example https://claimforge.dev/problems/not-found
             */
            type: string;
        };
        /**
         * ProcessingStatus
         * @enum {string}
         */
        ProcessingStatus: "pending" | "ready" | "failed";
        /** PropertyCreate */
        PropertyCreate: {
            /** Access Notes */
            access_notes?: string | null;
            address: components["schemas"]["AddressInput"];
            /** Latitude */
            latitude?: number | null;
            /** Longitude */
            longitude?: number | null;
            /** @default residential */
            property_type?: components["schemas"]["PropertyType"];
            /** Year Built */
            year_built?: number | null;
        };
        /** PropertyRead */
        PropertyRead: {
            /** Access Notes */
            access_notes: string | null;
            address: components["schemas"]["AddressRead"];
            /**
             * Created At
             * Format: date-time
             */
            created_at: string;
            /**
             * Id
             * Format: uuid
             */
            id: string;
            /** Latitude */
            latitude: number | null;
            /** Longitude */
            longitude: number | null;
            property_type: components["schemas"]["PropertyType"];
            /**
             * Updated At
             * Format: date-time
             */
            updated_at: string;
            /** Year Built */
            year_built: number | null;
        };
        /**
         * PropertyType
         * @enum {string}
         */
        PropertyType: "residential" | "multi_family" | "commercial" | "industrial" | "other";
        /**
         * PropertyUpdate
         * @description Partial update. ``address`` replaces the whole address; ``null`` clears optional fields.
         */
        PropertyUpdate: {
            /** Access Notes */
            access_notes?: string | null;
            address?: components["schemas"]["AddressInput"] | null;
            /** Latitude */
            latitude?: number | null;
            /** Longitude */
            longitude?: number | null;
            property_type?: components["schemas"]["PropertyType"] | null;
            /** Year Built */
            year_built?: number | null;
        };
        /** ReadinessResponse */
        ReadinessResponse: {
            /**
             * Database
             * @enum {string}
             */
            database: "ok" | "unreachable";
            /**
             * Status
             * @enum {string}
             */
            status: "ready" | "unavailable";
            /**
             * Storage
             * @enum {string}
             */
            storage: "ok" | "unreachable";
        };
        /** ReadingChange */
        ReadingChange: {
            /**
             * Point Id
             * Format: uuid
             */
            point_id: string;
            /**
             * Value
             * @description The corrected value; null removes the reading.
             */
            value: number | null;
        };
        /** ReadingIn */
        ReadingIn: {
            /**
             * Point Id
             * Format: uuid
             */
            point_id: string;
            /**
             * Value
             * @description On the point's scale, to one decimal place
             * @example 18.5
             */
            value: number;
        };
        /** ReadingRead */
        ReadingRead: {
            /** Label */
            label: string;
            /**
             * Point Id
             * Format: uuid
             */
            point_id: string;
            /**
             * Value
             * @description On the point's scale, to one decimal place
             * @example 18.5
             */
            value: number;
        };
        /** RefreshRequest */
        RefreshRequest: {
            /** Refresh Token */
            refresh_token: string;
        };
        /** ReportJobRead */
        ReportJobRead: {
            /**
             * Claim Id
             * Format: uuid
             */
            claim_id: string;
            /**
             * Created At
             * Format: date-time
             */
            created_at: string;
            /**
             * Download Url
             * @description Ready reports: saves the PDF under a readable name; works for an hour
             */
            download_url: string | null;
            /**
             * Error
             * @description Why it failed, or the last retry's reason
             */
            error: string | null;
            /** Finished At */
            finished_at: string | null;
            /**
             * Id
             * Format: uuid
             */
            id: string;
            kind: components["schemas"]["ReportKind"];
            requested_by: components["schemas"]["ClaimActor"] | null;
            /** Size Bytes */
            size_bytes: number | null;
            /** @description `queued` until it's `ready` or `failed` */
            status: components["schemas"]["JobStatus"];
        };
        /**
         * ReportKind
         * @enum {string}
         */
        ReportKind: "photo_report" | "drying_report";
        /** ReportRequest */
        ReportRequest: {
            kind: components["schemas"]["ReportKind"];
        };
        /**
         * Role
         * @description What a member can do in an organization (permissions are defined in the RBAC module).
         * @enum {string}
         */
        Role: "owner" | "admin" | "adjuster" | "technician" | "viewer";
        /** RoomCreate */
        RoomCreate: {
            /** Height Ft */
            height_ft?: number | null;
            /** Length Ft */
            length_ft?: number | null;
            /**
             * Level
             * @example Main floor
             */
            level?: string | null;
            /**
             * Name
             * @example Kitchen
             */
            name: string;
            /** Width Ft */
            width_ft?: number | null;
        };
        /** RoomRead */
        RoomRead: {
            /**
             * Created At
             * Format: date-time
             */
            created_at: string;
            /**
             * Floor Area Sqft
             * @description Length times width
             */
            floor_area_sqft: number | null;
            /** Height Ft */
            height_ft: number | null;
            /**
             * Id
             * Format: uuid
             */
            id: string;
            /** Length Ft */
            length_ft: number | null;
            /** Level */
            level: string | null;
            /** Name */
            name: string;
            /**
             * Structure Id
             * Format: uuid
             */
            structure_id: string;
            /**
             * Updated At
             * Format: date-time
             */
            updated_at: string;
            /**
             * Volume Cuft
             * @description Length times width times height
             */
            volume_cuft: number | null;
            /**
             * Wall Area Sqft
             * @description Perimeter times height, gross: doors and windows are not deducted
             */
            wall_area_sqft: number | null;
            /** Width Ft */
            width_ft: number | null;
        };
        /** RoomSubtotal */
        RoomSubtotal: {
            /** Lines */
            lines: number;
            /** @description Null for the lines without a room */
            room: components["schemas"]["LineRoom"] | null;
            /**
             * Subtotal
             * @description Dollars as a decimal string, to the cent
             * @example 42.15
             */
            subtotal: string;
        };
        /**
         * RoomUpdate
         * @description Only the fields sent change. ``structure_id`` moves the room within the claim.
         */
        RoomUpdate: {
            /** Height Ft */
            height_ft?: number | null;
            /** Length Ft */
            length_ft?: number | null;
            /** Level */
            level?: string | null;
            /** Name */
            name?: string | null;
            /** Structure Id */
            structure_id?: string | null;
            /** Width Ft */
            width_ft?: number | null;
        };
        /** SearchResults */
        SearchResults: {
            /**
             * Claims
             * @description Empty without `claims:read`
             */
            claims: components["schemas"]["ClaimHit"][];
            /**
             * Contacts
             * @description Empty without `contacts:read`
             */
            contacts: components["schemas"]["ContactHit"][];
        };
        /** ShareCreate */
        ShareCreate: {
            /**
             * Expires In Days
             * @description 1 to 30 days
             * @default 7
             */
            expires_in_days?: number;
            /**
             * Label
             * @example For Lone Star Mutual
             */
            label?: string | null;
        };
        /** ShareCreated */
        ShareCreated: {
            /**
             * Active
             * @description Not expired and not revoked
             */
            active: boolean;
            /**
             * Created At
             * Format: date-time
             */
            created_at: string;
            created_by: components["schemas"]["ClaimActor"] | null;
            /**
             * Expires At
             * Format: date-time
             */
            expires_at: string;
            /**
             * Id
             * Format: uuid
             */
            id: string;
            /** Label */
            label: string | null;
            /** Last Opened At */
            last_opened_at: string | null;
            /** Open Count */
            open_count: number;
            /**
             * Report Id
             * Format: uuid
             */
            report_id: string;
            /** Revoked At */
            revoked_at: string | null;
            /**
             * Url
             * @description The link to send. Shown this once: only a hash of it is kept.
             */
            url: string;
        };
        /** ShareRead */
        ShareRead: {
            /**
             * Active
             * @description Not expired and not revoked
             */
            active: boolean;
            /**
             * Created At
             * Format: date-time
             */
            created_at: string;
            created_by: components["schemas"]["ClaimActor"] | null;
            /**
             * Expires At
             * Format: date-time
             */
            expires_at: string;
            /**
             * Id
             * Format: uuid
             */
            id: string;
            /** Label */
            label: string | null;
            /** Last Opened At */
            last_opened_at: string | null;
            /** Open Count */
            open_count: number;
            /**
             * Report Id
             * Format: uuid
             */
            report_id: string;
            /** Revoked At */
            revoked_at: string | null;
        };
        /**
         * SignedUploadRead
         * @description Send the file as the body of this request, with these headers.
         */
        SignedUploadRead: {
            /**
             * Expires At
             * Format: date-time
             */
            expires_at: string;
            /** Headers */
            headers: {
                [key: string]: string;
            };
            /**
             * Method
             * @constant
             */
            method: "PUT";
            /** Url */
            url: string;
        };
        /** StructureCreate */
        StructureCreate: {
            /**
             * Name
             * @example Main house
             */
            name: string;
        };
        /** StructureRead */
        StructureRead: {
            /**
             * Created At
             * Format: date-time
             */
            created_at: string;
            /**
             * Id
             * Format: uuid
             */
            id: string;
            /** Name */
            name: string;
            /** Rooms */
            rooms: components["schemas"]["RoomRead"][];
            /**
             * Updated At
             * Format: date-time
             */
            updated_at: string;
        };
        /** StructureUpdate */
        StructureUpdate: {
            /** Name */
            name?: string | null;
        };
        /**
         * Surface
         * @description Where in the room the damaged material is.
         * @enum {string}
         */
        Surface: "floor" | "wall" | "ceiling" | "cabinetry" | "trim" | "fixture" | "contents" | "other";
        /** TagCount */
        TagCount: {
            /**
             * Photos
             * @description How many photos on live claims carry it
             */
            photos: number;
            /** Tag */
            tag: string;
        };
        /** TaskCreate */
        TaskCreate: {
            /**
             * Assignee Id
             * @description A member whose role can do field work (`field_data:write`)
             */
            assignee_id?: string | null;
            /** Description */
            description?: string | null;
            /** Due On */
            due_on?: string | null;
            /**
             * Title
             * @example Set 3 dehumidifiers in the basement
             */
            title: string;
        };
        /** TaskRead */
        TaskRead: {
            assignee: components["schemas"]["ClaimActor"] | null;
            claim: components["schemas"]["ClaimRef"];
            /** Completed At */
            completed_at: string | null;
            /** Completed By Id */
            completed_by_id: string | null;
            /**
             * Created At
             * Format: date-time
             */
            created_at: string;
            /** Created By Id */
            created_by_id: string | null;
            /** Description */
            description: string | null;
            /** Done */
            done: boolean;
            /** Due On */
            due_on: string | null;
            /**
             * Id
             * Format: uuid
             */
            id: string;
            /** Title */
            title: string;
            /**
             * Updated At
             * Format: date-time
             */
            updated_at: string;
        };
        /**
         * TaskStatus
         * @enum {string}
         */
        TaskStatus: "open" | "done";
        /**
         * TaskUpdate
         * @description Only the fields sent change; `null` clears the description, due date or assignee.
         */
        TaskUpdate: {
            /**
             * Assignee Id
             * @description A member whose role can do field work (`field_data:write`)
             */
            assignee_id?: string | null;
            /** Description */
            description?: string | null;
            /**
             * Done
             * @description `true` completes the task, `false` reopens it
             */
            done?: boolean | null;
            /** Due On */
            due_on?: string | null;
            /** Title */
            title?: string | null;
        };
        /** TemplateCreate */
        TemplateCreate: {
            /**
             * Accent Color
             * @default #1F4E79
             * @example #1F4E79
             */
            accent_color?: string;
            /** Footer Text */
            footer_text?: string | null;
            /** Header Text */
            header_text?: string | null;
            /**
             * Is Default
             * @description Takes over from the kind's default
             * @default false
             */
            is_default?: boolean;
            kind: components["schemas"]["ReportKind"];
            /** Name */
            name: string;
            /**
             * Options
             * @description Checked against the kind. Photo reports: `photos_per_page` (1, 2, 4 or 6), `show_captions`, `show_tags`, `show_taken_at`, `group_by_room`. Drying reports: `include_atmosphere`, `include_equipment`, `include_alerts`. Left out: the defaults.
             */
            options?: {
                [key: string]: unknown;
            } | null;
            /** Title */
            title?: string | null;
        };
        /** TemplateRead */
        TemplateRead: {
            /** Accent Color */
            accent_color: string;
            /**
             * Built In
             * @description True: no template is set up, this is what's used
             */
            built_in: boolean;
            /** Created At */
            created_at: string | null;
            /** Footer Text */
            footer_text: string | null;
            /** Header Text */
            header_text: string | null;
            /**
             * Id
             * @description Null for the built-in default
             */
            id: string | null;
            /** Is Default */
            is_default: boolean;
            kind: components["schemas"]["ReportKind"];
            /**
             * Logo Url
             * @description The logo, a PNG; works for an hour
             */
            logo_url: string | null;
            /** Name */
            name: string;
            /** Options */
            options: components["schemas"]["PhotoReportOptions"] | components["schemas"]["DryingReportOptions"];
            /**
             * Title
             * @description The cover title (the kind's own when not set)
             */
            title: string;
            /** Updated At */
            updated_at: string | null;
        };
        /**
         * TemplateUpdate
         * @description Only the fields sent change; ``options`` replaces them all. The kind is fixed.
         */
        TemplateUpdate: {
            /** Accent Color */
            accent_color?: string | null;
            /** Footer Text */
            footer_text?: string | null;
            /** Header Text */
            header_text?: string | null;
            /** Is Default */
            is_default?: boolean | null;
            /** Name */
            name?: string | null;
            /**
             * Options
             * @description Checked against the kind. Photo reports: `photos_per_page` (1, 2, 4 or 6), `show_captions`, `show_tags`, `show_taken_at`, `group_by_room`. Drying reports: `include_atmosphere`, `include_equipment`, `include_alerts`. Left out: the defaults.
             */
            options?: {
                [key: string]: unknown;
            } | null;
            /** Title */
            title?: string | null;
        };
        /** TimelineEntry */
        TimelineEntry: {
            /**
             * Action
             * @example note.created
             */
            action: string;
            /** @description Null for system changes or deleted accounts */
            actor: components["schemas"]["ClaimActor"] | null;
            /**
             * At
             * Format: date-time
             */
            at: string;
            /**
             * Changes
             * @description `{field: [before, after]}`
             */
            changes: {
                [key: string]: unknown[];
            };
            /**
             * Id
             * Format: uuid
             */
            id: string;
            kind: components["schemas"]["TimelineKind"];
            subject: components["schemas"]["TimelineSubject"];
            /**
             * Summary
             * @example Changed the status from new to on hold: Waiting on PA
             */
            summary: string;
        };
        /**
         * TimelineKind
         * @description What an entry is about; the timeline's tabs and filters.
         * @enum {string}
         */
        TimelineKind: "claim" | "status" | "contacts" | "team" | "layout" | "damage" | "photos" | "documents" | "moisture" | "equipment" | "estimates" | "reports" | "notes" | "tasks" | "other";
        /** TimelineSubject */
        TimelineSubject: {
            /**
             * Id
             * Format: uuid
             */
            id: string;
            /**
             * Type
             * @example note
             */
            type: string;
        };
        /**
         * TokenResponse
         * @description OAuth 2.0-style token pair.
         */
        TokenResponse: {
            /** Access Token */
            access_token: string;
            /**
             * Expires In
             * @description Access-token lifetime in seconds
             */
            expires_in: number;
            /**
             * Refresh Expires At
             * Format: date-time
             */
            refresh_expires_at: string;
            /** Refresh Token */
            refresh_token: string;
            /**
             * Token Type
             * @default bearer
             * @constant
             */
            token_type?: "bearer";
        };
    };
    responses: never;
    parameters: never;
    requestBodies: never;
    headers: never;
    pathItems: never;
}
export type $defs = Record<string, never>;
export interface operations {
    healthz: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HealthResponse"];
                };
            };
        };
    };
    readyz: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ReadinessResponse"];
                };
            };
            /** @description A dependency is unavailable */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ReadinessResponse"];
                };
            };
        };
    };
    login: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["LoginRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["TokenResponse"];
                };
            };
            /** @description Bad request */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Authentication required */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Permission denied */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Validation failed or business rule violated */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Too many requests; retry after the Retry-After header's seconds */
            429: {
                headers: {
                    "Retry-After"?: number;
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
    logout: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["RefreshRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Bad request */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Authentication required */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Permission denied */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Validation failed or business rule violated */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
    refresh: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["RefreshRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["TokenResponse"];
                };
            };
            /** @description Bad request */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Authentication required */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Permission denied */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Validation failed or business rule violated */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Too many requests; retry after the Retry-After header's seconds */
            429: {
                headers: {
                    "Retry-After"?: number;
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
    accept_invitation: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["InvitationAccept"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["TokenResponse"];
                };
            };
            /** @description Bad request */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Authentication required */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Permission denied */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Validation failed or business rule violated */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Too many requests; retry after the Retry-After header's seconds */
            429: {
                headers: {
                    "Retry-After"?: number;
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
    me: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["MeResponse"];
                };
            };
            /** @description Bad request */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Authentication required */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Permission denied */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Validation failed or business rule violated */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
    list_organizations: {
        parameters: {
            query?: {
                /** @description Items per page */
                limit?: number;
                /** @description next_cursor from the previous page */
                cursor?: string | null;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CursorPage_OrganizationRead_"];
                };
            };
            /** @description Bad request */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Authentication required */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Permission denied */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Validation failed or business rule violated */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
    create_organization: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["OrganizationCreate"];
            };
        };
        responses: {
            /** @description Successful Response */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["OrganizationRead"];
                };
            };
            /** @description Bad request */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Authentication required */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Permission denied */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Validation failed or business rule violated */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
    get_organization: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                organization_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["OrganizationRead"];
                };
            };
            /** @description Bad request */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Authentication required */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Permission denied */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Validation failed or business rule violated */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
    delete_organization: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                organization_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Bad request */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Authentication required */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Permission denied */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Validation failed or business rule violated */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
    update_organization: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                organization_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["OrganizationUpdate"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["OrganizationRead"];
                };
            };
            /** @description Bad request */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Authentication required */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Permission denied */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Validation failed or business rule violated */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
    list_audit_events: {
        parameters: {
            query?: {
                entity_type?: string | null;
                entity_id?: string | null;
                actor_user_id?: string | null;
                /** @description Items per page */
                limit?: number;
                /** @description next_cursor from the previous page */
                cursor?: string | null;
            };
            header?: never;
            path: {
                organization_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CursorPage_AuditEventRead_"];
                };
            };
            /** @description Bad request */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Authentication required */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Permission denied */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Validation failed or business rule violated */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
    list_claims: {
        parameters: {
            query?: {
                /** @description Any of these statuses; repeat to give several */
                status?: components["schemas"]["ClaimStatus"][];
                /** @description Any of these loss types; repeat to give several */
                loss_type?: components["schemas"]["LossType"][];
                property_id?: string | null;
                /** @description Claims this contact is linked to, in any role */
                contact_id?: string | null;
                /** @description Claims this member is assigned to, in any role */
                assigned_to?: string | null;
                /** @description `false`: claims nobody owns yet */
                has_adjuster?: boolean | null;
                /** @description Inclusive */
                loss_date_from?: string | null;
                /** @description Inclusive */
                loss_date_to?: string | null;
                /** @description Matches the claim number, carrier name, carrier claim number, policy number, the property's street, city or postal code, or a linked contact's name */
                q?: string | null;
                /** @description Claims with no loss date come last for `loss_date` and first for `-loss_date` */
                sort?: components["schemas"]["ClaimSort"];
                /** @description Items per page */
                limit?: number;
                /** @description next_cursor from the previous page */
                cursor?: string | null;
            };
            header?: never;
            path: {
                organization_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CursorPage_ClaimSummary_"];
                };
            };
            /** @description Bad request */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Authentication required */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Permission denied */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Validation failed or business rule violated */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
    create_claim: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                organization_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ClaimCreate"];
            };
        };
        responses: {
            /** @description Successful Response */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ClaimRead"];
                };
            };
            /** @description Bad request */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Authentication required */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Permission denied */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Validation failed or business rule violated */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
    get_claim_by_number: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                organization_id: string;
                number: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ClaimRead"];
                };
            };
            /** @description Bad request */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Authentication required */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Permission denied */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Validation failed or business rule violated */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
    get_claim: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                organization_id: string;
                claim_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ClaimRead"];
                };
            };
            /** @description Bad request */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Authentication required */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Permission denied */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Validation failed or business rule violated */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
    update_claim: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                organization_id: string;
                claim_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ClaimUpdate"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ClaimRead"];
                };
            };
            /** @description Bad request */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Authentication required */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Permission denied */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Validation failed or business rule violated */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
    assign_claim_member: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                organization_id: string;
                claim_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ClaimAssignmentCreate"];
            };
        };
        responses: {
            /** @description Successful Response */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ClaimAssignmentRead"];
                };
            };
            /** @description Bad request */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Authentication required */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Permission denied */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Validation failed or business rule violated */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
    unassign_claim_member: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                organization_id: string;
                claim_id: string;
                user_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Bad request */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Authentication required */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Permission denied */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Validation failed or business rule violated */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
    link_claim_contact: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                organization_id: string;
                claim_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ClaimContactLink"];
            };
        };
        responses: {
            /** @description Successful Response */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ClaimContactRead"];
                };
            };
            /** @description Bad request */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Authentication required */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Permission denied */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Validation failed or business rule violated */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
    unlink_claim_contact: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                organization_id: string;
                claim_id: string;
                contact_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Bad request */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Authentication required */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Permission denied */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Validation failed or business rule violated */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
    update_claim_contact: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                organization_id: string;
                claim_id: string;
                contact_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ClaimContactLinkUpdate"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ClaimContactRead"];
                };
            };
            /** @description Bad request */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Authentication required */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Permission denied */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Validation failed or business rule violated */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
    list_damage_items: {
        parameters: {
            query?: {
                room_id?: string | null;
                cause?: components["schemas"]["LossType"] | null;
            };
            header?: never;
            path: {
                organization_id: string;
                claim_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["DamageItemRead"][];
                };
            };
            /** @description Bad request */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Authentication required */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Permission denied */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Validation failed or business rule violated */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
    get_damage_item: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                organization_id: string;
                claim_id: string;
                damage_item_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["DamageItemRead"];
                };
            };
            /** @description Bad request */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Authentication required */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Permission denied */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Validation failed or business rule violated */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
    delete_damage_item: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                organization_id: string;
                claim_id: string;
                damage_item_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Bad request */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Authentication required */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Permission denied */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Validation failed or business rule violated */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
    update_damage_item: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                organization_id: string;
                claim_id: string;
                damage_item_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["DamageItemUpdate"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["DamageItemRead"];
                };
            };
            /** @description Bad request */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Authentication required */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Permission denied */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Validation failed or business rule violated */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
    start_document_upload: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                organization_id: string;
                claim_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["DocumentUploadCreate"];
            };
        };
        responses: {
            /** @description Successful Response */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["DocumentUploadRead"];
                };
            };
            /** @description Bad request */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Authentication required */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Permission denied */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Validation failed or business rule violated */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
    complete_document_upload: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                organization_id: string;
                claim_id: string;
                upload_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Completed before: the same one */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["DocumentRead"];
                };
            };
            /** @description Successful Response */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["DocumentRead"];
                };
            };
            /** @description Bad request */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Authentication required */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Permission denied */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Validation failed or business rule violated */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
    list_documents: {
        parameters: {
            query?: {
                /** @description Only these categories; repeat for several. */
                category?: components["schemas"]["DocumentCategory"][];
                /** @description Items per page */
                limit?: number;
                /** @description next_cursor from the previous page */
                cursor?: string | null;
            };
            header?: never;
            path: {
                organization_id: string;
                claim_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CursorPage_DocumentRead_"];
                };
            };
            /** @description Bad request */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Authentication required */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Permission denied */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Validation failed or business rule violated */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
    get_document: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                organization_id: string;
                claim_id: string;
                document_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["DocumentRead"];
                };
            };
            /** @description Bad request */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Authentication required */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Permission denied */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Validation failed or business rule violated */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
    delete_document: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                organization_id: string;
                claim_id: string;
                document_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Bad request */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Authentication required */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Permission denied */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Validation failed or business rule violated */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
    update_document: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                organization_id: string;
                claim_id: string;
                document_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["DocumentUpdate"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["DocumentRead"];
                };
            };
            /** @description Bad request */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Authentication required */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Permission denied */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Validation failed or business rule violated */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
    get_drying_log: {
        parameters: {
            query?: {
                /** @description Only this room's points */
                room_id?: string | null;
            };
            header?: never;
            path: {
                organization_id: string;
                claim_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["DryingLog"];
                };
            };
            /** @description Bad request */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Authentication required */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Permission denied */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Validation failed or business rule violated */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
    get_drying_status: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                organization_id: string;
                claim_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["DryingStatusRead"];
                };
            };
            /** @description Bad request */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Authentication required */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Permission denied */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Validation failed or business rule violated */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
    get_equipment_days: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                organization_id: string;
                claim_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["EquipmentDays"][];
                };
            };
            /** @description Bad request */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Authentication required */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Permission denied */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Validation failed or business rule violated */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
    list_equipment_placements: {
        parameters: {
            query?: {
                /** @description Only running (or only removed) */
                running?: boolean | null;
                room_id?: string | null;
            };
            header?: never;
            path: {
                organization_id: string;
                claim_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PlacementRead"][];
                };
            };
            /** @description Bad request */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Authentication required */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Permission denied */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Validation failed or business rule violated */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
    place_equipment: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                organization_id: string;
                claim_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["PlacementCreate"];
            };
        };
        responses: {
            /** @description Successful Response */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PlacementRead"];
                };
            };
            /** @description Bad request */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Authentication required */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Permission denied */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Validation failed or business rule violated */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
    delete_equipment_placement: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                organization_id: string;
                claim_id: string;
                placement_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Bad request */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Authentication required */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Permission denied */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Validation failed or business rule violated */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
    update_equipment_placement: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                organization_id: string;
                claim_id: string;
                placement_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["PlacementUpdate"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PlacementRead"];
                };
            };
            /** @description Bad request */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Authentication required */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Permission denied */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Validation failed or business rule violated */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
    remove_equipment: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                organization_id: string;
                claim_id: string;
                placement_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["PlacementRemove"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PlacementRead"];
                };
            };
            /** @description Bad request */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Authentication required */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Permission denied */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Validation failed or business rule violated */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
    list_estimates: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                organization_id: string;
                claim_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["EstimateSummary"][];
                };
            };
            /** @description Bad request */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Authentication required */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Permission denied */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Validation failed or business rule violated */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
    create_estimate: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                organization_id: string;
                claim_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["EstimateCreate"];
            };
        };
        responses: {
            /** @description Successful Response */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["EstimateRead"];
                };
            };
            /** @description Bad request */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Authentication required */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Permission denied */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Validation failed or business rule violated */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
    get_estimate: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                organization_id: string;
                claim_id: string;
                estimate_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["EstimateRead"];
                };
            };
            /** @description Bad request */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Authentication required */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Permission denied */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Validation failed or business rule violated */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
    delete_estimate: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                organization_id: string;
                claim_id: string;
                estimate_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Bad request */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Authentication required */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Permission denied */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Validation failed or business rule violated */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
    update_estimate: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                organization_id: string;
                claim_id: string;
                estimate_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["EstimateUpdate"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["EstimateRead"];
                };
            };
            /** @description Bad request */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Authentication required */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Permission denied */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Validation failed or business rule violated */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
    add_estimate_line: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                organization_id: string;
                claim_id: string;
                estimate_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["LineCreate"];
            };
        };
        responses: {
            /** @description Successful Response */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["EstimateRead"];
                };
            };
            /** @description Bad request */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Authentication required */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Permission denied */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Validation failed or business rule violated */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
    delete_estimate_line: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                organization_id: string;
                claim_id: string;
                estimate_id: string;
                line_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["EstimateRead"];
                };
            };
            /** @description Bad request */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Authentication required */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Permission denied */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Validation failed or business rule violated */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
    update_estimate_line: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                organization_id: string;
                claim_id: string;
                estimate_id: string;
                line_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["LineUpdate"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["EstimateRead"];
                };
            };
            /** @description Bad request */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Authentication required */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Permission denied */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Validation failed or business rule violated */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
    change_estimate_status: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                organization_id: string;
                claim_id: string;
                estimate_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["EstimateStatusChange"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["EstimateRead"];
                };
            };
            /** @description Bad request */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Authentication required */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Permission denied */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Validation failed or business rule violated */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
    list_moisture_logs: {
        parameters: {
            query?: {
                /** @description Items per page */
                limit?: number;
                /** @description next_cursor from the previous page */
                cursor?: string | null;
            };
            header?: never;
            path: {
                organization_id: string;
                claim_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CursorPage_MoistureLogRead_"];
                };
            };
            /** @description Bad request */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Authentication required */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Permission denied */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Validation failed or business rule violated */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
    create_moisture_log: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                organization_id: string;
                claim_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["MoistureLogCreate"];
            };
        };
        responses: {
            /** @description Successful Response */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["MoistureLogRead"];
                };
            };
            /** @description Bad request */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Authentication required */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Permission denied */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Validation failed or business rule violated */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
    get_moisture_log: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                organization_id: string;
                claim_id: string;
                log_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["MoistureLogRead"];
                };
            };
            /** @description Bad request */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Authentication required */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Permission denied */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Validation failed or business rule violated */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
    delete_moisture_log: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                organization_id: string;
                claim_id: string;
                log_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Bad request */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Authentication required */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Permission denied */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Validation failed or business rule violated */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
    update_moisture_log: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                organization_id: string;
                claim_id: string;
                log_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["MoistureLogUpdate"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["MoistureLogRead"];
                };
            };
            /** @description Bad request */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Authentication required */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Permission denied */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Validation failed or business rule violated */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
    list_moisture_points: {
        parameters: {
            query?: {
                /** @description Only this room's points */
                room_id?: string | null;
            };
            header?: never;
            path: {
                organization_id: string;
                claim_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["MoisturePointRead"][];
                };
            };
            /** @description Bad request */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Authentication required */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Permission denied */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Validation failed or business rule violated */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
    create_moisture_point: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                organization_id: string;
                claim_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["MoisturePointCreate"];
            };
        };
        responses: {
            /** @description Successful Response */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["MoisturePointRead"];
                };
            };
            /** @description Bad request */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Authentication required */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Permission denied */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Validation failed or business rule violated */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
    get_moisture_point: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                organization_id: string;
                claim_id: string;
                point_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["MoisturePointRead"];
                };
            };
            /** @description Bad request */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Authentication required */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Permission denied */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Validation failed or business rule violated */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
    delete_moisture_point: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                organization_id: string;
                claim_id: string;
                point_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Bad request */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Authentication required */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Permission denied */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Validation failed or business rule violated */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
    update_moisture_point: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                organization_id: string;
                claim_id: string;
                point_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["MoisturePointUpdate"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["MoisturePointRead"];
                };
            };
            /** @description Bad request */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Authentication required */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Permission denied */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Validation failed or business rule violated */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
    list_notes: {
        parameters: {
            query?: {
                /** @description Items per page */
                limit?: number;
                /** @description next_cursor from the previous page */
                cursor?: string | null;
            };
            header?: never;
            path: {
                organization_id: string;
                claim_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CursorPage_NoteRead_"];
                };
            };
            /** @description Bad request */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Authentication required */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Permission denied */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Validation failed or business rule violated */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
    create_note: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                organization_id: string;
                claim_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["NoteCreate"];
            };
        };
        responses: {
            /** @description Successful Response */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["NoteRead"];
                };
            };
            /** @description Bad request */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Authentication required */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Permission denied */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Validation failed or business rule violated */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
    delete_note: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                organization_id: string;
                claim_id: string;
                note_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Bad request */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Authentication required */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Permission denied */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Validation failed or business rule violated */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
    update_note: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                organization_id: string;
                claim_id: string;
                note_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["NoteUpdate"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["NoteRead"];
                };
            };
            /** @description Bad request */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Authentication required */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Permission denied */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Validation failed or business rule violated */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
    start_photo_upload: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                organization_id: string;
                claim_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["PhotoUploadCreate"];
            };
        };
        responses: {
            /** @description Successful Response */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PhotoUploadRead"];
                };
            };
            /** @description Bad request */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Authentication required */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Permission denied */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Validation failed or business rule violated */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
    complete_photo_upload: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                organization_id: string;
                claim_id: string;
                upload_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Completed before: the same photo */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PhotoRead"];
                };
            };
            /** @description Successful Response */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PhotoRead"];
                };
            };
            /** @description Bad request */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Authentication required */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Permission denied */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Validation failed or business rule violated */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
    list_photos: {
        parameters: {
            query?: {
                /** @description Only this room's photos */
                room_id?: string | null;
                /** @description Only photos not linked to a room */
                unassigned?: boolean;
                /** @description Only photos with every one of these tags; repeat. */
                tag?: string[];
                /** @description Items per page */
                limit?: number;
                /** @description next_cursor from the previous page */
                cursor?: string | null;
            };
            header?: never;
            path: {
                organization_id: string;
                claim_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CursorPage_PhotoRead_"];
                };
            };
            /** @description Bad request */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Authentication required */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Permission denied */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Validation failed or business rule violated */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
    get_photo: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                organization_id: string;
                claim_id: string;
                photo_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PhotoRead"];
                };
            };
            /** @description Bad request */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Authentication required */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Permission denied */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Validation failed or business rule violated */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
    delete_photo: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                organization_id: string;
                claim_id: string;
                photo_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Bad request */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Authentication required */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Permission denied */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Validation failed or business rule violated */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
    update_photo: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                organization_id: string;
                claim_id: string;
                photo_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["PhotoUpdate"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PhotoRead"];
                };
            };
            /** @description Bad request */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Authentication required */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Permission denied */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Validation failed or business rule violated */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
    list_reports: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                organization_id: string;
                claim_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ReportJobRead"][];
                };
            };
            /** @description Bad request */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Authentication required */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Permission denied */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Validation failed or business rule violated */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
    request_report: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                organization_id: string;
                claim_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ReportRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            202: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ReportJobRead"];
                };
            };
            /** @description Bad request */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Authentication required */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Permission denied */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Validation failed or business rule violated */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
    get_report: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                organization_id: string;
                claim_id: string;
                job_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ReportJobRead"];
                };
            };
            /** @description Bad request */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Authentication required */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Permission denied */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Validation failed or business rule violated */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
    delete_report: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                organization_id: string;
                claim_id: string;
                job_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Bad request */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Authentication required */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Permission denied */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Validation failed or business rule violated */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
    list_report_shares: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                organization_id: string;
                claim_id: string;
                job_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ShareRead"][];
                };
            };
            /** @description Bad request */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Authentication required */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Permission denied */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Validation failed or business rule violated */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
    share_report: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                organization_id: string;
                claim_id: string;
                job_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ShareCreate"];
            };
        };
        responses: {
            /** @description Successful Response */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ShareCreated"];
                };
            };
            /** @description Bad request */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Authentication required */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Permission denied */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Validation failed or business rule violated */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
    revoke_report_share: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                organization_id: string;
                claim_id: string;
                job_id: string;
                share_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ShareRead"];
                };
            };
            /** @description Bad request */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Authentication required */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Permission denied */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Validation failed or business rule violated */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
    get_room: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                organization_id: string;
                claim_id: string;
                room_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["RoomRead"];
                };
            };
            /** @description Bad request */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Authentication required */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Permission denied */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Validation failed or business rule violated */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
    delete_room: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                organization_id: string;
                claim_id: string;
                room_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Bad request */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Authentication required */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Permission denied */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Validation failed or business rule violated */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
    update_room: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                organization_id: string;
                claim_id: string;
                room_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["RoomUpdate"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["RoomRead"];
                };
            };
            /** @description Bad request */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Authentication required */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Permission denied */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Validation failed or business rule violated */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
    create_damage_item: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                organization_id: string;
                claim_id: string;
                room_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["DamageItemCreate"];
            };
        };
        responses: {
            /** @description Successful Response */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["DamageItemRead"];
                };
            };
            /** @description Bad request */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Authentication required */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Permission denied */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Validation failed or business rule violated */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
    change_claim_status: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                organization_id: string;
                claim_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ClaimStatusChangeCreate"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ClaimRead"];
                };
            };
            /** @description Bad request */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Authentication required */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Permission denied */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Validation failed or business rule violated */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
    get_claim_status_history: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                organization_id: string;
                claim_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ClaimStatusChangeRead"][];
                };
            };
            /** @description Bad request */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Authentication required */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Permission denied */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Validation failed or business rule violated */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
    list_structures: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                organization_id: string;
                claim_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["StructureRead"][];
                };
            };
            /** @description Bad request */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Authentication required */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Permission denied */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Validation failed or business rule violated */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
    create_structure: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                organization_id: string;
                claim_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["StructureCreate"];
            };
        };
        responses: {
            /** @description Successful Response */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["StructureRead"];
                };
            };
            /** @description Bad request */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Authentication required */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Permission denied */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Validation failed or business rule violated */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
    delete_structure: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                organization_id: string;
                claim_id: string;
                structure_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Bad request */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Authentication required */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Permission denied */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Validation failed or business rule violated */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
    update_structure: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                organization_id: string;
                claim_id: string;
                structure_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["StructureUpdate"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["StructureRead"];
                };
            };
            /** @description Bad request */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Authentication required */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Permission denied */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Validation failed or business rule violated */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
    create_room: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                organization_id: string;
                claim_id: string;
                structure_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["RoomCreate"];
            };
        };
        responses: {
            /** @description Successful Response */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["RoomRead"];
                };
            };
            /** @description Bad request */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Authentication required */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Permission denied */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Validation failed or business rule violated */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
    list_tasks: {
        parameters: {
            query?: {
                /** @description Both when omitted */
                status?: components["schemas"]["TaskStatus"] | null;
            };
            header?: never;
            path: {
                organization_id: string;
                claim_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["TaskRead"][];
                };
            };
            /** @description Bad request */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Authentication required */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Permission denied */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Validation failed or business rule violated */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
    create_task: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                organization_id: string;
                claim_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["TaskCreate"];
            };
        };
        responses: {
            /** @description Successful Response */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["TaskRead"];
                };
            };
            /** @description Bad request */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Authentication required */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Permission denied */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Validation failed or business rule violated */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
    delete_task: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                organization_id: string;
                claim_id: string;
                task_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Bad request */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Authentication required */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Permission denied */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Validation failed or business rule violated */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
    update_task: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                organization_id: string;
                claim_id: string;
                task_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["TaskUpdate"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["TaskRead"];
                };
            };
            /** @description Bad request */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Authentication required */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Permission denied */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Validation failed or business rule violated */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
    claim_timeline: {
        parameters: {
            query?: {
                /** @description Only these kinds; repeat for several. All when omitted. */
                kind?: components["schemas"]["TimelineKind"][];
                /** @description Items per page */
                limit?: number;
                /** @description next_cursor from the previous page */
                cursor?: string | null;
            };
            header?: never;
            path: {
                organization_id: string;
                claim_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CursorPage_TimelineEntry_"];
                };
            };
            /** @description Bad request */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Authentication required */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Permission denied */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Validation failed or business rule violated */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
    list_contacts: {
        parameters: {
            query?: {
                kind?: components["schemas"]["ContactKind"] | null;
                /** @description Matches name, company, email or phone digits */
                q?: string | null;
                /** @description Items per page */
                limit?: number;
                /** @description next_cursor from the previous page */
                cursor?: string | null;
            };
            header?: never;
            path: {
                organization_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CursorPage_ContactRead_"];
                };
            };
            /** @description Bad request */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Authentication required */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Permission denied */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Validation failed or business rule violated */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
    create_contact: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                organization_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ContactCreate"];
            };
        };
        responses: {
            /** @description Successful Response */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ContactRead"];
                };
            };
            /** @description Bad request */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Authentication required */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Permission denied */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Validation failed or business rule violated */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
    get_contact: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                organization_id: string;
                contact_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ContactRead"];
                };
            };
            /** @description Bad request */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Authentication required */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Permission denied */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Validation failed or business rule violated */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
    delete_contact: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                organization_id: string;
                contact_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Bad request */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Authentication required */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Permission denied */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Validation failed or business rule violated */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
    update_contact: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                organization_id: string;
                contact_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ContactUpdate"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ContactRead"];
                };
            };
            /** @description Bad request */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Authentication required */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Permission denied */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Validation failed or business rule violated */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
    list_equipment: {
        parameters: {
            query?: {
                kind?: components["schemas"]["EquipmentKind"] | null;
                status?: components["schemas"]["EquipmentStatus"] | null;
                /** @description Matches asset tag, name or serial number */
                q?: string | null;
                /** @description true: in service and not running anywhere (free to place); false: everything else */
                available?: boolean | null;
                /** @description Items per page */
                limit?: number;
                /** @description next_cursor from the previous page */
                cursor?: string | null;
            };
            header?: never;
            path: {
                organization_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CursorPage_EquipmentRead_"];
                };
            };
            /** @description Bad request */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Authentication required */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Permission denied */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Validation failed or business rule violated */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
    create_equipment: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                organization_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["EquipmentCreate"];
            };
        };
        responses: {
            /** @description Successful Response */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["EquipmentRead"];
                };
            };
            /** @description Bad request */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Authentication required */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Permission denied */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Validation failed or business rule violated */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
    get_equipment: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                organization_id: string;
                equipment_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["EquipmentRead"];
                };
            };
            /** @description Bad request */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Authentication required */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Permission denied */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Validation failed or business rule violated */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
    delete_equipment: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                organization_id: string;
                equipment_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Bad request */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Authentication required */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Permission denied */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Validation failed or business rule violated */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
    update_equipment: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                organization_id: string;
                equipment_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["EquipmentUpdate"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["EquipmentRead"];
                };
            };
            /** @description Bad request */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Authentication required */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Permission denied */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Validation failed or business rule violated */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
    list_invitations: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                organization_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["InvitationRead"][];
                };
            };
            /** @description Bad request */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Authentication required */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Permission denied */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Validation failed or business rule violated */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
    create_invitation: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                organization_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["InvitationCreate"];
            };
        };
        responses: {
            /** @description Successful Response */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["InvitationRead"];
                };
            };
            /** @description Bad request */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Authentication required */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Permission denied */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Validation failed or business rule violated */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
    revoke_invitation: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                organization_id: string;
                invitation_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Bad request */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Authentication required */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Permission denied */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Validation failed or business rule violated */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
    notes_mentioning_me: {
        parameters: {
            query?: {
                /** @description Items per page */
                limit?: number;
                /** @description next_cursor from the previous page */
                cursor?: string | null;
            };
            header?: never;
            path: {
                organization_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CursorPage_NoteRead_"];
                };
            };
            /** @description Bad request */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Authentication required */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Permission denied */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Validation failed or business rule violated */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
    list_photo_tags: {
        parameters: {
            query?: {
                /** @description Only tags starting with this */
                prefix?: string | null;
                limit?: number;
            };
            header?: never;
            path: {
                organization_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["TagCount"][];
                };
            };
            /** @description Bad request */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Authentication required */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Permission denied */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Validation failed or business rule violated */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
    list_price_lists: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                organization_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PriceListRead"][];
                };
            };
            /** @description Bad request */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Authentication required */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Permission denied */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Validation failed or business rule violated */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
    create_price_list: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                organization_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["PriceListCreate"];
            };
        };
        responses: {
            /** @description Successful Response */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PriceListRead"];
                };
            };
            /** @description Bad request */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Authentication required */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Permission denied */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Validation failed or business rule violated */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
    get_price_list: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                organization_id: string;
                list_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PriceListRead"];
                };
            };
            /** @description Bad request */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Authentication required */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Permission denied */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Validation failed or business rule violated */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
    delete_price_list: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                organization_id: string;
                list_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Bad request */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Authentication required */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Permission denied */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Validation failed or business rule violated */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
    update_price_list: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                organization_id: string;
                list_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["PriceListUpdate"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PriceListRead"];
                };
            };
            /** @description Bad request */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Authentication required */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Permission denied */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Validation failed or business rule violated */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
    import_price_items: {
        parameters: {
            query?: {
                mode?: components["schemas"]["ImportMode"];
                dry_run?: boolean;
            };
            header?: never;
            path: {
                organization_id: string;
                list_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                /**
                 * @example code,description,unit,unit_price,category
                 *     WTR DHM,Dehumidifier - Large,DA,123.40,WTR
                 */
                "text/csv": string;
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ImportResult"];
                };
            };
            /** @description Bad request */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Authentication required */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Permission denied */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Validation failed or business rule violated */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
    list_price_items: {
        parameters: {
            query?: {
                /** @description Matches code or description */
                q?: string | null;
                category?: string | null;
                /** @description Items per page */
                limit?: number;
                /** @description next_cursor from the previous page */
                cursor?: string | null;
            };
            header?: never;
            path: {
                organization_id: string;
                list_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CursorPage_PriceItemRead_"];
                };
            };
            /** @description Bad request */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Authentication required */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Permission denied */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Validation failed or business rule violated */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
    create_price_item: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                organization_id: string;
                list_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["PriceItemCreate"];
            };
        };
        responses: {
            /** @description Successful Response */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PriceItemRead"];
                };
            };
            /** @description Bad request */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Authentication required */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Permission denied */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Validation failed or business rule violated */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
    get_price_item: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                organization_id: string;
                list_id: string;
                item_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PriceItemRead"];
                };
            };
            /** @description Bad request */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Authentication required */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Permission denied */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Validation failed or business rule violated */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
    delete_price_item: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                organization_id: string;
                list_id: string;
                item_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Bad request */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Authentication required */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Permission denied */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Validation failed or business rule violated */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
    update_price_item: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                organization_id: string;
                list_id: string;
                item_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["PriceItemUpdate"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PriceItemRead"];
                };
            };
            /** @description Bad request */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Authentication required */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Permission denied */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Validation failed or business rule violated */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
    list_properties: {
        parameters: {
            query?: {
                /** @description Matches street, unit, city or postal code */
                q?: string | null;
                /** @description Postal code or its prefix, e.g. 787 */
                postal_code?: string | null;
                /** @description Items per page */
                limit?: number;
                /** @description next_cursor from the previous page */
                cursor?: string | null;
            };
            header?: never;
            path: {
                organization_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CursorPage_PropertyRead_"];
                };
            };
            /** @description Bad request */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Authentication required */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Permission denied */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Validation failed or business rule violated */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
    create_property: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                organization_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["PropertyCreate"];
            };
        };
        responses: {
            /** @description Successful Response */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PropertyRead"];
                };
            };
            /** @description Bad request */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Authentication required */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Permission denied */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Validation failed or business rule violated */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
    get_property: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                organization_id: string;
                property_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PropertyRead"];
                };
            };
            /** @description Bad request */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Authentication required */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Permission denied */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Validation failed or business rule violated */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
    delete_property: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                organization_id: string;
                property_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Bad request */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Authentication required */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Permission denied */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Validation failed or business rule violated */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
    update_property: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                organization_id: string;
                property_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["PropertyUpdate"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PropertyRead"];
                };
            };
            /** @description Bad request */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Authentication required */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Permission denied */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Validation failed or business rule violated */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
    list_report_templates: {
        parameters: {
            query?: {
                kind?: components["schemas"]["ReportKind"] | null;
            };
            header?: never;
            path: {
                organization_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["TemplateRead"][];
                };
            };
            /** @description Bad request */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Authentication required */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Permission denied */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Validation failed or business rule violated */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
    create_report_template: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                organization_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["TemplateCreate"];
            };
        };
        responses: {
            /** @description Successful Response */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["TemplateRead"];
                };
            };
            /** @description Bad request */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Authentication required */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Permission denied */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Validation failed or business rule violated */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
    get_effective_report_template: {
        parameters: {
            query: {
                kind: components["schemas"]["ReportKind"];
            };
            header?: never;
            path: {
                organization_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["TemplateRead"];
                };
            };
            /** @description Bad request */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Authentication required */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Permission denied */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Validation failed or business rule violated */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
    get_report_template: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                organization_id: string;
                template_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["TemplateRead"];
                };
            };
            /** @description Bad request */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Authentication required */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Permission denied */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Validation failed or business rule violated */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
    delete_report_template: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                organization_id: string;
                template_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Bad request */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Authentication required */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Permission denied */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Validation failed or business rule violated */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
    update_report_template: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                organization_id: string;
                template_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["TemplateUpdate"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["TemplateRead"];
                };
            };
            /** @description Bad request */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Authentication required */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Permission denied */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Validation failed or business rule violated */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
    set_report_template_logo: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                organization_id: string;
                template_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "image/jpeg": string;
                "image/png": string;
                "image/webp": string;
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["TemplateRead"];
                };
            };
            /** @description Bad request */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Authentication required */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Permission denied */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Validation failed or business rule violated */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
    remove_report_template_logo: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                organization_id: string;
                template_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["TemplateRead"];
                };
            };
            /** @description Bad request */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Authentication required */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Permission denied */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Validation failed or business rule violated */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
    search: {
        parameters: {
            query: {
                q: string;
                /** @description Results per section */
                limit?: number;
            };
            header?: never;
            path: {
                organization_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["SearchResults"];
                };
            };
            /** @description Bad request */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Authentication required */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Permission denied */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Validation failed or business rule violated */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
    tasks_assigned_to_me: {
        parameters: {
            query?: {
                status?: components["schemas"]["TaskStatus"];
                /** @description Due on or before this day; tasks without a due date drop out */
                due_by?: string | null;
                /** @description Items per page */
                limit?: number;
                /** @description next_cursor from the previous page */
                cursor?: string | null;
            };
            header?: never;
            path: {
                organization_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CursorPage_TaskRead_"];
                };
            };
            /** @description Bad request */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Authentication required */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Permission denied */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Validation failed or business rule violated */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
    open_shared_report: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                token: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            302: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Bad request */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Authentication required */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Permission denied */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description The link doesn't work (expired, revoked or unknown) */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Validation failed or business rule violated */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
}
