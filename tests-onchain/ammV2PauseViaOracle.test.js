// Validate operational behavior of the shared RBTC-side MoC-wrapper adapter
// at 0x4106e4Bb…e789, which is consumed by the rUSDT/RBTC, DoC/RBTC, and
// BPro/RBTC V2 pools. Exercises two scenarios:
//   1. Safe replacement — swapping mocOracleAddress to a different medianizer
//      that reports the same price (MockMoCMedianizer). Adapter output and
//      downstream pool quotes must stay within a tight tolerance.
//   2. Break-glass swap halt — swapping mocOracleAddress to a medianizer
//      that reports hasValue=false (DummyMoCMedianizer). Adapter reverts;
//      all three pool converters revert on swap quotes; LP deposit math is
//      empirically shown to be oracle-independent and thus continues to
//      function (though exits may still incur normal V2 fees and any pool
//      divergence loss — see round-trip test for quantified values).
//
// Setup (separate terminal):
//     npx hardhat node --fork https://mainnet-dev.sovryn.app/rpc --no-deploy
//
// Run:
//     npx hardhat test tests-onchain/ammV2PauseViaOracle.test.js --network rskForkedMainnet

const hre = require("hardhat");
const { expect } = require("chai");

const { ethers } = hre;

// Bypass hardhat-ethers HDWallet provider (which rejects impersonated accounts)
// by talking straight to the local fork node.
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

const FORK_BLOCK = 8746396;

const ADDR = {
    sovrynMultisig: "0x924f5ad34698Fd20c90Fe5D5A8A0abd3b42dc711",
    rbtcOracleAdapter: "0x4106e4Bb0C339cf7e8adc64Cf889F261Fef1e789",
    mocMedianizer: "0x972a21C61B436354C0F35836195D7B67f54E482C",
    fallbackOracle: "0x16261C66D8D687600E5CbF7945986044A6569cBe",
    converters: {
        USDT: "0x448c2474b255576554EeD36c24430ccFac131cE3",
        DOC: "0xd715192612F03D20BaE53a5054aF530C9Bb0fA3f",
        BPRO: "0x26463990196B74aD5644865E4d4567E4A411e065",
    },
    reserves: {
        WRBTC: "0x542fDA317318eBF1d3DEAf76E0b632741A7e677d",
        rUSDT: "0xef213441A85dF4d7ACbDaE0Cf78004e1E486bB96",
        DOC: "0xe700691dA7b9851F2F35f8b8182c69c53CcaD9Db",
        BPro: "0x440CD83C160De5C96Ddb20246815eA44C7aBBCa8",
    },
};

const SECONDARY_FOR = {
    USDT: ADDR.reserves.rUSDT,
    DOC: ADDR.reserves.DOC,
    BPRO: ADDR.reserves.BPro,
};

const MOC_ADAPTER_ABI = [
    "function mocOracleAddress() view returns (address)",
    "function setMoCOracleAddress(address) external",
    "function latestAnswer() view returns (int256)",
];

const CONVERTER_ABI = [
    "function targetAmountAndFee(address,address,uint256) view returns (uint256,uint256)",
    "function addLiquidity(address,uint256,uint256) external",
    "function removeLiquidity(address,uint256,uint256) external",
    "function removeLiquidityReturnAndFee(address,uint256) view returns (uint256,uint256)",
    "function reserveBalance(address) view returns (uint256)",
    "function priceOracle() view returns (address)",
    "function isActive() view returns (bool)",
    "function poolToken(address) view returns (address)",
    "function reserveStakedBalance(address) view returns (uint256)",
    "function liquidationLimit(address) view returns (uint256)",
];

const LP_TOKEN_ABI = [
    "function balanceOf(address) view returns (uint256)",
    "function totalSupply() view returns (uint256)",
];

const WRBTC_ABI = [
    "function deposit() payable",
    "function approve(address,uint256) returns (bool)",
    "function balanceOf(address) view returns (uint256)",
];

const ONE_RBTC = ethers.utils.parseEther("1.0");
const SAMPLE_IN = ONE_RBTC.div(1000); // 0.001 WRBTC
const QUOTE_TOLERANCE_BPS = 1; // 0.01%

