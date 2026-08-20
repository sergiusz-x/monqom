import { Global, Module } from '@nestjs/common'
import { EmailOutboxService } from './email-outbox.service'
import { EmailDeliveryService } from './resend'

@Global()
@Module({ providers: [EmailDeliveryService, EmailOutboxService], exports: [EmailOutboxService] })
export class EmailModule {}
