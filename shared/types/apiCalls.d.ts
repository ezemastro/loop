interface ApiResponseBase<T> {
  success: true;
  data: T;
}
interface ApiResponseError {
  success: false;
  error: string;
}
// type ApiResponse<T> = ApiResponseBase<T> | ApiResponseError;
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}
interface Pagination {
    totalRecords: number;
    currentPage: number;
    pageSize: number;
    totalPages: number;
    nextPage: number | null;
    previousPage: number | null;
}
interface PaginatedApiResponse<T> extends ApiResponse<T> {
  pagination: Pagination;
}

interface AuthApiRequest {
  cookies: {
    auth_token: string;
  };
}

interface PaginationParams {
  page?: number;
  sort?: SortOptions;
  order?: OrderOptions;
}

// POST /auth/register
interface PostAuthRegisterRequest {
  body: {
    firstName: string;
    lastName: string;
    email: string;
    password: string;
    schoolIds: UUID[];
  };
}
type PostAuthRegisterResponse = ApiResponse<{
  user: PrivateUser;
}>;

// POST /auth/login
interface PostAuthLoginRequest {
  body: {
    email: string;
    password: string;
  };
}
type PostAuthLoginResponse = ApiResponse<{
  user: PrivateUser;
}>;

// GET /me
type GetSelfRequest = AuthApiRequest;
type GetSelfResponse = ApiResponse<{
  user: PrivateUser;
}>;

// PATCH /me
interface PatchSelfRequest extends AuthApiRequest {
  body: Partial<PrivateUser> & { password?: string; schoolIds?: UUID[] };
}
type PatchSelfResponse = ApiResponse<{
  user: UserBase;
}>;

// GET /me/listings
interface GetSelfListingsRequest extends AuthApiRequest {
  query?: PaginationParams & {
    searchTerm?: string;
    categoryId?: UUID;
    productStatus?: ProductStatus;
    listingStatus?: ListingStatus;
    sellerId?: UUID;
    buyerId?: UUID;
  };
}
type GetSelfListingsResponse = PaginatedApiResponse<{
  listings: Listing[];
}>;

// GET /me/missions
type GetSelfMissionsRequest = AuthApiRequest;
type GetSelfMissionsResponse = ApiResponse<{
  userMissions: UserMission[];
}>;

// GET /me/notifications
interface GetSelfNotificationsRequest extends AuthApiRequest {
  query?: PaginationParams;
}
type GetSelfNotificationsResponse = PaginatedApiResponse<{
  notifications: AppNotification[];
}>;
// GET /me/notifications/unread
type GetSelfNotificationsUnreadRequest = AuthApiRequest;
type GetSelfNotificationsUnreadResponse = ApiResponse<{
  unreadNotificationsCount: number;
}>;

// POST /me/notifications/read-all
type PostSelfNotificationsReadAllRequest = AuthApiRequest;
type PostSelfNotificationsReadAllResponse = ApiResponse;

// GET /me/messages
interface GetSelfMessagesRequest extends AuthApiRequest {
  query?: PaginationParams;
}
type GetSelfMessagesResponse = PaginatedApiResponse<{
  chats: UserMessage[];
}>;
// GET /me/messages/unread
type GetSelfMessagesUnreadRequest = AuthApiRequest;
type GetSelfMessagesUnreadResponse = ApiResponse<{
  unreadChatsCount: number;
}>;
// POST /me/notification-token
interface PostSelfNotificationTokenRequest extends AuthApiRequest {
  body: {
    notificationToken: string;
  };
}
type PostSelfNotificationTokenResponse = ApiResponse;
// POST /me/wishes
interface PostSelfWishRequest extends AuthApiRequest {
  body: {
    categoryId: UUID;
    comment?: string | null;
  };
}
type PostSelfWishResponse = ApiResponse<{
  userWish: UserWish;
}>;
// DELETE /me/wishes/:categoryId
interface DeleteSelfWishRequest extends AuthApiRequest {
  params: {
    categoryId: UUID;
  };
}
type DeleteSelfWishResponse = ApiResponse;
// GET /me/wishes
type GetSelfWishesRequest = AuthApiRequest;
type GetSelfWishesResponse = ApiResponse<{
  userWishes: UserWish[];
}>;
// PUT /me/wishes/:wishId
interface PutSelfWishRequest extends AuthApiRequest {
  params: {
    wishId: UUID;
  };
  body: {
    categoryId?: UUID;
    comment?: string | null;
  };
}
type PutSelfWishResponse = ApiResponse<{
  userWish: UserWish;
}>;

