const vscode = require('vscode');
const path = require('path');
const WebSocket = require('ws');

const webSocketServer = new WebSocket.Server({port: 8080});

function activate() {
    console.log("vscode-connect activated");

    webSocketServer.on('connection', async (websocket) => {
        console.log("vscode-connect connection established");

        websocket.on('message', async (jsonString) => {
            const jsonData = JSON.parse(jsonString);
            const workspaceFolders = vscode.workspace.workspaceFolders;

            console.log("vscode-connect message received");
            console.log(jsonData);

            if (!workspaceFolders) {
                return websocket.send(JSON.stringify({
                    Body: "Workspace folder not found.",
                    StatusCode: 404
                }))
            } else if (jsonData.Receive) {
                const directories = await getDirectories(workspaceFolders);

                return websocket.send(JSON.stringify({
                    Body: directories,
                    StatusCode: 200
                }))
            } else if (jsonData.Directory) {
                const directories = await getDirectories(workspaceFolders);
                const fileData = directories[jsonData.Directory];
    
                if (!fileData) {
                    return websocket.send(JSON.stringify({
                        Body: "Invalid directory.",
                        StatusCode: 404
                    }))
                }
    
                try {
                    const content = await getFileContent(fileData.file_path);
                    websocket.send(JSON.stringify({
                        Body: content,
                        StatusCode: 200
                    }))
                } catch (error) {
                    console.error(error);
                    websocket.send(JSON.stringify({
                        Body: "Error reading file content.",
                        StatusCode: 500
                    }))
                }
            } else {
                return websocket.send(JSON.stringify({
                    Body: "Invalid arguments.",
                    StatusCode: 404
                }))
            }
        })
    })

    console.log(getEditorDirectories());
}

function deactivate() {
    return webSocketServer.close();
}

async function getDirectories(folders) {
    const existing_directories = {};
    const directories = {};

    async function traverseFolder(uri, rootFolderName) {
        try {
            const files = await vscode.workspace.fs.readDirectory(uri);
    
            for (const file of files) {
                const [name, fileType] = file;
                const fileUri = vscode.Uri.joinPath(uri, name);

                if (fileType === vscode.FileType.Directory) {
                    await traverseFolder(fileUri, rootFolderName);
                } else {
                    const filePath = fileUri.path.replace(/\\/g, '/');
                    const relativePath = filePath.slice(filePath.indexOf(rootFolderName));
                    const fileName = path.basename(filePath, path.extname(filePath));
    
                    const fileData = {
                        path: relativePath,
                        name: name,
                        file_path: filePath,
                        short_name: fileName,
                        from_vscode: true
                    }
    
                    directories[fileData.path] = fileData;
    
                    if (directories[fileData.name]) {
                        existing_directories[fileData.name] = true;
                        delete directories[fileData.name];
                    }
    
                    if (directories[fileData.short_name]) {
                        existing_directories[fileData.short_name] = true;
                        delete directories[fileData.short_name];
                    }
    
                    if (!existing_directories[fileData.name]) {
                        directories[fileData.name] = fileData;
                    }
    
                    if (!existing_directories[fileData.short_name]) {
                        directories[fileData.short_name] = fileData;
                    }
                }
            }
        } catch (error) {
            console.error(error);
        }
    }

    const promises = folders.map(folder => traverseFolder(folder.uri, folder.name));
    await Promise.all(promises);

    return directories;
}

async function getFileContent(filePath) {
    const uri = vscode.Uri.file(filePath);
    const content = await vscode.workspace.fs.readFile(uri);
    return content.toString();
}

module.exports = {
    activate,
    deactivate
}