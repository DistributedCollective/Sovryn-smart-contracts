const { expect } = require("chai");
const { spawnSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");
const root = path.resolve(__dirname, "../..");
const config = path.join(root, "scripts/zero-emergency-halt/hardhat.config.js");
const manual = path.join(root, "tests-onchain/SIP0097.test.js");
const cli = require.resolve("hardhat/internal/cli/cli");
const environment = (extra = {}) => ({
    HOME: process.env.HOME,
    PATH: process.env.PATH,
    TZ: "UTC",
    __decryptionAlreadyDone__: "TRUE",
    ...extra,
});

function rejectedBeforeNormalImport(entry, key) {
    const script = `
const Module=require('module');
const normal=${JSON.stringify(path.join(root, "hardhat.config.js"))};
const load=Module._load;
Module._load=function(request,parent,main){
 if(Module._resolveFilename(request,parent)===normal)throw new Error('NORMAL_CONFIG_IMPORTED');
 return load.call(this,request,parent,main);
};
try{require(${JSON.stringify(entry)});process.exit(13);}
catch(error){if(error.message==='SIP0097: signing input forbidden: '+${JSON.stringify(key)}){process.stdout.write(error.message);process.exit(0);}process.stderr.write(error.message);process.exit(12);}
`;
    return spawnSync(process.execPath, ["-e", script], {
        cwd: root,
        env: environment({ [key]: "test-only-inherited-input" }),
        encoding: "utf8",
        timeout: 30000,
    });
}

describe("SIP0097 isolated test entry points", function () {
    this.timeout(120000);
    let directory, script;
    before(function () {
        directory = fs.mkdtempSync(path.join(os.tmpdir(), "sip0097-keyless-"));
        script = path.join(directory, "startup.cjs");
        fs.writeFileSync(
            script,
            `const hre=require(${JSON.stringify(path.join(root, "node_modules/hardhat"))});console.log('SIP0097_STARTED:'+JSON.stringify({network:hre.network.name,chainId:hre.network.config.chainId,networks:Object.keys(hre.config.networks)}));`
        );
    });
    after(function () {
        fs.rmSync(directory, { recursive: true, force: true });
    });
    for (const key of [
        "DEPLOYER",
        "MAINNET_DEPLOYER_PRIVATE_KEY",
        "PROPOSAL_CREATOR_PRIVATE_KEY",
        "TESTNET_DEPLOYER_PRIVATE_KEY",
        "TESTNET_SIGNER_PRIVATE_KEY",
        "TESTNET_SIGNER_PRIVATE_KEY_2",
        "MNEMONIC",
        "PASSWORD",
        "RPC_AUTH",
    ]) {
        for (const [name, entry] of [
            ["config", config],
            ["manual harness", manual],
        ]) {
            it(`rejects ${key} at ${name} entry before normal config import`, function () {
                const result = rejectedBeforeNormalImport(entry, key);
                expect(result.status, result.stderr).to.equal(0);
                expect(result.stdout).to.equal(`SIP0097: signing input forbidden: ${key}`);
            });
        }
    }
    function startup(args = [], extra = {}) {
        return spawnSync(
            process.execPath,
            [cli, "--config", config, ...args, "run", "--no-compile", script],
            {
                cwd: root,
                env: environment(extra),
                encoding: "utf8",
                timeout: 30000,
            }
        );
    }
    it("refuses explicit mainnet startup before any test script executes", function () {
        const result = startup(["--network", "rskSovrynMainnet"]);
        expect(result.status).not.to.equal(0);
        expect(result.stdout).not.to.include("SIP0097_STARTED:");
    });
    it("refuses inherited nonlocal network selection before script execution", function () {
        const result = startup([], { HARDHAT_NETWORK: "rskSovrynMainnet" });
        expect(result.status).not.to.equal(0);
        expect(result.stdout).not.to.include("SIP0097_STARTED:");
    });
    it("exposes only isolated Hardhat and forces chain31337 despite a QA override", function () {
        const result = startup([], { PERIMETER_QA_CHAIN_ID: "30" });
        expect(result.status, result.stderr).to.equal(0);
        const line = result.stdout
            .split("\n")
            .find((value) => value.startsWith("SIP0097_STARTED:"));
        expect(line, result.stdout).to.be.a("string");
        expect(JSON.parse(line.slice("SIP0097_STARTED:".length))).to.deep.equal({
            network: "hardhat",
            chainId: 31337,
            networks: ["hardhat"],
        });
    });
});

describe("SIP0097 state-mutating unit before-deploy guard", function () {
    for (const [name, chainId, client] of [
        ["rskSovrynMainnet", 30, "Geth"],
        ["hardhat", 30, "HardhatNetwork/2"],
        ["hardhat", 31337, "Geth"],
    ]) {
        it(`rejects ${name}/${chainId}/${client} before the actual unit deployment hook`, function () {
            const entry = path.join(root, "tests/zero-emergency-halt/ZeroEmergencyHalt.test.js");
            const script = `
const Module=require('module'),real=require('ethers').ethers;
let deployed=false;const hooks=[];
const fake={network:{name:${JSON.stringify(name)},config:{}},ethers:{...real,getSigners:async()=>[{},{}],provider:{getNetwork:async()=>({chainId:${chainId}}),send:async()=>${JSON.stringify(client)}},getContractFactory:async()=>({deploy:async()=>{deployed=true;throw new Error('DEPLOYMENT_REACHED');}})},artifacts:{artifactExists:async()=>true}};
const load=Module._load;Module._load=function(request,parent,main){if(request==='hardhat')return fake;return load.call(this,request,parent,main);};
global.describe=(_name,fn)=>fn();global.beforeEach=fn=>hooks.push(fn);global.it=()=>{};
require(${JSON.stringify(entry)});
(async()=>{if(hooks.length!==2)throw new Error('native hooks missing');for(const hook of hooks){let error;try{await hook();}catch(e){error=e;}if(deployed||!error||!error.message.startsWith('SIP0097: isolated unit'))throw error||new Error('unsafe hook accepted');}console.log('BLOCKED_BEFORE_DEPLOYMENT');})().catch(error=>{console.error(error.message);process.exit(12)});
`;
            const result = spawnSync(process.execPath, ["-e", script], {
                cwd: root,
                env: environment(),
                encoding: "utf8",
                timeout: 30000,
            });
            expect(result.status, result.stderr).to.equal(0);
            expect(result.stdout).to.include("BLOCKED_BEFORE_DEPLOYMENT");
        });
    }
});
