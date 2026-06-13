import { ValidationError } from 'class-validator';

const PROPERTY_LABELS: Record<string, string> = {
  email: 'email',
  password: 'пароль',
  token: 'токен',
  userId: 'userId',
  recipientId: 'recipientId',
  contacts: 'контакты',
  person: 'person',
  phone: 'телефон',
  name: 'имя',
  lastName: 'фамилия',
  companyName: 'название компании',
  content: 'сообщение',
  conversationId: 'conversationId',
  cursor: 'cursor',
  limit: 'limit',
};

function getPropertyLabel(property: string): string {
  return PROPERTY_LABELS[property] ?? property;
}

function mapConstraint(
  constraintKey: string,
  property: string,
  constraintValue?: string
): string {
  const label = getPropertyLabel(property);

  switch (constraintKey) {
    case 'isEmail':
      return 'Некорректный email';
    case 'isString':
      return `Поле «${label}» должно быть строкой`;
    case 'isNotEmpty':
      return `Поле «${label}» не должно быть пустым`;
    case 'isUuid':
      return `Поле «${label}» должно быть UUID`;
    case 'isUrl':
      return `Поле «${label}» должно быть корректным URL`;
    case 'isEnum':
      return `Поле «${label}» содержит недопустимое значение`;
    case 'isArray':
      return `Поле «${label}» должно быть массивом`;
    case 'isInt':
      return `Поле «${label}» должно быть целым числом`;
    case 'min':
      return `Поле «${label}» не может быть меньше ${constraintValue}`;
    case 'max':
      return `Поле «${label}» не может быть больше ${constraintValue}`;
    case 'minLength':
      return `Поле «${label}» слишком короткое`;
    case 'maxLength':
      return `Поле «${label}» слишком длинное`;
    case 'whitelistValidation':
      return `Поле «${label}» не разрешено`;
    case 'isContactValue':
      return constraintValue ?? `Поле «${label}» заполнено неверно`;
    default:
      return `Поле «${label}» заполнено неверно`;
  }
}

function flattenValidationErrors(errors: ValidationError[]): string[] {
  const messages: string[] = [];

  for (const error of errors) {
    if (error.constraints) {
      for (const [key, value] of Object.entries(error.constraints)) {
        messages.push(mapConstraint(key, error.property, value));
      }
    }

    if (error.children?.length) {
      messages.push(...flattenValidationErrors(error.children));
    }
  }

  return messages;
}

export function formatValidationErrors(errors: ValidationError[]): string[] {
  const messages = flattenValidationErrors(errors);
  return messages.length > 0 ? messages : ['Некорректные данные запроса'];
}
