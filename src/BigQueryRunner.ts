import * as vscode from "vscode";
import { BigQuery, Job } from "@google-cloud/bigquery";
import * as flatten from "flat";
import {GoogleAuth} from "./google_auth";

// CommandMap describes a map of extension commands (defined in package.json)
// and the function they invoke.
// type CommandMap = Map<string, () => void>;
// let commands: CommandMap = new Map<string, () => void>([
//   ["extension.runAsQuery", runAsQuery],
//   ["extension.runSelectedAsQuery", runSelectedAsQuery],
//   ["extension.dryRun", dryRun]
// ]);

interface QueryResult {
  status: "success";
  sql?: string;
  info: { [s: string]: any };
  table: TableResult;
  json: string;
  detail: string;
}

interface QueryResultError {
  status: "error";
  errorMessage: string;
}

interface TableResult {
  headers: string[];
  rows: any[];
}

export class BigQueryRunner {
  configPrefix = "queryRunner";
  config: vscode.WorkspaceConfiguration;
  client: BigQuery;
  output = vscode.window.createOutputChannel("Query Runner");
  job: Job | null = null;
  editor: vscode.TextEditor;
  googleAuth: GoogleAuth;

  constructor(config: vscode.WorkspaceConfiguration, editor: vscode.TextEditor) {
    this.config = config;
    this.editor = editor;
    this.googleAuth = new GoogleAuth();

    this.client = new BigQuery({
      projectId: !!this.config.get("projectId") ? this.config.get("projectId") : undefined,
      // keyFilename: !!this.config.get("keyFilename") ? this.config.get("keyFilename") : undefined,
      location: !!this.config.get("location") ? this.config.get("location") : undefined,
    });
  }

  setConfig(config: vscode.WorkspaceConfiguration) {
    this.config = config;
  }

  getAuthorizeUrl () {
    return this.googleAuth.getAuthorizeUrl();
  }

  async setRefreshClient (authCode: string) {
    const refreshClient = await this.googleAuth.setRefreshClient(authCode);
    this.client.authClient.cachedCredential = refreshClient;
  }

  /**
   * @param queryText
   * @param isDryRun Defaults to False.
   */
  private async query(queryText: string, isDryRun?: boolean): Promise<QueryResult> {
    let data;
    try {
      data = await this.client.createQueryJob({
        query: queryText,
        // location: config.get("location"),
        // maximumBytesBilled: config.get("maximumBytesBilled"),
        // useLegacySql: config.get("useLegacySql"),
        dryRun: !!isDryRun
      });
    } catch (err) {
      vscode.window.showErrorMessage(`Failed to query BigQuery: ${err}`);
      throw err;
    }
    this.job = data[0];

    if (!this.job) {
      throw new Error("No job was found.");
    }

    // if (isDryRun) {
    //   vscode.window.showInformationMessage(`${jobIdMessage} (dry run)`);
    //   let totalBytesProcessed = job.metadata.statistics.totalBytesProcessed;
    //   writeDryRunSummary(id, totalBytesProcessed);
    //   return null;
    // }

    vscode.window.showInformationMessage(`BigQuery job ID: ${this.job.metadata.id}`);

    let result;

    try {
      result = await this.job.getQueryResults({
        autoPaginate: true // TODO
      });
    } catch (err) {
      vscode.window.showErrorMessage(`Failed to query BigQuery: ${err}`);
      throw err;
    }

    try {
      return await this.processResults(result[0]);
    } catch (err) {
      vscode.window.showErrorMessage(`Failed to get results: ${err}`);
      throw err;
    }
  }

  private makeTable(rows: Array<any>): TableResult {
    const headers: string[] = [];
    Object.keys(flatten(rows[0], { safe: true })).forEach(name => headers.push(name));

    let table: any[] = [];

    rows.forEach((val, idx) => {
      // Flatten each row, and for each header (name), insert the matching
      // object property (v[name])
      let v: { [s: string]: any } = flatten(val, { safe: true });
      let tableRow: any[] = [];
      headers.forEach((name, col) => {
        tableRow.push(v[name]);
      });
      table.push(tableRow);
    });

    return {
      headers,
      rows: table
    };
  }

  private async processResults(rows: Array<any>): Promise<QueryResult> {
    if (!this.job) {
      throw new Error('No job was found.');
    }

    const metadata = (await this.job.getMetadata())[0];

    return {
      status: "success",
      info: {
        projectId: metadata.jobReference.projectId,
        jobId: metadata.id,
        location: this.job.location,
        jobLink: metadata.selfLink,
        creationTime: metadata.statistics.creationTime,
        startTime: metadata.statistics.startTime,
        endTime: metadata.statistics.endTime,
        userEmail: metadata.user_email,
        totalBytesProcessed: metadata.statistics.totalBytesProcessed,
        status: metadata.status.state,
      },
      table: this.makeTable(rows),
      json: JSON.stringify(rows, null, "  "),
      detail: JSON.stringify(metadata.statistics, null, "  "),
    };
  }

  // private writeDryRunSummary(jobId: string, numBytesProcessed: string) {
  //   this.output.show();
  //   this.output.appendLine(`Results for job ${jobId} (dry run):`);
  //   this.output.appendLine(`Total bytes processed: ${numBytesProcessed}`);
  //   this.output.appendLine(``);
  // }

  public async runAsQuery(variables: { [s: string]: any }, onlySelected?: boolean): Promise<QueryResult | QueryResultError> {
    try {
      const queryText = this.getQueryText(variables, onlySelected);
      let queryResult = await this.query(queryText);
      queryResult.sql = queryText;
      return queryResult;
    } catch (err) {
      vscode.window.showErrorMessage(err);
      return {
        status: "error",
        errorMessage: err.message,
      };
    }
  }

  public async cancelQuery(): Promise<any> {
    if (!this.job) {
      vscode.window.showErrorMessage('No job was found.');
      return;
    }

    const result = await this.job.cancel();
    return result;
  }

  private getQueryText(variables: { [s: string]: any }, onlySelected?: boolean): string {
    if (!this.editor) {
      throw new Error("No active editor window was found");
    }

    let text: string;

    // Only return the selected text
    if (onlySelected) {
      const selection = this.editor.selection;
      if (selection.isEmpty) {
        throw new Error("No text is currently selected");
      }

      text = this.editor.document.getText(selection).trim();
    } else {
      text = this.editor.document.getText().trim();
    }

    if (!text) {
      throw new Error("The editor window is empty");
    }

    // Replace variables
    for (let [key, value] of Object.entries(variables)) {
      const re = new RegExp(key, 'g');
      text = text.replace(re, value);
    }

    return text;
  }

  // function runSelectedAsQuery(): void {
  //   try {
  //     let queryText = getQueryText(vscode.window.activeTextEditor, true);
  //     query(queryText);
  //   } catch (err) {
  //     vscode.window.showErrorMessage(err);
  //   }
  // }

  // function dryRun(): void {
  //   try {
  //     let queryText = getQueryText(vscode.window.activeTextEditor);
  //     query(queryText, true);
  //   } catch(err) {
  //     vscode.window.showErrorMessage(err);
  //   }
  // }

}

