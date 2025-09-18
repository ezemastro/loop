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
    schoolId: UUID;
    roleId: UUID;
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
  body: Partial<PrivateUser>;
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
type GetSelfNotificationsRequest = AuthApiRequest;
type GetSelfNotificationsResponse = ApiResponse<{
  notifications: Notification[];
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
type GetSelfMessagesRequest = AuthApiRequest;
type GetSelfMessagesResponse = ApiResponse<{
  chats: UserMessage[];
}>;
// GET /me/messages/unread
type GetSelfMessagesUnreadRequest = AuthApiRequest;
type GetSelfMessagesUnreadResponse = ApiResponse<{
  unreadChatsCount: number;
}>;

// GET /users/:id
interface GetUserByIdRequest {
  params: {
    id: UUID;
  };
}
type GetUserByIdResponse = ApiResponse<{
  user: PrivateUser;
}>;

// GET /users
interface GetUsersRequest {
  query?: PaginationParams & {
    searchTerm?: string;
    roleId?: UUID;
    schoolId?: UUID;
  };
}
type GetUsersResponse = PaginatedApiResponse<{
  users: PrivateUser[];
}>;

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

// GET /roles
interface GetRolesRequest {
  query?: PaginationParams & {
    searchTerm?: string;
  };
}
type GetRolesResponse = PaginatedApiResponse<{
  roles: Role[];
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
type GetMessagesByUserIdResponse = ApiResponse<{
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

// TODO - Implementar rutas de Administrador
