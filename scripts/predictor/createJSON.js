var fs = require("fs");

var configJSON = require("./contract_config.json");

// source and target are supposed to be strings
function writeInitialJSON(source, target) {
    // source file is a pre-existent JSON listiing contract names and addresses
    let F = require(source);
    let L = Object.keys(F).length;
    for (let i = 0; i < L; i++) {
        let A = F[Object.keys(F)[i]];
        F[Object.keys(F)[i]] = [A, "./"];
    }
    F = JSON.stringify(F, null, 2);
    // target is the path of a file that may or not exist, with the desired format
    fs.writeFileSync(target, F);
}

// this function will repeat all the steps this script tries to for each file mentioned in config
function initializeFiles(c) {
    let l = Object.keys(c).length;
    for (let i = 0; i < l; ++i) {
        let k = Object.keys(c)[i];
        let s = c[k][0];
        let t = c[k][2];
        writeInitialJSON(s, t);
    }
}

initializeFiles(configJSON);
