// Generated from apps/api/openapi.json by scripts/generate.mjs. Do not edit.
// Regenerate with `just api-openapi` (or `pnpm --filter @claimforge/api-client generate`).

import { z } from "zod";

const AddressInput = z.strictObject({ city: z.string().min(1).max(100), country: z.string().max(60).optional(), line1: z.string().min(1).max(200), line2: z.string().max(100).nullable().optional(), postal_code: z.string().max(16).nullable().optional(), region: z.string().max(100).nullable().optional() });
const AddressRead = z.object({ city: z.string(), country: z.string(), formatted: z.string(), line1: z.string(), line2: z.string().nullable(), postal_code: z.string().nullable(), region: z.string().nullable() });
const AlertEquipment = z.object({ asset_tag: z.string(), placement_id: z.uuid() });
const AlertKind = z.enum(["no_goal","stalled","monitoring_gap","equipment_in_dry_room"]);
const AlertPoint = z.object({ id: z.uuid(), label: z.string() });
const AssignmentRole = z.enum(["adjuster","contractor","field_technician"]);
const AtmosphereLocation = z.enum(["outdoors","unaffected","room","dehumidifier"]);
const AtmosphereIn = z.strictObject({ location: AtmosphereLocation, placement_id: z.uuid().nullable().optional(), relative_humidity: z.number().min(0).max(100), room_id: z.uuid().nullable().optional(), temperature_f: z.number().min(-40).max(160) });
const AtmosphereUnit = z.object({ asset_tag: z.string(), placement_id: z.uuid() });
const AtmosphereRoom = z.object({ id: z.uuid(), name: z.string() });
const AtmosphereRead = z.object({ dehumidifier: AtmosphereUnit.nullable(), dew_point_f: z.number().nullable(), grains_per_pound: z.number(), location: AtmosphereLocation, relative_humidity: z.number().min(0).max(100), room: AtmosphereRoom.nullable(), temperature_f: z.number().min(-40).max(160) });
const AuditActor = z.object({ full_name: z.string(), id: z.uuid() });
const AuditEventRead = z.object({ action: z.string(), actor: AuditActor.nullable(), changes: z.record(z.string(), z.unknown()), created_at: z.iso.datetime({ offset: true }), entity_id: z.uuid(), entity_type: z.string(), id: z.uuid(), request_id: z.string().nullable() });
const CapacityUnit = z.enum(["pints_per_day","cfm","btu_per_hour"]);
const ClaimActor = z.object({ full_name: z.string(), id: z.uuid() });
const ClaimAssignmentCreate = z.strictObject({ role: AssignmentRole, user_id: z.uuid() });
const ClaimAssignmentRead = z.object({ assigned_at: z.iso.datetime({ offset: true }), assigned_by_id: z.uuid().nullable(), role: AssignmentRole, user: ClaimActor });
const ClaimContactRole = z.enum(["insured","co_insured","tenant","property_manager","public_adjuster","insurance_agent","carrier_adjuster","other"]);
const ClaimContactLink = z.strictObject({ contact_id: z.uuid(), is_primary: z.boolean().optional(), role: ClaimContactRole });
const ClaimContactLinkUpdate = z.strictObject({ is_primary: z.boolean().nullable().optional(), role: ClaimContactRole.nullable().optional() });
const ContactKind = z.enum(["policyholder","tenant","property_manager","public_adjuster","insurance_agent","carrier_adjuster","contractor","other"]);
const ContactMethod = z.enum(["email","phone","text"]);
const ContactRead = z.object({ company_name: z.string().nullable(), created_at: z.iso.datetime({ offset: true }), email: z.string().nullable(), full_name: z.string(), id: z.uuid(), kind: ContactKind, notes: z.string().nullable(), phone: z.string().nullable(), preferred_contact_method: ContactMethod.nullable(), updated_at: z.iso.datetime({ offset: true }) });
const ClaimContactRead = z.object({ contact: ContactRead, is_primary: z.boolean(), role: ClaimContactRole });
const LossType = z.enum(["water","fire","smoke","mold","wind","hail","storm","flood","sewage","impact","vandalism","other"]);
const PropertyType = z.enum(["residential","multi_family","commercial","industrial","other"]);
const PropertyCreate = z.strictObject({ access_notes: z.string().max(2000).nullable().optional(), address: AddressInput, latitude: z.number().min(-90).max(90).nullable().optional(), longitude: z.number().min(-180).max(180).nullable().optional(), property_type: PropertyType.optional(), year_built: z.int().min(1600).nullable().optional() });
const ClaimCreate = z.strictObject({ carrier_claim_number: z.string().max(64).nullable().optional(), carrier_name: z.string().max(200).nullable().optional(), contacts: z.array(ClaimContactLink).max(20).optional(), description: z.string().max(10000).nullable().optional(), loss_date: z.iso.date().nullable().optional(), loss_type: LossType, policy_number: z.string().max(64).nullable().optional(), property: PropertyCreate.nullable().optional(), property_id: z.uuid().nullable().optional() });
const PropertyRead = z.object({ access_notes: z.string().nullable(), address: AddressRead, created_at: z.iso.datetime({ offset: true }), id: z.uuid(), latitude: z.number().nullable(), longitude: z.number().nullable(), property_type: PropertyType, updated_at: z.iso.datetime({ offset: true }), year_built: z.int().nullable() });
const ClaimStatus = z.enum(["new","inspected","in_progress","on_hold","completed","closed","cancelled"]);
const ClaimSummary = z.object({ adjuster: ClaimActor.nullable(), carrier_claim_number: z.string().nullable(), carrier_name: z.string().nullable(), created_at: z.iso.datetime({ offset: true }), id: z.uuid(), loss_date: z.iso.date().nullable(), loss_type: LossType, number: z.string(), policy_number: z.string().nullable(), primary_contact: ClaimContactRead.nullable(), property: PropertyRead, status: ClaimStatus, updated_at: z.iso.datetime({ offset: true }) });
const MatchedIn = z.enum(["claim","property","contact","note"]);
const ClaimHit = z.object({ claim: ClaimSummary, matched_in: z.array(MatchedIn) });
const ClaimRead = z.object({ assignments: z.array(ClaimAssignmentRead), carrier_claim_number: z.string().nullable(), carrier_name: z.string().nullable(), contacts: z.array(ClaimContactRead), created_at: z.iso.datetime({ offset: true }), created_by_id: z.uuid().nullable(), description: z.string().nullable(), id: z.uuid(), loss_date: z.iso.date().nullable(), loss_type: LossType, next_statuses: z.array(ClaimStatus), number: z.string(), policy_number: z.string().nullable(), property: PropertyRead, status: ClaimStatus, updated_at: z.iso.datetime({ offset: true }) });
const ClaimRef = z.object({ id: z.uuid(), number: z.string() });
const ClaimSort = z.enum(["-created_at","created_at","-updated_at","-loss_date","loss_date"]);
const ClaimStatusChangeCreate = z.strictObject({ expected_status: ClaimStatus.nullable().optional(), reason: z.string().max(1000).nullable().optional(), status: ClaimStatus });
const ClaimStatusChangeRead = z.object({ changed_at: z.iso.datetime({ offset: true }), changed_by: ClaimActor.nullable(), from_status: ClaimStatus, id: z.uuid(), reason: z.string().nullable(), to_status: ClaimStatus });
const ClaimUpdate = z.strictObject({ carrier_claim_number: z.string().max(64).nullable().optional(), carrier_name: z.string().max(200).nullable().optional(), description: z.string().max(10000).nullable().optional(), loss_date: z.iso.date().nullable().optional(), loss_type: LossType.nullable().optional(), policy_number: z.string().max(64).nullable().optional() });
const ContactCreate = z.strictObject({ company_name: z.string().min(1).max(200).nullable().optional(), email: z.string().max(254).nullable().optional(), full_name: z.string().min(1).max(200), kind: ContactKind.optional(), notes: z.string().max(4000).nullable().optional(), phone: z.string().max(40).nullable().optional(), preferred_contact_method: ContactMethod.nullable().optional() });
const ContactHit = z.object({ contact: ContactRead });
const ContactUpdate = z.strictObject({ company_name: z.string().min(1).max(200).nullable().optional(), email: z.string().max(254).nullable().optional(), full_name: z.string().min(1).max(200).nullable().optional(), kind: ContactKind.nullable().optional(), notes: z.string().max(4000).nullable().optional(), phone: z.string().max(40).nullable().optional(), preferred_contact_method: ContactMethod.nullable().optional() });
const CurrentPlacement = z.object({ claim: ClaimRef, id: z.uuid(), placed_at: z.iso.datetime({ offset: true }), room_id: z.uuid() });
const CursorPage_AuditEventRead_ = z.object({ has_more: z.boolean(), items: z.array(AuditEventRead), next_cursor: z.string().nullable() });
const CursorPage_ClaimSummary_ = z.object({ has_more: z.boolean(), items: z.array(ClaimSummary), next_cursor: z.string().nullable() });
const CursorPage_ContactRead_ = z.object({ has_more: z.boolean(), items: z.array(ContactRead), next_cursor: z.string().nullable() });
const DocumentCategory = z.enum(["authorization","correspondence","estimate","invoice","policy","report","other"]);
const DocumentType = z.enum(["application/pdf","application/msword","application/vnd.openxmlformats-officedocument.wordprocessingml.document","application/vnd.ms-excel","application/vnd.openxmlformats-officedocument.spreadsheetml.sheet","text/csv","text/plain","message/rfc822","image/jpeg","image/png","image/webp","image/heic"]);
const DocumentRead = z.object({ category: DocumentCategory, claim_id: z.uuid(), content_type: DocumentType, created_at: z.iso.datetime({ offset: true }), download_url: z.string(), filename: z.string(), id: z.uuid(), size_bytes: z.int(), title: z.string(), updated_at: z.iso.datetime({ offset: true }), uploaded_by: ClaimActor.nullable(), view_url: z.string().nullable() });
const CursorPage_DocumentRead_ = z.object({ has_more: z.boolean(), items: z.array(DocumentRead), next_cursor: z.string().nullable() });
const EquipmentKind = z.enum(["dehumidifier","desiccant_dehumidifier","air_mover","air_scrubber","heater","other"]);
const EquipmentStatus = z.enum(["in_service","maintenance","retired"]);
const EquipmentRead = z.object({ asset_tag: z.string(), capacity: z.int().nullable(), capacity_unit: CapacityUnit.nullable(), created_at: z.iso.datetime({ offset: true }), current_placement: CurrentPlacement.nullable(), id: z.uuid(), kind: EquipmentKind, name: z.string(), notes: z.string().nullable(), serial_number: z.string().nullable(), status: EquipmentStatus, updated_at: z.iso.datetime({ offset: true }) });
const CursorPage_EquipmentRead_ = z.object({ has_more: z.boolean(), items: z.array(EquipmentRead), next_cursor: z.string().nullable() });
const ReadingRead = z.object({ label: z.string(), point_id: z.uuid(), value: z.number().min(0).max(9999.9) });
const MoistureLogRead = z.object({ atmosphere: z.array(AtmosphereRead), created_at: z.iso.datetime({ offset: true }), id: z.uuid(), notes: z.string().nullable(), readings: z.array(ReadingRead), readings_edited_at: z.iso.datetime({ offset: true }).nullable(), taken_at: z.iso.datetime({ offset: true }), taken_by: ClaimActor.nullable(), updated_at: z.iso.datetime({ offset: true }) });
const CursorPage_MoistureLogRead_ = z.object({ has_more: z.boolean(), items: z.array(MoistureLogRead), next_cursor: z.string().nullable() });
const NoteRead = z.object({ author: ClaimActor.nullable(), body: z.string(), claim: ClaimRef, created_at: z.iso.datetime({ offset: true }), edited_at: z.iso.datetime({ offset: true }).nullable(), id: z.uuid(), mentions: z.array(ClaimActor), text: z.string(), updated_at: z.iso.datetime({ offset: true }) });
const CursorPage_NoteRead_ = z.object({ has_more: z.boolean(), items: z.array(NoteRead), next_cursor: z.string().nullable() });
const OrganizationRead = z.object({ created_at: z.iso.datetime({ offset: true }), default_overhead_percent: z.string().regex(new RegExp("^\\d{1,3}(\\.\\d{1,3})?$")), default_profit_percent: z.string().regex(new RegExp("^\\d{1,3}(\\.\\d{1,3})?$")), default_tax_percent: z.string().regex(new RegExp("^\\d{1,3}(\\.\\d{1,3})?$")), id: z.uuid(), name: z.string(), slug: z.string(), timezone: z.string(), updated_at: z.iso.datetime({ offset: true }) });
const CursorPage_OrganizationRead_ = z.object({ has_more: z.boolean(), items: z.array(OrganizationRead), next_cursor: z.string().nullable() });
const PhotoType = z.enum(["image/jpeg","image/png","image/webp","image/heic","image/heif"]);
const ProcessingStatus = z.enum(["pending","ready","failed"]);
const PhotoRoom = z.object({ id: z.uuid(), name: z.string() });
const PhotoRead = z.object({ caption: z.string().nullable(), claim_id: z.uuid(), content_type: PhotoType, created_at: z.iso.datetime({ offset: true }), download_url: z.string(), filename: z.string(), height: z.int().nullable(), id: z.uuid(), preview_url: z.string().nullable(), processing: ProcessingStatus, room: PhotoRoom.nullable(), size_bytes: z.int(), tags: z.array(z.string()), taken_at: z.iso.datetime({ offset: true }).nullable(), thumbnail_url: z.string().nullable(), uploaded_by: ClaimActor.nullable(), url: z.string(), width: z.int().nullable() });
const CursorPage_PhotoRead_ = z.object({ has_more: z.boolean(), items: z.array(PhotoRead), next_cursor: z.string().nullable() });
const PriceItemRead = z.object({ category: z.string().nullable(), code: z.string(), description: z.string(), id: z.uuid(), unit: z.string(), unit_price: z.string().regex(new RegExp("^\\d{1,10}(\\.\\d{1,2})?$")), updated_at: z.iso.datetime({ offset: true }) });
const CursorPage_PriceItemRead_ = z.object({ has_more: z.boolean(), items: z.array(PriceItemRead), next_cursor: z.string().nullable() });
const CursorPage_PropertyRead_ = z.object({ has_more: z.boolean(), items: z.array(PropertyRead), next_cursor: z.string().nullable() });
const TaskRead = z.object({ assignee: ClaimActor.nullable(), claim: ClaimRef, completed_at: z.iso.datetime({ offset: true }).nullable(), completed_by_id: z.uuid().nullable(), created_at: z.iso.datetime({ offset: true }), created_by_id: z.uuid().nullable(), description: z.string().nullable(), done: z.boolean(), due_on: z.iso.date().nullable(), id: z.uuid(), title: z.string(), updated_at: z.iso.datetime({ offset: true }) });
const CursorPage_TaskRead_ = z.object({ has_more: z.boolean(), items: z.array(TaskRead), next_cursor: z.string().nullable() });
const TimelineKind = z.enum(["claim","status","contacts","team","layout","damage","photos","documents","moisture","equipment","estimates","reports","notes","tasks","other"]);
const TimelineSubject = z.object({ id: z.uuid(), type: z.string() });
const TimelineEntry = z.object({ action: z.string(), actor: ClaimActor.nullable(), at: z.iso.datetime({ offset: true }), changes: z.record(z.string(), z.array(z.unknown())), id: z.uuid(), kind: TimelineKind, subject: TimelineSubject, summary: z.string() });
const CursorPage_TimelineEntry_ = z.object({ has_more: z.boolean(), items: z.array(TimelineEntry), next_cursor: z.string().nullable() });
const Surface = z.enum(["floor","wall","ceiling","cabinetry","trim","fixture","contents","other"]);
const DamageItemCreate = z.strictObject({ cause: LossType.nullable().optional(), description: z.string().max(2000).nullable().optional(), material: z.string().min(1).max(100), surface: Surface, water_category: z.int().min(1).max(3).nullable().optional(), water_class: z.int().min(1).max(4).nullable().optional() });
const DamageItemRead = z.object({ cause: LossType, created_at: z.iso.datetime({ offset: true }), created_by_id: z.uuid().nullable(), description: z.string().nullable(), id: z.uuid(), material: z.string(), room_id: z.uuid(), surface: Surface, updated_at: z.iso.datetime({ offset: true }), water_category: z.int().nullable(), water_class: z.int().nullable() });
const DamageItemUpdate = z.strictObject({ cause: LossType.nullable().optional(), description: z.string().max(2000).nullable().optional(), material: z.string().min(1).max(100).nullable().optional(), room_id: z.uuid().nullable().optional(), surface: Surface.nullable().optional(), water_category: z.int().min(1).max(3).nullable().optional(), water_class: z.int().min(1).max(4).nullable().optional() });
const DocumentUpdate = z.strictObject({ category: DocumentCategory.nullable().optional(), title: z.string().min(1).max(200).nullable().optional() });
const DocumentUploadCreate = z.strictObject({ category: DocumentCategory.optional(), content_type: DocumentType, filename: z.string().min(1).max(255), size_bytes: z.int().gt(0), title: z.string().min(1).max(200).nullable().optional() });
const SignedUploadRead = z.object({ expires_at: z.iso.datetime({ offset: true }), headers: z.record(z.string(), z.string()), method: z.literal("PUT"), url: z.string() });
const DocumentUploadRead = z.object({ id: z.uuid(), upload: SignedUploadRead });
const DryingAlert = z.object({ details: z.record(z.string(), z.int()), equipment: AlertEquipment.nullable(), kind: AlertKind, message: z.string(), point: AlertPoint.nullable(), room: AtmosphereRoom.nullable(), since: z.iso.datetime({ offset: true }).nullable() });
const DryingLogAirValue = z.object({ dew_point_f: z.number().nullable(), grain_depression: z.number().nullable(), grains_per_pound: z.number(), relative_humidity: z.number().min(0).max(100), temperature_f: z.number().min(-40).max(160) });
const DryingLogAir = z.object({ dehumidifier: AtmosphereUnit.nullable(), location: AtmosphereLocation, room: AtmosphereRoom.nullable(), values: z.array(DryingLogAirValue.nullable()) });
const GoalBasis = z.enum(["reference","published","manual"]);
const MoistureScale = z.enum(["percent","reference"]);
const DryingStatus = z.enum(["dry","drying","no_goal","not_read"]);
const DryingLogPoint = z.object({ dried_at: z.iso.datetime({ offset: true }).nullable(), dry_standard: z.number().min(0).max(9999.9).nullable(), dry_standard_basis: GoalBasis.nullable(), id: z.uuid(), label: z.string(), material: z.string(), scale: MoistureScale, status: DryingStatus, surface: Surface, values: z.array(z.number().min(0).max(9999.9).nullable()) });
const DryingLogRoom = z.object({ id: z.uuid(), name: z.string(), points: z.array(DryingLogPoint) });
const DryingLogVisit = z.object({ id: z.uuid(), taken_at: z.iso.datetime({ offset: true }), taken_by: ClaimActor.nullable() });
const DryingLog = z.object({ atmosphere: z.array(DryingLogAir), rooms: z.array(DryingLogRoom), visits: z.array(DryingLogVisit) });
const DryingReportOptions = z.strictObject({ include_alerts: z.boolean().optional(), include_atmosphere: z.boolean().optional(), include_equipment: z.boolean().optional() });
const DryingSummary = z.object({ all_dry: z.boolean(), dry: z.int(), drying: z.int(), last_visit_at: z.iso.datetime({ offset: true }).nullable(), no_goal: z.int(), not_read: z.int(), points: z.int() });
const DryingStatusRead = z.object({ alerts: z.array(DryingAlert), summary: DryingSummary });
const EquipmentCreate = z.strictObject({ asset_tag: z.string().min(1).max(40), capacity: z.int().gt(0).max(10000000).nullable().optional(), kind: EquipmentKind, name: z.string().min(1).max(100), notes: z.string().max(2000).nullable().optional(), serial_number: z.string().max(100).nullable().optional(), status: EquipmentStatus.optional() });
const EquipmentDays = z.object({ days: z.int(), kind: EquipmentKind, placements: z.int(), running: z.int() });
const EquipmentUpdate = z.strictObject({ asset_tag: z.string().min(1).max(40).nullable().optional(), capacity: z.int().gt(0).max(10000000).nullable().optional(), kind: EquipmentKind.nullable().optional(), name: z.string().min(1).max(100).nullable().optional(), notes: z.string().max(2000).nullable().optional(), serial_number: z.string().max(100).nullable().optional(), status: EquipmentStatus.nullable().optional() });
const EstimateCreate = z.strictObject({ notes: z.string().max(4000).nullable().optional(), overhead_percent: z.string().regex(new RegExp("^\\d{1,3}(\\.\\d{1,3})?$")).nullable().optional(), price_list_id: z.uuid().nullable().optional(), profit_percent: z.string().regex(new RegExp("^\\d{1,3}(\\.\\d{1,3})?$")).nullable().optional(), tax_percent: z.string().regex(new RegExp("^\\d{1,3}(\\.\\d{1,3})?$")).nullable().optional(), title: z.string().min(1).max(200) });
const EstimatePriceList = z.object({ id: z.uuid(), name: z.string() });
const LineRoom = z.object({ id: z.uuid(), name: z.string() });
const LineRead = z.object({ code: z.string().nullable(), description: z.string(), id: z.uuid(), notes: z.string().nullable(), position: z.int(), price_item_id: z.uuid().nullable(), quantity: z.string().regex(new RegExp("^\\d{1,10}(\\.\\d{1,2})?$")), room: LineRoom.nullable(), taxable: z.boolean(), total: z.string().regex(new RegExp("^\\d{1,10}(\\.\\d{1,2})?$")), unit: z.string(), unit_price: z.string().regex(new RegExp("^\\d{1,10}(\\.\\d{1,2})?$")) });
const EstimateStatus = z.enum(["draft","submitted","approved","rejected"]);
const RoomSubtotal = z.object({ lines: z.int(), room: LineRoom.nullable(), subtotal: z.string().regex(new RegExp("^\\d{1,10}(\\.\\d{1,2})?$")) });
const EstimateTotals = z.object({ overhead: z.string().regex(new RegExp("^\\d{1,10}(\\.\\d{1,2})?$")), profit: z.string().regex(new RegExp("^\\d{1,10}(\\.\\d{1,2})?$")), subtotal: z.string().regex(new RegExp("^\\d{1,10}(\\.\\d{1,2})?$")), tax: z.string().regex(new RegExp("^\\d{1,10}(\\.\\d{1,2})?$")), taxable_subtotal: z.string().regex(new RegExp("^\\d{1,10}(\\.\\d{1,2})?$")), total: z.string().regex(new RegExp("^\\d{1,10}(\\.\\d{1,2})?$")) });
const EstimateRead = z.object({ claim_id: z.uuid(), created_at: z.iso.datetime({ offset: true }), created_by: ClaimActor.nullable(), id: z.uuid(), lines: z.array(LineRead), next_statuses: z.array(EstimateStatus), notes: z.string().nullable(), number: z.int(), overhead_percent: z.string().regex(new RegExp("^\\d{1,3}(\\.\\d{1,3})?$")), price_list: EstimatePriceList.nullable(), profit_percent: z.string().regex(new RegExp("^\\d{1,3}(\\.\\d{1,3})?$")), rooms: z.array(RoomSubtotal), status: EstimateStatus, tax_percent: z.string().regex(new RegExp("^\\d{1,3}(\\.\\d{1,3})?$")), title: z.string(), total: z.string().regex(new RegExp("^\\d{1,10}(\\.\\d{1,2})?$")), totals: EstimateTotals, updated_at: z.iso.datetime({ offset: true }) });
const EstimateStatusChange = z.strictObject({ status: EstimateStatus });
const EstimateSummary = z.object({ claim_id: z.uuid(), created_at: z.iso.datetime({ offset: true }), id: z.uuid(), number: z.int(), status: EstimateStatus, title: z.string(), total: z.string().regex(new RegExp("^\\d{1,10}(\\.\\d{1,2})?$")), updated_at: z.iso.datetime({ offset: true }) });
const EstimateUpdate = z.strictObject({ notes: z.string().max(4000).nullable().optional(), overhead_percent: z.string().regex(new RegExp("^\\d{1,3}(\\.\\d{1,3})?$")).nullable().optional(), price_list_id: z.uuid().nullable().optional(), profit_percent: z.string().regex(new RegExp("^\\d{1,3}(\\.\\d{1,3})?$")).nullable().optional(), tax_percent: z.string().regex(new RegExp("^\\d{1,3}(\\.\\d{1,3})?$")).nullable().optional(), title: z.string().min(1).max(200).nullable().optional() });
const FieldError = z.object({ loc: z.array(z.union([z.string(), z.int()])), message: z.string(), type: z.string() });
const HealthResponse = z.object({ status: z.literal("ok"), version: z.string() });
const ImportMode = z.enum(["merge","replace"]);
const ImportResult = z.object({ added: z.int(), dry_run: z.boolean(), ignored_columns: z.array(z.string()), mode: z.string(), removed: z.int(), rows: z.int(), unchanged: z.int(), updated: z.int() });
const InvitationAccept = z.strictObject({ full_name: z.string().min(1).max(200).nullable().optional(), password: z.string().max(128).nullable().optional(), token: z.string().min(1).max(200) });
const Role = z.enum(["owner","admin","adjuster","technician","viewer"]);
const InvitationCreate = z.strictObject({ email: z.string(), role: Role });
const InvitationRead = z.object({ created_at: z.iso.datetime({ offset: true }), email: z.string(), expires_at: z.iso.datetime({ offset: true }), id: z.uuid(), role: Role });
const JobStatus = z.enum(["queued","ready","failed"]);
const LineCreate = z.strictObject({ code: z.string().min(1).max(40).nullable().optional(), description: z.string().min(1).max(500).nullable().optional(), notes: z.string().max(4000).nullable().optional(), position: z.int().min(1).nullable().optional(), price_item_id: z.uuid().nullable().optional(), quantity: z.string().regex(new RegExp("^\\d{1,10}(\\.\\d{1,2})?$")), room_id: z.uuid().nullable().optional(), taxable: z.boolean().optional(), unit: z.string().nullable().optional(), unit_price: z.string().regex(new RegExp("^\\d{1,10}(\\.\\d{1,2})?$")).nullable().optional() });
const LineUpdate = z.strictObject({ code: z.string().min(1).max(40).nullable().optional(), description: z.string().min(1).max(500).nullable().optional(), notes: z.string().max(4000).nullable().optional(), position: z.int().min(1).nullable().optional(), quantity: z.string().regex(new RegExp("^\\d{1,10}(\\.\\d{1,2})?$")).nullable().optional(), room_id: z.uuid().nullable().optional(), taxable: z.boolean().nullable().optional(), unit: z.string().nullable().optional(), unit_price: z.string().regex(new RegExp("^\\d{1,10}(\\.\\d{1,2})?$")).nullable().optional() });
const LoginRequest = z.strictObject({ email: z.string(), password: z.string().min(1).max(128) });
const MembershipOrganization = z.object({ id: z.uuid(), name: z.string(), slug: z.string() });
const Permission = z.enum(["org:read","org:update","org:delete","members:read","members:manage","claims:read","claims:write","claims:delete","claims:reopen","contacts:read","contacts:write","field_data:write","estimates:write","estimates:approve","reports:generate","audit:read"]);
const MembershipRead = z.object({ organization: MembershipOrganization, permissions: z.array(Permission), role: Role });
const MeResponse = z.object({ email: z.string(), full_name: z.string(), id: z.uuid(), memberships: z.array(MembershipRead) });
const MeUpdate = z.strictObject({ full_name: z.string().min(1).max(200) });
const MemberPerson = z.object({ full_name: z.string(), id: z.uuid() });
const MemberRead = z.object({ joined_at: z.iso.datetime({ offset: true }), permissions: z.array(Permission), role: Role, user: MemberPerson });
const ReadingIn = z.strictObject({ point_id: z.uuid(), value: z.number().min(0).max(9999.9) });
const MoistureLogCreate = z.strictObject({ atmosphere: z.array(AtmosphereIn).max(500).optional(), notes: z.string().max(2000).nullable().optional(), readings: z.array(ReadingIn).max(500).optional(), taken_at: z.iso.datetime({ offset: true }).nullable().optional() });
const ReadingChange = z.strictObject({ point_id: z.uuid(), value: z.number().min(0).max(9999.9).nullable() });
const MoistureLogUpdate = z.strictObject({ atmosphere: z.array(AtmosphereIn).max(500).nullable().optional(), notes: z.string().max(2000).nullable().optional(), readings: z.array(ReadingChange).max(500).optional(), taken_at: z.iso.datetime({ offset: true }).nullable().optional() });
const MoisturePointCreate = z.strictObject({ dry_standard: z.number().min(0).max(9999.9).nullable().optional(), dry_standard_basis: GoalBasis.nullable().optional(), label: z.string().min(1).max(20).nullable().optional(), material: z.string().min(1).max(100), notes: z.string().max(2000).nullable().optional(), room_id: z.uuid(), scale: MoistureScale, surface: Surface });
const MoisturePointRoom = z.object({ id: z.uuid(), name: z.string() });
const MoisturePointRead = z.object({ created_at: z.iso.datetime({ offset: true }), dry_standard: z.number().min(0).max(9999.9).nullable(), dry_standard_basis: GoalBasis.nullable(), id: z.uuid(), label: z.string(), material: z.string(), notes: z.string().nullable(), room: MoisturePointRoom, scale: MoistureScale, surface: Surface, updated_at: z.iso.datetime({ offset: true }) });
const MoisturePointUpdate = z.strictObject({ dry_standard: z.number().min(0).max(9999.9).nullable().optional(), dry_standard_basis: GoalBasis.nullable().optional(), label: z.string().min(1).max(20).nullable().optional(), material: z.string().min(1).max(100).nullable().optional(), notes: z.string().max(2000).nullable().optional(), room_id: z.uuid().nullable().optional(), surface: Surface.nullable().optional() });
const NoteCreate = z.strictObject({ body: z.string().min(1).max(10000) });
const NoteUpdate = z.strictObject({ body: z.string().min(1).max(10000) });
const OrganizationCreate = z.strictObject({ name: z.string().min(1).max(200), slug: z.string().max(63).regex(new RegExp("^[a-z0-9]+(-[a-z0-9]+)*$")).nullable().optional(), timezone: z.string().optional() });
const OrganizationUpdate = z.strictObject({ default_overhead_percent: z.string().regex(new RegExp("^\\d{1,3}(\\.\\d{1,3})?$")).nullable().optional(), default_profit_percent: z.string().regex(new RegExp("^\\d{1,3}(\\.\\d{1,3})?$")).nullable().optional(), default_tax_percent: z.string().regex(new RegExp("^\\d{1,3}(\\.\\d{1,3})?$")).nullable().optional(), name: z.string().min(1).max(200).nullable().optional(), timezone: z.string().nullable().optional() });
const PasswordChange = z.strictObject({ current_password: z.string().min(1).max(128), new_password: z.string().min(1).max(128) });
const PhotoReportOptions = z.strictObject({ group_by_room: z.boolean().optional(), photos_per_page: z.union([z.literal(1), z.literal(2), z.literal(4), z.literal(6)]).optional(), show_captions: z.boolean().optional(), show_tags: z.boolean().optional(), show_taken_at: z.boolean().optional() });
const PhotoUpdate = z.strictObject({ caption: z.string().max(2000).nullable().optional(), room_id: z.uuid().nullable().optional(), tags: z.array(z.string().min(1).max(40)).max(20).nullable().optional() });
const PhotoUploadCreate = z.strictObject({ caption: z.string().max(2000).nullable().optional(), content_type: PhotoType, filename: z.string().min(1).max(255), room_id: z.uuid().nullable().optional(), size_bytes: z.int().gt(0), tags: z.array(z.string().min(1).max(40)).max(20).optional(), taken_at: z.iso.datetime({ offset: true }).nullable().optional() });
const PhotoUploadRead = z.object({ id: z.uuid(), upload: SignedUploadRead });
const PlacedEquipment = z.object({ asset_tag: z.string(), id: z.uuid(), kind: EquipmentKind, name: z.string() });
const PlacementCreate = z.strictObject({ equipment_id: z.uuid(), placed_at: z.iso.datetime({ offset: true }).nullable().optional(), room_id: z.uuid() });
const PlacementRoom = z.object({ id: z.uuid(), name: z.string() });
const PlacementRead = z.object({ days: z.int(), equipment: PlacedEquipment, id: z.uuid(), placed_at: z.iso.datetime({ offset: true }), placed_by: ClaimActor.nullable(), removed_at: z.iso.datetime({ offset: true }).nullable(), removed_by: ClaimActor.nullable(), room: PlacementRoom, running: z.boolean() });
const PlacementRemove = z.strictObject({ removed_at: z.iso.datetime({ offset: true }).nullable().optional() });
const PlacementUpdate = z.strictObject({ placed_at: z.iso.datetime({ offset: true }).nullable().optional(), removed_at: z.iso.datetime({ offset: true }).nullable().optional(), room_id: z.uuid().nullable().optional() });
const PriceItemCreate = z.strictObject({ category: z.string().max(40).nullable().optional(), code: z.string().min(1).max(40), description: z.string().min(1).max(500), unit: z.string(), unit_price: z.string().regex(new RegExp("^\\d{1,10}(\\.\\d{1,2})?$")) });
const PriceItemUpdate = z.strictObject({ category: z.string().max(40).nullable().optional(), code: z.string().min(1).max(40).nullable().optional(), description: z.string().min(1).max(500).nullable().optional(), unit: z.string().nullable().optional(), unit_price: z.string().regex(new RegExp("^\\d{1,10}(\\.\\d{1,2})?$")).nullable().optional() });
const PriceListCreate = z.strictObject({ description: z.string().max(2000).nullable().optional(), effective_on: z.iso.date().nullable().optional(), is_default: z.boolean().optional(), name: z.string().min(1).max(100) });
const PriceListRead = z.object({ created_at: z.iso.datetime({ offset: true }), description: z.string().nullable(), effective_on: z.iso.date().nullable(), id: z.uuid(), imported_at: z.iso.datetime({ offset: true }).nullable(), is_default: z.boolean(), item_count: z.int(), name: z.string(), updated_at: z.iso.datetime({ offset: true }) });
const PriceListUpdate = z.strictObject({ description: z.string().max(2000).nullable().optional(), effective_on: z.iso.date().nullable().optional(), is_default: z.boolean().nullable().optional(), name: z.string().min(1).max(100).nullable().optional() });
const Problem = z.object({ code: z.string(), detail: z.string(), errors: z.array(FieldError).nullable().optional(), instance: z.string(), request_id: z.string().nullable().optional(), status: z.int(), title: z.string(), type: z.string() });
const PropertyUpdate = z.strictObject({ access_notes: z.string().max(2000).nullable().optional(), address: AddressInput.nullable().optional(), latitude: z.number().min(-90).max(90).nullable().optional(), longitude: z.number().min(-180).max(180).nullable().optional(), property_type: PropertyType.nullable().optional(), year_built: z.int().min(1600).nullable().optional() });
const ReadinessResponse = z.object({ database: z.enum(["ok","unreachable"]), status: z.enum(["ready","unavailable"]), storage: z.enum(["ok","unreachable"]) });
const RefreshRequest = z.strictObject({ refresh_token: z.string().min(1).max(200) });
const ReportKind = z.enum(["photo_report","drying_report"]);
const ReportJobRead = z.object({ claim_id: z.uuid(), created_at: z.iso.datetime({ offset: true }), download_url: z.string().nullable(), error: z.string().nullable(), finished_at: z.iso.datetime({ offset: true }).nullable(), id: z.uuid(), kind: ReportKind, requested_by: ClaimActor.nullable(), size_bytes: z.int().nullable(), status: JobStatus });
const ReportRequest = z.strictObject({ kind: ReportKind });
const RoomCreate = z.strictObject({ height_ft: z.number().gt(0).max(9999.99).nullable().optional(), length_ft: z.number().gt(0).max(9999.99).nullable().optional(), level: z.string().max(40).nullable().optional(), name: z.string().min(1).max(100), width_ft: z.number().gt(0).max(9999.99).nullable().optional() });
const RoomRead = z.object({ created_at: z.iso.datetime({ offset: true }), floor_area_sqft: z.number().nullable(), height_ft: z.number().nullable(), id: z.uuid(), length_ft: z.number().nullable(), level: z.string().nullable(), name: z.string(), structure_id: z.uuid(), updated_at: z.iso.datetime({ offset: true }), volume_cuft: z.number().nullable(), wall_area_sqft: z.number().nullable(), width_ft: z.number().nullable() });
const RoomUpdate = z.strictObject({ height_ft: z.number().gt(0).max(9999.99).nullable().optional(), length_ft: z.number().gt(0).max(9999.99).nullable().optional(), level: z.string().max(40).nullable().optional(), name: z.string().min(1).max(100).nullable().optional(), structure_id: z.uuid().nullable().optional(), width_ft: z.number().gt(0).max(9999.99).nullable().optional() });
const SearchResults = z.object({ claims: z.array(ClaimHit), contacts: z.array(ContactHit) });
const ShareCreate = z.strictObject({ expires_in_days: z.int().min(1).max(30).optional(), label: z.string().max(200).nullable().optional() });
const ShareCreated = z.object({ active: z.boolean(), created_at: z.iso.datetime({ offset: true }), created_by: ClaimActor.nullable(), expires_at: z.iso.datetime({ offset: true }), id: z.uuid(), label: z.string().nullable(), last_opened_at: z.iso.datetime({ offset: true }).nullable(), open_count: z.int(), report_id: z.uuid(), revoked_at: z.iso.datetime({ offset: true }).nullable(), url: z.string() });
const ShareRead = z.object({ active: z.boolean(), created_at: z.iso.datetime({ offset: true }), created_by: ClaimActor.nullable(), expires_at: z.iso.datetime({ offset: true }), id: z.uuid(), label: z.string().nullable(), last_opened_at: z.iso.datetime({ offset: true }).nullable(), open_count: z.int(), report_id: z.uuid(), revoked_at: z.iso.datetime({ offset: true }).nullable() });
const StructureCreate = z.strictObject({ name: z.string().min(1).max(100) });
const StructureRead = z.object({ created_at: z.iso.datetime({ offset: true }), id: z.uuid(), name: z.string(), rooms: z.array(RoomRead), updated_at: z.iso.datetime({ offset: true }) });
const StructureUpdate = z.strictObject({ name: z.string().min(1).max(100).nullable().optional() });
const TagCount = z.object({ photos: z.int(), tag: z.string() });
const TaskCreate = z.strictObject({ assignee_id: z.uuid().nullable().optional(), description: z.string().max(4000).nullable().optional(), due_on: z.iso.date().nullable().optional(), title: z.string().min(1).max(200) });
const TaskStatus = z.enum(["open","done"]);
const TaskUpdate = z.strictObject({ assignee_id: z.uuid().nullable().optional(), description: z.string().max(4000).nullable().optional(), done: z.boolean().nullable().optional(), due_on: z.iso.date().nullable().optional(), title: z.string().min(1).max(200).nullable().optional() });
const TemplateCreate = z.strictObject({ accent_color: z.string().regex(new RegExp("^#[0-9A-Fa-f]{6}$")).optional(), footer_text: z.string().max(2000).nullable().optional(), header_text: z.string().max(2000).nullable().optional(), is_default: z.boolean().optional(), kind: ReportKind, name: z.string().min(1).max(100), options: z.record(z.string(), z.unknown()).nullable().optional(), title: z.string().max(200).nullable().optional() });
const TemplateRead = z.object({ accent_color: z.string(), built_in: z.boolean(), created_at: z.iso.datetime({ offset: true }).nullable(), footer_text: z.string().nullable(), header_text: z.string().nullable(), id: z.uuid().nullable(), is_default: z.boolean(), kind: ReportKind, logo_url: z.string().nullable(), name: z.string(), options: z.union([PhotoReportOptions, DryingReportOptions]), title: z.string(), updated_at: z.iso.datetime({ offset: true }).nullable() });
const TemplateUpdate = z.strictObject({ accent_color: z.string().regex(new RegExp("^#[0-9A-Fa-f]{6}$")).nullable().optional(), footer_text: z.string().max(2000).nullable().optional(), header_text: z.string().max(2000).nullable().optional(), is_default: z.boolean().nullable().optional(), name: z.string().min(1).max(100).nullable().optional(), options: z.record(z.string(), z.unknown()).nullable().optional(), title: z.string().max(200).nullable().optional() });
const TokenResponse = z.object({ access_token: z.string(), expires_in: z.int(), refresh_expires_at: z.iso.datetime({ offset: true }), refresh_token: z.string(), token_type: z.literal("bearer").optional() });

