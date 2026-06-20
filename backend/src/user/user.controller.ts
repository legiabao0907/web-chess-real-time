import {
  Controller,
  Get,
  Post,
  Delete,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { UserService } from './user.service';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { Request } from 'express';

interface AuthRequest extends Request {
  user: { id: string; username: string; email: string };
}

@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  // GET /user/me
  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getMe(@Req() req: AuthRequest) {
    return this.userService.getMe(req.user.id);
  }

  // PATCH /user/me
  @Patch('me')
  @UseGuards(JwtAuthGuard)
  async updateMe(@Req() req: AuthRequest, @Body() dto: UpdateProfileDto) {
    return this.userService.updateMe(req.user.id, dto);
  }

  // PATCH /user/settings
  @Patch('settings')
  @UseGuards(JwtAuthGuard)
  async updateSettings(@Req() req: AuthRequest, @Body() dto: UpdateSettingsDto) {
    return this.userService.updateSettings(req.user.id, dto);
  }

  // GET /user/friend-requests (my pending incoming requests)
  @Get('friend-requests')
  @UseGuards(JwtAuthGuard)
  async getPendingRequests(@Req() req: AuthRequest) {
    return this.userService.getPendingRequests(req.user.id);
  }

  // GET /user/search?q=... — search users by username
  @Get('search')
  @UseGuards(JwtAuthGuard)
  async searchUsers(@Req() req: AuthRequest, @Query('q') q: string) {
    return this.userService.searchUsers(q || '', req.user.id);
  }

  // GET /user/:id — public profile
  @Get(':id')
  async getPublicProfile(@Param('id') id: string) {
    return this.userService.getPublicProfile(id);
  }

  // GET /user/:id/friendship — check friendship status (requires auth)
  @Get(':id/friendship')
  @UseGuards(JwtAuthGuard)
  async getFriendship(@Req() req: AuthRequest, @Param('id') targetId: string) {
    return this.userService.getFriendshipStatus(req.user.id, targetId);
  }

  // POST /user/:id/friend-request — send friend request
  @Post(':id/friend-request')
  @UseGuards(JwtAuthGuard)
  async sendFriendRequest(@Req() req: AuthRequest, @Param('id') targetId: string) {
    return this.userService.sendFriendRequest(req.user.id, targetId);
  }

  // POST /user/:id/accept-friend — accept incoming request
  @Post(':id/accept-friend')
  @UseGuards(JwtAuthGuard)
  async acceptFriendRequest(@Req() req: AuthRequest, @Param('id') requesterId: string) {
    return this.userService.acceptFriendRequest(req.user.id, requesterId);
  }

  // DELETE /user/:id/friend — remove friend / decline request
  @Delete(':id/friend')
  @UseGuards(JwtAuthGuard)
  async removeFriend(@Req() req: AuthRequest, @Param('id') targetId: string) {
    return this.userService.removeFriend(req.user.id, targetId);
  }
}
