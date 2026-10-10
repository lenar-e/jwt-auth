import { IsEmail, IsInt, IsString, Max, Min, MinLength } from 'class-validator';

export class RegistrationDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(6)
  password: string;

  @IsString()
  fullName: string;

  @IsInt()
  @Min(0)
  @Max(150)
  age: number;
}
