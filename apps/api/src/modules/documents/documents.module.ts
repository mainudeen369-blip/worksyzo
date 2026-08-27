import { Module } from '@nestjs/common';
import { OrgGuard } from '../../common/guards/org.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { SessionGuard } from '../../common/guards/session.guard';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { OrgsModule } from '../orgs/orgs.module';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';

@Module({
  imports: [AuditModule, AuthModule, OrgsModule],
  controllers: [DocumentsController],
  providers: [DocumentsService, SessionGuard, OrgGuard, PermissionGuard],
  exports: [DocumentsService],
})
export class DocumentsModule {}
