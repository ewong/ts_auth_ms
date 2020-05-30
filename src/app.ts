import express, { response } from 'express';
import graphqlHTTP from 'express-graphql';
import dotenv from 'dotenv';
import { schema, root } from './api/schema';
import { createConnection } from 'typeorm';
import cookieParser from 'cookie-parser';

dotenv.config();
createConnection().then(async connection => {
  const app = express();
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