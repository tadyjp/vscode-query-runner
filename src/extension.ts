// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import {BigQueryRunner} from './bigquery';

const configPrefix = "queryRunner";
let config: vscode.WorkspaceConfiguration;
let output = vscode.window.createOutputChannel("QueryRunner");

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
	readConfig();

	context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration(event => {
      if (!event.affectsConfiguration(configPrefix)) {
        return;
      }

      readConfig();
    })
	);

	let disposable = vscode.commands.registerCommand('extension.openQueryRunner', () => {
		const editor = vscode.window.activeTextEditor;

		if(!editor) {
			return;
		}

		const panel = vscode.window.createWebviewPanel(
			'queryRunner', // Identifies the type of the webview. Used internally
			'Query Runner', // Title of the panel displayed to the user
			vscode.ViewColumn.Beside, // Editor column to show the new webview panel in.
			{
				enableScripts: true,
				localResourceRoots: [vscode.Uri.file(path.join(context.extensionPath, 'public'))]
			}
		);

		panel.webview.html = getWebviewContent(context);

		const bigQueryRunner = new BigQueryRunner(config);

		panel.webview.onDidReceiveMessage(
			async message => {
				switch (message.command) {
					case 'runAsQuery':
						const result = await bigQueryRunner.runAsQuery();
						panel.webview.postMessage({ command: 'runAsQuery', result: result });
				}
			},
			undefined,
			context.subscriptions
		);
	});

	context.subscriptions.push(disposable);
}

function readConfig(): void {
  try {
		config = vscode.workspace.getConfiguration(configPrefix);
  } catch (e) {
    vscode.window.showErrorMessage(`failed to read config: ${e}`);
  }
}

function getWebviewContent(context: vscode.ExtensionContext): string {
	let indexPath = vscode.Uri.file(
		path.join(context.extensionPath, 'public', 'index.html')
	);
	indexPath = indexPath.with({ scheme: 'vscode-resource' });

	let html = fs.readFileSync(indexPath.path).toString();

	let resourceDir = vscode.Uri.file(
		path.join(context.extensionPath, 'public')
	);
	resourceDir = resourceDir.with({ scheme: 'vscode-resource' });

	return html.replace('__RESOURCE_DIR__', resourceDir.toString());
}

// function publicPath(filePath: string, context: vscode.ExtensionContext): string {
// }

// this method is called when your extension is deactivated
export function deactivate() {}