/** Every named schema in the contract, by name: `schemas.ClaimRead`. */
export const schemas = {
  AddressInput,
  AddressRead,
  AlertEquipment,
  AlertKind,
  AlertPoint,
  AssignmentRole,
  AtmosphereLocation,
  AtmosphereIn,
  AtmosphereUnit,
  AtmosphereRoom,
  AtmosphereRead,
  AuditActor,
  AuditEventRead,
  CapacityUnit,
  ClaimActor,
  ClaimAssignmentCreate,
  ClaimAssignmentRead,
  ClaimContactRole,
  ClaimContactLink,
  ClaimContactLinkUpdate,
  ContactKind,
  ContactMethod,
  ContactRead,
  ClaimContactRead,
  LossType,
  PropertyType,
  PropertyCreate,
  ClaimCreate,
  PropertyRead,
  ClaimStatus,
  ClaimSummary,
  MatchedIn,
  ClaimHit,
  ClaimRead,
  ClaimRef,
  ClaimSort,
  ClaimStatusChangeCreate,
  ClaimStatusChangeRead,
  ClaimUpdate,
  ContactCreate,
  ContactHit,
  ContactUpdate,
  CurrentPlacement,
  CursorPage_AuditEventRead_,
  CursorPage_ClaimSummary_,
  CursorPage_ContactRead_,
  DocumentCategory,
  DocumentType,
  DocumentRead,
  CursorPage_DocumentRead_,
  EquipmentKind,
  EquipmentStatus,
  EquipmentRead,
  CursorPage_EquipmentRead_,
  ReadingRead,
  MoistureLogRead,
  CursorPage_MoistureLogRead_,
  NoteRead,
  CursorPage_NoteRead_,
  OrganizationRead,
  CursorPage_OrganizationRead_,
  PhotoType,
  ProcessingStatus,
  PhotoRoom,
  PhotoRead,
  CursorPage_PhotoRead_,
  PriceItemRead,
  CursorPage_PriceItemRead_,
  CursorPage_PropertyRead_,
  TaskRead,
  CursorPage_TaskRead_,
  TimelineKind,
  TimelineSubject,
  TimelineEntry,
  CursorPage_TimelineEntry_,
  Surface,
  DamageItemCreate,
  DamageItemRead,
  DamageItemUpdate,
  DocumentUpdate,
  DocumentUploadCreate,
  SignedUploadRead,
  DocumentUploadRead,
  DryingAlert,
  DryingLogAirValue,
  DryingLogAir,
  GoalBasis,
  MoistureScale,
  DryingStatus,
  DryingLogPoint,
  DryingLogRoom,
  DryingLogVisit,
  DryingLog,
  DryingReportOptions,
  DryingSummary,
  DryingStatusRead,
  EquipmentCreate,
  EquipmentDays,
  EquipmentUpdate,
  EstimateCreate,
  EstimatePriceList,
  LineRoom,
  LineRead,
  EstimateStatus,
  RoomSubtotal,
  EstimateTotals,
  EstimateRead,
  EstimateStatusChange,
  EstimateSummary,
  EstimateUpdate,
  FieldError,
  HealthResponse,
  ImportMode,
  ImportResult,
  InvitationAccept,
  Role,
  InvitationCreate,
  InvitationRead,
  JobStatus,
  LineCreate,
  LineUpdate,
  LoginRequest,
  MembershipOrganization,
  Permission,
  MembershipRead,
  MeResponse,
  MeUpdate,
  MemberPerson,
  MemberRead,
  ReadingIn,
  MoistureLogCreate,
  ReadingChange,
  MoistureLogUpdate,
  MoisturePointCreate,
  MoisturePointRoom,
  MoisturePointRead,
  MoisturePointUpdate,
  NoteCreate,
  NoteUpdate,
  OrganizationCreate,
  OrganizationUpdate,
  PasswordChange,
  PhotoReportOptions,
  PhotoUpdate,
  PhotoUploadCreate,
  PhotoUploadRead,
  PlacedEquipment,
  PlacementCreate,
  PlacementRoom,
  PlacementRead,
  PlacementRemove,
  PlacementUpdate,
  PriceItemCreate,
  PriceItemUpdate,
  PriceListCreate,
  PriceListRead,
  PriceListUpdate,
  Problem,
  PropertyUpdate,
  ReadinessResponse,
  RefreshRequest,
  ReportKind,
  ReportJobRead,
  ReportRequest,
  RoomCreate,
  RoomRead,
  RoomUpdate,
  SearchResults,
  ShareCreate,
  ShareCreated,
  ShareRead,
  StructureCreate,
  StructureRead,
  StructureUpdate,
  TagCount,
  TaskCreate,
  TaskStatus,
  TaskUpdate,
  TemplateCreate,
  TemplateRead,
  TemplateUpdate,
  TokenResponse,
};

