import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
} from 'class-validator';

export enum ContactType {
  PHONE = 'phone',
  TELEGRAM = 'telegram',
  WHATSAPP = 'whatsapp',
  INSTAGRAM = 'instagram',
  YOUTUBE = 'youtube',
  VK = 'vk',
  WEBSITE = 'website',
  OTHER = 'other',
}

function IsContactValue(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isContactValue',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown, args: ValidationArguments) {
          if (typeof value !== 'string' || value.length === 0) {
            return false;
          }

          const { type } = args.object as ContactItemDto;

          if (type === ContactType.PHONE) {
            return value.length <= 50;
          }

          try {
            new URL(value);
            return true;
          } catch {
            return false;
          }
        },
        defaultMessage(args: ValidationArguments) {
          const { type } = args.object as ContactItemDto;

          return type === ContactType.PHONE
            ? 'Номер телефона указан неверно'
            : 'Укажите корректный URL';
        },
      },
    });
  };
}

export class ContactItemDto {
  @ApiProperty({
    enum: ContactType,
    example: ContactType.PHONE,
    description: 'Тип контакта: phone, telegram, instagram и т.д.',
  })
  @IsEnum(ContactType)
  type: ContactType;

  @ApiProperty({
    example: '+79991234567',
    description: 'Номер телефона или URL соцсети',
  })
  @IsContactValue()
  value: string;

  @ApiPropertyOptional({
    example: 'WhatsApp',
    description: 'Подпись: «Рабочий», «Личный Telegram»',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  label?: string;
}

export type ContactItem = {
  type: ContactType;
  value: string;
  label?: string;
};
