import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { Transform } from 'class-transformer'
import {
    ArrayMaxSize,
    ArrayUnique,
    IsArray,
    IsBoolean,
    IsDateString,
    IsDefined,
    IsIn,
    IsString,
    Length,
    Matches,
    MaxLength,
    MinLength,
    ValidateIf,
} from 'class-validator'
import { INTEGRATION_SCOPES } from './integration-scopes'

export class CredentialStepUpDto {
    @ApiProperty({ format: 'password', writeOnly: true })
    @IsString()
    @MinLength(1)
    @MaxLength(1024)
    current_password!: string

    @ApiPropertyOptional({
        writeOnly: true,
        description: 'Current TOTP or unused recovery code when 2FA is enabled.',
    })
    @ValidateIf((_, value: unknown) => value !== undefined)
    @IsString()
    @Length(1, 128)
    two_factor_token?: string
}

export class CreateIntegrationCredentialDto extends CredentialStepUpDto {
    @ApiProperty()
    @Transform(({ value }: { value: unknown }) =>
        typeof value === 'string' ? value.trim() : value,
    )
    @IsString()
    @Length(1, 100)
    @Matches(/\S/)
    name!: string

    @ApiProperty({ format: 'date-time' })
    @IsDateString({ strict: true, strictSeparator: true })
    @Matches(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/)
    expires_at!: string

    @ApiProperty({
        type: [String],
        enum: [...INTEGRATION_SCOPES],
        description: 'Exact independent scopes. An empty array grants no operation.',
    })
    @IsArray()
    @ArrayMaxSize(INTEGRATION_SCOPES.length)
    @ArrayUnique()
    @IsString({ each: true })
    @IsIn(INTEGRATION_SCOPES, { each: true })
    scopes!: string[]

    @ApiPropertyOptional({ type: [String] })
    @ValidateIf((_, value: unknown) => value !== undefined)
    @IsArray()
    @ArrayMaxSize(200)
    @ArrayUnique()
    @IsString({ each: true })
    @Length(1, 128, { each: true })
    @Matches(/^\S+$/, { each: true })
    category_ids?: string[]

    @ApiProperty({
        description:
            'Required explicit policy: false means unrestricted within this workspace; true uses category_ids, including an empty list.',
    })
    @IsDefined()
    @IsBoolean()
    category_allowlist_enabled?: boolean

    @ApiPropertyOptional({ type: [String] })
    @ValidateIf((_, value: unknown) => value !== undefined)
    @IsArray()
    @ArrayMaxSize(200)
    @ArrayUnique()
    @IsString({ each: true })
    @Length(1, 128, { each: true })
    @Matches(/^\S+$/, { each: true })
    payment_source_ids?: string[]

    @ApiProperty({
        description:
            'Required explicit policy: false means unrestricted within this workspace; true uses payment_source_ids, including an empty list.',
    })
    @IsDefined()
    @IsBoolean()
    payment_source_allowlist_enabled?: boolean

    @ApiPropertyOptional({ type: [String] })
    @ValidateIf((_, value: unknown) => value !== undefined)
    @IsArray()
    @ArrayMaxSize(64)
    @ArrayUnique()
    @IsString({ each: true })
    @Length(3, 64, { each: true })
    allowed_cidrs?: string[]

    @ApiPropertyOptional()
    @ValidateIf((_, value: unknown) => value !== undefined)
    @IsBoolean()
    cidr_allowlist_enabled?: boolean
}

export class RotateIntegrationCredentialDto extends CredentialStepUpDto {
    @ApiProperty({ format: 'date-time' })
    @IsDateString({ strict: true, strictSeparator: true })
    @Matches(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/)
    expires_at!: string

    @ApiPropertyOptional({
        type: [String],
        enum: [...INTEGRATION_SCOPES],
        description: 'Omit to preserve scopes; [] grants no operation.',
    })
    @ValidateIf((_, value: unknown) => value !== undefined)
    @IsArray()
    @ArrayMaxSize(INTEGRATION_SCOPES.length)
    @ArrayUnique()
    @IsIn(INTEGRATION_SCOPES, { each: true })
    scopes?: string[]

    @ApiPropertyOptional({
        description: 'Omit together with category_ids to preserve the category policy.',
    })
    @ValidateIf((_, value: unknown) => value !== undefined)
    @IsBoolean()
    category_allowlist_enabled?: boolean

    @ApiPropertyOptional({ type: [String] })
    @ValidateIf((_, value: unknown) => value !== undefined)
    @IsArray()
    @ArrayMaxSize(200)
    @ArrayUnique()
    @IsString({ each: true })
    @Length(1, 128, { each: true })
    @Matches(/^\S+$/, { each: true })
    category_ids?: string[]

    @ApiPropertyOptional({
        description: 'Omit together with payment_source_ids to preserve the payment source policy.',
    })
    @ValidateIf((_, value: unknown) => value !== undefined)
    @IsBoolean()
    payment_source_allowlist_enabled?: boolean

    @ApiPropertyOptional({ type: [String] })
    @ValidateIf((_, value: unknown) => value !== undefined)
    @IsArray()
    @ArrayMaxSize(200)
    @ArrayUnique()
    @IsString({ each: true })
    @Length(1, 128, { each: true })
    @Matches(/^\S+$/, { each: true })
    payment_source_ids?: string[]

    @ApiPropertyOptional({
        description: 'Omit together with allowed_cidrs to preserve the network policy.',
    })
    @ValidateIf((_, value: unknown) => value !== undefined)
    @IsBoolean()
    cidr_allowlist_enabled?: boolean

    @ApiPropertyOptional({ type: [String] })
    @ValidateIf((_, value: unknown) => value !== undefined)
    @IsArray()
    @ArrayMaxSize(64)
    @ArrayUnique()
    @IsString({ each: true })
    @Length(3, 64, { each: true })
    allowed_cidrs?: string[]
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

    @ApiProperty({
        readOnly: true,
        description: 'One-time bearer secret. Never returned by list or get.',
    })
    token!: string

    @ApiProperty()
    token_prefix!: string

    @ApiProperty({ format: 'date-time' })
    expires_at!: Date
}

export class RotatedIntegrationCredentialResponseDto {
    @ApiProperty()
    credential_id!: string

    @ApiProperty({ description: 'One-time replacement bearer secret. Never returned again.' })
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
