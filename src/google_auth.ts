import * as vscode from "vscode";
import {UserRefreshClient, OAuth2Client} from 'google-auth-library';

export class GoogleAuth {
  oAuth2Client: OAuth2Client;
  clientId = "845129514279-njboj9fbrordd88a0p9hi5k6i0oepgn0.apps.googleusercontent.com";

  constructor () {
    this.oAuth2Client = new OAuth2Client({
      clientId: this.clientId,
      redirectUri: "urn:ietf:wg:oauth:2.0:oob"
    });
  }

  getAuthorizeUrl () {
    const authorizeUrl = this.oAuth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: 'https://www.googleapis.com/auth/bigquery',
      prompt: 'consent'
    });

    return authorizeUrl;
  }

  async setRefreshClient (authCode: string): Promise<UserRefreshClient> {
    const r = await this.oAuth2Client.getToken(authCode);

    this.oAuth2Client.setCredentials(r.tokens);

    if (!this.oAuth2Client.credentials.access_token) {
      throw Error("No access_token was found.");
    }

    if (!r.tokens.refresh_token) {
      throw Error("No refresh_token was found.");
    }

    const tokenInfo = await this.oAuth2Client.getTokenInfo(
      this.oAuth2Client.credentials.access_token
    );

    vscode.window.showInformationMessage(`Successfully login to Google: ${JSON.stringify(tokenInfo, null, "  ")}`);

    const refreshClient = new UserRefreshClient({
      clientId: this.clientId,
      refreshToken: r.tokens.refresh_token
    });
    refreshClient.refreshAccessToken();

    return refreshClient;
  }
}
