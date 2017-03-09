// Copyright 2016 Google Inc. All Rights Reserved.
// Licensed under the Apache License, Version 2.0. See LICENSE
'use strict';

const fs = require('fs');
const path = require('path');
const GoogleAuth = require('google-auth-library');
const promisify = require('micro-promisify');
const readlineSync = require('readline-sync');

const { getMessage } = require('../utils/messages');

import { AuthorizeCredentials } from '../../types/types';

const fsReadFile = promisify(require('fs').readFile);
const fsWriteFile = promisify(require('fs').writeFile);

/* improve the bad polyfill that devtools-frontend did */
//@todo remove after https://github.com/GoogleChrome/lighthouse/issues/1535 will be closed
const globalAny:any = global;
const self = globalAny.self || this;
self.setImmediate = function(callback:any) {
  Promise.resolve().then(_ => callback.apply(null, [...arguments].slice(1)));
  return 0;
};

const EEXIST = 'EEXIST';

class GoogleOuth {
  scopes: Array<string>;
  tokenDir: string;
  tokenPath: string;

  constructor() {
    // If modifying these this.scopes, delete your previously saved credentials
    // at ~/.credentials/sheets.googleapis.com-nodejs-pwmetrics.json
    this.scopes = ['https://www.googleapis.com/auth/spreadsheets'];
    this.tokenDir = path.join((process.env.HOME || process.env.HOMEPATH || process.env.USERPROFILE), '/.credentials/');
    this.tokenPath = path.join(this.tokenDir, 'sheets.googleapis.com-nodejs-pwmetrics.json');
  }

  async authenticate(clientSecret:AuthorizeCredentials): Promise<any> {
    try {
      return await this.authorize(clientSecret);
    } catch(error) {
      throw new Error(error);
    }
  }

  async authorize(credentials:AuthorizeCredentials): Promise<any> {
    const clientSecret = credentials.installed.client_secret;
    const clientId = credentials.installed.client_id;
    const redirectUrl = credentials.installed.redirect_uris[0];
    const auth = new GoogleAuth();
    const oauth2Client = new auth.OAuth2(clientId, clientSecret, redirectUrl);

    try {
      const token = await this.getToken();
      oauth2Client.credentials = typeof token === 'string' ? JSON.parse(token) : token;
      return oauth2Client;
    } catch(error) {
      return await this.getNewToken(oauth2Client);
    }
  }

  async getToken() {
    return await fsReadFile(this.tokenPath, 'utf8');
  }

  async getNewToken(oauth2Client:any): Promise<any> {
    try {
      const authUrl = oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: this.scopes
      });

      console.log(getMessage('G_OUTH_WITH_URL', authUrl));

      const code = this.readline();
      const token:any = await this.getOauth2ClientToken(oauth2Client, code);
      oauth2Client.credentials = token;
      await this.storeToken(token);
      return oauth2Client;
    } catch (error) {
      throw getMessage('G_OUTH_ACCESS_ERROR',  error.message);
    }
  }

  readline() {
    return readlineSync.question(getMessage('G_OUTH_ENTER_CODE'), {
      hideEchoBack: true
    });
  }

  getOauth2ClientToken(oauth2Client:any, code:any): Promise<any> {
    return new Promise((resolve:Function, reject:Function) => {
      oauth2Client.getToken(code, (error:Object, token:Object) => {
        if (error)
          return reject(error);
        else
          return resolve(token);
      });
    });
  }

  async storeToken(token:string): Promise<any> {
    try {
      fs.mkdirSync(this.tokenDir);
    } catch (error) {
      if (error.code !== EEXIST) {
        throw error;
      }
    }
    await fsWriteFile(this.tokenPath, JSON.stringify(token));
    console.log(getMessage('G_OUTH_STORED_TOKEN', this.tokenPath));
  }
}

module.exports = GoogleOuth;
