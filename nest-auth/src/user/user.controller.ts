import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { UserService } from './user.service';
import * as bcryptjs from 'bcryptjs';
import { JwtService } from '@nestjs/jwt';
import { Response, Request } from 'express';
import { TokenService } from './token.service';
import { MoreThanOrEqual } from 'typeorm';
import * as speakeasy from 'speakeasy';

@Controller()
export class UserController {
  constructor(
    private userService: UserService,
    private jwtService: JwtService,
    private tokenService: TokenService,
  ) {}

  @Post('register')
  async register(@Body() body: any) {
    if (body.password !== body.password_confirm) {
      throw new BadRequestException('Passwords do not match');
    }

    return this.userService.save({
      first_name: body.first_name,
      last_name: body.last_name,
      email: body.email,
      password: await bcryptjs.hash(body.password, 12),
    });
  }

  @Post('login')
  async login(
    @Body('email') email: string,
    @Body('password') password: string,
    @Res({ passthrough: true }) response: Response,
  ) {
    const user = await this.userService.findOne({ where: { email } });

    if (!user) {
      throw new BadRequestException('invalid credentials');
    }

    if (!(await bcryptjs.compare(password, user.password))) {
      throw new BadRequestException('invalid credentials');
    }

    response.status(200);

    if (user.tfa_secret) {
      return {
        id: user.id,
      };
    }

    const secret = speakeasy.generateSecret({
      name: 'My App',
    });

    return {
      id: user.id,
      secret: secret.ascii,
      otpauth_url: secret.otpauth_url,
    };
  }

  @Post('two-factor')
  async twoFactor(
    @Body('id') id: number,
    @Body('code') code: string,
    @Res({ passthrough: true }) response: Response,
    @Body('secret') secret?: string,
  ) {
    const user = await this.userService.findOne({ where: { id } });

    if (!user) {
      throw new BadRequestException('invalid credentials');
    }

    if (!secret) {
      secret = user.tfa_secret;
    }

    const verified = speakeasy.totp.verify({
      secret,
      encoding: 'ascii',
      token: code,
    });

    if (!verified) {
      throw new BadRequestException('invalid credentials');
    }

    if (user.tfa_secret === '') {
      await this.userService.update(id, { tfa_secret: secret });
    }

    const accessToken = await this.jwtService.signAsync(
      { id },
      { expiresIn: '30s' },
    );
    const refreshToken = await this.jwtService.signAsync({ id });

    const expired_at = new Date();
    expired_at.setDate(expired_at.getDate() + 7);

    await this.tokenService.save({
      user_id: id,
      token: refreshToken,
      expired_at,
    });

    response.status(200);
    response.cookie('refresh_token', refreshToken, {
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60 * 1000, // 1 week
    });
    return { token: accessToken };
  }

  @Get('user')
  async user(@Req() request: Request) {
    try {
      const accessToken = request.headers.authorization.replace('Bearer ', '');

      const { id } = await this.jwtService.verifyAsync(accessToken);

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { password, ...data } = await this.userService.findOne({
        where: { id },
      });

      return data;
    } catch (e) {
      throw new UnauthorizedException();
    }
  }

  @Post('refresh')
  async refresh(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    try {
      const refreshToken = request.cookies['refresh_token'];

      const { id } = await this.jwtService.verifyAsync(refreshToken);

      const tokenEntity = await this.tokenService.findOne({
        where: { user_id: id, expired_at: MoreThanOrEqual(new Date()) },
      });

      if (!tokenEntity) {
        throw new UnauthorizedException();
      }

      const access_token = await this.jwtService.signAsync(
        { id },
        { expiresIn: '30s' },
      );

      response.status(200);

      return { token: access_token };
    } catch (e) {
      throw new UnauthorizedException();
    }
  }

  @Post('logout')
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const refresh_token = request.cookies['refresh_token'];

    await this.tokenService.delete({ token: refresh_token });

    response.clearCookie('refresh_token');

    return { message: 'success' };
  }
}
