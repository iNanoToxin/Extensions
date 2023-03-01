const process = require('child_process');
const vscode = require('vscode');

const myCommandId = 'kill-roblox.kill';

function activate(context) {
	console.log("activate");
	context.subscriptions.push(vscode.commands.registerCommand(myCommandId, () => {
		process.exec('taskkill /f /im RobloxPlayerBeta.exe');
	}));
	let kill_button = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
	kill_button.command = myCommandId;
	kill_button.text = '$(debug-disconnect) Kill roblox';
	kill_button.show();
}

function deactivate() {}

module.exports = {
	activate,
	deactivate
}