// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { BigQueryRunner } from './BigQueryRunner';

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

		if (!editor) {
			return;
		}

		const panel = vscode.window.createWebviewPanel(
			'queryRunner', // Identifies the type of the webview. Used internally
			'QueryRunner', // Title of the panel displayed to the user
			vscode.ViewColumn.Beside, // Editor column to show the new webview panel in.
			{
				enableScripts: true,
				retainContextWhenHidden: true,
				localResourceRoots: [vscode.Uri.file(path.join(context.extensionPath, 'public'))]
			}
		);

		panel.webview.html = getWebviewContent(context);

		const bigQueryRunner = new BigQueryRunner(config, editor);

		panel.webview.onDidReceiveMessage(
			async message => {
				switch (message.command) {
					case 'runAsQuery':
						const queryResult = await bigQueryRunner.runAsQuery(message.onlySelected);
						if (queryResult.status === "error") {
							panel.webview.postMessage({ command: 'queryError', errorMessage: queryResult.errorMessage });
						} else {
							panel.webview.postMessage({ command: 'runAsQuery', result: queryResult });
						}
						break;

					case 'cancelQuery':
						const cancelResult = await bigQueryRunner.cancelQuery();
						panel.webview.postMessage({ command: 'cancelQuery', result: cancelResult });
						break;
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

	return html.replace(new RegExp('__RESOURCE_DIR__', 'g'), resourceDir.toString());
}

// function publicPath(filePath: string, context: vscode.ExtensionContext): string {
// }

// this method is called when your extension is deactivated
export function deactivate() { }
