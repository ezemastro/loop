/**
 * True for a single conversation (`/messages/<userId>`, route groups already stripped by
 * `usePathname()`), false for the messages list. Inside a conversation the header drops its search
 * row and the bottom tab bar hides on mobile so the messages get the screen.
 */
export const isConversationPath = (pathname: string): boolean =>
  /^\/messages\/[^/]+/.test(pathname);
