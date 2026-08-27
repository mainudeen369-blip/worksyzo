import { Module, forwardRef } from '@nestjs/common';
import { OrgGuard } from '../../common/guards/org.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { SessionGuard } from '../../common/guards/session.guard';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { MembershipService } from './membership.service';
import { OrgsController } from './orgs.controller';
import { OrgsService } from './orgs.service';

@Module({
  imports: [AuditModule, forwardRef(() => AuthModule)],
  controllers: [OrgsController],
  providers: [
    OrgsService,
    MembershipService,
    SessionGuard,
    OrgGuard,
    PermissionGuard,
  ],
  exports: [OrgsService, MembershipService],
})
export class OrgsModule {}
