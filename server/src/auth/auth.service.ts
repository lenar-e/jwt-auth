import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { User, UserDocument } from './schemas/user.schema';
import * as uuid from 'uuid';
import { UserDto } from './dto/user.dto';
import { TokenService } from './token/token.service';
import { MailService } from './mail/mail.service';
import { RegistrationDto } from './dto/registration.dto';

const saltOrRounds = 10;
@Injectable()
export class AuthService {
  constructor(
    @InjectModel(User.name) private userModel: Model<User>,
    private readonly tokenService: TokenService,
    private readonly mailService: MailService,
  ) {}

  async generateTokensResponse(user: UserDocument) {
    const userDto = new UserDto(user);
    const tokens = this.tokenService.generateToken({ ...userDto });
    await this.tokenService.saveToken(userDto.id, tokens.refreshToken);
    return { ...tokens, user: userDto };
  }

  async registration(createdUser: RegistrationDto) {
    const { email, password, age, fullName } = createdUser;
    const candidate = await this.userModel.findOne({ email });
    if (candidate) {
      throw new BadRequestException(
        `Пользователь c email ${email} уже существует`,
      );
    }
    const hashPassword = await bcrypt.hash(password, saltOrRounds);
    const activationLink = uuid.v4();
    const user = await this.userModel.create({
      email,
      fullName,
      age,
      password: hashPassword,
      activationLink,
    });
    await this.mailService.sendActivationMail(email, activationLink);

    return this.generateTokensResponse(user);
  }
  async login(email: string, password: string) {
    const user = await this.userModel.findOne({ email });
    if (!user) {
      throw new BadRequestException(`Пользователь с такими данными не найден`);
    }
    const isPassEqual = await bcrypt.compare(password, user.password);

    if (!isPassEqual) {
      throw new BadRequestException(`Некорректный логин или пароль`);
    }
    return this.generateTokensResponse(user);
  }
  async logout(refreshToken: string) {
    return this.tokenService.removeToken(refreshToken);
  }

  async activate(activationLink: string) {
    const user = await this.userModel.findOne({ activationLink });
    if (!user) {
      throw new BadRequestException(`Некорректная ссылка активации`);
    }

    user.isActivated = true;
    await user.save();
    return { isSuccess: true };
  }
  async refresh(refreshToken?: string) {
    if (!refreshToken) {
      throw new UnauthorizedException();
    }
    const userData = this.tokenService.validateRefreshToken(refreshToken);
    const tokenFromDB = await this.tokenService.findToken(refreshToken);

    if (!userData || !tokenFromDB) {
      throw new UnauthorizedException();
    }

    const user = await this.userModel.findOne({ email: userData.email });
    if (!user) {
      throw new UnauthorizedException();
    }
    return this.generateTokensResponse(user);
  }

  async resetPasswordRequest(email: string) {
    const user = await this.userModel.findOne({ email });
    if (!user) {
      throw new BadRequestException(`Пользователь с email ${email} не найден`);
    }
    const resetLink = uuid.v4(); // Генерация ссылки для сброса пароля
    user.resetPasswordLink = resetLink;
    await user.save();
    await this.mailService.sendResetPasswordMail(email, resetLink);
  }

  async validatePasswordLink(resetPasswordLink: string) {
    const user = await this.userModel.findOne({ resetPasswordLink });
    if (!user) {
      throw new BadRequestException(`Некорректная ссылка`);
    }
    return {
      isSuccess: true,
    };
  }

  async resetPassword(resetPasswordLink: string, password: string) {
    const user = await this.userModel.findOne({ resetPasswordLink });
    if (!user) {
      throw new BadRequestException(`Некорректная ссылка`);
    }
    user.password = await bcrypt.hash(password, saltOrRounds);
    user.resetPasswordLink = undefined;
    await user.save();

    return { isSuccess: true };
  }

  async getProfileInfo(accessToken: string) {
    const token = this.tokenService.validateAccessToken(accessToken);
    const { email, age, fullName, isActivated, id } =
      await this.userModel.findOne({
        email: token.email,
      });

    return { email, age, fullName, isActivated, id };
  }
}
