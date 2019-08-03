import * as vscode from "vscode";
import { BigQuery, Job } from "@google-cloud/bigquery";
import * as flatten from "flat";
import bigquery from "@google-cloud/bigquery/build/src/types";

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
  info: { [s: string]: any };
  table: TableResult;
  json: string;
  detail: object;
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
  output = vscode.window.createOutputChannel("Query Runner");
  job: Job | null = null;
  editor: vscode.TextEditor;

  constructor(config: vscode.WorkspaceConfiguration, editor: vscode.TextEditor){
    this.config = config;
    this.editor = editor;
  }

  /**
   * @param queryText
   * @param isDryRun Defaults to False.
   */
  private async query(queryText: string, isDryRun?: boolean): Promise<QueryResult> {
    let client = new BigQuery({
      // keyFilename: config.get("keyFilename"),
      keyFilename: this.config.get("keyFilename"),
      // projectId: config.get("projectId"),
      projectId: this.config.get("projectId"),
    });

    let data;
    try {
      data = await client.createQueryJob({
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

  private makeTable (rows: Array<any>): TableResult {
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
    if(!this.job) {
      throw new Error('No job was found.');
    }

    this.output.show();
    this.output.appendLine(`Results for job ${this.job.id}:`);

    rows.forEach(row => {
      this.output.appendLine(
        JSON.stringify(flatten(row, { safe: true }), null, "  ")
      );
    });

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
      detail: {}
    };
  }

  private writeDryRunSummary(jobId: string, numBytesProcessed: string) {
    this.output.show();
    this.output.appendLine(`Results for job ${jobId} (dry run):`);
    this.output.appendLine(`Total bytes processed: ${numBytesProcessed}`);
    this.output.appendLine(``);
  }

  public async runAsQuery(): Promise<QueryResult | QueryResultError> {
    try {
      // let queryText = getQueryText(vscode.window.activeTextEditor);
      const queryText = this.getQueryText();
      // const queryText = `
      //   SELECT
      //     'hello' AS text
      //     , [1, 2, 3] as arr
      //     , STRUCT(1 AS a, 'abc' AS b) AS dict
      //   UNION ALL
      //   SELECT
      //     NULL AS text
      //     , [1] as arr
      //     , STRUCT(2 AS a, 'zzz' AS b) AS dict
      // `;
      return await this.query(queryText);
    } catch (err) {
      vscode.window.showErrorMessage(err);
      return {
        status: "error",
        errorMessage: err.message,
      };
    }
  }

  public async cancelQuery(): Promise<any> {
    if(!this.job) {
      vscode.window.showErrorMessage('No job was found.');
      return;
    }

    const result = await this.job.cancel();
    return result;
  }

  private getQueryText(onlySelected?: boolean): string {
    if (!this.editor) {
      throw new Error("No active editor window was found");
    }

    // Only return the selected text
    if (onlySelected) {
      const selection = this.editor.selection;
      if (selection.isEmpty) {
        throw new Error("No text is currently selected");
      }

      return this.editor.document.getText(selection).trim();
    }

    const text = this.editor.document.getText().trim();
    if (!text) {
      throw new Error("The editor window is empty");
    }

    this.output.show();
    this.output.appendLine(text);

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

