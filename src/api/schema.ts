import { buildSchema } from 'graphql';
import User from '../entity/user';
import { JWT, JWTActionType } from '../utils/jwt';
import { parseAccessToken, setRefreshTokenCookie, handlePasswordChange, handleSendEmailRequest } from './helpers';
import Mailer from '../utils/mailer';

export const schema = buildSchema(`
  type Query {
    profile: Profile
    resendConfirmation(email: String!): TmpEmailResponse
    forgotPassword(email: String!): TmpEmailResponse
  }

  type Mutation {
    register(email: String!, password: String!, confirmation: String!): RegisteredUser
    login(email: String!, password: String!): AccessToken
    confirm(email: String!): Boolean
    refresh: AccessToken
    resetPassword(password: String!, confirmation: String!): Boolean
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

  type TmpEmailResponse {
    tmp_email_token: ID
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
    Mailer.sendConfirmation(user.email, confirmToken);
    return { ukey: user.ukey, tmp_confirm_token: confirmToken };
  },

  resendConfirmation: async ({ email }: { email: string }, context: any) => {
    return await handleSendEmailRequest(email, context.res, true);
  },

  confirm: async ({ email }: { email: string }, context: any) => {
    let result = parseAccessToken(context.req);
    if (result.isError()) {
      context.res.status(result.status);
      throw result.getError()!;
    }

    const claims = result.getObject()!;
    if (claims.act != JWTActionType.confirmUser) {
      context.res.status(401);
      throw new Error('Not authorized');
    }

    const user = await User.getByUserKey(claims.uky, claims.rti);
    if (user == undefined) {
      context.res.status(404);
      throw new Error('User not found');
    }

    if (email != user.email) {
      context.res.status(401);
      throw new Error('Not authorized');
    }

    result = await user.updateConfirmed();
    if (result.isError()) {
      context.res.status(result.status);
      throw result.getError()!;
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
    const user = await User.getByUserKey(claims.uky, claims.rti);
    if (user == undefined) {
      context.res.status(404);
      throw new Error('User not found');
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

    const user = await User.getByUserKey(claims.uky, claims.rti);
    if (user == undefined)
      throw new Error('Not authorized');

    const result = await user.updateRefreshIndex();
    if (result.isError()) {
      context.res.status(result.status);
      throw result.getError()!;
    }
    user.refreshIndex += 1;

    const refreshToken = JWT.encode(user.ukey, user.refreshIndex, JWTActionType.refreshAccess);
    const accessToken = JWT.encode(user.ukey, user.refreshIndex, JWTActionType.userAccess);
    if (refreshToken == undefined || accessToken == undefined) {
      context.res.status(500);
      throw new Error('Refresh failed');
    }

    setRefreshTokenCookie(context.res, refreshToken);
    context.res.status(200);
    return { ukey: user.ukey, access_token: accessToken };
  },

  forgotPassword: async ({ email }: { email: string }, context: any) => {
    return await handleSendEmailRequest(email, context.res, false);
  },

  resetPassword: async ({ password, confirmation }: { password: string, confirmation: string }, context: any) => {
    return await handlePasswordChange(undefined, password, confirmation, context.req, context.res, true);
  },

};