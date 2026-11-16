/**
 * React Query hooks over the typed client: `@claimforge/api-client/react`.
 *
 *     const queryClient = createQueryClient();
 *     <QueryClientProvider client={queryClient}>
 *       <ApiProvider client={api}>…</ApiProvider>
 *     </QueryClientProvider>
 *
 * Each data hook has a matching `…Query(api, …)` returning query options, so router
 * loaders can prefetch exactly what the component will read.
 */
export {
  claimByNumberQuery,
  claimQuery,
  claimsQuery,
  statusHistoryQuery,
  timelineQuery,
  useAssignClaim,
  useChangeClaimStatus,
  useClaim,
  useClaimByNumber,
  useClaims,
  useClaimStatusHistory,
  useClaimTimeline,
  useCreateClaim,
  useUnassignClaim,
  useUpdateClaim,
} from "./claims";
export { ApiProvider, useApi, type ApiProviderProps } from "./context";
export {
  documentQuery,
  documentsQuery,
  useDeleteDocument,
  useDocument,
  useDocuments,
  useUpdateDocument,
  useUploadDocument,
  type DocumentChange,
  type DocumentUpload,
} from "./documents";
export { queryKeys } from "./keys";
export { createQueryClient, MAX_RETRIES, shouldRetry } from "./query-client";
export {
  estimateQuery,
  estimatesQuery,
  useAddLine,
  useChangeEstimateStatus,
  useCreateEstimate,
  useDeleteEstimate,
  useDeleteLine,
  useEstimate,
  useEstimates,
  useUpdateEstimate,
  useUpdateLine,
  type LineChange,
} from "./estimates";
export {
  mentionsQuery,
  notesQuery,
  useCreateNote,
  useDeleteNote,
  useNotes,
  useNotesMentioningMe,
  useUpdateNote,
  type NoteChange,
} from "./notes";
export {
  invitationsQuery,
  organizationQuery,
  organizationsQuery,
  useCreateInvitation,
  useCreateOrganization,
  useDeleteOrganization,
  useInvitations,
  useOrganization,
  useOrganizations,
  useRevokeInvitation,
  useUpdateOrganization,
} from "./organizations";
export { allItems, editOrRefetch, editPages, nextCursor } from "./pages";
export {
  PROCESSING_POLL_MS,
  photoQuery,
  photosQuery,
  photoTagsQuery,
  useDeletePhoto,
  usePhoto,
  usePhotos,
  usePhotoTags,
  useUpdatePhoto,
  useUploadPhoto,
  type PhotoChange,
  type PhotoUpload,
} from "./photos";
export {
  dryingLogQuery,
  dryingStatusQuery,
  moistureLogQuery,
  moistureLogsQuery,
  moisturePointQuery,
  moisturePointsQuery,
  useCreateMoistureLog,
  useCreateMoisturePoint,
  useDeleteMoistureLog,
  useDeleteMoisturePoint,
  useDryingLog,
  useDryingStatus,
  useMoistureLog,
  useMoistureLogs,
  useMoisturePoint,
  useMoisturePoints,
  useUpdateMoistureLog,
  useUpdateMoisturePoint,
  type MoistureLogChange,
  type MoisturePointChange,
} from "./readings";
export {
  roomQuery,
  structuresQuery,
  useCreateRoom,
  useCreateStructure,
  useDeleteRoom,
  useDeleteStructure,
  useRoom,
  useStructures,
  useUpdateRoom,
  useUpdateStructure,
  type NewRoom,
  type RoomChange,
  type StructureChange,
} from "./rooms";
export { meQuery, useAcceptInvitation, useLogin, useLogout, useMe } from "./session";
export {
  myTasksQuery,
  tasksQuery,
  useCreateTask,
  useDeleteTask,
  useMyTasks,
  useTasks,
  useUpdateTask,
  type TaskChange,
} from "./tasks";
