const electron = require("electron");
console.log("electron type:", typeof electron);
console.log("electron.ipcMain:", electron.ipcMain);
console.log("app:", electron.app ? "defined" : "undefined");
