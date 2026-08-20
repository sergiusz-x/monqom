import {
    IsBoolean,
    IsEmail,
    IsIn,
    IsNotEmpty,
    IsOptional,
    IsString,
    Length,
    MinLength,
} from 'class-validator'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

export class RegisterDto {
    @ApiProperty({ format: 'email' })
    @IsEmail()
    email!: string

    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    name!: string

    @ApiProperty({ minLength: 8, format: 'password' })
    @IsString()
    @MinLength(8)
    password!: string

    @ApiPropertyOptional({ enum: ['en', 'pl'] })
    @IsOptional()
    @IsIn(['en', 'pl'])
    locale?: string

    @ApiPropertyOptional({ minLength: 3, maxLength: 3 })
    @IsOptional()
    @IsString()
    @Length(3, 3)
    base_currency?: string

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    turnstile_token?: string
}

export class LoginDto {
    @ApiProperty({ format: 'email' })
    @IsEmail()
    email!: string

    @ApiProperty({ format: 'password' })
    @IsString()
    @IsNotEmpty()
    password!: string
}

export class TokenDto {
    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    token!: string
}

export class EmailDto {
    @ApiProperty({ format: 'email' })
    @IsEmail()
    email!: string
}

export class ResetPasswordDto extends TokenDto {
    @ApiProperty({ minLength: 8, format: 'password' })
    @IsString()
    @MinLength(8)
    newPassword!: string
}

export class CurrentPasswordDto {
    @ApiProperty({ format: 'password' })
    @IsString()
    @IsNotEmpty()
    currentPassword!: string
}

export class ChangePasswordDto {
    @ApiProperty({ format: 'password' })
    @IsString()
    @IsNotEmpty()
    currentPassword!: string

    @ApiProperty({ minLength: 8, format: 'password' })
    @IsString()
    @MinLength(8)
    newPassword!: string
}

export class UpdateUserProfileDto {
    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    @IsNotEmpty()
    name?: string

    @ApiPropertyOptional({ enum: ['en', 'pl'] })
    @IsOptional()
    @IsIn(['en', 'pl'])
    locale?: string

    @ApiPropertyOptional()
    @IsOptional()
    @IsBoolean()
    hide_salary_amounts?: boolean
}
