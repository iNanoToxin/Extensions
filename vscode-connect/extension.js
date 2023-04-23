const vscode = require("vscode")
const path = require("path")
const WebSocket = require("ws")

const webSocketServer = new WebSocket.Server({
    port: 8080
})

const workspace         = vscode.workspace
const workspace_folders = workspace.workspaceFolders
const Uri               = vscode.Uri

const hash_map_data = new Map()
const hash_map_uris = new Map()
const blacklisted = {}


function activate() {
    console.log("vscode-connect activated")

    webSocketServer.on("connection", (websocket) => {
        console.log("vscode-connect connection established")

        websocket.on("message", (jsonString) => {
            const jsonData = JSON.parse(jsonString)

            console.log("vscode-connect message received")
            console.log(jsonData)

            if (jsonData.Directory) {
                if (!hash_map_uris.has(jsonData.Directory)) {
                    return websocket.send(JSON.stringify({
                        Body: "Invalid directory.",
                        StatusCode: 404
                    }))
                }

                return websocket.send(JSON.stringify({
                    Body: hash_map_data.get(hash_map_uris.get(jsonData.Directory)),
                    StatusCode: 200
                }))
            } else {
                return websocket.send(JSON.stringify({
                    Body: "Invalid arguments.",
                    StatusCode: 404
                }))
            }
        })
    })
}

function deactivate() {
    return webSocketServer.close()
}




function get_workspace_folder(uri) {
    return workspace.getWorkspaceFolder(uri).name
}

function assign_data_to_map(path, file_data) {
    if (hash_map_uris.has(file_data.name)) {
        blacklisted[file_data.name] = true
        hash_map_uris.delete(file_data.name)
    }

    if (hash_map_uris.has(file_data.short_name)) {
        blacklisted[file_data.short_name] = true
        hash_map_uris.delete(file_data.short_name)
    }

    if (!blacklisted[file_data.name]) {
        hash_map_uris.set(file_data.name, path)
    }

    if (!blacklisted[file_data.short_name]) {
        hash_map_uris.set(file_data.short_name, path)
    }

    hash_map_uris.set(file_data.path, path)
}

function on_create(uri, root_name) {
    const file_name = path.basename(uri.path)

    if (!root_name) {
        root_name = get_workspace_folder(uri)
    }

    workspace.fs.stat(uri).then((result) => {
        if (result.type === 1) {
            const file_data = {
                path: uri.path.slice(uri.path.indexOf(root_name)),
                name: file_name,
                file_path: uri.path,
                short_name: path.basename(uri.path, path.extname(uri.path)),
                from_vscode: true
            }

            workspace.fs.readFile(uri).then((results) => {
                file_data.source = results.toString()
            })

            hash_map_data.set(uri.fsPath, file_data)

            assign_data_to_map(uri.fsPath, file_data)

            console.log(`created file {${file_name}}.`)
        } else if (result.type === 2 & !(/^\./).test(file_name)) {
            workspace.fs.readDirectory(uri).then((results) => {
                results.forEach((result) => {
                    on_create(Uri.joinPath(uri, result[0]), root_name)
                })
            })
        }
    })
}

function on_delete(uri) {
    for (let [index, value] of hash_map_data) {
        if (index.slice(0, uri.fsPath.length) === uri.fsPath) {
            console.log(`deleted file {${path.basename(index)}}.`)
            hash_map_data.delete(index)
        }
    }

    for (let [index, value] of hash_map_uris) {
        if (value.slice(0, uri.fsPath.length) === uri.fsPath) {
            hash_map_uris.delete(index)
        }
    }
}

function on_rename(old_uri, new_uri) {
    if (!hash_map_data.has(old_uri.fsPath)) {
        return
    }

    const old_file_name = path.basename(old_uri.path)
    const new_file_name = path.basename(new_uri.path)

    const file_data = hash_map_data.get(old_uri.fsPath)
    file_data.path = new_uri.path.slice(new_uri.path.indexOf(get_workspace_folder(old_uri)))
    file_data.name = new_file_name
    file_data.file_path = new_uri.path
    file_data.short_name = path.basename(new_uri.path, path.extname(new_uri.path))

    hash_map_data.set(new_uri.fsPath, file_data)
    hash_map_data.delete(old_uri.fsPath)

    for (let [index, value] of hash_map_uris) {
        if (value === old_uri.fsPath) {
            hash_map_uris.delete(index)
        }
    }

    assign_data_to_map(new_uri.fsPath, file_data)

    console.log(`renamed file from {${old_file_name}} to {${new_file_name}}.`)
}

function on_update(document) {
    if (!hash_map_data.has(document.uri.fsPath)) {
        return
    }

    hash_map_data.get(document.uri.fsPath).source = document.getText()
    console.log(`updated document source {${path.basename(document.fileName)}}.`)
}

workspace.onDidChangeWorkspaceFolders((result) => {
    result.added.forEach((folder) => on_create(folder.uri, folder.name))
    result.removed.forEach((folder) => on_delete(folder.uri))
})

workspace.onDidCreateFiles((result) => result.files.forEach((uri) => on_create(uri)))
workspace.onDidDeleteFiles((result) => result.files.forEach((uri) => on_delete(uri)))
workspace.onDidRenameFiles((result) => result.files.forEach((result) => on_rename(result.oldUri, result.newUri)))
workspace.onDidChangeTextDocument((result) => on_update(result.document))

if (workspace_folders) {
    workspace_folders.forEach((folder) => on_create(folder.uri, folder.name))
}

module.exports = {
    activate,
    deactivate
}