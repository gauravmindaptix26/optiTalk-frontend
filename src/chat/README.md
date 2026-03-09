## ZegoCloud Chat (ZIM) - One-to-One Peer Messaging

This app uses **ZegoCloud ZIM (Instant Messaging)** for real-time one-to-one peer messaging between users.

### Current Focus: One-to-One Peer Messaging

The primary implementation is **peer-to-peer (one-to-one) messaging** between two users.

**Message Flow:**
```
User A Types Message → handleSend() → zim.sendMessage()
                         ↓
Local state updated → MessageList displays sent message
                         ↓
User B receives peerMessageReceived event
                         ↓
handleIncoming() → merge messages → display in real-time
```

### Required Environment Variables

**Backend (`backend/.env`)**
```bash
VITE_ZEGO_APP_ID=123456789
VITE_ZEGO_SERVER_SECRET=your_server_secret_from_zego
```

**Frontend (`frontend/.env`)**
```bash
VITE_ZEGO_APP_ID=123456789
VITE_ZEGO_TOKEN_ENDPOINT=http://localhost:3000/api/token
VITE_API_BASE=http://localhost:3000
```

### One-to-One Messaging Implementation

#### Key Functions (ChatPage.jsx)

1. **handleSend(payload)** - Line ~901
   - Called when user submits message from MessageComposer
   - Attaches reply context if replying to another message
   - Calls send() to post to Zego

2. **send(message)** - Line ~803
   - Uses zim.sendMessage(message, conversationID, conversationType, config)
   - Updates local messagesByConv state immediately
   - Message appears instantly in UI

3. **handleIncoming(type, conversationID, list)** - Line ~280
   - Called when peerMessageReceived event fires
   - Merges incoming messages with existing history
   - Updates conversation list with lastMessage and unreadCount
   - Handles typing indicators (custom message type 200)

#### Message Event Listener (ChatPage.jsx - useEffect)
```javascript
zim.on("peerMessageReceived", (_zim, data) => {
  handleIncoming(
    ZIMConversationType.Peer,
    data.fromConversationID,  // Sender's user ID
    data.messageList          // Array of new messages
  );
});
```

### Message Structure

```javascript
{
  messageID: "unique-id",
  senderUserID: "sender@example.com",
  conversationID: "recipient@example.com",
  conversationType: 0,  // 0 = Peer (one-to-one)
  messageType: 1,       // 1 = Text message
  message: "Hello!",
  timestamp: 1704931200000,
  receiptStatus: 0,     // 0=Sent, 1=Delivered, 2=Read
  reactions: [],        // Emoji reactions
  extendedData: "{}"    // JSON for metadata (replies, etc.)
}
```

### Testing One-to-One Messaging

**Step 1:** Login with two different users
- User A in Chrome
- User B in Firefox

**Step 2:** User A starts conversation
- Search for User B's email
- Click result to create peer conversation

**Step 3:** User A sends message
- Type message
- Click Send

**Step 4:** Verify on User B
- Message appears instantly
- Conversation shows in sidebar
- Unread count increases

**Step 5:** User B replies
- Type response
- Message appears in User A's view

### Important Notes

✅ **What's Working:**
- One-to-one peer messaging send/receive
- Real-time message delivery
- Conversation list management
- Message history/caching
- Typing indicators (basic)

❌ **Not Yet Implemented:**
- Message notifications (desktop/toast/mobile)
- Message reactions UI
- Message replies/threading
- Message search
- Message edit/delete
- Media attachments
- Emoji picker

### Token Endpoint

Frontend calls:
`GET /api/token?userID=user@example.com`

Expected response:
```json
{ "token": "zego_zim_token_here", "userID": "user@example.com" }
```

Notes:
- Do **not** generate tokens in the browser (it requires your Zego server secret).
- Implement token generation on a backend (Node/Express, etc.) using Zego's official token generation method.
