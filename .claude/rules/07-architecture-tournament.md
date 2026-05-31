# Hệ Thống Giải Đấu

## Swiss Pairing System

### Implementation
- **File**: [backend/src/tournament/tournament-swiss.service.ts](backend/src/tournament/tournament-swiss.service.ts)
- **Algorithm**: Swiss pairing - ghép cặp dựa trên điểm số và tiebreaks

### Cách Hoạt Động

1. **Tạo Giải Đấu**:
   - Creator tạo tournament với format, time control, số vòng
   - Players đăng ký tham gia

2. **Bắt Đầu Giải Đấu**:
   - Vòng 1: Ghép cặp ngẫu nhiên hoặc theo rating
   - Tạo các trận đấu với `tournamentId`

3. **Sau Mỗi Vòng**:
   - Cập nhật điểm số (win: 1, draw: 0.5, loss: 0)
   - Tính tiebreaks (Buchholz, Sonneborn-Berger)
   - Tạo pairings cho vòng tiếp theo dựa trên standings

4. **Kết Thúc Giải Đấu**:
   - Xác định người thắng dựa trên điểm và tiebreaks
   - Cập nhật rankings

## Database Schema

### tournaments
- `id`: UUID
- `name`: Tên giải đấu
- `format`: 'swiss' | 'round-robin' | 'knockout'
- `status`: 'pending' | 'active' | 'completed'
- `timeControl`: 'blitz' | 'rapid' | 'bullet'
- `startTime`, `endTime`: Thời gian
- `creatorId`: Người tạo

### tournament_participants
- `tournamentId`: FK to tournaments
- `userId`: FK to users
- `points`: Điểm số (float)
- `tieBreak`: Tiebreak score (float)
- `rank`: Xếp hạng (integer)

### games
- `tournamentId`: FK to tournaments (nullable)
- Liên kết game với tournament
