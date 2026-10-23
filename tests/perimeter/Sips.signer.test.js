const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const ethers = require("ethers");
const describeCase = typeof describe === "function" ? describe : require("node:test").describe;
const testCase = typeof it === "function" ? it : require("node:test").it;

function createAction() {
    let action;
    const file = path.resolve(__dirname, "../../hardhat/tasks/sips.js");
    const context = {
        types: { string: "string" },
        require: (name) => {
            if (name === "hardhat/config")
                return {
                    task: (name) => {
                        const chain = new Proxy(
                            {},
                            {
                                get: (_, key) =>
                                    key === "setAction"
                                        ? (fn) => {
                                              if (name === "sips:create") action = fn;
                                              return chain;
                                          }
                                        : () => chain,
                            }
                        );
                        return chain;
                    },
                };
            if (name === "node-logs")
                return class {
                    showInConsole() {
                        return this;
                    }
                };
            if (name === "./sips/args/sipArgs")
                return { fixture: async () => ({ governor: "GovernorOwner", args: {} }) };
            if (name === "../../deployment/helpers/helpers") return {};
            throw new Error("Unexpected dependency " + name);
        },
    };
    vm.runInNewContext(fs.readFileSync(file, "utf8"), context, { filename: file });
    assert.equal(typeof action, "function");
    return action;
}

describeCase("SIP creation named signer selection", () => {
    testCase(
        "refuses missing or invalid named signers before ethers can default to account zero",
        async () => {
            for (const deployer2 of [undefined, null, "", "not-an-address"]) {
                let selected = false;
                const hre = {
                    getNamedAccounts: async () => ({ deployer2 }),
                    deployments: { get: async () => ({ address: ethers.constants.AddressZero }) },
                    ethers: {
                        utils: ethers.utils,
                        getSigner: async () => {
                            selected = true;
                            throw new Error("unexpected signer selection");
                        },
                    },
                };
                await assert.rejects(
                    createAction()({ argsFunc: "fixture", signer: "deployer2" }, hre),
                    /named signer.*not configured/
                );
                assert.equal(selected, false);
            }
        }
    );
    testCase("passes the resolved named account to ethers without changing it", async () => {
        const address = "0x163463B7DdBCE853832037A059f5c5E6606bF9c4";
        let selected;
        const hre = {
            getNamedAccounts: async () => ({ deployer2: address }),
            deployments: { get: async () => ({ address: ethers.constants.AddressZero }) },
            ethers: {
                utils: ethers.utils,
                getSigner: async (value) => {
                    selected = value;
                    throw new Error("stop after signer selection");
                },
            },
        };
        await assert.rejects(
            createAction()({ argsFunc: "fixture", signer: "deployer2" }, hre),
            /stop after signer selection/
        );
        assert.equal(selected, address);
    });
});