function absDiff(a, b) {
    return a.gte(b) ? a.sub(b) : b.sub(a);
}

function diffBps(a, b) {
    if (a.isZero()) {
        return b.isZero() ? ethers.constants.Zero : ethers.constants.MaxUint256;
    }
    return absDiff(a, b).mul(10000).div(a);
}

async function fundAccount(addr) {
    await directProvider.send("hardhat_setBalance", [
        addr,
        "0x56BC75E2D63100000", // 100 RBTC
    ]);
}

describe("AMM v2 shared RBTC adapter: safe replacement and break-glass swap halt", function () {
    this.timeout(300000);

    let adapter, adapterAsMultisig;
    let user, wrbtc;

    async function getPoolQuotes() {
        const quotes = {};
        for (const name of Object.keys(ADDR.converters)) {
            const conv = new ethers.Contract(ADDR.converters[name], CONVERTER_ABI, user);
            const [out] = await conv.targetAmountAndFee(
                ADDR.reserves.WRBTC,
                SECONDARY_FOR[name],
                SAMPLE_IN
            );
            quotes[name] = out;
        }
        return quotes;
    }

    before(async function () {
        expect(hre.network.tags["forked"], "must run on forked net").to.equal(true);

        await hre.network.provider.request({
            method: "hardhat_reset",
            params: [
                {
                    forking: {
                        jsonRpcUrl: "https://mainnet-dev.sovryn.app/rpc",
                        blockNumber: FORK_BLOCK,
                    },
                },
            ],
        });

        [user] = await ethers.getSigners();
        await fundAccount(user.address);

        const multisigSigner = await getImpersonatedSignerFromJsonRpcProvider(ADDR.sovrynMultisig);

        adapter = new ethers.Contract(ADDR.rbtcOracleAdapter, MOC_ADAPTER_ABI, user);
        adapterAsMultisig = adapter.connect(multisigSigner);
        wrbtc = new ethers.Contract(ADDR.reserves.WRBTC, WRBTC_ABI, user);
    });

    it("baseline: adapter wraps MoCMedianizer, all 3 pools quote", async () => {
        expect((await adapter.mocOracleAddress()).toLowerCase()).to.equal(
            ADDR.mocMedianizer.toLowerCase()
        );
        const priceBefore = await adapter.latestAnswer();
        expect(priceBefore).to.be.gt(0);
        console.log(
            `   adapter.latestAnswer() = ${ethers.utils.formatEther(priceBefore)} BTC/USD`
        );

        for (const name of Object.keys(ADDR.converters)) {
            const conv = new ethers.Contract(ADDR.converters[name], CONVERTER_ABI, user);
            expect(await conv.isActive()).to.equal(true);
            const [out] = await conv.targetAmountAndFee(
                ADDR.reserves.WRBTC,
                SECONDARY_FOR[name],
                SAMPLE_IN
            );
            console.log(`   ${name}: 0.001 WRBTC -> ${out.toString()} secondary reserve`);
            expect(out).to.be.gt(0);
        }
    });

    it("safe replacement: compatible medianizer with same price keeps adapter and pool quotes stable", async () => {
        const priceBefore = await adapter.latestAnswer();
        const quotesBefore = await getPoolQuotes();

        const MockMoCMedianizer = await ethers.getContractFactory("MockMoCMedianizer");
        const replacementMedianizer = await MockMoCMedianizer.deploy(priceBefore);
        await replacementMedianizer.deployed();

        await adapterAsMultisig.setMoCOracleAddress(replacementMedianizer.address);
        expect((await adapter.mocOracleAddress()).toLowerCase()).to.equal(
            replacementMedianizer.address.toLowerCase()
        );

        const priceAfter = await adapter.latestAnswer();
        expect(priceAfter).to.equal(priceBefore);

        const quotesAfter = await getPoolQuotes();
        for (const name of Object.keys(quotesBefore)) {
            const driftBps = diffBps(quotesBefore[name], quotesAfter[name]);
            console.log(
                `   ${name}: quote_before=${quotesBefore[name]} quote_after=${quotesAfter[name]} drift_bps=${driftBps.toString()}`
            );
            expect(
                driftBps.lte(QUOTE_TOLERANCE_BPS),
                `${name} quote drift after compatible oracle replacement exceeds tolerance`
            ).to.equal(true);
        }

        await adapterAsMultisig.setMoCOracleAddress(ADDR.mocMedianizer);
        expect((await adapter.mocOracleAddress()).toLowerCase()).to.equal(
            ADDR.mocMedianizer.toLowerCase()
        );
    });

    it("break-glass pause: swapping mocOracleAddress to DummyMoCMedianizer makes adapter.latestAnswer revert", async () => {
        const DummyMoCMedianizer = await ethers.getContractFactory("DummyMoCMedianizer");
        const dummy = await DummyMoCMedianizer.deploy();
        await dummy.deployed();

        // peek() returns (bytes32(0), false) — consumer treats feed as unavailable.
        const [v, has] = await dummy.peek();
        expect(v).to.equal(ethers.constants.HashZero);
        expect(has).to.equal(false);

        await adapterAsMultisig.setMoCOracleAddress(dummy.address);
        expect((await adapter.mocOracleAddress()).toLowerCase()).to.equal(
            dummy.address.toLowerCase()
        );
        await expect(adapter.latestAnswer()).to.be.reverted;
    });

    it("all 3 pools revert on targetAmountAndFee (swap quote)", async () => {
        for (const name of Object.keys(ADDR.converters)) {
            const conv = new ethers.Contract(ADDR.converters[name], CONVERTER_ABI, user);
            await expect(
                conv.targetAmountAndFee(ADDR.reserves.WRBTC, SECONDARY_FOR[name], SAMPLE_IN),
                `${name} targetAmountAndFee should revert`
            ).to.be.reverted;
        }
    });

    // Finding: V2 converters fall back to cached rates when the oracle fails,
    // so addLiquidity/removeLiquidity continue to work even with the adapter
    // reverting. The oracle-break pause is a swaps-only halt, not a full halt.
    // V2 LP mint math is staked-balance-proportional, not oracle-based:
    //   poolTokensMinted = amount * totalSupply / reserveStakedBalance
    // So LP deposits/withdrawals are oracle-independent — the oracle only
    // affects swap pricing and internal weight rebalancing. This test proves
    // that by comparing actual mint vs expected staked-proportional mint
    // while the oracle is broken.
    it("LP mint is staked-balance-proportional (oracle-independent)", async () => {
        await wrbtc.deposit({ value: SAMPLE_IN.mul(3) });
        for (const name of Object.keys(ADDR.converters)) {
            const conv = new ethers.Contract(ADDR.converters[name], CONVERTER_ABI, user);
            const lpTokenAddr = await conv.poolToken(ADDR.reserves.WRBTC);
            const lp = new ethers.Contract(lpTokenAddr, LP_TOKEN_ABI, user);

            const stakedBefore = await conv.reserveStakedBalance(ADDR.reserves.WRBTC);
            const supplyBefore = await lp.totalSupply();
            const userBefore = await lp.balanceOf(user.address);

            await wrbtc.approve(ADDR.converters[name], SAMPLE_IN);
            await conv.addLiquidity(ADDR.reserves.WRBTC, SAMPLE_IN, 1);

            const minted = (await lp.balanceOf(user.address)).sub(userBefore);
            const expected = SAMPLE_IN.mul(supplyBefore).div(stakedBefore);
            const diff = minted.gt(expected) ? minted.sub(expected) : expected.sub(minted);
            // allow 0.1% tolerance for rounding
            const tolerance = expected.div(1000);

            console.log(
                `   ${name}: minted=${minted.toString()} expected=${expected.toString()} diff=${diff.toString()}`
            );
            expect(
                diff.lte(tolerance),
                `${name} mint amount diverges from staked-balance formula by >0.1%`
            ).to.equal(true);
        }
    });

    // LP round-trip during the oracle break: is deposit+withdraw lossless?
    // In a healthy V2 pool approximately yes, but these pools are heavily
    // imbalanced (BPRO in particular: reserveBalance < stakedBalance means
    // LPs share the drainage discount on exit). Observed losses on 0.001 WRBTC:
    //   USDT  ~9 bps   (reserve >= staked, mostly conversion fee)
    //   DOC   ~3 bps
    //   BPRO ~123 bps  (drainage discount dominates; meaningful for users)
    // The critical invariant the test enforces is that round-trip NEVER
    // returns more than was deposited (no value-creation exploit). Users can
    // still take a meaningful loss on imbalanced pools; frontends should warn.
    it("round-trip LP cannot create value (no exploit); may lose on imbalanced pools", async () => {
        for (const name of Object.keys(ADDR.converters)) {
            const conv = new ethers.Contract(ADDR.converters[name], CONVERTER_ABI, user);
            const lpAddr = await conv.poolToken(ADDR.reserves.WRBTC);
            const lp = new ethers.Contract(lpAddr, LP_TOKEN_ABI, user);

            const staked = await conv.reserveStakedBalance(ADDR.reserves.WRBTC);
            const reserve = await conv.reserveBalance(ADDR.reserves.WRBTC);
            const limit = await conv.liquidationLimit(lpAddr);
            console.log(
                `   ${name} WRBTC side: staked=${ethers.utils.formatEther(
                    staked
                )} reserveBal=${ethers.utils.formatEther(
                    reserve
                )} liqLimit(poolToken)=${ethers.utils.formatEther(limit)}`
            );

            const lpBefore = await lp.balanceOf(user.address);

            // deposit 0.001 WRBTC
            await wrbtc.deposit({ value: SAMPLE_IN });
            await wrbtc.approve(ADDR.converters[name], SAMPLE_IN);
            await conv.addLiquidity(ADDR.reserves.WRBTC, SAMPLE_IN, 1);
            const mintedNow = (await lp.balanceOf(user.address)).sub(lpBefore);

            // quote removal (view) and compare
            const [quoted] = await conv.removeLiquidityReturnAndFee(lpAddr, mintedNow);

            const wrbtcPre = await wrbtc.balanceOf(user.address);
            await conv.removeLiquidity(lpAddr, mintedNow, 1);
            const wrbtcBack = (await wrbtc.balanceOf(user.address)).sub(wrbtcPre);

            const deltaWei = absDiff(wrbtcBack, SAMPLE_IN);
            const delta = wrbtcBack.gte(SAMPLE_IN)
                ? `+${deltaWei.toString()}`
                : `-${deltaWei.toString()}`;
            console.log(
                `   ${name} round-trip: deposited=${SAMPLE_IN} quoted_back=${quoted} actual_back=${wrbtcBack} delta_wei=${delta}`
            );

            // Report any divergence in bps (10000 = 100%)
            const divBps = diffBps(SAMPLE_IN, wrbtcBack);
            console.log(`   ${name} round-trip divergence: ${divBps.toString()} bps`);

            // The key safety property: attacker CAN'T gain more than deposit
            expect(
                wrbtcBack.lte(SAMPLE_IN.add(1)),
                `${name}: round-trip should not mint WRBTC out of thin air`
            ).to.equal(true);
        }
    });

    // Strongest proof that LP deposits and withdrawals do NOT touch the oracle:
    // replace the medianizer with compatible ones reporting 0.5x, 2x, 10x the
    // real price, and show mint AND burn outputs are byte-for-byte identical
    // to the baseline (1x) case on all 3 pools. Each iteration runs on a fresh
    // EVM snapshot, so the pool state is bitwise-identical at start. Any oracle
    // coupling would show up as a divergence at the extreme price points.
    it("LP mint/burn are oracle-invariant across extreme valid prices (0.5x, 2x, 10x)", async () => {
        // Use a fixed synthetic baseline near the real BTC/USD price. The
        // actual value is irrelevant — the test compares mint/burn across
        // multipliers of this same baseline. Avoiding `adapter.latestAnswer()`
        // here sidesteps the long-fork staleness of the real MoCMedianizer.
        const baselinePrice = ethers.utils.parseEther("76000");

        const MockMoCMedianizer = await ethers.getContractFactory("MockMoCMedianizer");

        const multipliers = [
            { name: "1x (baseline)", num: 1, denom: 1 },
            { name: "0.5x", num: 1, denom: 2 },
            { name: "2x", num: 2, denom: 1 },
            { name: "10x", num: 10, denom: 1 },
        ];

        const results = {};

        for (const m of multipliers) {
            const snapId = await directProvider.send("evm_snapshot", []);

            const scaledPrice = baselinePrice.mul(m.num).div(m.denom);
            const med = await MockMoCMedianizer.deploy(scaledPrice);
            await med.deployed();
            await adapterAsMultisig.setMoCOracleAddress(med.address);
            expect(await adapter.latestAnswer()).to.equal(scaledPrice);

            const perPool = {};
            for (const name of Object.keys(ADDR.converters)) {
                const conv = new ethers.Contract(ADDR.converters[name], CONVERTER_ABI, user);
                const lpAddr = await conv.poolToken(ADDR.reserves.WRBTC);
                const lp = new ethers.Contract(lpAddr, LP_TOKEN_ABI, user);

                await wrbtc.deposit({ value: SAMPLE_IN });
                await wrbtc.approve(ADDR.converters[name], SAMPLE_IN);

                const lpBefore = await lp.balanceOf(user.address);
                await conv.addLiquidity(ADDR.reserves.WRBTC, SAMPLE_IN, 1);
                const minted = (await lp.balanceOf(user.address)).sub(lpBefore);

                const wrbtcBefore = await wrbtc.balanceOf(user.address);
                await conv.removeLiquidity(lpAddr, minted, 1);
                const returned = (await wrbtc.balanceOf(user.address)).sub(wrbtcBefore);

                perPool[name] = { minted, returned };
            }
            results[m.name] = perPool;
            const summary = Object.keys(perPool)
                .map(
                    (n) =>
                        `${n} mint=${perPool[n].minted.toString()} burn=${perPool[n].returned.toString()}`
                )
                .join(" | ");
            console.log(`   ${m.name}: ${summary}`);

            await directProvider.send("evm_revert", [snapId]);
        }

        const baseline = results["1x (baseline)"];
        for (const mName of Object.keys(results)) {
            if (mName === "1x (baseline)") continue;
            for (const name of Object.keys(ADDR.converters)) {
                expect(
                    results[mName][name].minted,
                    `${name} @ ${mName}: mint differs from 1x baseline`
                ).to.equal(baseline[name].minted);
                expect(
                    results[mName][name].returned,
                    `${name} @ ${mName}: burn return differs from 1x baseline`
                ).to.equal(baseline[name].returned);
            }
        }
    });

    // Empirical proof that the SECONDARY side (rUSDT / DOC / BPro) is also
    // oracle-independent during the pause. Funds the user with each secondary
    // token via hardhat_setStorageAt on the ERC20 balances mapping (slot auto-
    // probed), then deposits + withdraws while mocOracleAddress is a dummy.
    // Asserts: (a) mint matches staked-balance formula exactly, and
    //          (b) round-trip cannot return more than deposited.
    it("secondary-side (rUSDT/DOC/BPro) LP is oracle-independent during pause", async () => {
        // Ensure the adapter is on the dummy so swaps are halted.
        const DummyMoCMedianizer = await ethers.getContractFactory("DummyMoCMedianizer");
        const dummy = await DummyMoCMedianizer.deploy();
        await dummy.deployed();
        await adapterAsMultisig.setMoCOracleAddress(dummy.address);
        await expect(adapter.latestAnswer()).to.be.reverted; // confirm oracle is broken

        const ERC20 = [
            "function balanceOf(address) view returns (uint256)",
            "function approve(address,uint256) returns (bool)",
            "function totalSupply() view returns (uint256)",
        ];

        // Find the slot of the `_balances` (or equivalent) mapping for an ERC20
        // by probing: for each candidate slot, set the derived storage key to a
        // sentinel value and check if balanceOf reflects it.
        async function findBalanceSlot(tokenAddr) {
            const token = new ethers.Contract(tokenAddr, ERC20, user);
            const sentinel = ethers.BigNumber.from("0x1111111111111111");
            for (let slot = 0; slot < 20; slot++) {
                const key = ethers.utils.keccak256(
                    ethers.utils.defaultAbiCoder.encode(
                        ["address", "uint256"],
                        [user.address, slot]
                    )
                );
                const before = await directProvider.send("eth_getStorageAt", [
                    tokenAddr,
                    key,
                    "latest",
                ]);
                await directProvider.send("hardhat_setStorageAt", [
                    tokenAddr,
                    key,
                    ethers.utils.hexZeroPad(sentinel.toHexString(), 32),
                ]);
                const balAfter = await token.balanceOf(user.address);
                await directProvider.send("hardhat_setStorageAt", [tokenAddr, key, before]);
                if (balAfter.eq(sentinel)) return slot;
            }
            throw new Error(`balance slot not found for token ${tokenAddr}`);
        }

        async function grantBalance(tokenAddr, slot, amount) {
            const key = ethers.utils.keccak256(
                ethers.utils.defaultAbiCoder.encode(["address", "uint256"], [user.address, slot])
            );
            await directProvider.send("hardhat_setStorageAt", [
                tokenAddr,
                key,
                ethers.utils.hexZeroPad(amount.toHexString(), 32),
            ]);
        }

        const secondaries = {
            USDT: {
                token: ADDR.reserves.rUSDT,
                sample: ethers.utils.parseEther("10"), // 10 rUSDT
            },
            DOC: {
                token: ADDR.reserves.DOC,
                sample: ethers.utils.parseEther("10"), // 10 DOC
            },
            BPRO: {
                token: ADDR.reserves.BPro,
                sample: ethers.utils.parseEther("0.0001"), // 0.0001 BPro
            },
        };

        for (const name of Object.keys(secondaries)) {
            const { token: tokenAddr, sample } = secondaries[name];
            const converterAddr = ADDR.converters[name];

            const slot = await findBalanceSlot(tokenAddr);
            await grantBalance(tokenAddr, slot, sample);

            const token = new ethers.Contract(tokenAddr, ERC20, user);
            const conv = new ethers.Contract(converterAddr, CONVERTER_ABI, user);
            const lpAddr = await conv.poolToken(tokenAddr);
            const lp = new ethers.Contract(lpAddr, LP_TOKEN_ABI, user);

            expect(await token.balanceOf(user.address)).to.equal(sample);

            const stakedBefore = await conv.reserveStakedBalance(tokenAddr);
            const supplyBefore = await lp.totalSupply();
            const lpBefore = await lp.balanceOf(user.address);

            await token.approve(converterAddr, sample);
            await conv.addLiquidity(tokenAddr, sample, 1);

            const minted = (await lp.balanceOf(user.address)).sub(lpBefore);
            const expected = sample.mul(supplyBefore).div(stakedBefore);
            console.log(
                `   ${name} secondary: balance_slot=${slot} deposited=${sample} minted=${minted} expected=${expected}`
            );
            expect(
                minted,
                `${name} secondary mint diverges from staked-proportional formula`
            ).to.equal(expected);

            const tokBefore = await token.balanceOf(user.address);
            await conv.removeLiquidity(lpAddr, minted, 1);
            const tokReturned = (await token.balanceOf(user.address)).sub(tokBefore);

            const divBps = diffBps(sample, tokReturned);
            console.log(
                `   ${name} secondary round-trip: returned=${tokReturned} div_bps=${divBps.toString()}`
            );
            expect(
                tokReturned.lte(sample.add(1)),
                `${name} secondary round-trip must not mint value`
            ).to.equal(true);
        }
    });

    // Verify reversibility of the pause: setter can be called back to
    // MoCMedianizer and the adapter state is restored. We don't assert on
    // adapter.latestAnswer() because MoCMedianizer's internal freshness
    // window may elapse on a long-running fork (not a mainnet concern).
    it("reversal: setMoCOracleAddress back to MoCMedianizer is accepted and state is restored", async () => {
        await adapterAsMultisig.setMoCOracleAddress(ADDR.mocMedianizer);
        expect((await adapter.mocOracleAddress()).toLowerCase()).to.equal(
            ADDR.mocMedianizer.toLowerCase()
        );
    });
});
