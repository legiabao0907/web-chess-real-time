# Deployment Diagram — Hệ Thống Cờ Vua Online

> Ngày tạo: 2026-06-19

---

## 1. Deployment Diagram (UML)

```mermaid
graph TB
    subgraph Client["🖥️ Client Browser"]
        direction TB
        nextjs["Next.js 16 App<br/>React 19<br/>Port: 3000"]
        stockfish["Stockfish WASM<br/>AI Engine<br/>(in-browser)"]
        socket_client["Socket.IO Client<br/>WebSocket"]
        zustand["Zustand Stores<br/>- useChatStore<br/>- useFriendStore<br/>- useProfileStore<br/>- useWatchStore"]
    end

    subgraph DockerHost["🐳 Docker Host"]
        direction TB

        subgraph frontend_ctr["Frontend Container"]
            nextjs_prod["Next.js Production<br/>Port: 3000"]
        end

        subgraph backend_ctr["Backend Container"]
            direction TB
            nestjs["NestJS Server<br/>Port: 8080"]
            
            subgraph modules["Core Modules"]
                auth["Auth Module<br/>JWT Guard"]
                game["Game Module<br/>Matchmaking"]
                tournament["Tournament Module<br/>Swiss Pairing"]
                chat["Chat Module<br/>Direct Message"]
                watch["Watch Module<br/>Spectator"]
                ai["AI Module<br/>Stockfish API"]
                leaderboard["Leaderboard Module<br/>ELO Updates"]
            end
            
            subgraph gateways["Socket.IO Gateways"]
                game_gw["GameGateway<br/>namespace: /chess"]
                tournament_gw["TournamentGateway<br/>namespace: /tournament"]
                chat_gw["ChatGateway<br/>namespace: /chat"]
                watch_gw["WatchGateway<br/>namespace: /watch"]
                leaderboard_gw["LeaderboardGateway<br/>namespace: /leaderboard"]
            end
        end

        subgraph postgres_ctr["PostgreSQL Container"]
            postgres[("PostgreSQL 16<br/>Port: 5432<br/>━━━━━━━━━━<br/>users<br/>games<br/>tournaments<br/>tournament_participants<br/>chat_rooms<br/>chat_room_members<br/>messages<br/>friends<br/>profileInfo")]
        end

        subgraph redis_ctr["Redis Container"]
            redis[("Redis 7<br/>Port: 6379<br/>━━━━━━━━━━<br/>chess:game:{id}<br/>chess:queue:{timeControl}<br/>chess:online_users<br/>chat:room:{id}:messages<br/>user:session:{token}")]
        end
    end

    subgraph external["🌐 External"]
        npm_reg["NPM Registry<br/>(chess.js, react-chessboard)"]
    end

    %% Connections
    nextjs <-->|"REST API<br/>/api/*"| nestjs
    nextjs <-->|"WebSocket<br/>Socket.IO"| nestjs
    socket_client <-->|"Events"| game_gw
    socket_client <-->|"Events"| chat_gw
    socket_client <-->|"Events"| tournament_gw
    socket_client <-->|"Events"| watch_gw
    socket_client <-->|"Events"| leaderboard_gw

    nestjs -->|"Drizzle ORM<br/>SQL Queries"| postgres
    nestjs -->|"ioredis<br/>Lua Scripts"| redis
    
    game_gw -->|"Game State<br/>R/W"| redis
    game_gw -->|"Persist<br/>Completed Games"| postgres
    chat_gw -->|"Online Users<br/>Hash"| redis
    chat_gw -->|"Message<br/>History"| postgres
    tournament_gw -->|"Tournament<br/>State"| redis
    tournament_gw -->|"Standings<br/>Results"| postgres

    frontend_ctr -.->|"Docker Network"| backend_ctr
    backend_ctr -.->|"Docker Network"| postgres_ctr
    backend_ctr -.->|"Docker Network"| redis_ctr

    %% Styles
    classDef client fill:#e1f5fe,stroke:#01579b,stroke-width:2px
    classDef container fill:#fff3e0,stroke:#e65100,stroke-width:2px
    classDef database fill:#e8f5e9,stroke:#2e7d32,stroke-width:2px
    classDef cache fill:#fce4ec,stroke:#c62828,stroke-width:2px
    classDef external fill:#f3e5f5,stroke:#7b1fa2,stroke-width:2px

    class Client,nextjs,stockfish,socket_client,zustand client
    class DockerHost,frontend_ctr,backend_ctr,nestjs,modules,gateways container
    class postgres_ctr,postgres database
    class redis_ctr,redis cache
    class external,npm_reg external
```