// POST /me/change-password
interface PostSelfChangePasswordRequest extends AuthApiRequest {
  body: {
    oldPassword: string;
    newPassword: string;
  };
}
type PostSelfChangePasswordResponse = ApiResponse;

// GET /users/:id
interface GetUserByIdRequest {
  params: {
    userId: UUID;
  };
}
type GetUserByIdResponse = ApiResponse<{
  user: PrivateUser;
}>;

// GET /users
interface GetUsersRequest {
  query?: PaginationParams & {
    searchTerm?: string;
    schoolId?: UUID;
    userId?: UUID;
  };
}
type GetUsersResponse = PaginatedApiResponse<{
  users: PrivateUser[];
}>;

// GET /users/:userId/wishes
interface GetUserWishesRequest {
  params: {
    userId: UUID;
  };
}
type GetUserWishesResponse = ApiResponse<{
  userWishes: UserWish[];
}>;

// POST /users/:userId/donate
interface PostUserDonateRequest extends AuthApiRequest {
  params: {
    userId: UUID;
  };
  body: {
    amount: number;
  };
}
type PostUserDonateResponse = ApiResponse;

// GET /schools
interface GetSchoolsRequest {
  query?: PaginationParams & {
    searchTerm?: string;
  };
}
type GetSchoolsResponse = PaginatedApiResponse<{
  schools: School[];
}>;
// GET /schools/:id
interface GetSchoolByIdRequest {
  params: {
    schoolId: UUID;
  };
}
type GetSchoolByIdResponse = ApiResponse<{
  school: School;
}>;

// GET /categories
type GetCategoriesRequest = null;
type GetCategoriesResponse = ApiResponse<{
  categories: Category[];
}>;

// GET /listings
interface GetListingsRequest {
  query?: PaginationParams & {
    searchTerm?: string;
    schoolId?: UUID;
    userId?: UUID;
    categoryId?: UUID;
    productStatus?: ProductStatus;
    sellerId?: UUID;
  };
}
type GetListingsResponse = PaginatedApiResponse<{
  listings: Listing[];
}>;

// POST /listings
interface PostListingsRequest extends AuthRequest {
  body: {
    title: string;
    description: string | null;
    price: number;
    categoryId: UUID;
    productStatus: ProductStatus;
    mediaIds: UUID[];
  };
}
type PostListingsResponse = ApiResponse<{
  listing: Listing;
}>;

// PATCH /listing/:id
interface PatchListingsRequest extends AuthRequest {
  params: {
    listingId: UUID;
  };
  body: Partial<Listing> & { mediaIds: UUID[] };
}
type PatchListingsResponse = ApiResponse<{
  listing: Listing;
}>;

// GET /listing/:id
interface GetListingByIdRequest {
  params: {
    listingId: UUID;
  };
}
type GetListingByIdResponse = ApiResponse<{
  listing: Listing;
}>;

// DELETE /listing/:id
interface DeleteListingRequest extends AuthRequest {
  params: {
    listingId: UUID;
  };
}
type DeleteListingResponse = ApiResponse<{
  listing: Listing;
}>;

// POST /listings/:id/offer
interface PostListingOfferRequest extends AuthRequest {
  params: {
    listingId: UUID;
  };
  body: {
    price: number;
  };
}
type PostListingOfferResponse = ApiResponse<{
  listing: Listing;
}>;

// DELETE /listings/:id/offer
interface DeleteListingOfferRequest extends AuthRequest {
  params: {
    listingId: UUID;
  };
}
type DeleteListingOfferResponse = ApiResponse;

// POST /listings/:id/offer/reject
interface PostListingOfferRejectRequest extends AuthRequest {
  params: {
    listingId: UUID;
  };
}
type PostListingOfferRejectResponse = ApiResponse;

// POST /listings/:id/offer/accept
interface PostListingOfferAcceptRequest extends AuthRequest {
  params: {
    listingId: UUID;
  };
  body: {
    tradingListingIds?: UUID[];
  };
}
type PostListingOfferAcceptResponse = ApiResponse;

// POST /listings/:id/receive
interface PostListingReceivedRequest extends AuthRequest {
  params: {
    listingId: UUID;
  };
}
type PostListingReceivedResponse = ApiResponse;

// POST /uploads
interface PostMediaRequest extends AuthRequest {
  body: {
    file: {
      uri: string;
      type: string;
      name: string;
    };
  };
}
type PostMediaResponse = ApiResponse<{
  media: Media;
}>;


// GET /messages/:userId
interface GetMessagesByUserIdRequest {
  params: {
    userId: UUID;
  };
  query: {
    page?: number;
  };
}
type GetMessagesByUserIdResponse = PaginatedApiResponse<{
  messages: Message[];
}>;

