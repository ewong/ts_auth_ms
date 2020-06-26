import dotenv from 'dotenv';
dotenv.config();

import express, { response } from 'express';
import graphqlHTTP from 'express-graphql';
import cookieParser from 'cookie-parser';
import Access from './entity/access';
import cors from 'cors';

import { createConnection } from 'typeorm';
import { schema, root } from './api/schema';

createConnection().then(async connection => {
  await Access.load();
  const app = express();
  const corsOptions = {
    origin: process.env.CORS_ORIGIN!,
    credentials: true,
    optionsSuccessStatus: 200 // some legacy browsers (IE11, various SmartTVs) choke on 204
  };
  app.use(cors(corsOptions));
  app.use(express.json());
  app.use(cookieParser());
  app.use(process.env.GRAPHQL_PATH!, graphqlHTTP((request, response, graphQLParams) => ({
    schema: schema,
    rootValue: root,
    graphiql: true,
    context: {
      req: request,
      res: response,
    }
  })));

  app.listen(parseInt(process.env.APP_PORT!));
  console.log(`Server started at url: http://localhost:${process.env.APP_PORT!}${process.env.GRAPHQL_PATH}`);
}).catch(error => { console.log(error) });