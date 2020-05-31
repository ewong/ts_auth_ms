import { Request, Response } from 'express';
import { buildSchema } from 'graphql';
import User from '../entity/user';
import Result from '../model/result';
import { JWT, JWTActionType } from '../utils/jwt';

export const schema = buildSchema(`
  type Query {
    profile: Profile
  }

  type Mutation {
    register(email: String!, password: String!, confirmation: String!): RegisteredUser
    login(email: String!, password: String!): AccessToken
    confirm(email: String!): Boolean
    refresh: AccessToken
  }

  type Profile {
    ukey: ID
    email: String
  }

  type RegisteredUser {
    ukey: ID
    tmp_confirm_token: ID
  }

  type AccessToken {
    ukey: ID
    access_token: ID
  }

`);

export const root = {
  register: async ({ email, password, confirmation }: { email: string, password: string, confirmation: string }, context: any) => {
    const result = await User.register(email, password, confirmation);
    context.res.status(result.status);
    if (result.isError())
      throw result.getError()!
    const user = result.getObject()!;
    const confirmToken = JWT.encode(user.ukey, user.refreshIndex, JWTActionType.confirmUser);
    if (confirmToken == undefined) {
      context.res.status(500);
      throw new Error('Confirmation failed');
    }
    return { ukey: user.ukey, tmp_confirm_token: confirmToken };
  },

  confirm: async ({ email }: { email: string }, context: any) => {
    const result = parseAccessToken(context.req);
    if (result.isError()) {
      context.res.status(result.status);
      throw result.getError()!;
    }

    const claims = result.getObject()!;
    if (claims.act != JWTActionType.confirmUser) {
      context.res.status(401);
      throw new Error('Not authorized');
    }

    const user = await User.getByUserKey(claims.uky);
    if (user == undefined) {
      context.res.status(404);
      throw new Error('User not found');
    }

    if (email != user.email) {
      context.res.status(401);
      throw new Error('Not authorized');
    }

    if (user.confirmed) {
      context.res.status(400);
      throw new Error('User already confirmed');
    }

    user.confirmed = true;
    const success = await user.save();
    if (!success) {
      context.res.status(500);
      throw new Error('Confirmation failed');
    }

    context.res.status(200);
    return true;
  },

  login: async ({ email, password }: { email: string, password: string }, context: any) => {
    const result = await User.login(email, password);
    context.res.status(result.status);
    if (result.isError())
      throw result.getError()!;
    const data = result.getObject()!;
    setRefreshTokenCookie(context.res, data.refresh_token);
    return data;
  },

  profile: async ({ }: {}, context: any) => {
    const result = parseAccessToken(context.req);
    if (result.isError()) {
      context.res.status(result.status);
      throw result.getError()!;
    }

    const claims = result.getObject()!;
    const user = await User.getByUserKey(claims.uky);

    if (user == undefined) {
      context.res.status(404);
      throw new Error('Invalid user');
    }
    return user;
  },

  refresh: async ({ }: {}, context: any) => {
    const token = context.req.cookies[process.env.REFRESH_TOKEN_NAME!];
    context.res.status(401);
    if (token == undefined)
      throw new Error('Not authorized');

    const claims = JWT.decode(token, JWTActionType.refreshAccess);
    if (claims == undefined)
      throw new Error('Not authorized');

    const user = await User.getByUserKey(claims.uky);
    if (user == undefined)
      throw new Error('Not authorized');

    if (user.refreshIndex != claims.rti)
      throw new Error('Not authorized');

    user.refreshIndex = user.refreshIndex + 1;
    const success = await user.save();
    if (!success) {
      context.res.status(500);
      throw new Error('Refresh failed');
    }

    const refreshToken = JWT.encode(user.ukey, user.refreshIndex, JWTActionType.refreshAccess);
    const accessToken = JWT.encode(user.ukey, user.refreshIndex, JWTActionType.userAccess);
    if (refreshToken == undefined || accessToken == undefined) {
      context.res.status(500);
      throw new Error('Refresh failed');
    }

    setRefreshTokenCookie(context.res, refreshToken);
    context.res.status(200);
    return { ukey: user.ukey, access_token: accessToken };
  }
};

function parseAccessToken(req: Request): Result<any> {
  const authHeader = req.headers['authorization'];
  if (authHeader == undefined)
    return new Result(new Error('Not authorized'), 401);

  // format: bearer <token>
  const a = authHeader.split(' ');
  if (a.length != 2)
    return new Result(new Error('Not authorized'), 401);

  const token = a[1];
  const claims = JWT.decode(token, JWTActionType.userAccess);
  if (claims == undefined)
    return new Result(new Error('Not authorized'), 401);
  return new Result(claims, 200);
}

function setRefreshTokenCookie(res: Response, token: string) {
  const refreshExpiration = JWT.refreshExpiration();
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