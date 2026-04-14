import {
  Controller,
  Get,
  Patch,
  Body,
  Param,
  UseGuards,
  Req,
} from '@nestjs/common';
import { UserService } from './user.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { Request } from 'express';

interface AuthRequest extends Request {
  user: { id: string; username: string; email: string };
}

@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  // GET /user/me  — requires Bearer token
  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getMe(@Req() req: AuthRequest) {
    return this.userService.getMe(req.user.id);
  }

  // PATCH /user/me  — requires Bearer token
  @Patch('me')
  @UseGuards(JwtAuthGuard)
  async updateMe(@Req() req: AuthRequest, @Body() dto: UpdateProfileDto) {
    return this.userService.updateMe(req.user.id, dto);
  }

  // GET /user/:id  — public profile
  @Get(':id')
  async getPublicProfile(@Param('id') id: string) {
    return this.userService.getPublicProfile(id);
  }
}
