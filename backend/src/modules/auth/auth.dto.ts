import { IsEmail, IsIn, IsNotEmpty, IsOptional, IsString, Length, MinLength } from 'class-validator'

export class RegisterDto {
    @IsEmail()
    email!: string

    @IsString()
    @IsNotEmpty()
    name!: string

    @IsString()
    @MinLength(8)
    password!: string

    @IsOptional()
    @IsIn(['en', 'pl'])
    locale?: string

    @IsOptional()
    @IsString()
    @Length(3, 3)
    base_currency?: string

    @IsOptional()
    @IsString()
    turnstile_token?: string
}

export class LoginDto {
    @IsEmail()
    email!: string

    @IsString()
    @IsNotEmpty()
    password!: string
}

export class TokenDto {
    @IsString()
    @IsNotEmpty()
    token!: string
}

export class EmailDto {
    @IsEmail()
    email!: string
}

export class ResetPasswordDto extends TokenDto {
    @IsString()
    @MinLength(8)
    newPassword!: string
}

export class CurrentPasswordDto {
    @IsString()
    @IsNotEmpty()
    currentPassword!: string
}

export class ChangePasswordDto {
    @IsString()
    @IsNotEmpty()
    currentPassword!: string

    @IsString()
    @MinLength(8)
    newPassword!: string
}

export class UpdateUserProfileDto {
    @IsOptional()
    @IsString()
    @IsNotEmpty()
    name?: string

    @IsOptional()
    @IsIn(['en', 'pl'])
    locale?: string
}
