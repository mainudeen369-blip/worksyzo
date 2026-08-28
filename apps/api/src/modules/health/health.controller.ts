import { Controller, Get } from '@nestjs/common';
import { getObjectStorage, storageSetupHint } from '@worksyzo/storage';
import { detectProvider, isAiConfigured } from '@worksyzo/ingest';

@Controller('health')
export class HealthController {
  @Get()
  check() {
    let storage = { driver: 'unknown', detail: 'unavailable' };
    try {
      const s = getObjectStorage();
      storage = { driver: s.driver, detail: s.describe() };
    } catch (error) {
      storage = { driver: 'error', detail: (error as Error).message };
    }

    const aiProvider = detectProvider();

    return {
      ok: true,
      service: 'worksyzo-api',
      time: new Date().toISOString(),
      step: 'B',
      storage,
      storageHint: storageSetupHint(),
      aiConfigured: isAiConfigured(),
      aiProvider: {
        provider: aiProvider.provider,
        chatModel: aiProvider.chatModel,
        embedModel: aiProvider.embedModel,
      },
    };
  }
}
