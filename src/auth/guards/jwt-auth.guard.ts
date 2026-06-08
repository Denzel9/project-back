import {
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  handleRequest<TUser>(
    err: Error | null,
    user: TUser,
    _info: unknown,
    _context: ExecutionContext
  ): TUser {
    if (err || !user) {
      throw err ?? new UnauthorizedException('Требуется авторизация');
    }

    return user;
  }
}
