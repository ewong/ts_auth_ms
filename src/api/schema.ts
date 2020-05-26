import { Request, Response } from 'express';
import { buildSchema } from 'graphql';
import User from '../entity/user';

export const schema = buildSchema(`
  type Query {
    profile(ukey: String!): Profile
  }

  type Mutation {
    register(email: String!, password: String!, confirmation: String!): RegisteredUser
    login(email: String!, password: String!): AccessToken
    confirm(email: String!): Boolean
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
    return { ukey: user.ukey, tmp_confirm_token: 'tmpConfirmToken' };
  },

  confirm: async ({ email }: { email: string }, context: any) => {
    const user = await User.getByEmail(email);
    if (user == undefined) {
      context.res.status(404);
      throw new Error('User not found');
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
    return result.getObject()!;
  },

  profile: async ({ ukey }: { ukey: string }, context: any) => {
    const user = await User.getByUserKey(ukey);
    if (user == undefined) {
      context.res.status(404);
      throw new Error('Invalid user');
    }
    return user;
  },
};