import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  Param,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { submitExerciseAttemptSchema } from '@aex/validation';
import type { AuthenticatedRequest, Identity } from '../auth/auth.types';
import { ContentAccessGuard } from '../content/content-access.guard';
import { ContentIdPipe } from '../content/content-id.pipe';
import { AttemptsService } from './attempts.service';

function identity(request: AuthenticatedRequest): Identity {
  if (!request.identity) throw new UnauthorizedException();
  return request.identity;
}

@Controller()
@UseGuards(ContentAccessGuard)
export class AttemptsController {
  constructor(private readonly attempts: AttemptsService) {}

  @Post('exercises/:id/attempts')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  submit(
    @Req() request: AuthenticatedRequest,
    @Param('id', ContentIdPipe) id: string,
    @Body() body: unknown,
  ) {
    const parsed = submitExerciseAttemptSchema.safeParse(body);
    if (!parsed.success)
      throw new BadRequestException(
        'Informe id, selectedOptionId e, opcionalmente, assignmentId como UUIDs.',
      );
    return this.attempts.submit(identity(request), id, parsed.data);
  }

  @Get('me/attempts')
  @Header('Cache-Control', 'no-store')
  history(@Req() request: AuthenticatedRequest) {
    return this.attempts.attempts(identity(request));
  }

  @Get('me/progress')
  @Header('Cache-Control', 'no-store')
  progress(@Req() request: AuthenticatedRequest) {
    return this.attempts.progress(identity(request));
  }

  @Get('me/achievements')
  @Header('Cache-Control', 'no-store')
  achievements(@Req() request: AuthenticatedRequest) {
    return this.attempts.achievements(identity(request));
  }
}
