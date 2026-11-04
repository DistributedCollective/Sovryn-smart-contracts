const { expect } = require("chai");
const { spawnSync } = require("child_process");
const path = require("path");

const root = path.resolve(__dirname, "../..");
const keys = [1, 2, 3, 4].map((n) => "0x" + n.toString(16).padStart(64, "0"));
const inspect = `
require('dotenv').config=()=>({});
const h=require('hardhat');
const {Wallet}=require('ethers');
const {processNamedAccounts}=require('hardhat-deploy/dist/src/utils');
const accounts=h.config.networks.rskSovrynMainnet.accounts.map(k=>new Wallet(k).address);
const names=processNamedAccounts({name:'rskSovrynMainnet',config:{}},h.config.namedAccounts,accounts,30).namedAccounts;
console.log(JSON.stringify({selected:names.proposer3||null,intended:process.env.DEPLOYER?new Wallet(process.env.DEPLOYER).address:null}));
`;
function resolveNamedAccounts(extra) {
    const result = spawnSync(process.execPath, ["-e", inspect], {
        cwd: root,
        env: {
            HOME: process.env.HOME,
            PATH: process.env.PATH,
            TZ: "UTC",
            __decryptionAlreadyDone__: "TRUE",
            ...extra,
        },
        encoding: "utf8",
        timeout: 30000,
    });
    expect(result.status, result.stderr).to.equal(0);
    return JSON.parse(result.stdout.trim());
}

describe("SIP0097 mainnet proposer account selection", function () {
    this.timeout(120000);
    it("selects DEPLOYER when an earlier key slot is empty", function () {
        const result = resolveNamedAccounts({
            MAINNET_DEPLOYER_PRIVATE_KEY: keys[0],
            PROPOSAL_CREATOR_PRIVATE_KEY: keys[1],
            DEPLOYER: keys[2],
        });
        expect(result.selected).to.equal(result.intended);
    });
    it("selects DEPLOYER when all four key slots are present", function () {
        const result = resolveNamedAccounts({
            MAINNET_DEPLOYER_PRIVATE_KEY: keys[0],
            PROPOSAL_CREATOR_PRIVATE_KEY: keys[1],
            TESTNET_DEPLOYER_PRIVATE_KEY: keys[2],
            DEPLOYER: keys[3],
        });
        expect(result.selected).to.equal(result.intended);
    });
    it("does not select another account when DEPLOYER is absent", function () {
        const result = resolveNamedAccounts({
            MAINNET_DEPLOYER_PRIVATE_KEY: keys[0],
            PROPOSAL_CREATOR_PRIVATE_KEY: keys[1],
            TESTNET_DEPLOYER_PRIVATE_KEY: keys[2],
        });
        expect(result.selected).to.equal(null);
    });
});
