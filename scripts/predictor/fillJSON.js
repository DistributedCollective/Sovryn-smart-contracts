var fs = require("fs");

// CAUTION : THIS SCRIPT WILL COPY AND WRITE FROM SOURCE TO TARGET PATH

// if some of the path-file info is filled by hand in a pre-existent JSON file
// this script will copy those path strings to another similar JSON file (like mainnet/testnet JSON instances)
// to avoid to repeat manual work

// so I need the path of the file with hand filled data, as my source
// and the path of the target file where we want to copy such data

// let's receive the path of our source/target files as console parameters
var sourcePath = process.argv[2];
var targetPath = process.argv[3];
var S;
var T;

// this function allows us to know if the couple of files pre-exist or not
function checkParameters(s, t) {
    if (fs.existsSync(s)) {
        S = require(s);
    } else {
        S = null;
    }
    if (!fs.existsSync(t) && S != null) {
        // we must ensure that target file exists
        if (t.slice(0, 2) != "./") t = "./" + t;
        fs.writeFileSync(t, "{}");
        T = {};
    } else if (S != null) {
        T = require(t);
    }
    return t;
}

function findEqKeys(S, T, i) {
    var ki = Object.keys(S)[i];
    var LT = Object.keys(T).length;
    let flag = false;
    for (let j = 0; j < LT; j++) {
        let kj = Object.keys(T)[j];
        // if there are differences with lowercase or uppercase, the rest of the filling must be complete by hand
        if (ki == kj) {
            flag = true;
            let vi = S[ki][1];
            // if the field contents data it is left as it is
            if (T[kj][1] == "./" || T[kj][1] == undefined || T[kj][1] == null) {
                T[kj][1] = vi;
            }
            // https://www.youtube.com/watch?v=n0SMef9C_xU
            break;
        }
    }
    if (!flag) {
        console.log(ki, "not found");
        T[ki] = ["0x", S[ki][1]];
    }
    return T;
}

function checkAll(S, T) {
    var LS = Object.keys(S).length;
    for (let k = 0; k < LS; k++) {
        T = findEqKeys(S, T, k);
    }
    return T;
}

function run() {
    if (
        sourcePath != undefined &&
        sourcePath != null &&
        targetPath != undefined &&
        targetPath != null
    ) {
        targetPath = checkParameters(sourcePath, targetPath);

        if (S != null) {
            T = checkAll(S, T);
            T = JSON.stringify(T, null, 2);
            fs.writeFileSync(targetPath, T);
        } else {
            console.log("source file must be initialized");
        }
    } else {
        console.log("check input parameters");
    }
}

run();
