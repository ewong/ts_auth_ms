# ts_auth_ms
JWT authentication microservice using Typescript, ExpressJS, Typeorm &amp; Postgresql

RELEASE NOTES

VERSION 0.3.1
- Added CORS
- Temporarily set confirmed = true in user.ts constructor.

VERSION 0.3.0
- Convert JWT class, JWTAction clas & JWTActionType enum to Access class.
- Created Mailer class stub.
- Updated Database & User classes.
- Created new handlers (forgotPassword, resendConfirmation, resetPassword) in schema.ts.

VERSION 0.2.0
- JWT access control introduced.
- JWT class & JWTActionType enum implements access control.

VERSION 0.1.0
- Base system with ExpressJS, GraphQL, TypeORM & Postgresql.
- Implements User model with TypeORM.