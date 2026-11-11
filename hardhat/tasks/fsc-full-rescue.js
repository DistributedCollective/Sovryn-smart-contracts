const { task } = require("hardhat/config");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const A = require("./feeCollectorRescueOnlyBytecode.json");
const C = "0x115caf168c51ed15ec535727f64684d33b7b08d1";
const W = "0x924f5ad34698fd20c90fe5d5a8a0abd3b42dc711";
const OLD = "0xccb75e444f4808012a57eb2db06648249f370d2f";
const PROXY_HASH = "0x26d04054c097cd966f9bac6f0a5decc1b0dd5029a5bb15138cdb62acc48c1e48";
const CODE_HASH = "0x991dd7fe89b6324de8e0647f105d241b6553a737e42bfa62fdd4625b1e8adda1";
const CREATION_HASH = "0x2b7733218e4a62a93ea51b3076e797cc426d0682d9d48063f567469b07a839b4";
const SOURCE_HASH = "4a47f64d50ee1a4bba18aab24546b67d14f5bed3dbdbe7efd0e7aac64d371ddb";
const PABI = [
    "function getProxyOwner() view returns(address)",
    "function getImplementation() view returns(address)",
    "function setImplementation(address)",
];
const MABI = [
    "function required() view returns(uint256)",
    "function isOwner(address) view returns(bool)",
    "function submitTransaction(address,uint256,bytes) returns(uint256)",
    "function transactions(uint256) view returns(address destination,uint256 value,bytes data,bool executed)",
    "event Submission(uint256 indexed transactionId)",
];
const same = (a, b) => a.toLowerCase() === b.toLowerCase();
const check = (p, m) => {
    if (!p) throw new Error(m);
};
async function configuredSigner(hre, name) {
    const { ethers } = hre;
    if (/^\d+$/.test(name)) {
        const signer = (await ethers.getSigners())[Number(name)];
        check(Boolean(signer), "Configured signer index not found");
        return signer;
    }
    const selected = ethers.utils.isAddress(name) ? name : (await hre.getNamedAccounts())[name];
    check(
        typeof selected === "string" && ethers.utils.isAddress(selected),
        "Configured signer name/address not found"
    );
    return ethers.getSigner(selected);
}
async function context(args, hre) {
    const { ethers } = hre;
    const collector = args.collector || C,
        wallet = args.multisig || W;
    check(
        ethers.utils.keccak256(A.bytecode) === CREATION_HASH &&
            ethers.utils.keccak256(A.deployedBytecode) === CODE_HASH,
        "Precompiled artifact hash mismatch"
    );
    const source = fs.readFileSync(path.resolve(__dirname, "../../", A.sourceName));
    check(
        crypto.createHash("sha256").update(source).digest("hex") === SOURCE_HASH,
        "Rescue source changed: re-review required"
    );
    check((await ethers.provider.getNetwork()).chainId === 30, "Rootstock chain30 required");
    check(
        ethers.utils.keccak256(await ethers.provider.getCode(collector)) === PROXY_HASH,
        "Unexpected proxy runtime"
    );
    const reader = new ethers.VoidSigner(wallet, ethers.provider);
    const proxy = new ethers.Contract(collector, PABI, reader),
        ms = new ethers.Contract(wallet, MABI, reader);
    const [owner, current, q] = await Promise.all([
        proxy.getProxyOwner(),
        proxy.getImplementation(),
        ms.required(),
    ]);
    check(same(owner, wallet) && q.eq(3), "Wrong proxy owner or quorum");
    const lock = ethers.utils.keccak256(
        ethers.utils.toUtf8Bytes("sovryn.feeCollector.rescueOnly.lock.v1")
    );
    check(
        (await ethers.provider.getStorageAt(collector, lock)) === ethers.constants.HashZero,
        "Rescue guard slot is not empty"
    );
    let signer;
    if (args.submit) {
        signer = await configuredSigner(hre, args.signer || "deployer");
        check(
            signer && (await ms.isOwner(await signer.getAddress())),
            "Configured signer is not a multisig owner"
        );
    }
    return { ethers, collector, wallet, reader, proxy, ms, current, signer };
}
async function propose(ctx, data) {
    const { ethers, collector, wallet, ms, signer } = ctx;
    const signed = ms.connect(signer);
    const gas = await signed.estimateGas.submitTransaction(collector, 0, data);
    const tx = await signed.submitTransaction(collector, 0, data, {
        type: 0,
        gasPrice: await ethers.provider.getGasPrice(),
        gasLimit: gas.mul(130).div(100),
    });
    console.log(`Submission ${tx.hash}; inspect this hash before retrying if interrupted.`);
    const receipt = await tx.wait(1);
    check(receipt.status === 1, "Submission failed");
    const logs = receipt.logs
        .filter((l) => same(l.address, wallet))
        .map((l) => {
            try {
                return ms.interface.parseLog(l);
            } catch (_) {
                return null;
            }
        })
        .filter((l) => l && l.name === "Submission");
    check(logs.length === 1, "Expected one wallet Submission event");
    const id = logs[0].args.transactionId;
    const stored = await ms.transactions(id);
    check(
        same(stored.destination, collector) &&
            stored.value.isZero() &&
            stored.data.toLowerCase() === data.toLowerCase(),
        "Stored proposal mismatch"
    );
    console.log(
        `MULTISIG TRANSACTION ${id.toString()}: first confirmation included; reach 3 confirmations and verify execution.`
    );
    return { proposalId: id.toString(), hash: tx.hash, data };
}
async function prepare(args, hre) {
    const ctx = await context(args, hre);
    const { ethers, proxy, current, collector, wallet, signer } = ctx;
    if (ethers.utils.keccak256(await ethers.provider.getCode(current)) === CODE_HASH) {
        console.log(`Rescue-only logic already installed: ${current}`);
        return { logic: current, alreadyInstalled: true };
    }
    check(
        same(current, OLD) || same(current, collector),
        "Unexpected old implementation: stop and review"
    );
    console.log(
        "Upgrade stops all normal delegated collector operations. Existing claims stay recorded; custody goes only to proxy owner."
    );
    console.log(
        `Approved rescue runtime ${CODE_HASH}, size ${(A.deployedBytecode.length - 2) / 2} bytes. Previous logic: ${current}`
    );
    if (!args.submit) {
        console.log(
            "DRY RUN. --submit deploys the checked logic and creates ONE upgrade transaction; it does not execute the upgrade."
        );
        return { runtimeHash: CODE_HASH };
    }
    let logic = args.logic;
    if (!logic && fs.existsSync("fsc-rescue-only-deployment.json")) {
        const saved = JSON.parse(fs.readFileSync("fsc-rescue-only-deployment.json", "utf8"));
        check(
            saved.chainId === 30 && same(saved.collector, collector) && same(saved.wallet, wallet),
            "Saved deployment belongs to another context"
        );
        check(
            ethers.utils.keccak256(await ethers.provider.getCode(saved.logic)) === CODE_HASH,
            "Saved deployment not found or changed; inspect before retrying"
        );
        logic = saved.logic;
        console.log(`Reusing saved checked deployment ${logic}`);
    }
    if (!logic) {
        const factory = new ethers.ContractFactory(A.abi, A.bytecode, signer);
        const deployed = await factory.deploy({
            type: 0,
            gasPrice: await ethers.provider.getGasPrice(),
        });
        console.log(
            `Logic deployment ${deployed.deployTransaction.hash}; address ${deployed.address}. Save it; rerun with --logic ADDRESS if interrupted.`
        );
        await deployed.deployed();
        logic = deployed.address;
        fs.writeFileSync(
            "fsc-rescue-only-deployment.json",
            JSON.stringify(
                {
                    chainId: 30,
                    collector,
                    wallet,
                    logic,
                    hash: deployed.deployTransaction.hash,
                    runtimeHash: CODE_HASH,
                    previousImplementation: current,
                },
                null,
                2
            ) + "\n",
            { mode: 0o600 }
        );
    }
    check(
        ethers.utils.keccak256(await ethers.provider.getCode(logic)) === CODE_HASH,
        "Logic runtime mismatch"
    );
    const data = proxy.interface.encodeFunctionData("setImplementation", [logic]);
    await hre.network.provider.send("eth_call", [
        { from: wallet, to: collector, data, gas: "0x2dc6c0" },
        "latest",
    ]);
    const result = await propose(ctx, data);
    console.log(
        `After quorum verify getImplementation()==${logic}, then run fsc:rescue-token. Do NOT send assets to the logic address.`
    );
    return { ...result, logic };
}
async function withdraw(args, hre) {
    const ctx = await context(args, hre);
    const { ethers, collector, wallet, current, reader } = ctx;
    check(
        ethers.utils.keccak256(await ethers.provider.getCode(current)) === CODE_HASH,
        "Rescue-only upgrade is not installed; confirm/verify it first"
    );
    const iface = new ethers.utils.Interface(A.abi);
    let data, amount;
    if (!args.token || args.token.toLowerCase() === "native") {
        amount = await ethers.provider.getBalance(collector);
        data = iface.encodeFunctionData("rescueNative");
    } else {
        const token = ethers.utils.getAddress(args.token);
        check(
            !same(token, collector) && token !== ethers.constants.AddressZero,
            "Invalid ERC20 token; use native for RBTC"
        );
        amount = await new ethers.Contract(
            token,
            ["function balanceOf(address) view returns(uint256)"],
            reader
        ).balanceOf(collector);
        data = iface.encodeFunctionData("rescueERC20", [token]);
    }
    if (amount.isZero()) {
        console.log("No balance remains for this asset.");
        return;
    }
    console.log(
        `Full current asset balance raw=${amount.toString()}, custody receiver=${wallet}. Claim ledgers remain unchanged.`
    );
    await hre.network.provider.send("eth_call", [
        { from: wallet, to: collector, data, gas: "0x2dc6c0" },
        "latest",
    ]);
    if (!args.submit) {
        console.log(JSON.stringify({ to: collector, value: 0, data }, null, 2));
        console.log("DRY RUN. --submit creates ONE asset-rescue transaction.");
        return { data, amount: amount.toString() };
    }
    const result = await propose(ctx, data);
    console.log(
        "Verify rescue event and source/recipient balances after quorum. Keep normal claims disabled until backing is restored or coherently resolved."
    );
    return result;
}
function base(name, description, action) {
    return task(name, description)
        .addOptionalParam("signer", "Existing configured signer name/address/index", "deployer")
        .addOptionalParam("collector", "Collector proxy", C)
        .addOptionalParam("multisig", "Proxy-owner custody wallet", W)
        .addFlag("submit", "Operator signs/broadcasts; default dry run")
        .setAction(action);
}
base(
    "fsc:prepare-rescue-only",
    "Deploy checked rescue-only logic and propose collector upgrade",
    prepare
).addOptionalParam("logic", "Reuse an already deployed matching implementation");
base(
    "fsc:rescue-token",
    "Propose full native or ERC20 custody transfer to proxy owner",
    withdraw
).addOptionalParam("token", "ERC20 address, or native for RBTC", "native");
module.exports = { prepare, withdraw, configuredSigner, CODE_HASH, CREATION_HASH };
