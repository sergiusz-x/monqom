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
