// This is a nodejs script to compute the selectors of Solidity events or functions
// (four bytes of the Keccak-256 or SHA-3 hash of the signature of the function)
// Knowledge: In Solidiy selector = bytes4(keccak256(signature))
// Install: npm i keccak256
// Run: node ./scripts/getSelectors.js ./contracts functions > functionSignatures.txt
// Run: node ./scripts/getSelectors.js ./contracts events > eventTopics.txt

// Pending to fix 3 issues:
// 1.- On function signatures, interfaces should be typed as addresses.
// 2.- On function signatures, structs should be exploded into their components, around brackets ()
// 3.- According to the list swapExternal(address,address,address,address,uint256,uint256,bytes) has selector: 0x11058a8a
// According to vscode: e321b540  =>  swapExternal(address,address,address,address,uint256,uint256,uint256,bytes)
// It has an additional parameter. This case should be debugged.

// Get the path where contracts are located
var args = process.argv.slice(2);
let path = String(args[0]);

// Get the type of items to search on contracts
let searchType = String(args[1]);

const keccak256 = require("keccak256");

// Get keccak256 in 0x string format for a given content
var keccak256_0x = function (content) {
	return "0x" + keccak256(content).toString("hex");
};

const fs = require("fs");

// Parse a contract searching for function and event declarations
var parseContract = function (fileContent) {
	fileContent = fileContent
		.replace(/\/\/[^\n]*\n/g, "\n") // remove comments like //
		.replace(/\/\*[\s\S]*?\*\//g, ""); // remove comments like /* */

	var signatureList = {};
	if (searchType == "functions") {
		searchRegExp = new RegExp(/function [^\)]*\)/g); // focus on function declarations
	} else if (searchType == "events") {
		searchRegExp = new RegExp(/event [^\)]*\)/g); // focus on event declarations
	} else {
		console.log("Error: Unknown searchType", searchType);
		process.exit(1);
	}

	while (null != (f = searchRegExp.exec(fileContent))) {
		// For every function or event found
		signature = f[0]
			.replace(/(function|event) /g, "") // remove "function " or "event " on every match
			.replace(/([\(,])\s+/g, "$1") // remove whitespaces and newlines inmediatly after ( or ,
			.replace(/\s+\)/g, ")") // remove whitespaces and newlines inmediatly before )
			.replace(/\s.*?([,\)])/g, "$1") // remove var names and extra modifiers
			.replace(/^(u?int[0-9]*|address|bool|string|bytes(32|4)*)/g, "address") // every unknown type found is considered to be an address
			;
		if (!!signature) {
			signatureList[signature] = keccak256_0x(signature);
		}
	}

	return signatureList;
};

// Parse a contract searching for interface declarations
var parseInterfacesFromContract = function (fileContent) {
	fileContent = fileContent
		.replace(/\/\/[^\n]*\n/g, "\n") // remove comments like //
		.replace(/\/\*[\s\S]*?\*\//g, ""); // remove comments like /* */

	var interfaceList = [];
	searchRegExp = new RegExp(/interface [^\}]*\}/g); // focus on interface declarations

	// Get all interfaces from repo
	while (null != (f = searchRegExp.exec(fileContent))) {
		// For every interface found
		interfaceName = f[0]
			.replace(/[\n\r\t\s]+/g, " ") // remove newlines and tabs
			.replace(/^interface ([^\s]+).*$/g, "$1") // leave only interface name
			;
		if (!!interfaceName) {
			interfaceList.push(interfaceName);
		}
	}

	return interfaceList;
};

// Parse a contract searching for struct declarations
var parseStructsFromContract = function (fileContent) {
	fileContent = fileContent
		.replace(/\/\/[^\n]*\n/g, "\n") // remove comments like //
		.replace(/\/\*[\s\S]*?\*\//g, ""); // remove comments like /* */

	var structList = {};
	searchRegExp = new RegExp(/struct [^\}]*\}/g); // focus on struct declarations

	// Get all structs from repo
	while (null != (f = searchRegExp.exec(fileContent))) {
		// For every struct found
		structName = f[0]
			.replace(/[\n\r\t\s]+/g, " ") // remove newlines and tabs
			.replace(/^struct ([^\s]+).*$/g, "$1") // leave only struct name
			;
		structDeclaration = f[0]
			.replace(/[\n\r\t\s]+/g, " ") // remove newlines and tabs
			.replace(/^struct [^\s]+ \{(.*)\}/g, "$1") // leave only struct declaration
			;
		if (!!structName) {
			structList[structName] = structDeclaration;
		}
	}

	return structList;
};

// Loop through fileList and extract all interfaces from repo
var getAllInterfaces = function (fileList) {
	var interfaces = [];
	for (let file of fileList) {
		// console.log("\nFile: ", file);
		let content = fs.readFileSync(file, { encoding: "utf8" });
		var interfacesToAdd = parseInterfacesFromContract(content);
		interfaces.push(...interfacesToAdd);
	}

	return interfaces;
};

// Loop through fileList and extract all structs from repo
var getAllStructs = function (fileList) {
	var structs = {};
	for (let file of fileList) {
		// console.log("\nFile: ", file);
		let content = fs.readFileSync(file, { encoding: "utf8" });
		var structsToAdd = parseStructsFromContract(content);
		for (var key in structsToAdd) {
			structs[key] = structsToAdd[key];
		}
	}

	return structs;
};

// Loop through fileList and call parser on each one
var parseContractList = function (fileList) {
	var contractSignatures = {};
	for (let file of fileList) {
		// console.log("\nFile: ", file);
		let content = fs.readFileSync(file, { encoding: "utf8" });
		contractSignatures[file] = parseContract(content);
	}

	return contractSignatures;
};

// Open files recursively
const glob = require("glob");

var getDirectories = function (src, ext, callback) {
	glob(src + "/**/*" + ext, callback);
};

getDirectories(path, ".sol", function (err, res) {
	if (err) {
		console.log("Error", err);
	} else {
		interfaces = getAllInterfaces(res);

console.log("Interfaces found: ", interfaces);
process.exit(1);
		structs = getAllStructs(res);

console.log("Structs found: ", structs);
process.exit(1);

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
