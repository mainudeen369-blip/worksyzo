import {
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Param,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { RequirePermission, Tenant, type TenantScope } from '../../common/decorators';
import { OrgGuard } from '../../common/guards/org.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { SessionGuard } from '../../common/guards/session.guard';
import { DocumentsService } from './documents.service';

@Controller('orgs/:orgId/documents')
@UseGuards(SessionGuard, OrgGuard, PermissionGuard)
export class DocumentsController {
  constructor(@Inject(DocumentsService) private readonly documents: DocumentsService) {}

  @Get()
  @RequirePermission('document:read')
  list(@Tenant() tenant: TenantScope) {
    return this.documents.list(tenant.orgId, tenant.userId);
  }

  @Get(':documentId')
  @RequirePermission('document:read')
  get(@Tenant() tenant: TenantScope, @Param('documentId') documentId: string) {
    return this.documents.get(tenant.orgId, tenant.userId, documentId);
  }

  @Get(':documentId/inspect')
  @RequirePermission('document:read')
  inspect(@Tenant() tenant: TenantScope, @Param('documentId') documentId: string) {
    return this.documents.inspect(tenant.orgId, tenant.userId, documentId);
  }

  @Post()
  @RequirePermission('document:create')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 12 * 1024 * 1024 },
    }),
  )
  upload(
    @Tenant() tenant: TenantScope,
    @UploadedFile()
    file?: { originalname: string; mimetype: string; size: number; buffer: Buffer },
  ) {
    if (!file) throw new BadRequestException('file field is required');
    return this.documents.upload(tenant.orgId, tenant.userId, file);
  }

  @Post(':documentId/retry')
  @RequirePermission('document:create')
  retry(@Tenant() tenant: TenantScope, @Param('documentId') documentId: string) {
    return this.documents.retry(tenant.orgId, tenant.userId, documentId);
  }

  @Delete(':documentId')
  @RequirePermission('document:delete')
  @HttpCode(204)
  async remove(@Tenant() tenant: TenantScope, @Param('documentId') documentId: string) {
    await this.documents.remove(tenant.orgId, tenant.userId, documentId);
  }
}