// POST /messages/:userId
interface PostMessageRequest extends AuthRequest {
  params: {
    userId: UUID;
  };
  body: {
    text: string;
    attachedListingId?: UUID | null;
  };
}
type PostMessageResponse = ApiResponse<{
  message: Message;
}>;

// POST messages/:userId/read
interface PostMessageReadRequest extends AuthRequest {
  params: {
    userId: UUID;
  };
}
type PostMessageReadResponse = ApiResponse;

// GET /stats
type GetGlobalStatsRequest = null;
type GetGlobalStatsResponse = ApiResponse<{
  globalStats: Stats;
}>;

// Administrador
// POST /admin/login
interface PostAdminLoginRequest {
  body: {
    username: string;
    password: string;
  };
}
type PostAdminLoginResponse = ApiResponse<{
  admin: Admin;
}>;

// POST /admin/register
interface PostAdminRegisterRequest {
  body: {
    username: string;
    fullName: string;
    password: string;
    passToken: string;
  };
}
type PostAdminRegisterResponse = ApiResponse<{
  admin: Admin;
}>;

// GET /admin/users
interface GetAdminUsersRequest {
  query: {
    page?: number;
    search?: string;
  };
}
type GetAdminUsersResponse = ApiResponse<{
  users: PrivateUser[];
  total: number;
}>;

// POST /admin/users/:userId/credits
interface PostAdminUserCreditsRequest {
  params: {
    userId: UUID;
  };
  body: {
    amount: number;
    positive: boolean;
    meta?: Record<string, unknown>;
  };
}
type PostAdminUserCreditsResponse = ApiResponse<{
  user: PrivateUser;
}>;
// POST /admin/users/:userId/reset-password
interface PostAdminUserResetPasswordRequest {
  params: {
    userId: UUID;
  };
  body: {
    newPassword: string;
  };
}
type PostAdminUserResetPasswordResponse = ApiResponse;

// POST /admin/schools
interface PostAdminSchoolsRequest {
  body: {
    name: string;
    mediaId: UUID;
  };
}
type PostAdminSchoolsResponse = ApiResponse<{
  school: School;
}>;

// POST /admin/categories
interface PostAdminCategoriesRequest {
  body: {
    name: string;
    description?: string;
    parentId?: UUID;
    icon?: string;
    minPriceCredits?: number;
    maxPriceCredits?: number;
    statKgWaste?: number;
    statKgCo2?: number;
    statLH2o?: number;
  };
}
type PostAdminCategoriesResponse = ApiResponse<{
  category: Category;
}>;

// PATCH /admin/categories/:categoryId
interface PatchAdminCategoryRequest {
  params: {
    categoryId: UUID;
  };
  body: {
    name?: string;
    description?: string;
    parentId?: UUID | null;
    icon?: string;
    minPriceCredits?: number;
    maxPriceCredits?: number;
    statKgWaste?: number;
    statKgCo2?: number;
    statLH2o?: number;
  };
}
type PatchAdminCategoryResponse = ApiResponse<{
  category: Category;
}>;

// POST /admin/notifications
interface PostAdminNotificationRequest {
  body: {
    userId: UUID;
    type: NotificationType;
    payload: Record<string, unknown>;
  };
}
type PostAdminNotificationResponse = ApiResponse<{
  notification: Notification;
}>;

// GET /admin/stats
interface GetAdminStatsRequest {
  query?: Record<string, never>;
}
type GetAdminStatsResponse = ApiResponse<{
  stats: Record<string, number>;
}>;

// GET /admin/schools/stats
interface GetAdminSchoolStatsRequest {
  query?: Record<string, never>;
}
type GetAdminSchoolStatsResponse = ApiResponse<{
  schools: Array<{
    id: number;
    name: string;
    statKgWaste: number;
    statKgCo2: number;
    statLH2o: number;
  }>;
}>;

// POST /admin/missions
interface PostAdminMissionTemplateRequest {
  body: {
    key: string;
    title: string;
    description: string | null;
    rewardCredits: number;
    active: boolean;
  };
}
type PostAdminMissionTemplateResponse = ApiResponse<{
  missionTemplate: MissionTemplate;
}>;

// PATCH /admin/missions/:missionTemplateId
interface PatchAdminMissionTemplateRequest {
  params: {
    missionTemplateId: UUID;
  };
  body: {
    title?: string;
    description?: string;
    rewardCredits?: number;
    active?: boolean;
  };
}
type PatchAdminMissionTemplateResponse = ApiResponse<{
  missionTemplate: MissionTemplate;
}>;
