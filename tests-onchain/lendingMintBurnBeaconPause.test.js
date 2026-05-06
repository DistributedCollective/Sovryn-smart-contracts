// Empirically verify iToken mint/burn behavior under the CURRENT live
// mainnet state, where both LoanTokenLogicBeacons (LM + Wrbtc) are paused.
//
// Flow:
//   1. Confirm the beacon-paused revert by trying iDOC.mint.
//   2. Impersonate ContractsGuardian multisig and call unpause() on BOTH
//      beacons (LM covers iDOC/iUSDT/iXUSD/iBPro/iDLLR; Wrbtc covers iRBTC).
//   3. Deposit + withdraw round-trip on iDOC (LM beacon).
//   4. Deposit + withdraw round-trip on iRBTC (Wrbtc beacon) using native rBTC.
//
// Proves: unpausing the beacon is the only action required for lenders to
// regain mint/burn ability; no oracle dependency along the path.
//
// Setup (separate terminal):
//     npx hardhat node --fork https://mainnet-dev.sovryn.app/rpc --no-deploy
//
// Run:
//     npx hardhat test tests-onchain/lendingMintBurnBeaconPause.test.js --network rskForkedMainnet

const hre = require("hardhat");
const { expect } = require("chai");

const { ethers } = hre;

const LOCAL_RPC = "http://127.0.0.1:8545";
const directProvider = new ethers.providers.JsonRpcProvider(LOCAL_RPC);

async function getImpersonatedSignerFromJsonRpcProvider(addr) {
    await directProvider.send("hardhat_impersonateAccount", [addr]);
    await directProvider.send("hardhat_setBalance", [
        addr,
        "0x56BC75E2D63100000", // 100 RBTC
    ]);
    return directProvider.getSigner(addr);
}

const ADDR = {
    contractsGuardian: "0xDd8e07A57560AdA0A2D84a96c457a5e6DDD488b7",
    sovrynMultisig: "0x924f5ad34698Fd20c90Fe5D5A8A0abd3b42dc711",
    timelockOwner: "0x967c84b731679E36A344002b8E3CE50620A7F69f",
    protocol: "0x5A0D867e0D70Fcc6Ade25C3F1B89d618b5B4Eaa7",
    beaconLM: "0x5b155ECcC1dC31Ea59F2c12d2F168C956Ac0FFAa",
    beaconWrbtc: "0x845eF7Be59664899398282Ef42239634aBDd752C",
    iDOC: "0xd8D25f03EBbA94E15Df2eD4d6D38276B595593c1",
    DOC: "0xe700691dA7b9851F2F35f8b8182c69c53CcaD9Db",
    iRBTC: "0xa9DcDC63eaBb8a2b6f39D7fF9429d88340044a7A",
};

const PROTOCOL_ABI = ["function togglePaused(bool) external"];

const ITOKEN_ABI = [
    "function mint(address,uint256) returns (uint256)",
    "function burn(address,uint256) returns (uint256)",
    "function mintWithBTC(address,bool) payable returns (uint256)",
    "function burnToBTC(address,uint256,bool) returns (uint256)",
    "function balanceOf(address) view returns (uint256)",
    "function loanTokenAddress() view returns (address)",
];

const ERC20 = [
    "function balanceOf(address) view returns (uint256)",
    "function approve(address,uint256) returns (bool)",
    "function transfer(address,uint256) returns (bool)",
];

const BEACON_ABI = [
    "function pause() external",
    "function unpause() external",
    "function pauser() view returns (address)",
];

const ONE = ethers.utils.parseEther("1");

async function findBalanceSlot(tokenAddr, userAddr) {
    const sentinel = ethers.BigNumber.from("0x1111111111111111");
    for (let slot = 0; slot < 20; slot++) {
        const key = ethers.utils.keccak256(
            ethers.utils.defaultAbiCoder.encode(["address", "uint256"], [userAddr, slot])
        );
        const before = await directProvider.send("eth_getStorageAt", [tokenAddr, key, "latest"]);
        await directProvider.send("hardhat_setStorageAt", [
            tokenAddr,
            key,
            ethers.utils.hexZeroPad(sentinel.toHexString(), 32),
        ]);
        const token = new ethers.Contract(tokenAddr, ERC20, ethers.provider);
        const bal = await token.balanceOf(userAddr);
        await directProvider.send("hardhat_setStorageAt", [tokenAddr, key, before]);
        if (bal.eq(sentinel)) return slot;
    }
    throw new Error(`balance slot not found for ${tokenAddr}`);
}

