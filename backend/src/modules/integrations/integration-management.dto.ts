import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import {
    IsArray,
    IsBoolean,
    IsDateString,
    IsOptional,
    IsString,
    Length,
    MinLength,
} from 'class-validator'

export class CredentialStepUpDto {
    @ApiProperty({ format: 'password' })
    @IsString()
    @MinLength(1)
    current_password!: string

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    two_factor_token?: string
}

export class CreateIntegrationCredentialDto extends CredentialStepUpDto {
    @ApiProperty()
    @IsString()
    @Length(1, 100)
    name!: string

    @ApiProperty({ format: 'date-time' })
    @IsDateString()
    expires_at!: string

    @ApiProperty({ type: [String] })
    @IsArray()
    @IsString({ each: true })
    scopes!: string[]

    @ApiPropertyOptional({ type: [String] })
    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    category_ids?: string[]

    @ApiPropertyOptional()
    @IsOptional()
    @IsBoolean()
    category_allowlist_enabled?: boolean

    @ApiPropertyOptional({ type: [String] })
    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    payment_source_ids?: string[]

    @ApiPropertyOptional()
    @IsOptional()
    @IsBoolean()
    payment_source_allowlist_enabled?: boolean

    @ApiPropertyOptional({ type: [String] })
    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    allowed_cidrs?: string[]

    @ApiPropertyOptional()
    @IsOptional()
    @IsBoolean()
    cidr_allowlist_enabled?: boolean
}

export class RotateIntegrationCredentialDto extends CredentialStepUpDto {
    @ApiProperty({ format: 'date-time' })
    @IsDateString()
    expires_at!: string
}

export class IntegrationCreatorResponseDto {
    @ApiProperty()
    id!: string

    @ApiProperty()
    name!: string
}

export class IntegrationCredentialResponseDto {
    @ApiProperty()
    id!: string

    @ApiProperty()
    token_prefix!: string

    @ApiProperty()
    status!: string

    @ApiProperty({ format: 'date-time' })
    created_at!: Date

    @ApiProperty({ format: 'date-time' })
    expires_at!: Date

    @ApiPropertyOptional({ format: 'date-time', nullable: true })
    revoked_at!: Date | null

    @ApiPropertyOptional({ format: 'date-time', nullable: true })
    last_used_at!: Date | null

    @ApiProperty({ type: [String] })
    scopes!: string[]

    @ApiProperty()
    category_allowlist_enabled!: boolean

    @ApiProperty({ type: [String] })
    category_ids!: string[]

    @ApiProperty()
    payment_source_allowlist_enabled!: boolean

    @ApiProperty({ type: [String] })
    payment_source_ids!: string[]

    @ApiProperty()
    cidr_allowlist_enabled!: boolean

    @ApiProperty({ type: [String] })
    allowed_cidrs!: string[]
}

export class IntegrationResponseDto {
    @ApiProperty()
    id!: string

    @ApiProperty()
    name!: string

    @ApiProperty()
    status!: string

    @ApiProperty({ format: 'date-time' })
    created_at!: Date

    @ApiProperty({ type: IntegrationCreatorResponseDto })
    created_by!: IntegrationCreatorResponseDto

    @ApiProperty({ type: [IntegrationCredentialResponseDto] })
    credentials!: IntegrationCredentialResponseDto[]
}

export class IssuedIntegrationCredentialResponseDto {
    @ApiProperty()
    integration_id!: string

    @ApiProperty()
    credential_id!: string

    @ApiProperty()
    token!: string

    @ApiProperty()
    token_prefix!: string

    @ApiProperty({ format: 'date-time' })
    expires_at!: Date
}

export class RotatedIntegrationCredentialResponseDto {
    @ApiProperty()
    credential_id!: string

    @ApiProperty()
    token!: string

    @ApiProperty()
    token_prefix!: string

    @ApiProperty({ format: 'date-time' })
    expires_at!: Date
}

export class RevokedIntegrationCredentialResponseDto {
    @ApiProperty()
    revoked!: boolean
}

export class DeletedIntegrationCredentialResponseDto {
    @ApiProperty()
    deleted!: boolean
}
