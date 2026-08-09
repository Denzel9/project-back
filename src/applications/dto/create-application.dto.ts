import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class CreateApplicationDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  postId: string;

  @ApiProperty({
    example: 'Готов обсудить сотрудничество. Опыт 3 года.',
    minLength: 1,
    maxLength: 2000,
  })
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  message: string;

  @ApiProperty({
    required: false,
    default: true,
    description:
      'Прикрепить статистику кандидата к отклику (видна владельцу поста)',
  })
  @IsOptional()
  @IsBoolean()
  attachStatistics?: boolean;
}