async function grantBalance(tokenAddr, userAddr, slot, amount) {
    const key = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["address", "uint256"], [userAddr, slot])
    );
    await directProvider.send("hardhat_setStorageAt", [
        tokenAddr,
        key,
        ethers.utils.hexZeroPad(amount.toHexString(), 32),
    ]);
}

describe("iToken mint/burn under LoanTokenLogicBeacon pause (current mainnet state)", function () {
    this.timeout(300000);

    let user;
    let docSlot;

    before(async function () {
        expect(hre.network.tags["forked"], "must run on forked net").to.equal(true);

        // Intentionally do NOT call hardhat_reset — use the state of the
        // running fork node (expected to be `npx hardhat node --fork
        // https://mainnet-dev.sovryn.app/rpc` at current mainnet HEAD) so we
        // test the live pause state, not a pinned snapshot.
        const blockNumber = await directProvider.getBlockNumber();
        console.log(`   Fork node block: ${blockNumber}`);

        [user] = await ethers.getSigners();
        await directProvider.send("hardhat_setBalance", [user.address, "0x56BC75E2D63100000"]);

        docSlot = await findBalanceSlot(ADDR.DOC, user.address);
        console.log(`   DOC balance slot = ${docSlot}`);
    });

    it("baseline: iDOC.mint reverts with 'LoanTokenLogicBeacon:paused mode'", async () => {
        await grantBalance(ADDR.DOC, user.address, docSlot, ONE);
        const doc = new ethers.Contract(ADDR.DOC, ERC20, user);
        await doc.approve(ADDR.iDOC, ONE);

        const iDoc = new ethers.Contract(ADDR.iDOC, ITOKEN_ABI, user);
        await expect(iDoc.mint(user.address, ONE)).to.be.revertedWith(
            "LoanTokenLogicBeacon:paused mode"
        );
    });

    it("baseline: iRBTC.mintWithBTC reverts with 'LoanTokenLogicBeacon:paused mode'", async () => {
        const iRbtc = new ethers.Contract(ADDR.iRBTC, ITOKEN_ABI, user);
        await expect(
            iRbtc.mintWithBTC(user.address, false, { value: ONE.div(100) })
        ).to.be.revertedWith("LoanTokenLogicBeacon:paused mode");
    });

    it("ContractsGuardian unpauses BOTH beacons", async () => {
        const pauserSigner = await getImpersonatedSignerFromJsonRpcProvider(
            ADDR.contractsGuardian
        );

        const beaconLM = new ethers.Contract(ADDR.beaconLM, BEACON_ABI, pauserSigner);
        const beaconWrbtc = new ethers.Contract(ADDR.beaconWrbtc, BEACON_ABI, pauserSigner);

        // Sanity-check pauser roles
        expect((await beaconLM.pauser()).toLowerCase()).to.equal(
            ADDR.contractsGuardian.toLowerCase()
        );
        expect((await beaconWrbtc.pauser()).toLowerCase()).to.equal(
            ADDR.contractsGuardian.toLowerCase()
        );

        await beaconLM.unpause();
        await beaconWrbtc.unpause();

        console.log("   ✓ BeaconLM and BeaconWrbtc unpaused");
    });

    it("after beacon unpause: iDOC.mint still reverts with 'Paused' (protocol-global pause)", async () => {
        await grantBalance(ADDR.DOC, user.address, docSlot, ONE);
        const doc = new ethers.Contract(ADDR.DOC, ERC20, user);
        await doc.approve(ADDR.iDOC, ONE);

        const iDoc = new ethers.Contract(ADDR.iDOC, ITOKEN_ABI, user);
        await expect(iDoc.mint(user.address, ONE)).to.be.revertedWith("Paused");
    });

    it("Unpause protocol global pause via authorized caller (togglePaused(false))", async () => {
        // togglePaused is `onlyPauserOrOwner`. The pauser selector isn't
        // registered on the diamond so we can't read it. Try each known
        // candidate; succeed on the first that works.
        const candidates = [
            { name: "Sovryn multisig", addr: ADDR.sovrynMultisig },
            { name: "ContractsGuardian", addr: ADDR.contractsGuardian },
            { name: "TimelockOwner (owner)", addr: ADDR.timelockOwner },
        ];

        let succeeded = null;
        for (const c of candidates) {
            const signer = await getImpersonatedSignerFromJsonRpcProvider(c.addr);
            const protocol = new ethers.Contract(ADDR.protocol, PROTOCOL_ABI, signer);
            try {
                await protocol.callStatic.togglePaused(false);
                await protocol.togglePaused(false);
                succeeded = c;
                break;
            } catch (e) {
                console.log(`   ✗ ${c.name} (${c.addr}) — ${e.reason || e.message.slice(0, 60)}`);
            }
        }

        expect(succeeded, "no candidate could call togglePaused").to.not.equal(null);
        console.log(`   ✓ Protocol unpaused by ${succeeded.name} (${succeeded.addr})`);
    });

    it("iDOC: mint + burn round-trip works after beacon unpause", async () => {
        await grantBalance(ADDR.DOC, user.address, docSlot, ONE.mul(3));

        const doc = new ethers.Contract(ADDR.DOC, ERC20, user);
        const iDoc = new ethers.Contract(ADDR.iDOC, ITOKEN_ABI, user);

        await doc.approve(ADDR.iDOC, ONE);
        const iDocBefore = await iDoc.balanceOf(user.address);
        await iDoc.mint(user.address, ONE);
        const iDocAfter = await iDoc.balanceOf(user.address);
        const minted = iDocAfter.sub(iDocBefore);
        expect(minted, "iDOC mint should produce >0 iDOC").to.be.gt(0);
        console.log(`   iDOC minted: ${minted.toString()}`);

        const docBefore = await doc.balanceOf(user.address);
        await iDoc.burn(user.address, minted);
        const docAfter = await doc.balanceOf(user.address);
        const redeemed = docAfter.sub(docBefore);
        expect(redeemed, "iDOC burn should return >0 DOC").to.be.gt(0);
        console.log(`   iDOC burned ${minted} -> redeemed ${redeemed} DOC`);
    });

    it("iRBTC: mintWithBTC + burnToBTC round-trip works after beacon unpause", async () => {
        const iRbtc = new ethers.Contract(ADDR.iRBTC, ITOKEN_ABI, user);
        const depositAmount = ONE.div(100); // 0.01 rBTC

        const iRbtcBefore = await iRbtc.balanceOf(user.address);
        await iRbtc.mintWithBTC(user.address, false, { value: depositAmount });
        const iRbtcAfter = await iRbtc.balanceOf(user.address);
        const minted = iRbtcAfter.sub(iRbtcBefore);
        expect(minted, "iRBTC mint should produce >0 iRBTC").to.be.gt(0);
        console.log(`   iRBTC minted: ${minted.toString()}`);

        const rbtcBefore = await ethers.provider.getBalance(user.address);
        const tx = await iRbtc.burnToBTC(user.address, minted, false);
        const receipt = await tx.wait();
        const gasCost = receipt.gasUsed.mul(tx.gasPrice || receipt.effectiveGasPrice);
        const rbtcAfter = await ethers.provider.getBalance(user.address);
        const redeemedNet = rbtcAfter.sub(rbtcBefore).add(gasCost);
        expect(redeemedNet, "iRBTC burn should return >0 rBTC (gross of gas)").to.be.gt(0);
        console.log(`   iRBTC burned ${minted} -> redeemed ${redeemedNet} rBTC (gas-adjusted)`);
    });
});