/** Success bodies by operation (`get /v1/me`) and status. */
export const responses = {
  "get /healthz": { 200: HealthResponse },
  "get /readyz": { 200: ReadinessResponse },
  "post /v1/auth/login": { 200: TokenResponse },
  "post /v1/auth/refresh": { 200: TokenResponse },
  "post /v1/invitations/accept": { 200: TokenResponse },
  "get /v1/me": { 200: MeResponse },
  "patch /v1/me": { 200: MeResponse },
  "post /v1/me/password": { 200: TokenResponse },
  "get /v1/organizations": { 200: CursorPage_OrganizationRead_ },
  "post /v1/organizations": { 201: OrganizationRead },
  "get /v1/organizations/{organization_id}": { 200: OrganizationRead },
  "patch /v1/organizations/{organization_id}": { 200: OrganizationRead },
  "get /v1/organizations/{organization_id}/audit-events": { 200: CursorPage_AuditEventRead_ },
  "get /v1/organizations/{organization_id}/claims": { 200: CursorPage_ClaimSummary_ },
  "post /v1/organizations/{organization_id}/claims": { 201: ClaimRead },
  "get /v1/organizations/{organization_id}/claims/by-number/{number}": { 200: ClaimRead },
  "get /v1/organizations/{organization_id}/claims/{claim_id}": { 200: ClaimRead },
  "patch /v1/organizations/{organization_id}/claims/{claim_id}": { 200: ClaimRead },
  "post /v1/organizations/{organization_id}/claims/{claim_id}/assignments": { 201: ClaimAssignmentRead },
  "post /v1/organizations/{organization_id}/claims/{claim_id}/contacts": { 201: ClaimContactRead },
  "patch /v1/organizations/{organization_id}/claims/{claim_id}/contacts/{contact_id}": { 200: ClaimContactRead },
  "get /v1/organizations/{organization_id}/claims/{claim_id}/damage-items": { 200: z.array(DamageItemRead) },
  "get /v1/organizations/{organization_id}/claims/{claim_id}/damage-items/{damage_item_id}": { 200: DamageItemRead },
  "patch /v1/organizations/{organization_id}/claims/{claim_id}/damage-items/{damage_item_id}": { 200: DamageItemRead },
  "post /v1/organizations/{organization_id}/claims/{claim_id}/document-uploads": { 201: DocumentUploadRead },
  "post /v1/organizations/{organization_id}/claims/{claim_id}/document-uploads/{upload_id}/complete": { 200: DocumentRead, 201: DocumentRead },
  "get /v1/organizations/{organization_id}/claims/{claim_id}/documents": { 200: CursorPage_DocumentRead_ },
  "get /v1/organizations/{organization_id}/claims/{claim_id}/documents/{document_id}": { 200: DocumentRead },
  "patch /v1/organizations/{organization_id}/claims/{claim_id}/documents/{document_id}": { 200: DocumentRead },
  "get /v1/organizations/{organization_id}/claims/{claim_id}/drying-log": { 200: DryingLog },
  "get /v1/organizations/{organization_id}/claims/{claim_id}/drying-status": { 200: DryingStatusRead },
  "get /v1/organizations/{organization_id}/claims/{claim_id}/equipment-days": { 200: z.array(EquipmentDays) },
  "get /v1/organizations/{organization_id}/claims/{claim_id}/equipment-placements": { 200: z.array(PlacementRead) },
  "post /v1/organizations/{organization_id}/claims/{claim_id}/equipment-placements": { 201: PlacementRead },
  "patch /v1/organizations/{organization_id}/claims/{claim_id}/equipment-placements/{placement_id}": { 200: PlacementRead },
  "post /v1/organizations/{organization_id}/claims/{claim_id}/equipment-placements/{placement_id}/remove": { 200: PlacementRead },
  "get /v1/organizations/{organization_id}/claims/{claim_id}/estimates": { 200: z.array(EstimateSummary) },
  "post /v1/organizations/{organization_id}/claims/{claim_id}/estimates": { 201: EstimateRead },
  "get /v1/organizations/{organization_id}/claims/{claim_id}/estimates/{estimate_id}": { 200: EstimateRead },
  "patch /v1/organizations/{organization_id}/claims/{claim_id}/estimates/{estimate_id}": { 200: EstimateRead },
  "post /v1/organizations/{organization_id}/claims/{claim_id}/estimates/{estimate_id}/lines": { 201: EstimateRead },
  "delete /v1/organizations/{organization_id}/claims/{claim_id}/estimates/{estimate_id}/lines/{line_id}": { 200: EstimateRead },
  "patch /v1/organizations/{organization_id}/claims/{claim_id}/estimates/{estimate_id}/lines/{line_id}": { 200: EstimateRead },
  "post /v1/organizations/{organization_id}/claims/{claim_id}/estimates/{estimate_id}/status": { 200: EstimateRead },
  "get /v1/organizations/{organization_id}/claims/{claim_id}/moisture-logs": { 200: CursorPage_MoistureLogRead_ },
  "post /v1/organizations/{organization_id}/claims/{claim_id}/moisture-logs": { 201: MoistureLogRead },
  "get /v1/organizations/{organization_id}/claims/{claim_id}/moisture-logs/{log_id}": { 200: MoistureLogRead },
  "patch /v1/organizations/{organization_id}/claims/{claim_id}/moisture-logs/{log_id}": { 200: MoistureLogRead },
  "get /v1/organizations/{organization_id}/claims/{claim_id}/moisture-points": { 200: z.array(MoisturePointRead) },
  "post /v1/organizations/{organization_id}/claims/{claim_id}/moisture-points": { 201: MoisturePointRead },
  "get /v1/organizations/{organization_id}/claims/{claim_id}/moisture-points/{point_id}": { 200: MoisturePointRead },
  "patch /v1/organizations/{organization_id}/claims/{claim_id}/moisture-points/{point_id}": { 200: MoisturePointRead },
  "get /v1/organizations/{organization_id}/claims/{claim_id}/notes": { 200: CursorPage_NoteRead_ },
  "post /v1/organizations/{organization_id}/claims/{claim_id}/notes": { 201: NoteRead },
  "patch /v1/organizations/{organization_id}/claims/{claim_id}/notes/{note_id}": { 200: NoteRead },
  "post /v1/organizations/{organization_id}/claims/{claim_id}/photo-uploads": { 201: PhotoUploadRead },
  "post /v1/organizations/{organization_id}/claims/{claim_id}/photo-uploads/{upload_id}/complete": { 200: PhotoRead, 201: PhotoRead },
  "get /v1/organizations/{organization_id}/claims/{claim_id}/photos": { 200: CursorPage_PhotoRead_ },
  "get /v1/organizations/{organization_id}/claims/{claim_id}/photos/{photo_id}": { 200: PhotoRead },
  "patch /v1/organizations/{organization_id}/claims/{claim_id}/photos/{photo_id}": { 200: PhotoRead },
  "get /v1/organizations/{organization_id}/claims/{claim_id}/reports": { 200: z.array(ReportJobRead) },
  "post /v1/organizations/{organization_id}/claims/{claim_id}/reports": { 202: ReportJobRead },
  "get /v1/organizations/{organization_id}/claims/{claim_id}/reports/{job_id}": { 200: ReportJobRead },
  "get /v1/organizations/{organization_id}/claims/{claim_id}/reports/{job_id}/shares": { 200: z.array(ShareRead) },
  "post /v1/organizations/{organization_id}/claims/{claim_id}/reports/{job_id}/shares": { 201: ShareCreated },
  "post /v1/organizations/{organization_id}/claims/{claim_id}/reports/{job_id}/shares/{share_id}/revoke": { 200: ShareRead },
  "get /v1/organizations/{organization_id}/claims/{claim_id}/rooms/{room_id}": { 200: RoomRead },
  "patch /v1/organizations/{organization_id}/claims/{claim_id}/rooms/{room_id}": { 200: RoomRead },
  "post /v1/organizations/{organization_id}/claims/{claim_id}/rooms/{room_id}/damage-items": { 201: DamageItemRead },
  "post /v1/organizations/{organization_id}/claims/{claim_id}/status": { 200: ClaimRead },
  "get /v1/organizations/{organization_id}/claims/{claim_id}/status-history": { 200: z.array(ClaimStatusChangeRead) },
  "get /v1/organizations/{organization_id}/claims/{claim_id}/structures": { 200: z.array(StructureRead) },
  "post /v1/organizations/{organization_id}/claims/{claim_id}/structures": { 201: StructureRead },
  "patch /v1/organizations/{organization_id}/claims/{claim_id}/structures/{structure_id}": { 200: StructureRead },
  "post /v1/organizations/{organization_id}/claims/{claim_id}/structures/{structure_id}/rooms": { 201: RoomRead },
  "get /v1/organizations/{organization_id}/claims/{claim_id}/tasks": { 200: z.array(TaskRead) },
  "post /v1/organizations/{organization_id}/claims/{claim_id}/tasks": { 201: TaskRead },
  "patch /v1/organizations/{organization_id}/claims/{claim_id}/tasks/{task_id}": { 200: TaskRead },
  "get /v1/organizations/{organization_id}/claims/{claim_id}/timeline": { 200: CursorPage_TimelineEntry_ },
  "get /v1/organizations/{organization_id}/contacts": { 200: CursorPage_ContactRead_ },
  "post /v1/organizations/{organization_id}/contacts": { 201: ContactRead },
  "get /v1/organizations/{organization_id}/contacts/{contact_id}": { 200: ContactRead },
  "patch /v1/organizations/{organization_id}/contacts/{contact_id}": { 200: ContactRead },
  "get /v1/organizations/{organization_id}/equipment": { 200: CursorPage_EquipmentRead_ },
  "post /v1/organizations/{organization_id}/equipment": { 201: EquipmentRead },
  "get /v1/organizations/{organization_id}/equipment/{equipment_id}": { 200: EquipmentRead },
  "patch /v1/organizations/{organization_id}/equipment/{equipment_id}": { 200: EquipmentRead },
  "get /v1/organizations/{organization_id}/invitations": { 200: z.array(InvitationRead) },
  "post /v1/organizations/{organization_id}/invitations": { 201: InvitationRead },
  "get /v1/organizations/{organization_id}/members": { 200: z.array(MemberRead) },
  "get /v1/organizations/{organization_id}/notes/mentioning-me": { 200: CursorPage_NoteRead_ },
  "get /v1/organizations/{organization_id}/photo-tags": { 200: z.array(TagCount) },
  "get /v1/organizations/{organization_id}/price-lists": { 200: z.array(PriceListRead) },
  "post /v1/organizations/{organization_id}/price-lists": { 201: PriceListRead },
  "get /v1/organizations/{organization_id}/price-lists/{list_id}": { 200: PriceListRead },
  "patch /v1/organizations/{organization_id}/price-lists/{list_id}": { 200: PriceListRead },
  "post /v1/organizations/{organization_id}/price-lists/{list_id}/import": { 200: ImportResult },
  "get /v1/organizations/{organization_id}/price-lists/{list_id}/items": { 200: CursorPage_PriceItemRead_ },
  "post /v1/organizations/{organization_id}/price-lists/{list_id}/items": { 201: PriceItemRead },
  "get /v1/organizations/{organization_id}/price-lists/{list_id}/items/{item_id}": { 200: PriceItemRead },
  "patch /v1/organizations/{organization_id}/price-lists/{list_id}/items/{item_id}": { 200: PriceItemRead },
  "get /v1/organizations/{organization_id}/properties": { 200: CursorPage_PropertyRead_ },
  "post /v1/organizations/{organization_id}/properties": { 201: PropertyRead },
  "get /v1/organizations/{organization_id}/properties/{property_id}": { 200: PropertyRead },
  "patch /v1/organizations/{organization_id}/properties/{property_id}": { 200: PropertyRead },
  "get /v1/organizations/{organization_id}/report-templates": { 200: z.array(TemplateRead) },
  "post /v1/organizations/{organization_id}/report-templates": { 201: TemplateRead },
  "get /v1/organizations/{organization_id}/report-templates/effective": { 200: TemplateRead },
  "get /v1/organizations/{organization_id}/report-templates/{template_id}": { 200: TemplateRead },
  "patch /v1/organizations/{organization_id}/report-templates/{template_id}": { 200: TemplateRead },
  "delete /v1/organizations/{organization_id}/report-templates/{template_id}/logo": { 200: TemplateRead },
  "put /v1/organizations/{organization_id}/report-templates/{template_id}/logo": { 200: TemplateRead },
  "get /v1/organizations/{organization_id}/search": { 200: SearchResults },
  "get /v1/organizations/{organization_id}/tasks/assigned-to-me": { 200: CursorPage_TaskRead_ },
};

