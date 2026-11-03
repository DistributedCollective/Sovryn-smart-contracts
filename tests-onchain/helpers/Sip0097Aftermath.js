/* Bounded benign local-fork controls. Production RPC is never a send destination. */
const assert = require("assert");
const fs = require("fs");
const { ethers } = require("ethers");
const sip = require("../../hardhat/tasks/sips/args/sip0097");
require("../../scripts/zero-emergency-halt/keyless").assertNoSigningInputs();
const A = {
    masset: "0x1440d19436bEeaF8517896bffB957a88EC95a00F",
    xusd: "0xb5999795BE0EbB5bAb23144AA5FD6A02D080299F",
    doc: "0xe700691dA7b9851F2F35f8b8182c69c53CcaD9Db",
    dllr: "0xc1411567d2670e24d9C4DaAa7CdA95686e1250AA",
    zusd: "0xdB107FA69E33f05180a4C2cE9c2E7CB481645C2d",
    mynt: "0x5F777270259E32F79589fe82269DB6209F7b7582",
    reward: "0x7535e61FC42392C578D90268358b94649f9B4193",
    fees: "0xB424B283276bF63C35d98346632AF1802e196D9B",
};
const HOLDERS = {
    doc: "0x88f3b6181fe81cbb23761d311022c1d35c7fbf3a",
    dllr: "0x94a0b23396109cdc7bf51b342152517690efcc47",
    zusd: "0x5f9c0d6971b3efca2301f49645001fc76ba55b40",
};
const E = [
    "function balanceOf(address) view returns(uint256)",
    "function totalSupply() view returns(uint256)",
    "function allowance(address,address) view returns(uint256)",
    "function transfer(address,uint256) returns(bool)",
    "function approve(address,uint256) returns(bool)",
    "function transferFrom(address,address,uint256) returns(bool)",
];
const M = [
    "function mint(address,uint256) returns(uint256)",
    "function redeem(address,uint256) returns(uint256)",
];
const HALT = "0xe0e757e8fcf336658036202834aee10ce03debda";
const amount = ethers.utils.parseEther;
let ctx;
const digest = (x) => ethers.utils.keccak256(ethers.utils.toUtf8Bytes(JSON.stringify(x)));
function mapSlot(a, s) {
    return ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["address", "uint256"], [a, s])
    );
}
function allowanceSlot(a, b, s) {
    return ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["address", "bytes32"], [b, mapSlot(a, s)])
    );
}
async function localGuard() {
    const { provider, guard } = ctx;
    await guard();
    await sip.assertLocalFork(
        {
            network: { config: { url: provider.connection.url } },
            ethers: { provider },
        },
        sip.MANIFEST
    );
}

