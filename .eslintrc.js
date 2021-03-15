module.exports = {
	env: {
		browser: true,
		commonjs: true,
		es2021: true,
		mocha: true, // for test files
		"truffle/globals": true, // same as "truffle/truffle": true
	},
	extends: "eslint:recommended",
	parserOptions: {
		ecmaVersion: 12,
	},
	rules: {},
	plugins: ["truffle"],
};
