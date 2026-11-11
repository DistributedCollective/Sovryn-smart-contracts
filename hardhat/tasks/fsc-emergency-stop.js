const { task } = require("hardhat/config");
const PROXY = "0x115caf168c51ed15ec535727f64684d33b7b08d1";
const WALLET = "0x924f5ad34698fd20c90fe5d5a8a0abd3b42dc711";
const IMPL = "0xccb75e444f4808012a57eb2db06648249f370d2f";
const PROXY_CODE_HASH = "0x26d04054c097cd966f9bac6f0a5decc1b0dd5029a5bb15138cdb62acc48c1e48";
const ABI = [
    "function getProxyOwner() view returns(address)",
    "function getImplementation() view returns(address)",
    "function setImplementation(address)",
];
const MS = [
    "function required() view returns(uint256)",
    "function isOwner(address) view returns(bool)",
    "function submitTransaction(address,uint256,bytes) returns(uint256)",
    "function transactions(uint256) view returns(address destination,uint256 value,bytes data,bool executed)",
    "event Submission(uint256 indexed transactionId)",
];
const same = (a, b) => a.toLowerCase() === b.toLowerCase();
const check = (ok, message) => {
    if (!ok) throw new Error(message);
};
function stopOperation(ethers, proxy) {
    proxy = ethers.utils.getAddress(proxy);
    check(proxy !== ethers.constants.AddressZero, "Zero proxy refused");
    return {
        to: proxy,
        value: 0,
        data: new ethers.utils.Interface(ABI).encodeFunctionData("setImplementation", [proxy]),
    };
}
async function emergencyStop(args, hre) {
    const { ethers } = hre;
    const proxy = args.collector || PROXY;
    const wallet = args.multisig || WALLET;
    const expected = args.implementation || IMPL;
    check(
        ethers.utils.keccak256(await ethers.provider.getCode(proxy)) === PROXY_CODE_HASH,
        "Proxy runtime is not the locally verified recoverable proxy"
    );
    const reader = new ethers.VoidSigner(wallet, ethers.provider);
    const collector = new ethers.Contract(proxy, ABI, reader);
    const ms = new ethers.Contract(wallet, MS, reader);
    const [network, owner, current, quorum] = await Promise.all([
        ethers.provider.getNetwork(),
        collector.getProxyOwner(),
        collector.getImplementation(),
        ms.required(),
    ]);
    check(network.chainId === 30, "Rootstock chain ID30 required");
    check(same(owner, wallet) && quorum.eq(3), "Wrong proxy owner or quorum");
    if (same(current, proxy)) {
        console.log("Collector is already emergency-stopped (self implementation).");
        return;
    }
    check(same(current, expected), "Implementation changed: stop and review");
    const op = stopOperation(ethers, proxy);
    check(
        (await ethers.provider.call({ from: wallet, to: proxy, data: op.data })) === "0x",
        "Owner stop simulation failed"
    );
    console.log(
        "EMERGENCY STOP: delegated collector functions will revert; proxy admin restoration remains available."
    );
    console.log(`Current implementation to preserve: ${current}`);
    console.log(JSON.stringify(op, null, 2));
    if (!args.submit) {
        console.log("DRY RUN. Add --submit to create ONE multisig proposal.");
        return op;
    }
    let signer;
    const selected = args.signer || "deployer";
    if (/^\d+$/.test(selected)) signer = (await ethers.getSigners())[Number(selected)];
    else {
        const account = ethers.utils.isAddress(selected)
            ? selected
            : (await hre.getNamedAccounts())[selected];
        check(
            typeof account === "string" && ethers.utils.isAddress(account),
            "Configured signer name/address not found"
        );
        signer = await ethers.getSigner(account);
    }
    check(
        signer && (await ms.isOwner(await signer.getAddress())),
        "Configured signer is not a multisig owner"
    );
    const signed = ms.connect(signer);
    const estimate = await signed.estimateGas.submitTransaction(proxy, 0, op.data);
    const tx = await signed.submitTransaction(proxy, 0, op.data, {
        type: 0,
        gasPrice: await ethers.provider.getGasPrice(),
        gasLimit: estimate.mul(130).div(100),
    });
    console.log(
        `Submission hash: ${tx.hash}. If interrupted, inspect this transaction before retrying.`
    );
    const receipt = await tx.wait(1);
    check(receipt.status === 1, "Submission reverted");
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
        same(stored.destination, proxy) &&
            stored.value.isZero() &&
            stored.data.toLowerCase() === op.data.toLowerCase(),
        "Stored operation mismatch"
    );
    console.log(
        `EMERGENCY STOP PROPOSAL ${id.toString()}: reach 3 confirmations and verify getImplementation() equals ${proxy}.`
    );
    console.log(
        "Do not restore the vulnerable implementation until the exploit path is contained. Whitelist-removal calls revert while stopped."
    );
    return {
        proposalId: id.toString(),
        hash: tx.hash,
        operation: op,
        originalImplementation: current,
    };
}
task("fsc:emergency-stop", "Create ONE reversible collector shutdown proposal")
    .addOptionalParam("signer", "Existing configured signer name/address/index", "deployer")
    .addOptionalParam("collector", "Collector proxy", PROXY)
    .addOptionalParam("multisig", "Proxy owner multisig", WALLET)
    .addOptionalParam("implementation", "Expected current implementation", IMPL)
    .addFlag("submit", "Create the stop proposal; first confirmation included")
    .setAction(emergencyStop);
module.exports = { stopOperation, emergencyStop };
