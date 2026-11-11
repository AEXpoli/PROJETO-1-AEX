import { Controller, Get, Header, Param, UseGuards } from '@nestjs/common';
import { ContentAccessGuard } from './content-access.guard';
import { ContentIdPipe } from './content-id.pipe';
import { ContentService } from './content.service';

@Controller()
@UseGuards(ContentAccessGuard)
export class ContentController {
  constructor(private readonly content: ContentService) {}

  @Get('modules')
  @Header('Cache-Control', 'no-store')
  listModules() {
    return this.content.listModules();
  }

  @Get('modules/:id')
  @Header('Cache-Control', 'no-store')
  getModule(@Param('id', ContentIdPipe) id: string) {
    return this.content.getModule(id);
  }

  @Get('modules/:id/exercises')
  @Header('Cache-Control', 'no-store')
  listExercises(@Param('id', ContentIdPipe) id: string) {
    return this.content.listExercises(id);
  }

  @Get('exercises/:id')
  @Header('Cache-Control', 'no-store')
  getExercise(@Param('id', ContentIdPipe) id: string) {
    return this.content.getExercise(id);
  }
}