async function ledger() {
    const { provider, who, other, c } = ctx;
    const r = {};
    for (const name of ["doc", "dllr", "xusd"]) {
        r[name] = {
            supply: (await c[name].totalSupply()).toString(),
            balances: {},
            allowances: {},
        };
        for (const [n, a] of Object.entries({
            actor: who,
            other,
            masset: A.masset,
            mynt: A.mynt,
            reward: A.reward,
            fees: A.fees,
            holder: HOLDERS[name] || HOLDERS.doc,
        }))
            r[name].balances[n] = (await c[name].balanceOf(a)).toString();
        for (const [n, a] of Object.entries({ masset: A.masset, mynt: A.mynt, other }))
            r[name].allowances[n] = (await c[name].allowance(who, a)).toString();
    }
    r.zusd = { slots: {}, balances: {}, allowances: {} };
    for (const i of [0, 51, 52, 53, 54, 55, 59, 60, 61])
        r.zusd.slots[i] = await provider.getStorageAt(A.zusd, i);
    for (const [n, a] of Object.entries({
        actor: who,
        other,
        mynt: A.mynt,
        masset: A.masset,
        holder: HOLDERS.zusd,
    }))
        r.zusd.balances[n] = await provider.getStorageAt(A.zusd, mapSlot(a, 57));
    r.zusd.allowances.mynt = await provider.getStorageAt(A.zusd, allowanceSlot(who, A.mynt, 58));
    return r;
}
async function invoke(label, contract, method, args = [], signer = ctx.actor) {
    await localGuard();
    return ctx.tx(label, contract, method, args, signer, { gasLimit: 3000000 });
}
async function initialize({ provider, actor, guard, tx }) {
    assert(!ctx, "already initialized");
    ctx = { provider, actor, guard, tx };
    await localGuard();
    ctx.who = await actor.getAddress();
    ctx.other = await provider.getSigner(1).getAddress();
    assert.notEqual(ctx.who.toLowerCase(), ctx.other.toLowerCase());
    ctx.otherSigner = provider.getSigner(ctx.other);
    ctx.c = {};
    for (const name of ["doc", "dllr", "xusd", "zusd"])
        ctx.c[name] = new ethers.Contract(A[name], E, provider);
    ctx.c.masset = new ethers.Contract(A.masset, M, provider);
    ctx.c.mynt = new ethers.Contract(A.mynt, M, provider);
    ctx.c.reward = new ethers.Contract(
        A.reward,
        ["function getPenaltyForWithdrawal(address,uint256) view returns(uint256)"],
        provider
    );
    ctx.c.feeManager = new ethers.Contract(
        "0x36C6f1B5E9de57A59B41778A36f3DD9ed1851832",
        [
            "function calculateDepositFee(uint256) view returns(uint256)",
            "function calculateRedeemFee(uint256) view returns(uint256)",
        ],
        provider
    );
    const before = await ledger();
    const receipts = [];
    for (const name of ["doc", "dllr", "zusd"]) {
        const holder = HOLDERS[name];
        assert.equal(await provider.getCode(holder), "0x", "fixture holder must be EOA");
        assert(
            (await ctx.c[name].balanceOf(holder)).gte(amount("2")),
            "insufficient genuine holder balance"
        );
        const holderBefore = await ctx.c[name].balanceOf(holder);
        const actorBefore = await ctx.c[name].balanceOf(ctx.who);
        const supplyBefore = await ctx.c[name].totalSupply();
        await localGuard();
        await provider.send("anvil_setBalance", [holder, ethers.utils.hexValue(amount("1"))]);
        await localGuard();
        await provider.send("anvil_impersonateAccount", [holder]);
        try {
            receipts.push(
                await invoke(
                    `aftermath.fixture.${name}.holderTransfer`,
                    ctx.c[name],
                    "transfer",
                    [ctx.who, amount("2")],
                    provider.getSigner(holder)
                )
            );
        } finally {
            await localGuard();
            await provider.send("anvil_stopImpersonatingAccount", [holder]);
        }
        assert((await ctx.c[name].balanceOf(holder)).eq(holderBefore.sub(amount("2"))));
        assert((await ctx.c[name].balanceOf(ctx.who)).eq(actorBefore.add(amount("2"))));
        assert((await ctx.c[name].totalSupply()).eq(supplyBefore));
    }
    for (const name of ["doc", "dllr"])
        receipts.push(
            await invoke(`aftermath.fixture.${name}.approveBF`, ctx.c[name], "approve", [
                A.masset,
                amount("1"),
            ])
        );
    for (const name of ["doc", "zusd", "dllr"])
        receipts.push(
            await invoke(`aftermath.fixture.${name}.approveMynt`, ctx.c[name], "approve", [
                A.mynt,
                amount("1"),
            ])
        );
    receipts.push(
        await invoke("aftermath.fixture.mintXUSDordinaryDOC", ctx.c.masset, "mint", [
            A.doc,
            amount("0.1"),
        ])
    );
    // Source storage calibration keeps later halted-ZUSD accounting checks honest.
    assert(
        ethers.BigNumber.from(await provider.getStorageAt(A.zusd, 51)).eq(
            await ctx.c.zusd.totalSupply()
        ),
        "ZUSD supply slot mismatch"
    );
    assert(
        ethers.BigNumber.from(await provider.getStorageAt(A.zusd, mapSlot(ctx.who, 57))).eq(
            await ctx.c.zusd.balanceOf(ctx.who)
        ),
        "ZUSD balance slot mismatch"
    );
    assert(
        ethers.BigNumber.from(
            await provider.getStorageAt(A.zusd, allowanceSlot(ctx.who, A.mynt, 58))
        ).eq(await ctx.c.zusd.allowance(ctx.who, A.mynt)),
        "ZUSD allowance slot mismatch"
    );
    const after = await ledger();
    return {
        utc: new Date().toISOString(),
        sourceBlock: 9380535,
        actor: ctx.who,
        recipient: ctx.other,
        holders: HOLDERS,
        fixture:
            "Existing EOA holder transfers of two genuine units each, native gas funding only; XUSD obtained by ordinary 0.1 DOC mint. No protocol reserve extraction, code/storage edits, ownership changes or fake token mint.",
        before,
        after,
        receiptHashes: receipts.map((r) => r.transactionHash),
    };
}
async function controls(stage, { zeroHalted }) {
    await localGuard();
    const { provider, c, who, other, otherSigner } = ctx;
    const snap = await provider.send("evm_snapshot", []);
    const rows = [];
    const stageBefore = await ledger();
    async function ok(name, contract, method, args, signer) {
        const r = await invoke(`aftermath.${stage}.${name}`, contract, method, args, signer);
        assert.equal(r.status, 1);
        rows.push({
            name,
            expected: "success",
            status: 1,
            hash: r.transactionHash,
            gasUsed: r.gasUsed.toString(),
        });
        return r;
    }
    async function atomicFailure(name, contract, method, args) {
        const before = await ledger();
        let receipt, error;
        try {
            await invoke(`aftermath.${stage}.${name}`, contract, method, args);
            throw Error("unexpected success");
        } catch (e) {
            if (e.message === "unexpected success") throw e;
            receipt = e.receipt;
            error = e.reason || e.message;
        }
        assert(receipt && receipt.status === 0, "revert must have an actual local receipt");
        assert.equal(receipt.logs.length, 0, "reverted call retained logs");
        const after = await ledger();
        assert.deepStrictEqual(
            after,
            before,
            `${name}: residual supply/custody/allowance mutation`
        );
        const trace = await provider.send("debug_traceTransaction", [
            receipt.transactionHash,
            { tracer: "callTracer" },
        ]);
        const hits = [];
        function walk(n) {
            if ((n.to || "").toLowerCase() === HALT) {
                assert.equal(n.type, "DELEGATECALL");
                const encoded =
                    "0x08c379a0" +
                    ethers.utils.defaultAbiCoder
                        .encode(["string"], ["Zero: emergency shutdown"])
                        .slice(2);
                assert.equal(n.output, encoded, "wrong halt revert reason");
                hits.push({
                    type: n.type,
                    from: n.from,
                    to: n.to,
                    input: n.input,
                    output: n.output,
                    error: n.error,
                });
            }
            for (const ch of n.calls || []) walk(ch);
        }
        walk(trace);
        assert(hits.length > 0, "failed path did not reach actual deployed Zero halt");
        rows.push({
            name,
            expected: "atomic revert",
            status: 0,
            hash: receipt.transactionHash,
            gasUsed: receipt.gasUsed.toString(),
            ledgerHash: digest(before),
            error,
            haltHits: hits,
            trace,
        });
    }
    try {
        const supply = await c.xusd.totalSupply(),
            actorBal = await c.xusd.balanceOf(who),
            recipientBal = await c.xusd.balanceOf(other);
        await ok("xusd.transfer", c.xusd, "transfer", [other, amount("0.0001")]);
        assert((await c.xusd.balanceOf(who)).eq(actorBal.sub(amount("0.0001"))));
        assert((await c.xusd.balanceOf(other)).eq(recipientBal.add(amount("0.0001"))));
        await ok("xusd.approve", c.xusd, "approve", [other, amount("0.0001")]);
        assert((await c.xusd.allowance(who, other)).eq(amount("0.0001")));
        await ok(
            "xusd.transferFrom",
            c.xusd,
            "transferFrom",
            [who, other, amount("0.0001")],
            otherSigner
        );
        assert((await c.xusd.allowance(who, other)).eq(0));
        assert((await c.xusd.totalSupply()).eq(supply));
        for (const token of ["doc", "dllr"]) {
            const before = await ledger();
            await ok(`babelfish.${token}.mint`, c.masset, "mint", [A[token], amount("0.001")]);
            const after = await ledger();
            assert.equal(
                ethers.BigNumber.from(before[token].balances.actor)
                    .sub(after[token].balances.actor)
                    .toString(),
                amount("0.001").toString()
            );
            assert.equal(
                ethers.BigNumber.from(after[token].balances.masset)
                    .sub(before[token].balances.masset)
                    .toString(),
                amount("0.001").toString()
            );
            assert.equal(
                ethers.BigNumber.from(after.xusd.supply).sub(before.xusd.supply).toString(),
                amount("0.001").toString()
            );
            const redeemAmount = amount("0.0005");
            const penalty = await c.reward.getPenaltyForWithdrawal(A[token], redeemAmount);
            const redeemBefore = await ledger();
            await ok(`babelfish.${token}.redeem`, c.masset, "redeem", [A[token], redeemAmount]);
            const redeemAfter = await ledger();
            const payout = redeemAmount.sub(penalty);
            assert.equal(
                ethers.BigNumber.from(redeemAfter[token].balances.actor)
                    .sub(redeemBefore[token].balances.actor)
                    .toString(),
                payout.toString()
            );
            assert.equal(
                ethers.BigNumber.from(redeemBefore[token].balances.masset)
                    .sub(redeemAfter[token].balances.masset)
                    .toString(),
                payout.toString()
            );
            assert.equal(
                ethers.BigNumber.from(redeemBefore.xusd.balances.actor)
                    .sub(redeemAfter.xusd.balances.actor)
                    .toString(),
                redeemAmount.toString()
            );
            assert.equal(
                ethers.BigNumber.from(redeemBefore.xusd.supply)
                    .sub(redeemAfter.xusd.supply)
                    .toString(),
                payout.toString()
            );
            assert.equal(
                ethers.BigNumber.from(redeemAfter.xusd.balances.reward)
                    .sub(redeemBefore.xusd.balances.reward)
                    .toString(),
                penalty.toString()
            );
        }
        await ok("dllr.transfer", c.dllr, "transfer", [other, amount("0.0001")]);
        for (const token of ["doc", "zusd"])
            for (const method of ["mint", "redeem"]) {
                const args = [A[token], amount("0.0005")];
                if (zeroHalted)
                    await atomicFailure(`mynt.${token}.${method}`, c.mynt, method, args);
                else {
                    const qty = args[1],
                        fee =
                            await c.feeManager[
                                method === "mint" ? "calculateDepositFee" : "calculateRedeemFee"
                            ](qty);
                    const before = await ledger();
                    const underlyingBefore = await c[token].balanceOf(who),
                        custodyBefore = await c[token].balanceOf(A.mynt);
                    await ok(`mynt.${token}.${method}`, c.mynt, method, args);
                    const after = await ledger();
                    const underlyingAfter = await c[token].balanceOf(who),
                        custodyAfter = await c[token].balanceOf(A.mynt);
                    if (method === "mint") {
                        assert(underlyingBefore.sub(underlyingAfter).eq(qty));
                        assert(custodyAfter.sub(custodyBefore).eq(qty));
                        assert(
                            ethers.BigNumber.from(after.dllr.supply)
                                .sub(before.dllr.supply)
                                .eq(qty)
                        );
                        assert(
                            ethers.BigNumber.from(after.dllr.balances.actor)
                                .sub(before.dllr.balances.actor)
                                .eq(qty.sub(fee))
                        );
                    } else {
                        assert(underlyingAfter.sub(underlyingBefore).eq(qty.sub(fee)));
                        assert(custodyBefore.sub(custodyAfter).eq(qty.sub(fee)));
                        assert(
                            ethers.BigNumber.from(before.dllr.supply)
                                .sub(after.dllr.supply)
                                .eq(qty.sub(fee))
                        );
                        assert(
                            ethers.BigNumber.from(before.dllr.balances.actor)
                                .sub(after.dllr.balances.actor)
                                .eq(qty)
                        );
                    }
                    assert(
                        ethers.BigNumber.from(after.dllr.balances.fees)
                            .sub(before.dllr.balances.fees)
                            .eq(fee)
                    );
                }
            }
        if (zeroHalted)
            await atomicFailure("zusd.transfer", c.zusd, "transfer", [other, amount("0.0001")]);
        else await ok("zusd.transfer", c.zusd, "transfer", [other, amount("0.0001")]);
        const after = await ledger();
        return {
            utc: new Date().toISOString(),
            stage,
            zeroHalted,
            rows,
            before: stageBefore,
            after,
            snapshotReverted: true,
        };
    } finally {
        await localGuard();
        assert(
            await provider.send("evm_revert", [snap]),
            "failed to restore stage control snapshot"
        );
        assert.deepStrictEqual(
            await ledger(),
            stageBefore,
            "control snapshot did not restore fixture accounting"
        );
    }
}
module.exports = { initialize, controls, addresses: A, holders: HOLDERS };