---

## 2. Mô Tả Các Node

### 2.1 Client Browser

| Thành phần | Công nghệ | Mô tả |
|------------|-----------|-------|
| **Next.js 16 App** | React 19, TypeScript | Frontend SSR/SPA, App Router |
| **Stockfish WASM** | Stockfish 16, WebAssembly | AI engine chạy trực tiếp trong browser |
| **Socket.IO Client** | socket.io-client | WebSocket client, kết nối tới 5 namespaces |
| **Zustand Stores** | Zustand | State management phía client |

### 2.2 Docker Host

| Container | Công nghệ | Port | Mô tả |
|-----------|-----------|------|-------|
| **Frontend** | Next.js 16 | 3000 | Production build của Next.js |
| **Backend** | NestJS 10 | 8080 | REST API + 5 Socket.IO Gateways |
| **PostgreSQL** | PostgreSQL 16 | 5432 | Lưu trữ bền vững (9 bảng) |
| **Redis** | Redis 7 | 6379 | Cache & real-time state |

### 2.3 Backend Gateways (Socket.IO Namespaces)

| Gateway | Namespace | Chức năng |
|---------|-----------|-----------|
| **GameGateway** | `/chess` | Matchmaking, nước đi, game state |
| **TournamentGateway** | `/tournament` | Cập nhật giải đấu real-time |
| **ChatGateway** | `/chat` | Direct message, typing indicator |
| **WatchGateway** | `/watch` | Spectator mode |
| **LeaderboardGateway** | `/leaderboard` | ELO updates real-time |

---

## 3. Luồng Dữ Liệu Chính

### 3.1 Matchmaking Flow

```mermaid
sequenceDiagram
    actor P1 as Player 1
    actor P2 as Player 2
    participant GW as GameGateway
    participant R as Redis
    
    P1->>GW: emit('find_game', {timeControl, rating})
    GW->>R: Lua Script: MATCHMAKE_LUA
    Note over R: ZRANGEBYSCORE tìm đối thủ<br/>trong khoảng [rating±30]
    R-->>GW: QUEUED (chưa có đối thủ)
    GW-->>P1: emit('searching', {eloRange, startedAt})
    
    P2->>GW: emit('find_game', {timeControl, rating})
    GW->>R: Lua Script: MATCHMAKE_LUA
    R-->>GW: MATCHED (tìm thấy P1)
    GW->>R: Tạo game state {gameId, fen, ...}
    GW-->>P1: emit('game_started', {gameState})
    GW-->>P2: emit('game_started', {gameState})
```

### 3.2 Game Move Flow

```mermaid
sequenceDiagram
    actor P1 as Player 1
    participant GW as GameGateway
    participant R as Redis
    participant WG as WatchGateway
    actor S as Spectator
    
    P1->>GW: emit('make_move', {from, to})
    GW->>R: Validate (chess.js) + Update state
    GW-->>P1: emit('move_made', {move, newFen})
    GW-->>P2: emit('move_made', {move, newFen})
    GW->>WG: Broadcast game_update
    WG-->>S: emit('game_update', {newState})
```

### 3.3 Game Over → Persist Flow

