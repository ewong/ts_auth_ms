import { sign, verify } from 'jsonwebtoken';

export const JWTActionType = {
  userAccess: 0,
  refreshAccess: 1,
  confirmUser: 2,
};

class JWTAction {
  type?: number;
  expiresIn?: string;
  secret?: string;

  constructor(type: number) {
    const types = ['userAccess', 'refreshAccess', 'confirmUser'];

    if (type < 0 || type >= types.length) {
      this.type = undefined;
      return;
    }

    this.type = type;
    switch (type) {
      case 1:
        this.expiresIn = process.env.REFRESH_TOKEN_EXPIRATION_DAYS + 'd';
        this.secret = process.env.REFRESH_TOKEN_SECRET;
      default:
        this.expiresIn = process.env.ACCESS_TOKEN_EXPIRATION_MINUTES + 'm';
        this.secret = process.env.ACCESS_TOKEN_SECRET;
    }
  }

  invalid() {
    return this.type == undefined || this.expiresIn == undefined || this.secret == undefined;
  }
}

export class JWT {
  static encode(ukey: string, refreshIndex: number, actionType: number): string | undefined {
    const action = new JWTAction(actionType);

    if (action.invalid())
      return undefined;

    try {
      const claims = {
        iss: process.env.JWT_ISSUER,
        uky: ukey,
        act: action.type,
        rti: refreshIndex,
      };
      const token = sign(claims, action.secret!, { expiresIn: action.expiresIn });
      return token;
    } catch (err) {
      console.log(err);
      return undefined;
    }
  }

  static decode(token: string, actionTypes: number): any | undefined {
    const action = new JWTAction(actionTypes);
    if (action.invalid())
      return undefined;

    try {
      const claims = verify(token, action.secret!);
      return claims;
    } catch (err) {
      console.log(err);
      return undefined;
    }
  }

  static refreshExpiration() {
    const d = new Date();
    d.setDate(d.getDate() + parseInt(process.env.REFRESH_TOKEN_EXPIRATION_DAYS!));
    return d;
  }
}
