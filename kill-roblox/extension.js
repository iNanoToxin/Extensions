const process = require('child_process');
const vscode = require('vscode');

const myCommandId = 'kill-roblox.kill';

let kill_command = vscode.commands.registerCommand(myCommandId, () => {
	process.exec('taskkill /f /im RobloxPlayerBeta.exe');
});

let kill_button = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);

function activate(context) {
	kill_button.text = 'Kill roblox';
	kill_button.command = myCommandId;
	kill_button.show();

	context.subscriptions.push(kill_button);
	context.subscriptions.push(kill_command);
}

function deactivate() {}

module.exports = {
	activate,
	deactivate
}