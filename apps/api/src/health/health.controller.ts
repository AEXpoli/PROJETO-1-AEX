import { Controller, Get } from '@nestjs/common';
import type { HealthResponse } from '@aex/types';
import { Public } from '../auth/auth.decorators';

@Controller('health')
export class HealthController {
  @Get('live')
  @Public()
  live(): HealthResponse {
    return { status: 'ok' };
  }
}