```mermaid
sequenceDiagram
    participant GW as GameGateway
    participant R as Redis
    participant DB as PostgreSQL
    participant LB as LeaderboardGateway
    
    GW->>R: Kiểm tra checkmate/timeout/resign
    GW-->>Players: emit('game_over', {result, eloChange})
    GW->>DB: INSERT INTO games (...)
    GW->>R: DEL chess:game:{id}
    GW->>LB: triggerEloUpdate(winner, loser)
    LB->>DB: UPDATE users SET rating = newRating
    LB-->>Users: emit('elo_updated', {newElo})
```

### 3.4 Chat Direct Message Flow

```mermaid
sequenceDiagram
    actor U1 as User 1
    participant CG as ChatGateway
    participant R as Redis
    participant DB as PostgreSQL
    actor U2 as User 2
    
    U1->>CG: emit('send_direct_message', {toUserId, content})
    CG->>R: HGET chess:online_users {toUserId}
    R-->>CG: socketId (User 2 đang online)
    CG->>DB: INSERT INTO messages (...)
    CG->>R: LPUSH chat:room:{id}:messages (cache 50)
    CG-->>U2: emit('receive_direct_message', {msg})
    CG-->>U1: emit('receive_direct_message', {msg}) (sync multi-tab)
```

---

## 4. Docker Compose — Network Topology

```mermaid
graph LR
    subgraph docker_network["docker-compose network: chess-network"]
        direction TB
        
        nginx["🔀 Nginx<br/>(optional)<br/>Reverse Proxy"]
        frontend["🖥️ Frontend<br/>Next.js :3000"]
        backend["⚙️ Backend<br/>NestJS :8080"]
        postgres["🗄️ PostgreSQL<br/>:5432"]
        redis["⚡ Redis<br/>:6379"]
    end
    
    browser["🌐 Browser"] -->|"HTTP :3000"| frontend
    browser -->|"HTTP :8080"| backend
    browser -->|"WebSocket :8080"| backend
    
    frontend -->|"REST /api/*"| backend
    backend -->|"SQL :5432"| postgres
    backend -->|"Redis Protocol :6379"| redis
```

### docker-compose.yml (kiến trúc)

```yaml
services:
  postgres:
    image: postgres:16
    ports: ["5432:5432"]
    volumes: [postgres_data:/var/lib/postgresql/data]
    environment:
      POSTGRES_DB: testnest
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: admin

  redis:
    image: redis:7-alpine
    ports: ["6379:6379"]
    volumes: [redis_data:/data]

  backend:
    build: ./backend
    ports: ["8080:8080"]
    depends_on: [postgres, redis]
    environment:
      DATABASE_URL: postgres://postgres:admin@postgres:5432/testnest
      REDIS_HOST: redis
      REDIS_PORT: 6379
      FRONTEND_URL: http://localhost:3000

  frontend:
    build: ./frontend
    ports: ["3000:3000"]
    depends_on: [backend]
    environment:
      NEXT_PUBLIC_API_URL: http://localhost:8080/api
      NEXT_PUBLIC_BACKEND_URL: http://localhost:8080

volumes:
  postgres_data:
  redis_data:
```

---

## 5. Công Nghệ Sử Dụng

| Tầng | Công nghệ | Phiên bản |
|------|-----------|-----------|
| **Frontend Framework** | Next.js (React) | 16 / 19 |
| **Backend Framework** | NestJS | 10 |
| **Language** | TypeScript | 5.x |
| **Database** | PostgreSQL | 16 |
| **ORM** | Drizzle ORM | latest |
| **Cache** | Redis | 7 |
| **Real-time** | Socket.IO | 4.x |
| **Chess Logic** | chess.js | latest |
| **AI Engine** | Stockfish | 16 (WASM) |
| **Container** | Docker + Compose | latest |
| **State Mgmt** | Zustand | latest |
| **Chess UI** | react-chessboard | latest |