/** JSON request bodies by operation (`post /v1/auth/login`). */
export const requests = {
  "post /v1/auth/login": LoginRequest,
  "post /v1/auth/logout": RefreshRequest,
  "post /v1/auth/refresh": RefreshRequest,
  "post /v1/invitations/accept": InvitationAccept,
  "patch /v1/me": MeUpdate,
  "post /v1/me/password": PasswordChange,
  "post /v1/organizations": OrganizationCreate,
  "patch /v1/organizations/{organization_id}": OrganizationUpdate,
  "post /v1/organizations/{organization_id}/claims": ClaimCreate,
  "patch /v1/organizations/{organization_id}/claims/{claim_id}": ClaimUpdate,
  "post /v1/organizations/{organization_id}/claims/{claim_id}/assignments": ClaimAssignmentCreate,
  "post /v1/organizations/{organization_id}/claims/{claim_id}/contacts": ClaimContactLink,
  "patch /v1/organizations/{organization_id}/claims/{claim_id}/contacts/{contact_id}": ClaimContactLinkUpdate,
  "patch /v1/organizations/{organization_id}/claims/{claim_id}/damage-items/{damage_item_id}": DamageItemUpdate,
  "post /v1/organizations/{organization_id}/claims/{claim_id}/document-uploads": DocumentUploadCreate,
  "patch /v1/organizations/{organization_id}/claims/{claim_id}/documents/{document_id}": DocumentUpdate,
  "post /v1/organizations/{organization_id}/claims/{claim_id}/equipment-placements": PlacementCreate,
  "patch /v1/organizations/{organization_id}/claims/{claim_id}/equipment-placements/{placement_id}": PlacementUpdate,
  "post /v1/organizations/{organization_id}/claims/{claim_id}/equipment-placements/{placement_id}/remove": PlacementRemove,
  "post /v1/organizations/{organization_id}/claims/{claim_id}/estimates": EstimateCreate,
  "patch /v1/organizations/{organization_id}/claims/{claim_id}/estimates/{estimate_id}": EstimateUpdate,
  "post /v1/organizations/{organization_id}/claims/{claim_id}/estimates/{estimate_id}/lines": LineCreate,
  "patch /v1/organizations/{organization_id}/claims/{claim_id}/estimates/{estimate_id}/lines/{line_id}": LineUpdate,
  "post /v1/organizations/{organization_id}/claims/{claim_id}/estimates/{estimate_id}/status": EstimateStatusChange,
  "post /v1/organizations/{organization_id}/claims/{claim_id}/moisture-logs": MoistureLogCreate,
  "patch /v1/organizations/{organization_id}/claims/{claim_id}/moisture-logs/{log_id}": MoistureLogUpdate,
  "post /v1/organizations/{organization_id}/claims/{claim_id}/moisture-points": MoisturePointCreate,
  "patch /v1/organizations/{organization_id}/claims/{claim_id}/moisture-points/{point_id}": MoisturePointUpdate,
  "post /v1/organizations/{organization_id}/claims/{claim_id}/notes": NoteCreate,
  "patch /v1/organizations/{organization_id}/claims/{claim_id}/notes/{note_id}": NoteUpdate,
  "post /v1/organizations/{organization_id}/claims/{claim_id}/photo-uploads": PhotoUploadCreate,
  "patch /v1/organizations/{organization_id}/claims/{claim_id}/photos/{photo_id}": PhotoUpdate,
  "post /v1/organizations/{organization_id}/claims/{claim_id}/reports": ReportRequest,
  "post /v1/organizations/{organization_id}/claims/{claim_id}/reports/{job_id}/shares": ShareCreate,
  "patch /v1/organizations/{organization_id}/claims/{claim_id}/rooms/{room_id}": RoomUpdate,
  "post /v1/organizations/{organization_id}/claims/{claim_id}/rooms/{room_id}/damage-items": DamageItemCreate,
  "post /v1/organizations/{organization_id}/claims/{claim_id}/status": ClaimStatusChangeCreate,
  "post /v1/organizations/{organization_id}/claims/{claim_id}/structures": StructureCreate,
  "patch /v1/organizations/{organization_id}/claims/{claim_id}/structures/{structure_id}": StructureUpdate,
  "post /v1/organizations/{organization_id}/claims/{claim_id}/structures/{structure_id}/rooms": RoomCreate,
  "post /v1/organizations/{organization_id}/claims/{claim_id}/tasks": TaskCreate,
  "patch /v1/organizations/{organization_id}/claims/{claim_id}/tasks/{task_id}": TaskUpdate,
  "post /v1/organizations/{organization_id}/contacts": ContactCreate,
  "patch /v1/organizations/{organization_id}/contacts/{contact_id}": ContactUpdate,
  "post /v1/organizations/{organization_id}/equipment": EquipmentCreate,
  "patch /v1/organizations/{organization_id}/equipment/{equipment_id}": EquipmentUpdate,
  "post /v1/organizations/{organization_id}/invitations": InvitationCreate,
  "post /v1/organizations/{organization_id}/price-lists": PriceListCreate,
  "patch /v1/organizations/{organization_id}/price-lists/{list_id}": PriceListUpdate,
  "post /v1/organizations/{organization_id}/price-lists/{list_id}/items": PriceItemCreate,
  "patch /v1/organizations/{organization_id}/price-lists/{list_id}/items/{item_id}": PriceItemUpdate,
  "post /v1/organizations/{organization_id}/properties": PropertyCreate,
  "patch /v1/organizations/{organization_id}/properties/{property_id}": PropertyUpdate,
  "post /v1/organizations/{organization_id}/report-templates": TemplateCreate,
  "patch /v1/organizations/{organization_id}/report-templates/{template_id}": TemplateUpdate,
};

