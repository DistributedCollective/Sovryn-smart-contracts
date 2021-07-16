// This is a nodejs script to compute the selectors of Solidity events or functions
// (four bytes of the Keccak-256 or SHA-3 hash of the signature of the function)
// Knowledge: In Solidiy selector = bytes4(keccak256(signature))
// Install: npm i keccak256
// Run: node ./scripts/getSelectors.js > functionSignatures.txt

const keccak256 = require("keccak256");

// Get keccak256 in 0x string format for a given content
var keccak256_0x = function (content) {
    return "0x" + keccak256(content).toString('hex');
}


const fs = require("fs");

// Parse a contract searching for function and event declarations
var parseContract = function (fileContent) {
    fileContent = fileContent
        .replace(/\/\/.*?\n/g, '\n') // remove comments like //
        .replace(/\/\*[\s\S]*?\*\//g, '') // remove comments like /* */
    ;

    var signatureList = {};
    searchFunctions = new RegExp(/function [^\)]*\)/g); // focus on function declarations
    while(null != (f = searchFunctions.exec(fileContent))) { // for every function found
        signature = 
            f[0]
            .replace(/function /g, '') // remove "function " on every match
            .replace(/([\(,])\s+/g, '$1') // remove whitespaces and newlines inmediatly after ( or ,
            .replace(/\s+\)/g, ')') // remove whitespaces and newlines inmediatly before )
            .replace(/\s.*?([,\)])/g, '$1') // remove var names and extra modifiers
        ;
        signatureList[signature] = keccak256_0x(signature);
    }

    return signatureList;
}

// Loop through fileList and call parser on each one
var parseContractList = function (fileList) {
    var contractSignatures = {};
    for(let file of fileList) {
        // console.log("\nFile: ", file);
        let content = fs.readFileSync(file, {encoding: 'utf8'});
        contractSignatures[file] = parseContract(content);
    }

    return contractSignatures;
}


// Open files recursively
const glob = require("glob");

var getDirectories = function (src, ext, callback) {
    glob(src + '/**/*' + ext, callback);
};

getDirectories('./contracts', '.sol', function (err, res) {
  if (err) {
    console.log('Error', err);
  } else {
    contractSignatures = parseContractList(res);
    // console.log("contractSignatures: ", contractSignatures);
    // Loop through results and apply tabulated format to copy/past on Google Docs
    for (const [contract, functions] of Object.entries(contractSignatures)) {
        console.log(contract);
        for (const [signature, selector] of Object.entries(functions)) {
            console.log("\t" + signature + "\t" + selector.slice(0, 10) + "\t" + selector);
        }
    }
  }
});
