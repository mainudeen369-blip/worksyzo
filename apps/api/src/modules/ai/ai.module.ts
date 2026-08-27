import { Module } from '@nestjs/common';
import { OrgGuard } from '../../common/guards/org.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { SessionGuard } from '../../common/guards/session.guard';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { OrgsModule } from '../orgs/orgs.module';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';

@Module({
  imports: [AuditModule, AuthModule, OrgsModule],
  controllers: [AiController],
  providers: [AiService, SessionGuard, OrgGuard, PermissionGuard],
})
export class AiModule {}
