import { BadRequestException, Injectable } from '@nestjs/common';
import type { PipeTransform } from '@nestjs/common';
import { contentIdSchema } from '@aex/validation';

@Injectable()
export class ContentIdPipe implements PipeTransform<unknown, string> {
  transform(value: unknown): string {
    const parsed = contentIdSchema.safeParse(value);
    if (!parsed.success) throw new BadRequestException('id deve ser UUID válido.');
    return parsed.data;
  }
}
