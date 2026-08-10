import { Module, forwardRef } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PushController } from './push.controller';
import { PushService } from './push.service';

@Module({
  imports: [forwardRef(() => AuthModule)],
  controllers: [PushController],
  providers: [PushService],
  exports: [PushService],
})
export class PushModule {}
