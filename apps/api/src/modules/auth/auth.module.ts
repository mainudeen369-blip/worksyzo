import { Module } from '@nestjs/common';
import { SessionGuard } from '../../common/guards/session.guard';
import { AuditModule } from '../audit/audit.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { SessionService } from './session.service';
import { FaceAuthService } from './face-auth.service';

@Module({
  imports: [AuditModule],
  controllers: [AuthController],
  providers: [AuthService, SessionService, FaceAuthService, SessionGuard],
  exports: [AuthService, SessionService, FaceAuthService],
})
export class AuthModule {}
