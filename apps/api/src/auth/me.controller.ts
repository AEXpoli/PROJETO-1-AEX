import { Controller, Get, Header, Req, UnauthorizedException } from '@nestjs/common';
import type { AuthenticatedRequest } from './auth.types';
import { MeService } from './me.service';

@Controller('me')
export class MeController {
  constructor(private readonly me: MeService) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  getMe(@Req() request: AuthenticatedRequest) {
    if (!request.identity) throw new UnauthorizedException();
    return this.me.getMe(request.identity);
  }
}
