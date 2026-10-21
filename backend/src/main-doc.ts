import { NestFactory } from '@nestjs/core'
import { AppModule } from './app.module'
import { SwaggerModule } from '@nestjs/swagger'
import { writeFileSync, mkdirSync, existsSync } from 'fs'
import { createOpenApiConfiguration } from './shared/openapi/configuration'

async function generateDocument() {
    const app = await NestFactory.create(AppModule)
    const document = SwaggerModule.createDocument(app, createOpenApiConfiguration(), {
        ignoreGlobalPrefix: true,
    })
    const specDir = './spec'
    if (!existsSync(specDir)) {
        mkdirSync(specDir, { recursive: true })
    }
    writeFileSync(`${specDir}/openapi.json`, JSON.stringify(document, null, 2))
    await app.close()
    console.log('OpenAPI spec generated successfully')
}

generateDocument().catch((err) => {
    console.error('Error generating OpenAPI spec:', err)
    process.exit(1)
})
