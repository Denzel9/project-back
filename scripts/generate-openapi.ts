import { NestFactory } from '@nestjs/core';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { stringify } from 'yaml';
import { AppModule } from '../src/app.module';
import { buildSwaggerDocument } from '../src/swagger/swagger-document';

async function generateOpenApi() {
  const app = await NestFactory.create(AppModule, { logger: false });
  await app.init();

  const document = buildSwaggerDocument(app);
  const outputPath = join(process.cwd(), 'docs', 'openapi.yaml');

  mkdirSync(join(process.cwd(), 'docs'), { recursive: true });
  writeFileSync(outputPath, stringify(document));

  await app.close();

  console.log(`OpenAPI spec written to ${outputPath}`);
}

generateOpenApi().catch(error => {
  console.error('Failed to generate OpenAPI spec:', error);
  process.exit(1);
});
