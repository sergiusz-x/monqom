import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { writeFileSync, mkdirSync, existsSync } from 'fs';

async function generateDocument() {
  const app = await NestFactory.create(AppModule);
  const config = new DocumentBuilder()
    .setTitle('Monqom API')
    .setDescription('The Monqom API description')
    .setVersion('1.0')
    .addTag('monqom')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  const specDir = './spec';
  if (!existsSync(specDir)) {
    mkdirSync(specDir, { recursive: true });
  }
  writeFileSync(`${specDir}/openapi.json`, JSON.stringify(document, null, 2));
  await app.close();
  console.log('OpenAPI spec generated successfully');
}

generateDocument().catch((err) => {
  console.error('Error generating OpenAPI spec:', err);
  process.exit(1);
});
