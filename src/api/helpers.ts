import { Request, Response } from 'express';
import Result from '../utils/result';
import User from '../entity/user';
import Mailer from '../utils/mailer';
import Access from '../entity/access';

export function parseAccessToken(req: Request, accessId: number): Result<any> {
  const authHeader = req.headers['authorization'];
  if (authHeader == undefined)
    return new Result(new Error('Not authorized'), 401);

  // format: bearer <token>
  const a = authHeader.split(' ');
  if (a.length != 2)
    return new Result(new Error('Not authorized'), 401);

  const token = a[1];
  const claims = Access.decode(token, accessId);
  if (claims == undefined)
    return new Result(new Error('Not authorized'), 401);
  return new Result(claims, 200);
}

export function setRefreshTokenCookie(res: Response, token: string) {
  const refreshExpiration = Access.refreshExpiration();
  res.cookie(
    process.env.REFRESH_TOKEN_NAME!,
    token,
    {
      domain: process.env.REFRESH_TOKEN_DOMAIN!,
      secure: process.env.REFRESH_TOKEN_SECURE! == 'true',
      httpOnly: process.env.REFRESH_TOKEN_HTTPONLY! == 'true',
      expires: refreshExpiration,
      maxAge: refreshExpiration.getTime(),
    }
  );
}

export async function handleSendEmailRequest(email: string, res: Response, isConfirmation: boolean, accessName: string): Promise<any> {
  const user = await User.getByEmail(email);
  if (user == undefined) {
    res.status(404);
    throw new Error('User not found');
  }

  if (isConfirmation && user.confirmed) {
    res.status(401);
    throw new Error('User already confirmed');
  }

  const token = Access.encode(user.ukey, user.refreshIndex, accessName);
  if (token == undefined) {
    res.status(500);
    throw new Error('Server error');
  }

  isConfirmation ? Mailer.sendConfirmation(user.email, token) : Mailer.sendForgotPassword(user.email, token);
  res.status(200);
  return { tmp_email_token: token };
}

export async function handlePasswordChange(oldPassword: string | undefined, newPassword: string, confirmation: string, req: Request, res: Response, accessId: number): Promise<boolean> {
  if (newPassword != confirmation) {
    res.status(400);
    throw new Error('Passwords do not match');
  }

  let result = parseAccessToken(req, accessId);
  if (result.isError()) {
    res.status(result.status);
    throw result.getError()!;
  }

  const claims = result.getObject()!;
  if (claims.act != accessId) {
    res.status(401);
    throw new Error('Not authorized');
  }

  const user = await User.getByUserKey(claims.uky, claims.rti);
  if (user == undefined) {
    res.status(404);
    throw new Error('User not found');
  }

  result = await user.updatePassword(oldPassword, newPassword);
  res.status(result.status);

  if (result.isError())
    throw result.isError()!;

  return result.getObject()!;
}