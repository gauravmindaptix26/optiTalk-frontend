## ZegoCloud Chat (ZIM)

This app uses **ZegoCloud ZIM (Instant Messaging)** with **Auth0** authentication for real-time chat.

### Current Scope

The app currently supports:
- Peer chat
- Group chat
- Conversation list and unread badges
- Typing indicators
- Read receipts
- Reactions
- Reply and forward actions
- Delete for me / revoke for all
- Profile editing
- User search and group member management

### Message Flow

```text
User A Types Message -> handleSend() -> zim.sendMessage()
                                |
                                v
Local state updated -> MessageList renders sent message
                                |
                                v
User B receives peer/group event from ZIM
                                |
                                v
handleIncoming() -> merge messages -> update sidebar + thread
```

### Required Environment Variables

Backend (`backend/.env`)

```bash
ZEGO_APP_ID=123456789
ZEGO_SERVER_SECRET=your_server_secret_from_zego
AUTH0_DOMAIN=your-auth0-domain
AUTH0_AUDIENCE=your-auth0-api-audience
FRONTEND_ORIGIN=https://your-frontend-domain
```

Frontend (`frontend/.env`)

```bash
VITE_ZEGO_APP_ID=123456789
VITE_ZEGO_TOKEN_ENDPOINT=https://your-backend-domain/api/token
VITE_API_BASE=https://your-backend-domain
VITE_AUTH0_DOMAIN=your-auth0-domain
VITE_AUTH0_CLIENT_ID=your-auth0-client-id
VITE_AUTH0_REDIRECT_URI=https://your-frontend-domain/chat
```

### Core Messaging Implementation

Key file:
- `frontend/src/chat/ChatPage.jsx`

Important responsibilities in that file:
- Bootstrapping Auth0 + Zego session
- Fetching token from backend
- Loading conversations/history
- Handling incoming peer/group/room events
- Reactions, receipts, revoke events
- Group creation and member management
- Search and local cache hydration

### Working Features

- One-to-one messaging
- Group messaging
- Real-time delivery
- Conversation list management
- Message history cache
- Typing indicators
- Read receipts
- Reactions
- Reply and forward
- Delete and revoke
- User search
- Profile sync

### Still Missing Or Weak

- Notifications (desktop/toast/mobile)
- In-chat message search
- Media attachments
- Emoji picker UI in composer
- Presence / last seen
- Persistent database-backed user directory
- Better message pagination/history loading

### Deployment Notes

- Frontend must point to deployed backend using:
  - `VITE_API_BASE`
  - `VITE_ZEGO_TOKEN_ENDPOINT`
- Backend must allow deployed frontend origin using:
  - `FRONTEND_ORIGIN`
- Auth0 callback/logout/web origins must match deployed frontend URL.
