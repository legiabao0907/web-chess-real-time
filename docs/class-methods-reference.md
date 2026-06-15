# Class Methods Reference — Giải Thích Chi Tiết Từng Hàm

> **Tài liệu này giải thích CHI TIẾT từng hàm (method) của mỗi class** trong hệ thống cờ vua trực tuyến.
> Mỗi hàm được mô tả: mục đích, tham số đầu vào, giá trị trả về, và cách nó hoạt động.

---

## Mục Lục

- [1. Module Game](#1-module-game)
  - [GameGateway](#gamegateway)
  - [GameService](#gameservice)
  - [AiService](#aiservice)
- [2. Module Tournament](#2-module-tournament)
  - [TournamentGateway](#tournamentgateway)
  - [TournamentService](#tournamentservice)
  - [TournamentSwissService](#tournamentswissservice)
- [3. Module Chat](#3-module-chat)
  - [ChatGateway](#chatgateway)
  - [ChatService](#chatservice)
- [4. Module Auth](#4-module-auth)
  - [AuthController](#authcontroller)
  - [AuthService](#authservice)
- [5. Module User](#5-module-user)
  - [UserController](#usercontroller)
  - [UserService](#userservice)
- [6. Module Leaderboard](#6-module-leaderboard)
  - [LeaderboardGateway](#leaderboardgateway)
  - [LeaderboardService](#leaderboardservice)
- [7. Module Watch](#7-module-watch)
  - [WatchGateway](#watchgateway)
- [8. Frontend Stores & Hooks](#8-frontend-stores--hooks)

---

## 1. Module Game

### GameGateway

> **File**: `backend/src/game/game.gateway.ts`
> **Namespace**: `/chess`
> **Vai trò**: Cổng WebSocket chính cho mọi thao tác game. Nhận event từ client, ủy thác xử lý cho `GameService`, broadcast kết quả.

| Hàm | Giải thích |
|-----|-----------|
| **`afterInit(server)`** | Chạy 1 lần khi Gateway khởi tạo xong. Gọi `startReMatchIntervals()` để bắt đầu periodic re-match (mỗi 5 giây kiểm tra hàng đợi và ghép lại với phạm vi ELO mở rộng). |
| **`handleConnection(client)`** | Gọi khi có client WebSocket mới kết nối tới `/chess`. Gửi event `connected` xác nhận kết nối thành công. |
| **`handleDisconnect(client)`** | Gọi khi client ngắt kết nối. Nếu client đang trong hàng đợi → gọi `leaveQueue()` để xóa khỏi queue. Nếu client đang trong game → emit `opponent_disconnected` cho đối thủ. |
| **`handleReconnectCheck(client, data)`** | Client gửi `reconnect_check` khi load lại trang để kiểm tra có đang trong game nào không. Nếu có game active → tự động join lại room và gửi `game_state` để khôi phục giao diện. |
| **`handleFindGame(client, data)`** | **TÌM TRẬN**: Client gửi `find_game` với `{userId, username, timeControl, rating}`. Tạo `MatchmakingEntry`, emit `searching` cho client (đang tìm...), rồi gọi `GameService.joinQueue()` để ghép cặp atomic qua Redis Lua script. Nếu tìm thấy đối thủ → gọi `createGameFromMatch()`. |
| **`handleCancelSearch(client, data)`** | **HỦY TÌM TRẬN**: Client gửi `cancel_search`. Gọi `GameService.leaveQueue()` để xóa khỏi Redis queue. Emit `search_cancelled`. |
| **`handleStartBotGame(client, data)`** | **CHƠI VỚI MÁY**: Client gửi `start_bot_game` với `{difficulty, side, timeControl}`. Tạo game state với `blackId = BOT_USER_ID`, đánh dấu `isBot=true`. Emit `bot_game_start`. Nếu bot đi trước (người chơi chọn Đen) → gọi `triggerBotMove()` sau 600ms. |
| **`handleJoinGame(client, data)`** | **VÀO LẠI GAME**: Client gửi `join_game` để reconnect vào game đang active. Kiểm tra user có phải người chơi trong game không, nếu đúng → join room và emit `game_state` đầy đủ. |
| **`handleMakeMove(client, data)`** | **ĐI CỜ**: Client gửi `make_move` với `{gameId, userId, move: {from, to, promotion}}`. Gọi `GameService.processMove()` để validate + cập nhật game state. Nếu thành công → emit `move_made` cho room + gọi `WatchGateway.broadcastGameUpdate()`. Nếu game kết thúc → gọi `handleGameOver()`. Nếu là bot game → trigger bot move tiếp theo. |
| **`handleAnalyzePosition(client, data)`** | **PHÂN TÍCH THẾ CỜ**: Client gửi `analyze_position` với `{fen}`. Gọi `AiService.evaluatePosition()` để đánh giá thế cờ (centipawns), và `AiService.getBestMove()` để gợi ý nước đi tốt nhất. Trả về `position_analysis`. |
| **`handleResign(client, data)`** | **ĐẦU HÀNG**: Client gửi `resign` với `{gameId, userId}`. Gọi `GameService.resign()` → set `winner = đối thủ`. Tính ELO change qua `triggerLeaderboardUpdate()`. Emit `game_over` với ELO changes. Persist vào DB + dọn dẹp Redis. |
| **`handleClaimTimeout(client, data)`** | **KHIẾU NẠI HẾT GIỜ**: Client gửi `claim_timeout` khi đồng hồ đối thủ về 0. Server kiểm tra thời gian thực tế (tính elapsed từ `lastMoveAt`). Nếu đúng là hết giờ (< 2 giây) → set game over. Nếu còn thời gian (> 2 giây) → bỏ qua (chống claim sai). |
| **`handleOfferDraw(client, data)`** | **XIN HÒA**: Client gửi `offer_draw`. Nếu đối thủ đã offer draw trước đó (cùng game) → auto-accept (gọi `acceptDraw`). Nếu chưa → lưu offer vào Redis với TTL 60s, emit `draw_offered` cho đối thủ. Nếu là bot game → bot luôn từ chối hòa. |
| **`handleAcceptDraw(client, data)`** | **CHẤP NHẬN HÒA**: Client gửi `accept_draw`. Gọi `GameService.acceptDraw()` → set `status='draw', winner='draw'`. Tính ELO change (hòa). Emit `game_over`. Persist DB + dọn dẹp. |
| **`handleDeclineDraw(client, data)`** | **TỪ CHỐI HÒA**: Client gửi `decline_draw`. Emit `draw_declined` cho đối thủ. |
| **`handleSendMessage(client, data)`** | **CHAT TRONG GAME**: Client gửi `send_message` với `{gameId, userId, username, message}`. Trim + giới hạn 500 ký tự. Broadcast `chat_message` tới room. |
| **`createGameFromMatch(player1, player2, timeControl)`** | *(private)* Tạo game state từ 2 người chơi đã được ghép cặp. Random chọn trắng/đen. Gọi `GameService.createGameState()`, lưu vào Redis, set `currentGameId` cho cả 2, join Socket.IO room, emit `game_start`. |
| **`triggerBotMove(gameId, playerClient?)`** | *(private)* Gọi AI để sinh nước đi cho bot. Lấy `GameService.getBestMove()` từ `AiService`, gọi `processMove()` với `userId=BOT_USER_ID`, emit `move_made`. Nếu game kết thúc sau nước đi của bot → gọi `handleGameOver()`. |
| **`getBotDelay(difficulty)`** | *(private)* Trả về thời gian "suy nghĩ" giả lập cho bot: Easy=300-700ms, Medium=500-1300ms, Hard=800-2000ms. Tạo cảm giác bot đang "nghĩ". |
| **`handleGameOver(gameId, game, client?)`** | *(private)* **XỬ LÝ KẾT THÚC GAME**: Tính ELO change → emit `game_over` với ELO changes → persist vào PostgreSQL → clear `currentGameId` khỏi Redis → nếu là tournament game → gọi `recordTournamentGameResult()`. |
| **`triggerLeaderboardUpdate(game)`** | *(private)* Tính ELO FIDE (K=32) cho cả 2 người chơi. Lấy ELO hiện tại từ `LeaderboardService.getPlayerRank()`. Gọi `LeaderboardGateway.triggerEloUpdate()`. Map kết quả winner/loser → white/black changes. |
| **`recordTournamentGameResult(gameId, game)`** | *(private)* Nếu game thuộc giải đấu: gọi `TournamentService.recordTournamentResult()` để cập nhật điểm. Kiểm tra nếu tất cả game trong vòng đã finished → tự động chuyển vòng sau 30 giây (hoặc finish nếu đã 7 vòng). |

---

### GameService

> **File**: `backend/src/game/game.service.ts`
> **Vai trò**: Business logic cốt lõi — matchmaking, tạo game, validate nước đi, quản lý đồng hồ, lưu trữ.

| Hàm | Giải thích |
|-----|-----------|
| **`onModuleInit()`** | Chạy khi module khởi tạo. Pre-load 2 Lua scripts (`MATCHMAKE_LUA`, `LEAVE_QUEUE_LUA`) vào Redis và cache SHA1 digest để dùng `EVALSHA` (nhanh hơn `EVAL`). |
| **`getGame(gameId)`** | Đọc game state từ Redis (`chess:game:{gameId}`). Parse JSON → `GameState`. Trả về `null` nếu không tìm thấy. |
| **`saveGame(game, ttlSeconds)`** | Lưu game state vào Redis với TTL (mặc định 3600s = 1 giờ). Dùng `SETEX`. |
| **`deleteGame(gameId)`** | Xóa game state khỏi Redis. |
| **`getUserCurrentGame(userId)`** | Lấy `gameId` hiện tại của user từ Redis (`chess:user:{userId}:game`). Dùng để kiểm tra user có đang trong game nào không. |
| **`setUserCurrentGame(userId, gameId)`** | Gán `gameId` cho user (đánh dấu user đang trong game). TTL 3600s. |
| **`clearUserCurrentGame(userId)`** | Xóa mapping user→game khi game kết thúc. |
| **`joinQueue(entry, maxEloDiff)`** | **GHÉP TRẬN ATOMIC**: Gọi Redis `EVALSHA MATCHMAKE_LUA` — Lua script chạy atomic trong Redis: ZSCAN kiểm tra trùng lặp → ZRANGEBYSCORE tìm đối thủ trong khoảng `[rating-maxDiff, rating+maxDiff]` → chọn đối thủ có rating gần nhất → nếu tìm thấy: ZREM đối thủ, return `MATCHED:{...}` → nếu không: ZADD vào queue, return `QUEUED:{...}`. Xử lý fallback nếu script bị flush (NOSCRIPT → reload). |
| **`leaveQueue(userId, timeControl)`** | **RỜI HÀNG ĐỢI ATOMIC**: Gọi Redis `EVALSHA LEAVE_QUEUE_LUA` — ZSCAN tìm entry của user trong ZSET → ZREM xóa. Đảm bảo không có race condition. |
| **`getExpandedEloRange(joinedAt)`** | *(static)* Tính phạm vi ELO hiện tại dựa trên thời gian chờ: mỗi 5 giây mở rộng thêm ±30, bắt đầu từ ±30, tối đa ±200. VD: chờ 12 giây → `30 + 2*30 = 90`. |
| **`getQueueSize(timeControl)`** | Đếm số người đang chờ trong queue (`ZCARD`). |
| **`getQueueEntries(timeControl)`** | Lấy toàn bộ entries trong queue (`ZRANGE 0 -1`). Parse JSON → `MatchmakingEntry[]`. |
| **`reMatchWaitingPlayers(timeControl)`** | **PERIODIC RE-MATCH**: Được gọi mỗi 5 giây bởi `GameGateway`. Duyệt tất cả người đang chờ, tính `expandedRange`, thử ghép lại với `joinQueue(entry, expandedRange)`. Chỉ ghép khi range đã mở rộng hơn ban đầu (>30). |
| **`createGameState(gameId, white, black, timeControl)`** | Tạo `GameState` mới: khởi tạo bàn cờ (chess.js), set đồng hồ theo time control (VD: blitz_5 = 5 phút), `status='active'`, `turn='w'`, `lastMoveAt=Date.now()`. |
| **`processMove(gameId, userId, move)`** | **XỬ LÝ NƯỚC ĐI**: (1) Kiểm tra game tồn tại & active. (2) Kiểm tra đúng lượt (trừ bot). (3) Tính elapsed time → trừ đồng hồ + cộng increment → kiểm tra timeout. (4) Load lại chess.js state từ `verboseMoves` (hoặc PGN/FEN). (5) Gọi `chess.move()` — nếu illegal → return error. (6) Cập nhật FEN, PGN, turn, moveHistory, verboseMoves. (7) Kiểm tra checkmate/stalemate/draw. (8) Lưu game vào Redis. |
| **`resign(gameId, userId)`** | Xử lý đầu hàng: set `status='resigned'`, `winner = đối thủ`. Lưu game. |
| **`offerDraw(gameId, userId)`** | Xử lý xin hòa: kiểm tra Redis key `chess:game:{gameId}:draw_offer`. Nếu đối thủ đã offer trước → return `true` (hòa được chấp nhận). Nếu chưa → lưu userId vào Redis với TTL 60s → return `false`. |
| **`acceptDraw(gameId)`** | Chấp nhận hòa: set `status='draw'`, `winner='draw'`. Lưu game. |
| **`generateGameId()`** | Tạo UUID v4 cho game mới. |
| **`saveGameToDb(gameId)`** | **PERSIST VÀO POSTGRESQL**: Đọc game từ Redis → nullify BOT_USER_ID (không phải UUID hợp lệ) → xác định winnerId → lấy tournamentId nếu có → INSERT vào bảng `games` với `ON CONFLICT DO NOTHING` (tránh lưu trùng). Log lỗi nếu thất bại. |
| **`getGameHistory(userId)`** | Lấy lịch sử trận đấu của user từ PostgreSQL (cả trận làm trắng và đen). Sắp xếp theo thời gian giảm dần. |
| **`getPublicGameHistory(targetUserId)`** | Giống `getGameHistory` nhưng không yêu cầu auth — dùng cho public profile. Giới hạn 30 trận gần nhất. |

---

### AiService

> **File**: `backend/src/ai/ai.service.ts`
> **Vai trò**: Engine cờ vua AI — Minimax + Alpha-Beta Pruning + Piece-Square Tables.

| Hàm | Giải thích |
|-----|-----------|
| **`getBestMove(fen, difficulty, botColor)`** | **SINH NƯỚC ĐI TỐT NHẤT**: (1) Nếu Easy + 35% random → gọi `getRandomMove()`. (2) Duyệt tất cả nước đi hợp lệ (đã sắp xếp theo MVV-LVA). (3) Với mỗi nước: `chess.move()` → `minimax(depth-1)` → `chess.undo()`. (4) Chọn nước có score tốt nhất (max cho trắng, min cho đen). (5) Trả về `{from, to, promotion}`. |
| **`evaluatePosition(fen)`** | **ĐÁNH GIÁ THẾ CỜ**: Public API cho phân tích. Trả về centipawn score từ góc nhìn Trắng (dương = trắng tốt hơn). ±99999 nếu chiếu hết |
| **`minimax(chess, depth, alpha, beta, maximizing)`** | *(private)* **Thuật toán Minimax + Alpha-Beta Pruning**: Đệ quy tìm kiếm cây game đến `depth`. Nếu `depth=0` hoặc game over → gọi `quiescence()`. Sắp xếp nước đi bằng `orderMoves()` để tối ưu cắt tỉa. Cắt nhánh khi `beta <= alpha`. |
| **`quiescence(chess, alpha, beta, maximizing, depth)`** | *(private)* **Quiescence Search**: Tiếp tục tìm kiếm chỉ các nước ăn quân (captures + en-passant) để tránh "horizon effect" — tình trạng bỏ sót chiến thuật vì depth giới hạn. |
| **`evaluate(chess)`** | *(private)* **Hàm đánh giá**: Duyệt toàn bộ bàn cờ, tính điểm dựa trên (1) Giá trị quân cờ (Pawn=100, Knight=320, Bishop=330, Rook=500, Queen=900, King=20000) + (2) Piece-Square Tables (vị trí quân trên bàn cờ). Điểm từ góc nhìn Trắng (dương = trắng hơn). |
| **`orderMoves(moves, chess)`** | *(private)* **Sắp xếp nước đi (MVV-LVA)**: Ưu tiên nước ăn quân — quân bị ăn giá trị cao nhất (MVV) bởi quân tấn công giá trị thấp nhất (LVA). Cải thiện đáng kể hiệu quả Alpha-Beta pruning (cắt được nhiều nhánh hơn). |
| **`getRandomMove(chess)`** | *(private)* Chọn ngẫu nhiên 1 nước trong danh sách legal moves. Dùng cho chế độ Easy (35% xác suất). |

---

## 2. Module Tournament

### TournamentGateway

> **File**: `backend/src/tournament/tournament.gateway.ts`
> **Namespace**: `/tournament`

| Hàm | Giải thích |
|-----|-----------|
| **`tournamentIdentify(data)`** | Client gửi `tournament_identify` để đăng ký `userId → socketId`. Lưu vào map `userSockets` để có thể gửi thông báo cá nhân sau này. |
| **`joinTournamentRoom(data)`** | Client join Socket.IO room của giải đấu (`tournament:{id}`) để nhận real-time updates. |
| **`leaveTournamentRoom(data)`** | Client rời room giải đấu. |
| **`notifyGameResult(data)`** | Gửi thông báo kết quả 1 trận trong giải tới tất cả participants trong room. |
| **`notifyNextRound(data)`** | Gửi thông báo vòng mới (pairings) tới tất cả participants. |
| **`notifyTournamentFinished(data)`** | Gửi thông báo giải đấu kết thúc (final standings). |
| **`notifyPlayer(userId, event, data)`** | Gửi event riêng tới 1 người chơi cụ thể (dùng `userSockets` map để tìm socket). VD: `tournament_game_ready`. |
| **`broadcastTournamentUpdate(tournamentId, data)`** | Broadcast event `tournament_update` tới tất cả clients trong room của giải đấu. |
| **`setNextRoundTimer(tournamentId, timestamp)`** | Lưu timestamp bắt đầu vòng tiếp theo (dùng cho countdown 30s). |
| **`clearNextRoundTimer(tournamentId)`** | Xóa timer khi đã chuyển vòng. |

---

### TournamentService

> **File**: `backend/src/tournament/tournament.service.ts`

| Hàm | Giải thích |
|-----|-----------|
| **`listTournaments()`** | Lấy danh sách tất cả giải đấu từ PostgreSQL, kèm `creatorUsername` và `participantCount`. Sắp xếp theo `startTime` giảm dần. |
| **`getTournament(id)`** | Lấy chi tiết 1 giải đấu: thông tin tournament + danh sách participants (kèm username, points, tieBreak, rank) + current round. |
| **`getTournamentRounds(tournamentId)`** | Đọc tất cả các vòng đấu từ Redis (key `tournament:{id}:round:{n}`). Parse JSON → `TournamentRound[]`. |
| **`getCurrentRound(tournamentId)`** | Đọc số vòng hiện tại từ Redis (`tournament:{id}:currentRound`). |
| **`createTournament(creatorId, dto)`** | Tạo giải đấu mới: INSERT vào PostgreSQL với `status='upcoming'`. Tự động join creator vào giải. |
| **`joinTournament(tournamentId, userId)`** | Tham gia giải đấu: kiểm tra giải tồn tại, chưa ongoing/finished, user chưa tham gia → INSERT vào `tournament_participants`. |
| **`leaveTournament(tournamentId, userId)`** | Rời giải đấu: chỉ khi `status='upcoming'` → DELETE khỏi `tournament_participants`. |
| **`startTournament(tournamentId, userId)`** | **BẮT ĐẦU GIẢI**: Kiểm tra creator + status='upcoming' + ≥2 người. Update status → 'ongoing'. Gọi `generateSwissPairings()` tạo Round 1. Tạo GameState trong Redis cho từng cặp đấu. Lưu round vào Redis. |
| **`nextRound(tournamentId, userId?)`** | **CHUYỂN VÒNG**: Kiểm tra tất cả game vòng hiện tại đã finished. Mark vòng hiện tại finished. Áp dụng điểm số (`applyRoundResults`). Nếu đã 7 vòng → finish. Nếu chưa → gọi `TournamentSwissService.generateNextRoundPairs()` → tạo GameState mới → lưu round mới vào Redis. |
| **`finishTournament(tournamentId, userId)`** | **KẾT THÚC GIẢI**: Update status → 'finished', set `endTime`. Cập nhật rankings dựa trên points + tieBreak. |
| **`deleteTournament(tournamentId, userId, isAdmin)`** | **XÓA GIẢI ĐẤU**: Chỉ creator/admin, và status != 'ongoing'. Cascade: xóa participants → unlink games → xóa tournament. Dọn dẹp Redis keys (tất cả round data + currentRound + reverse lookup). |
| **`recordTournamentResult(tournamentId, gameId, result)`** | Ghi nhận kết quả 1 trận trong giải: cập nhật `TournamentGame.status='finished'`, `result`, `whitePoints/blackPoints`. Lưu vào Redis round data. Trả về round đã cập nhật. |
| **`getTournamentGameInfo(gameId)`** | Lấy thông tin `{tournamentId, round}` từ Redis reverse lookup (`tournament:game:{gameId}`). |
| **`applyRoundResults(tournamentId, roundData)`** | Cập nhật điểm số + tieBreak cho tất cả participants sau 1 vòng. Gọi `updateTiebreaks()` tính Buchholz. UPDATE PostgreSQL. |

---

### TournamentSwissService

> **File**: `backend/src/tournament/tournament-swiss.service.ts`

| Hàm | Giải thích |
|-----|-----------|
| **`generateNextRoundPairs(tournamentId, nextRound)`** | **HÀM CHÍNH**: Sinh cặp đấu cho vòng tiếp theo theo thuật toán Hệ Thụy Sĩ (Swiss System). (1) Lấy participants từ DB + rating. (2) Lấy lịch sử tất cả trận đã đấu từ `games` table. (3) Tính thống kê màu quân. (4) Chạy `pairPlayers()`. (5) Trả về `SwissRoundResult` (KHÔNG ghi DB — caller tự lưu). |
| **`buildPlayerList(tournamentId)`** | *(private)* Lấy danh sách `SwissPlayer[]` từ DB: userId, username, tournamentPoints, rating (theo time control), whitesPlayed, blacksPlayed, colorHistory, hadBye. |
| **`pairPlayers(players, pastMatches)`** | *(private)* **THUẬT TOÁN GHÉP CẶP SWISS**: (1) Sắp xếp players theo điểm giảm dần. (2) Chia thành nhóm cùng điểm (score groups). (3) Trong mỗi nhóm: ghép cặp 2 người chưa từng đấu với nhau, ưu tiên cân bằng màu quân. (4) Nếu lẻ → xử lý "float" (người bị dư đấu với nhóm điểm thấp hơn). (5) Nếu vẫn lẻ → cho người thấp nhất bye (miễn chưa nhận bye trước đó). |
| **`calculateTiebreaks(player)`** | *(private)* Tính điểm Buchholz (tổng điểm của tất cả đối thủ đã gặp) và Sonneborn-Berger (tổng điểm đối thủ đã thắng + nửa điểm đối thủ đã hòa). |
| **`generateSwissPairings(...)`** | *(legacy/fallback)* Phiên bản đơn giản hơn của `generateNextRoundPairs`, dùng trong `startTournament()` để tạo Round 1 nhanh chóng. |

---

## 3. Module Chat

### ChatGateway

> **File**: `backend/src/chat/chat.gateway.ts`
> **Namespace**: `/chat`

| Hàm | Giải thích |
|-----|-----------|
| **`identify(data)`** | Client gửi `identify` với `{userId, username}` khi kết nối. Lưu `userId → socketId` vào Redis Hash `chess:online_users` VÀ vào map `userSockets` (hỗ trợ multi-tab). Gọi `broadcastUserStatus()` để thông báo bạn bè biết user online. |
| **`joinDm(data)`** | Client mở khung chat với 1 friend. Gọi `ChatService.getOrCreatePrivateRoom()` → join Socket.IO room → gọi `ChatService.getMessages()` lấy lịch sử → emit `dm_joined` với roomId + messages. |
| **`sendDm(data)`** | **GỬI TIN NHẮN (ROOM-BASED)**: Dùng khi cả 2 đã join room. Gọi `ChatService.saveMessage()` → lưu DB + cache Redis → emit `dm_message` tới room. |
| **`sendDirectMessage(data)`** | **GỬI TIN NHẮN (DIRECT-BASED)**: Dùng khi người nhận chưa mở chat. Tra `socketId` của người nhận từ Redis Hash `chess:online_users` → emit `receive_direct_message` trực tiếp tới socket đó (KHÔNG cần room). Đồng thời emit ngược lại cho tất cả socket của người gửi (multi-tab sync). |
| **`typing(data)`** | Client emit `typing` khi đang gõ → broadcast `user_typing` tới room. |
| **`getDmHistory(data)`** | Client yêu cầu thêm lịch sử (pagination). Gọi `ChatService.getMessages()` với offset → emit `dm_history`. |
| **`broadcastUserStatus(userId, username, online)`** | *(public)* Thông báo trạng thái online/offline tới tất cả bạn bè đang online của user đó. |

---

### ChatService

> **File**: `backend/src/chat/chat.service.ts`

| Hàm | Giải thích |
|-----|-----------|
| **`getOrCreatePrivateRoom(user1Id, user2Id)`** | Tìm private room đã tồn tại giữa 2 user (dùng JOIN qua `chat_room_members`). Nếu chưa có → tạo room mới + thêm cả 2 vào. Trả về `roomId`. |
| **`saveMessage(roomId, senderId, senderUsername, content)`** | Lưu tin nhắn: INSERT vào PostgreSQL `messages` table → push vào Redis List `chat:room:{roomId}:messages` (giữ tối đa 50 tin, TTL 1h). Trả về `ChatMessage` object. |
| **`getMessages(roomId, limit)`** | Lấy lịch sử tin nhắn: thử Redis cache trước (`LRANGE`). Nếu cache rỗng → query PostgreSQL → warm cache (ghi lại vào Redis). Trả về `ChatMessage[]` (sắp xếp cũ→mới). |
| **`getUserRooms(userId)`** | Lấy danh sách tất cả `roomId` mà user là thành viên. |

---

## 4. Module Auth

### AuthController

> **File**: `backend/src/auth/auth.controller.ts`

| Hàm | Giải thích |
|-----|-----------|
| **`POST /auth/register`** | Nhận `{email, username, password}` → gọi `AuthService.register()` → trả về user + tokens. |
| **`POST /auth/login`** | Nhận `{identifier, password}` → gọi `AuthService.login()` → trả về user + tokens. |
| **`POST /auth/refresh`** | Nhận `{refreshToken}` → gọi `AuthService.refreshTokens()` → trả về cặp token mới. |

---

### AuthService

> **File**: `backend/src/auth/auth.service.ts`

| Hàm | Giải thích |
|-----|-----------|
| **`register(dto)`** | **ĐĂNG KÝ**: (1) Kiểm tra email/username chưa tồn tại. (2) Hash password với bcrypt (cost factor 12). (3) INSERT user mới với ELO mặc định 1200. (4) Tạo JWT tokens. (5) Trả về user + `{accessToken, refreshToken}`. |
| **`login(dto)`** | **ĐĂNG NHẬP**: (1) Tìm user theo email HOẶC username. (2) So sánh password với bcrypt hash. (3) Nếu đúng → tạo tokens. (4) Nếu sai → 401 Unauthorized. |
| **`refreshTokens(refreshToken)`** | **LÀM MỚI TOKEN**: Verify refresh token với `JWT_REFRESH_SECRET`. Nếu hợp lệ + user tồn tại → tạo cặp token mới. Nếu hết hạn/sai → 401. |
| **`generateTokens(userId, username, email)`** | *(private)* Tạo JWT access token (secret `JWT_ACCESS_SECRET`, hết hạn `JWT_ACCESS_EXPIRES_IN` = 15 phút) và refresh token (secret `JWT_REFRESH_SECRET`, hết hạn `JWT_REFRESH_EXPIRES_IN` = 7 ngày). |

---

## 5. Module User

### UserController

> **File**: `backend/src/user/user.controller.ts`

| Hàm | Giải thích |
|-----|-----------|
| **`GET /user/me`** | Lấy thông tin user hiện tại: profile + friends + stats. Gọi `UserService.getMe()`. |
| **`PATCH /user/profile`** | Cập nhật profile: username, bio, avatar... Gọi `UserService.updateMe()`. |
| **`POST /user/friends/request`** | Gửi lời mời kết bạn: `{targetUsername}`. Gọi `UserService.sendFriendRequest()`. |
| **`PUT /user/friends/respond`** | Phản hồi lời mời: `{requestId, accept}`. Gọi `UserService.respondFriendRequest()`. |
| **`GET /user/friends`** | Lấy danh sách bạn bè. Gọi `UserService.getFriendList()`. |

---

### UserService

> **File**: `backend/src/user/user.service.ts`

| Hàm | Giải thích |
|-----|-----------|
| **`getMe(userId)`** | Lấy đầy đủ thông tin user: users table + profileInfo (avatar, bio, country, stats) + danh sách bạn bè (kèm username, ELO). |
| **`updateMe(userId, dto)`** | Cập nhật profile: nếu có `username` → kiểm tra uniqueness → UPDATE. Nếu có avatar/bio → upsert `profileInfo.metadata` JSONB. |
| **`sendFriendRequest(fromId, toUsername)`** | Gửi lời mời kết bạn: tìm user theo username → kiểm tra chưa là bạn/chưa gửi lời mời → INSERT vào `friends` với `status='pending'`. |
| **`respondFriendRequest(requestId, accept)`** | Phản hồi lời mời: nếu accept → UPDATE `status='accepted'`. Nếu decline → DELETE record. |
| **`getFriendList(userId)`** | Lấy danh sách bạn bè (status='accepted'), kèm thông tin cơ bản của bạn. |

---

## 6. Module Leaderboard

### LeaderboardGateway

> **File**: `backend/src/leaderboard/leaderboard.gateway.ts`
> **Namespace**: `/leaderboard`

| Hàm | Giải thích |
|-----|-----------|
| **`handleSubscribe(client, data)`** | Client subscribe vào 1 category (blitz/bullet/rapid). Join Socket.IO room `leaderboard:{category}`. Gửi ngay `leaderboard_data` (bảng xếp hạng hiện tại). |
| **`handleUnsubscribe(client, data)`** | Client rời room category. |
| **`handleRequest(client, data)`** | Client yêu cầu bảng xếp hạng (pagination: limit, offset). Gửi `leaderboard_data`. |
| **`broadcastLeaderboard(category, limit)`** | *(public)* Broadcast bảng xếp hạng mới nhất tới tất cả subscribers của category. Gọi sau mỗi lần ELO thay đổi. |
| **`triggerEloUpdate(params)`** | *(public)* **TÍNH ELO FIDE**: Nhận `{winnerId, loserId, winnerElo, loserElo, isDraw, category}`. Áp dụng công thức FIDE với K=32: `expected = 1/(1+10^((opponentElo - elo)/400))`, `change = round(K * (score - expected))`, `newElo = max(100, elo + change)`. Gọi `LeaderboardService.updateElo()` cho cả winner và loser. Broadcast cập nhật. Trả về `{winnerChange, loserChange, winnerNewElo, loserNewElo}`. |

---

### LeaderboardService

> **File**: `backend/src/leaderboard/leaderboard.service.ts`

| Hàm | Giải thích |
|-----|-----------|
| **`updateElo(dto)`** | Cập nhật ELO cho 1 người chơi: (1) Đọc dữ liệu cũ từ Redis Hash. (2) Tính wins/losses/draws/gamesPlayed tích lũy. (3) Ghi Redis Hash `chess:player:{userId}:{category}` (TTL 7 ngày). (4) `ZADD` vào Redis Sorted Set `chess:leaderboard:{category}` (score=ELO). (5) UPDATE PostgreSQL `users` table (persist). |
| **`getTopPlayers(category, limit, offset)`** | Lấy top N người chơi: `ZREVRANGE` (ELO giảm dần) → pipeline `GET` từng player data → build `LeaderboardEntry[]` với rank, username, elo, wins/losses/draws, winRate, trend. |
| **`getPlayerRank(userId, category)`** | Lấy rank + ELO của 1 người chơi: `ZREVRANK` + `ZSCORE`. |
| **`seedDemoData()`** | *(dev only)* Thêm dữ liệu mẫu (Magnus Carlsen, Hikaru Nakamura...) vào Redis nếu bảng xếp hạng đang trống. |

---

## 7. Module Watch

### WatchGateway

> **File**: `backend/src/watch/watch.gateway.ts`
> **Namespace**: `/watch`

| Hàm | Giải thích |
|-----|-----------|
| **`handleWatchGame(client, data)`** | Client gửi `watch_game` với `{gameId}`. Kiểm tra game tồn tại → join Socket.IO room → emit `watch_state` (trạng thái hiện tại: FEN, đồng hồ, moveHistory, spectatorCount). |
| **`handleLeaveWatch(client, data)`** | Client rời chế độ xem. Rời room + giảm spectator count. |
| **`broadcastGameUpdate(gameId, move)`** | *(public — được GameGateway gọi)* Broadcast `game_update` tới tất cả spectators trong room. Chứa FEN mới, nước đi, đồng hồ. |
| **`broadcastGameOver(gameId, result)`** | *(public — được GameGateway gọi)* Broadcast `game_over` tới tất cả spectators khi game kết thúc. |

---

## 8. Frontend Stores & Hooks

### 🏪 Zustand Stores

#### UserStore
| Hàm | Giải thích |
|-----|-----------|
| **`login(email, password)`** | Gọi API `/auth/login` → lưu tokens vào localStorage → set `user` + `isAuthenticated=true`. |
| **`register(data)`** | Gọi API `/auth/register` → tự động login sau khi đăng ký thành công. |
| **`logout()`** | Xóa tokens khỏi localStorage → reset state. |
| **`fetchProfile()`** | Gọi API `GET /user/me` → cập nhật thông tin user. |
| **`updateLocalElo(newElo)`** | Cập nhật ELO trong localStorage `authUser` ngay sau khi game kết thúc (để UI hiển thị ELO mới mà không cần gọi API). |

#### GameStore
| Hàm | Giải thích |
|-----|-----------|
| **`setGame(game)`** | Lưu `GameState` hiện tại khi game bắt đầu. |
| **`updateMove(move)`** | Cập nhật FEN, PGN, đồng hồ sau mỗi nước đi. |
| **`setGameOver(result)`** | Lưu kết quả khi game kết thúc (winner, ELO changes). |
| **`setSearching(bool)`** | Bật/tắt trạng thái "đang tìm trận". |
| **`reset()`** | Reset toàn bộ state về mặc định. |

#### ChatStore
| Hàm | Giải thích |
|-----|-----------|
| **`upsertRoomForDirect(msg)`** | Tạo/cập nhật phòng chat tạm khi nhận `receive_direct_message`. Nếu phòng chưa tồn tại → tạo mới với `unreadCount=1` (hiển thị badge). Nếu đã có → thêm message + tăng unread. |
| **`addMessage(roomId, msg)`** | Thêm tin nhắn vào phòng đã mở. |
| **`setActiveRoom(roomId)`** | Đánh dấu phòng đang mở → reset `unreadCount=0`. |
| **`markRead(roomId)`** | Đánh dấu tất cả tin nhắn đã đọc. |
| **`setTyping(roomId, userId, bool)`** | Cập nhật trạng thái "đang gõ" của 1 user trong phòng. |

#### TournamentStore
| Hàm | Giải thích |
|-----|-----------|
| **`fetchTournaments()`** | Gọi API lấy danh sách giải đấu. |
| **`setCurrentTournament(t)`** | Lưu giải đấu đang xem. |
| **`setPairings(pairings)`** | Cập nhật cặp đấu của người chơi. |
| **`startCountdown(ms)`** | Bắt đầu đếm ngược 30 giây (dùng `useRef` để tránh stale closure). |
| **`clearCountdown()`** | Xóa countdown timer. |

### 🪝 Custom Hooks

#### useChessSocket
| Hàm | Giải thích |
|-----|-----------|
| **`connect()`** | Tạo kết nối Socket.IO tới `/chess` namespace. Đăng ký tất cả listener (onGameStarted, onMoveMade, onGameOver, onSearchProgress). |
| **`disconnect()`** | Ngắt kết nối WebSocket. |
| **`joinQueue(timeControl)`** | Emit `find_game` để bắt đầu tìm trận. |
| **`makeMove(from, to, promotion)`** | Emit `make_move` khi người dùng thả quân. |
| **`resign()`** | Emit `resign` khi bấm nút đầu hàng. |
| **`offerDraw()`** | Emit `offer_draw` khi bấm nút xin hòa. |
| **`respondDraw(accept)`** | Emit `accept_draw` hoặc `decline_draw`. |
| **`startBotGame(difficulty, color)`** | Emit `start_bot_game` khi chơi với máy. |

#### useFriendChat
| Hàm | Giải thích |
|-----|-----------|
| **`connect(userId)`** | Tạo kết nối Socket.IO tới `/chat`. Tự động gửi `identify`. |
| **`sendMessage(roomId, content)`** | Gửi tin nhắn qua room (ưu tiên). |
| **`sendDirectMessage(toUserId, content)`** | Gửi tin nhắn trực tiếp (fallback). |
| **`joinDm(friendId)`** | Mở phòng chat với bạn → emit `join_dm`. |
| **`sendTyping(roomId)`** | Emit `typing` khi đang gõ. |

#### useWatchSocket
| Hàm | Giải thích |
|-----|-----------|
| **`connect()`** | Kết nối tới `/watch` namespace. |
| **`watchGame(gameId)`** | Emit `watch_game` để xem 1 trận. |
| **`leaveWatch()`** | Emit `leave_watch` để dừng xem. |

#### useLeaderboard
| Hàm | Giải thích |
|-----|-----------|
| **`subscribe(category)`** | Emit `subscribe_leaderboard` → nhận `leaderboard_data` ban đầu → listen `leaderboard_data` cho updates. |
| **`unsubscribe()`** | Emit `unsubscribe_leaderboard`. |

#### useStockfish
| Hàm | Giải thích |
|-----|-----------|
| **`load()`** | Khởi tạo Stockfish Web Worker từ `stockfish-worker.js`. |
| **`getBestMove(fen, difficulty)`** | Gửi FEN cho Stockfish → chờ kết quả → parse nước đi tốt nhất → trả về `{from, to, promotion}`. |
| **`terminate()`** | Dừng Web Worker. |

---

## Phụ lục: Các DTO/Interface chính

| DTO | File | Mô tả |
|-----|------|-------|
| **`GameState`** | `game/dto/game.dto.ts` | Trạng thái đầy đủ của một ván cờ: id, fen, pgn, whiteId/blackId, đồng hồ (whiteTimeMs/blackTimeMs), turn, moveHistory, verboseMoves, status, winner, isBot, botDifficulty, botColor |
| **`MatchmakingEntry`** | `game/dto/game.dto.ts` | Thông tin người chơi trong hàng đợi: userId, username, rating, timeControl, socketId, joinedAt |
| **`MakeMoveDto`** | `game/dto/game.dto.ts` | Dữ liệu nước đi từ client: gameId, userId, move {from, to, promotion?} |
| **`StartBotGameDto`** | `game/dto/game.dto.ts` | Dữ liệu bắt đầu game với bot: userId, difficulty, side, timeControl |
| **`VerboseMove`** | `game/dto/game.dto.ts` | Chi tiết 1 nước đi từ chess.js: color, from, to, piece, captured, promotion, flags, san, before, after |
| **`TournamentRound`** | `tournament/tournament.service.ts` | Dữ liệu 1 vòng đấu: tournamentId, round, games[], status |
| **`TournamentGame`** | `tournament/tournament.service.ts` | Dữ liệu 1 trận trong giải: gameId, whiteId/blackId, status, result, whitePoints/blackPoints |
| **`SwissPlayer`** | `tournament/tournament-swiss.service.ts` | Thông tin kỳ thủ cho Swiss pairing: tournamentPoints, rating, whitesPlayed, blacksPlayed, colorHistory, hadBye |
| **`SwissPairing`** | `tournament/tournament-swiss.service.ts` | Kết quả ghép cặp: gameId, whiteId/blackId, whiteUsername/blackUsername, round, type |
| **`LeaderboardEntry`** | `leaderboard/dto/leaderboard.dto.ts` | 1 dòng trong bảng xếp hạng: rank, userId, username, elo, wins, losses, draws, gamesPlayed, winRate, trend, eloChange |
| **`UpdateEloDto`** | `leaderboard/dto/leaderboard.dto.ts` | Dữ liệu cập nhật ELO: userId, username, category, newElo, eloDelta, wins, losses, draws |
| **`ChatMessage`** | `chat/dto/chat.dto.ts` | 1 tin nhắn: id, roomId, senderId, senderUsername, content, createdAt |