/** The success statuses of every operation, in the contract's order. */
export const successStatuses: Record<string, readonly number[]> = {
  "get /healthz": [200],
  "get /readyz": [200],
  "post /v1/auth/login": [200],
  "post /v1/auth/logout": [204],
  "post /v1/auth/refresh": [200],
  "post /v1/invitations/accept": [200],
  "get /v1/me": [200],
  "patch /v1/me": [200],
  "post /v1/me/password": [200],
  "get /v1/organizations": [200],
  "post /v1/organizations": [201],
  "delete /v1/organizations/{organization_id}": [204],
  "get /v1/organizations/{organization_id}": [200],
  "patch /v1/organizations/{organization_id}": [200],
  "get /v1/organizations/{organization_id}/audit-events": [200],
  "get /v1/organizations/{organization_id}/claims": [200],
  "post /v1/organizations/{organization_id}/claims": [201],
  "get /v1/organizations/{organization_id}/claims/by-number/{number}": [200],
  "get /v1/organizations/{organization_id}/claims/{claim_id}": [200],
  "patch /v1/organizations/{organization_id}/claims/{claim_id}": [200],
  "post /v1/organizations/{organization_id}/claims/{claim_id}/assignments": [201],
  "delete /v1/organizations/{organization_id}/claims/{claim_id}/assignments/{user_id}": [204],
  "post /v1/organizations/{organization_id}/claims/{claim_id}/contacts": [201],
  "delete /v1/organizations/{organization_id}/claims/{claim_id}/contacts/{contact_id}": [204],
  "patch /v1/organizations/{organization_id}/claims/{claim_id}/contacts/{contact_id}": [200],
  "get /v1/organizations/{organization_id}/claims/{claim_id}/damage-items": [200],
  "delete /v1/organizations/{organization_id}/claims/{claim_id}/damage-items/{damage_item_id}": [204],
  "get /v1/organizations/{organization_id}/claims/{claim_id}/damage-items/{damage_item_id}": [200],
  "patch /v1/organizations/{organization_id}/claims/{claim_id}/damage-items/{damage_item_id}": [200],
  "post /v1/organizations/{organization_id}/claims/{claim_id}/document-uploads": [201],
  "post /v1/organizations/{organization_id}/claims/{claim_id}/document-uploads/{upload_id}/complete": [200, 201],
  "get /v1/organizations/{organization_id}/claims/{claim_id}/documents": [200],
  "delete /v1/organizations/{organization_id}/claims/{claim_id}/documents/{document_id}": [204],
  "get /v1/organizations/{organization_id}/claims/{claim_id}/documents/{document_id}": [200],
  "patch /v1/organizations/{organization_id}/claims/{claim_id}/documents/{document_id}": [200],
  "get /v1/organizations/{organization_id}/claims/{claim_id}/drying-log": [200],
  "get /v1/organizations/{organization_id}/claims/{claim_id}/drying-status": [200],
  "get /v1/organizations/{organization_id}/claims/{claim_id}/equipment-days": [200],
  "get /v1/organizations/{organization_id}/claims/{claim_id}/equipment-placements": [200],
  "post /v1/organizations/{organization_id}/claims/{claim_id}/equipment-placements": [201],
  "delete /v1/organizations/{organization_id}/claims/{claim_id}/equipment-placements/{placement_id}": [204],
  "patch /v1/organizations/{organization_id}/claims/{claim_id}/equipment-placements/{placement_id}": [200],
  "post /v1/organizations/{organization_id}/claims/{claim_id}/equipment-placements/{placement_id}/remove": [200],
  "get /v1/organizations/{organization_id}/claims/{claim_id}/estimates": [200],
  "post /v1/organizations/{organization_id}/claims/{claim_id}/estimates": [201],
  "delete /v1/organizations/{organization_id}/claims/{claim_id}/estimates/{estimate_id}": [204],
  "get /v1/organizations/{organization_id}/claims/{claim_id}/estimates/{estimate_id}": [200],
  "patch /v1/organizations/{organization_id}/claims/{claim_id}/estimates/{estimate_id}": [200],
  "post /v1/organizations/{organization_id}/claims/{claim_id}/estimates/{estimate_id}/lines": [201],
  "delete /v1/organizations/{organization_id}/claims/{claim_id}/estimates/{estimate_id}/lines/{line_id}": [200],
  "patch /v1/organizations/{organization_id}/claims/{claim_id}/estimates/{estimate_id}/lines/{line_id}": [200],
  "post /v1/organizations/{organization_id}/claims/{claim_id}/estimates/{estimate_id}/status": [200],
  "get /v1/organizations/{organization_id}/claims/{claim_id}/moisture-logs": [200],
  "post /v1/organizations/{organization_id}/claims/{claim_id}/moisture-logs": [201],
  "delete /v1/organizations/{organization_id}/claims/{claim_id}/moisture-logs/{log_id}": [204],
  "get /v1/organizations/{organization_id}/claims/{claim_id}/moisture-logs/{log_id}": [200],
  "patch /v1/organizations/{organization_id}/claims/{claim_id}/moisture-logs/{log_id}": [200],
  "get /v1/organizations/{organization_id}/claims/{claim_id}/moisture-points": [200],
  "post /v1/organizations/{organization_id}/claims/{claim_id}/moisture-points": [201],
  "delete /v1/organizations/{organization_id}/claims/{claim_id}/moisture-points/{point_id}": [204],
  "get /v1/organizations/{organization_id}/claims/{claim_id}/moisture-points/{point_id}": [200],
  "patch /v1/organizations/{organization_id}/claims/{claim_id}/moisture-points/{point_id}": [200],
  "get /v1/organizations/{organization_id}/claims/{claim_id}/notes": [200],
  "post /v1/organizations/{organization_id}/claims/{claim_id}/notes": [201],
  "delete /v1/organizations/{organization_id}/claims/{claim_id}/notes/{note_id}": [204],
  "patch /v1/organizations/{organization_id}/claims/{claim_id}/notes/{note_id}": [200],
  "post /v1/organizations/{organization_id}/claims/{claim_id}/photo-uploads": [201],
  "post /v1/organizations/{organization_id}/claims/{claim_id}/photo-uploads/{upload_id}/complete": [200, 201],
  "get /v1/organizations/{organization_id}/claims/{claim_id}/photos": [200],
  "delete /v1/organizations/{organization_id}/claims/{claim_id}/photos/{photo_id}": [204],
  "get /v1/organizations/{organization_id}/claims/{claim_id}/photos/{photo_id}": [200],
  "patch /v1/organizations/{organization_id}/claims/{claim_id}/photos/{photo_id}": [200],
  "get /v1/organizations/{organization_id}/claims/{claim_id}/reports": [200],
  "post /v1/organizations/{organization_id}/claims/{claim_id}/reports": [202],
  "delete /v1/organizations/{organization_id}/claims/{claim_id}/reports/{job_id}": [204],
  "get /v1/organizations/{organization_id}/claims/{claim_id}/reports/{job_id}": [200],
  "get /v1/organizations/{organization_id}/claims/{claim_id}/reports/{job_id}/shares": [200],
  "post /v1/organizations/{organization_id}/claims/{claim_id}/reports/{job_id}/shares": [201],
  "post /v1/organizations/{organization_id}/claims/{claim_id}/reports/{job_id}/shares/{share_id}/revoke": [200],
  "delete /v1/organizations/{organization_id}/claims/{claim_id}/rooms/{room_id}": [204],
  "get /v1/organizations/{organization_id}/claims/{claim_id}/rooms/{room_id}": [200],
  "patch /v1/organizations/{organization_id}/claims/{claim_id}/rooms/{room_id}": [200],
  "post /v1/organizations/{organization_id}/claims/{claim_id}/rooms/{room_id}/damage-items": [201],
  "post /v1/organizations/{organization_id}/claims/{claim_id}/status": [200],
  "get /v1/organizations/{organization_id}/claims/{claim_id}/status-history": [200],
  "get /v1/organizations/{organization_id}/claims/{claim_id}/structures": [200],
  "post /v1/organizations/{organization_id}/claims/{claim_id}/structures": [201],
  "delete /v1/organizations/{organization_id}/claims/{claim_id}/structures/{structure_id}": [204],
  "patch /v1/organizations/{organization_id}/claims/{claim_id}/structures/{structure_id}": [200],
  "post /v1/organizations/{organization_id}/claims/{claim_id}/structures/{structure_id}/rooms": [201],
  "get /v1/organizations/{organization_id}/claims/{claim_id}/tasks": [200],
  "post /v1/organizations/{organization_id}/claims/{claim_id}/tasks": [201],
  "delete /v1/organizations/{organization_id}/claims/{claim_id}/tasks/{task_id}": [204],
  "patch /v1/organizations/{organization_id}/claims/{claim_id}/tasks/{task_id}": [200],
  "get /v1/organizations/{organization_id}/claims/{claim_id}/timeline": [200],
  "get /v1/organizations/{organization_id}/contacts": [200],
  "post /v1/organizations/{organization_id}/contacts": [201],
  "delete /v1/organizations/{organization_id}/contacts/{contact_id}": [204],
  "get /v1/organizations/{organization_id}/contacts/{contact_id}": [200],
  "patch /v1/organizations/{organization_id}/contacts/{contact_id}": [200],
  "get /v1/organizations/{organization_id}/equipment": [200],
  "post /v1/organizations/{organization_id}/equipment": [201],
  "delete /v1/organizations/{organization_id}/equipment/{equipment_id}": [204],
  "get /v1/organizations/{organization_id}/equipment/{equipment_id}": [200],
  "patch /v1/organizations/{organization_id}/equipment/{equipment_id}": [200],
  "get /v1/organizations/{organization_id}/invitations": [200],
  "post /v1/organizations/{organization_id}/invitations": [201],
  "delete /v1/organizations/{organization_id}/invitations/{invitation_id}": [204],
  "get /v1/organizations/{organization_id}/members": [200],
  "get /v1/organizations/{organization_id}/notes/mentioning-me": [200],
  "get /v1/organizations/{organization_id}/photo-tags": [200],
  "get /v1/organizations/{organization_id}/price-lists": [200],
  "post /v1/organizations/{organization_id}/price-lists": [201],
  "delete /v1/organizations/{organization_id}/price-lists/{list_id}": [204],
  "get /v1/organizations/{organization_id}/price-lists/{list_id}": [200],
  "patch /v1/organizations/{organization_id}/price-lists/{list_id}": [200],
  "post /v1/organizations/{organization_id}/price-lists/{list_id}/import": [200],
  "get /v1/organizations/{organization_id}/price-lists/{list_id}/items": [200],
  "post /v1/organizations/{organization_id}/price-lists/{list_id}/items": [201],
  "delete /v1/organizations/{organization_id}/price-lists/{list_id}/items/{item_id}": [204],
  "get /v1/organizations/{organization_id}/price-lists/{list_id}/items/{item_id}": [200],
  "patch /v1/organizations/{organization_id}/price-lists/{list_id}/items/{item_id}": [200],
  "get /v1/organizations/{organization_id}/properties": [200],
  "post /v1/organizations/{organization_id}/properties": [201],
  "delete /v1/organizations/{organization_id}/properties/{property_id}": [204],
  "get /v1/organizations/{organization_id}/properties/{property_id}": [200],
  "patch /v1/organizations/{organization_id}/properties/{property_id}": [200],
  "get /v1/organizations/{organization_id}/report-templates": [200],
  "post /v1/organizations/{organization_id}/report-templates": [201],
  "get /v1/organizations/{organization_id}/report-templates/effective": [200],
  "delete /v1/organizations/{organization_id}/report-templates/{template_id}": [204],
  "get /v1/organizations/{organization_id}/report-templates/{template_id}": [200],
  "patch /v1/organizations/{organization_id}/report-templates/{template_id}": [200],
  "delete /v1/organizations/{organization_id}/report-templates/{template_id}/logo": [200],
  "put /v1/organizations/{organization_id}/report-templates/{template_id}/logo": [200],
  "get /v1/organizations/{organization_id}/search": [200],
  "get /v1/organizations/{organization_id}/tasks/assigned-to-me": [200],
  "get /v1/shared-reports/{token}": [],
};

/** Status workflows, as the API enforces them: `workflows.ClaimStatus.transitions.new`. */
export const workflows = {
  ClaimStatus: {"transitions":{"cancelled":["new"],"closed":["in_progress"],"completed":["in_progress","closed"],"in_progress":["on_hold","completed","cancelled"],"inspected":["in_progress","on_hold","cancelled"],"new":["inspected","in_progress","on_hold","cancelled"],"on_hold":["new","inspected","in_progress","cancelled"]},"reasonRequired":{"cancelled":["new"],"closed":["in_progress"],"completed":[],"in_progress":["on_hold","cancelled"],"inspected":["on_hold","cancelled"],"new":["on_hold","cancelled"],"on_hold":["cancelled"]}},
  EstimateStatus: {"transitions":{"approved":["draft"],"draft":["submitted"],"rejected":["draft"],"submitted":["draft","approved","rejected"]}},
} as const;
