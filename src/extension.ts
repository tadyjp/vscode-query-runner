// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

let output = vscode.window.createOutputChannel("BigQuery");

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "vscode-query-runner" is now active!');

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with registerCommand
	// The commandId parameter must match the command field in package.json
	let disposable = vscode.commands.registerCommand('extension.helloWorld', () => {
		// The code you place here will be executed every time your command is executed
		const editor = vscode.window.activeTextEditor;
		// Display a message box to the user

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
	});

	context.subscriptions.push(disposable);
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
