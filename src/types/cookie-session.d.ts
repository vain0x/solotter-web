import * as express from 'express';

declare module 'express' {
  namespace e {
    interface Response {
      session: object;
    }
  }
}
