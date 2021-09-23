// This is a nodejs script to compute the selectors of Solidity events or functions
// (four bytes of the Keccak-256 or SHA-3 hash of the signature of the function)
// Install: npm i keccak256

var myArgs = process.argv.slice(2);
// console.log('arg: ', String(myArgs[0]).split(/\r?\n/));

let signatures = String(myArgs[0])
	.replace(/;/g, "") // remove final ;
	.split(/\r?\n/) // split lines, every line is a signature
	.sort(function (a, b) {
		// sorted alphabetically
		if (a < b) {
			return -1;
		}
		if (a > b) {
			return 1;
		}
		return 0;
	})
	.filter((item, i, ar) => ar.indexOf(item) === i); // get unique
// console.log('signatures: ', signatures);

const keccak256 = require("keccak256");
for (let s of signatures) {
	if (s) console.log(s + "\t" + "0x" + keccak256(s).toString("hex"));
}
