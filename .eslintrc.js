module.exports = {
    env: {
        browser: true,
        commonjs: true,
        es2021: true,
        mocha: true, // for test files
    },
    extends: "prettier",
    parserOptions: {
        // 2021 for numeric separators (10_000) used in ColFee tests; the
        // `env.es2021` above already grants the globals.
        ecmaVersion: 2021,
    },
    rules: {
        "compiler-version": ["off"],
    },
};
