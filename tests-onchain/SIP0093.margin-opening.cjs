// Manual mainnet-fork proof. Run from the repository root; never use a production wallet.
// Start a FRESH dedicated node (leave any existing QA node untouched):
// anvil --fork-url https://mainnet-dev.sovryn.app/rpc --fork-block-number 9358092 \
//   --chain-id 31337 --port 18593 --no-mining --silent
// Then: node tests-onchain/SIP0093.margin-opening.cjs
// Each pool is restored from its snapshot, including the altered positive control.
// Fork clock stays at the upstream timestamp to preserve the original price-feed state.
const fs = require("fs");
const assert = require("assert");
const { ethers: e } = require("ethers");
function makeProvider() {
  const provider = new e.providers.JsonRpcProvider(
    "http://127.0.0.1:18593",
    31337,
  );
  provider.formatter.address = (a) =>
    typeof a === "string" ? a.toLowerCase() : a;
  provider.pollingInterval = 100;
  return provider;
}
let p = makeProvider();
const dep = (n) =>
  JSON.parse(
    fs.readFileSync("deployment/deployments/rskSovrynMainnet/" + n + ".json"),
  );
const sov = dep("SOV").address;
const abi = [
  "function marginTrade(bytes32,uint256,uint256,uint256,address,address,uint256,bytes) payable returns(uint256,uint256)",
  "function marginTradeAffiliate(bytes32,uint256,uint256,uint256,address,address,uint256,address,bytes) payable returns(uint256,uint256)",
  "function owner() view returns(address)",
  "function loanTokenAddress() view returns(address)",
  "function loanParamsIds(uint256) view returns(bytes32)",
  "function checkPause(string) view returns(bool)",
  "function toggleFunctionPause(string,bool)",
];
const sigs = [
  "marginTrade(bytes32,uint256,uint256,uint256,address,address,uint256,bytes)",
  "marginTradeAffiliate(bytes32,uint256,uint256,uint256,address,address,uint256,address,bytes)",
];
const tokenAbi = [
  "function balanceOf(address) view returns(uint256)",
  "function transfer(address,uint256) returns(bool)",
  "function approve(address,uint256) returns(bool)",
];
const key = e.utils.solidityKeccak256(["address", "bool"], [sov, false]);
const slot = e.utils.keccak256(
  e.utils.defaultAbiCoder.encode(["uint256", "uint256"], [key, 16]),
);
const oldIds = {
  iRBTC: "0x9d73538c03755fd7b8998d5065b7025144645ae13993db29d83d7b7d825ea312",
  iDOC: "0x288431da9aad756383010893854ff26b3212ad7299b0044fb6ae66a8304411f3",
  iXUSD: "0x0b0812beed088cf8d1fc3ec05e8887e60054a84aec81d9d996d97446f9e789d3",
  iBPRO: "0x1c5879cbbdc9cf9fcfc6bd60fb731e69538df440dac1093ddee739cbf05e2b26",
};
async function impersonate(a) {
  await p.send("anvil_setBalance", [
    a,
    e.utils.hexValue(e.utils.parseEther("10")),
  ]);
  await p.send("anvil_impersonateAccount", [a]);
  return p.getSigner(a);
}
function reason(err) {
  const data = err.error?.data?.data || err.error?.data || err.data;
  if (typeof data === "string" && data.startsWith("0x08c379a0"))
    return e.utils.defaultAbiCoder.decode(["string"], "0x" + data.slice(10))[0];
  return err.reason || err.message;
}
(async () => {
  assert.equal((await p.getNetwork()).chainId, 31337);
  assert.equal(await p.getBlockNumber(), 9358092);
  await p.send("anvil_setBlockTimestampInterval", [0]);
  await p.send("evm_setAutomine", [true]);
  const trader = await p.getSigner(0).getAddress();
  const results = [];
  for (const name of ["iRBTC", "iDOC", "iXUSD", "iBPRO"]) {
    const snapshot = await p.send("evm_snapshot", []);
    try {
      const address = dep("LoanToken_" + name).address;
      const pool = new e.Contract(address, abi, p.getSigner(0));
      const token = new e.Contract(await pool.loanTokenAddress(), tokenAbi, p);
      const margin = e.utils.parseEther(
        name === "iRBTC" || name === "iBPRO" ? "0.001" : "100",
      );
      // iDOC has only ~11 DoC at this block. Add local fixture liquidity so the
      // size/funding checks do not mask the separate SOV parameter gate.
      const poolBalance = await token.balanceOf(address);
      if (poolBalance.lt(margin.mul(10))) {
        assert.equal(name, "iDOC", "unexpected pool needs fixture liquidity");
        const candidates = await Promise.all(
          Array.from({ length: 30 }, async (_, index) => {
            const balanceSlot = e.utils.keccak256(
              e.utils.defaultAbiCoder.encode(
                ["address", "uint256"],
                [address, index],
              ),
            );
            return {
              balanceSlot,
              value: await p.getStorageAt(token.address, balanceSlot),
            };
          }),
        );
        const matching = candidates.filter((candidate) =>
          e.BigNumber.from(candidate.value).eq(poolBalance),
        );
        assert.equal(
          matching.length,
          1,
          "token balance storage slot must be unique",
        );
        await p.send("anvil_setStorageAt", [
          token.address,
          matching[0].balanceSlot,
          e.utils.hexZeroPad(margin.mul(10).toHexString(), 32),
        ]);
        assert((await token.balanceOf(address)).eq(margin.mul(10)));
        console.log(
          JSON.stringify({
            pool: name,
            fixture: "local token liquidity",
            before: poolBalance.toString(),
            after: margin.mul(10).toString(),
          }),
        );
      }
      const funding = await impersonate(address);
      await (
        await token
          .connect(funding)
          .transfer(trader, margin.mul(2), { gasLimit: 150000 })
      ).wait();
      await (
        await token
          .connect(p.getSigner(0))
          .approve(address, e.constants.MaxUint256, { gasLimit: 150000 })
      ).wait();
      const args = [
        e.constants.HashZero,
        e.utils.parseEther("5"),
        margin,
        0,
        sov,
        trader,
        0,
        "0x",
      ];
      const before = await token.balanceOf(trader);
      assert.equal(await pool.loanParamsIds(key), e.constants.HashZero);
      async function attempt(label, affiliate = false) {
        const fn = affiliate ? "marginTradeAffiliate" : "marginTrade";
        const a = affiliate ? [...args.slice(0, 7), trader, "0x"] : args;
        let r = "SUCCESS";
        try {
          await pool.callStatic[fn](...a, { gasLimit: 6000000 });
        } catch (err) {
          r = reason(err);
        }
        let tx, status;
        try {
          const sent = await pool[fn](...a, { gasLimit: 6000000 });
          tx = sent.hash;
          try {
            status = (await sent.wait()).status;
          } catch (err) {
            status = err.receipt?.status;
          }
        } catch (err) {
          status = "send failed " + reason(err);
        }
        assert(
          (await token.balanceOf(trader)).eq(before),
          "failed trade moved funds",
        );
        console.log(
          JSON.stringify({
            pool: name,
            label,
            reason: r,
            status,
            tx,
            pointer: await pool.loanParamsIds(key),
          }),
        );
        assert.equal(status, 0, "negative trade must revert");
        assert.equal(
          r,
          label === "current pauses" ? "unauthorized" : "loanParams not exists",
          "unexpected rejection reason",
        );
        results.push({ pool: name, label, reason: r, status, tx });
        return r;
      }
      await attempt("current pauses");
      const owner = await impersonate(await pool.owner());
      for (const sig of sigs)
        if (await pool.checkPause(sig))
          await (
            await pool
              .connect(owner)
              .toggleFunctionPause(sig, false, { gasLimit: 150000 })
          ).wait();
      await attempt("unpaused, original SOV mapping");
      await attempt("unpaused, original SOV mapping, affiliate", true);
      if (name === "iRBTC") {
        // Mutation control: restore only the historical active pointer, never for baseline tests.
        await p.send("anvil_setStorageAt", [address, slot, oldIds[name]]);
        assert.equal(
          (await pool.loanParamsIds(key)).toLowerCase(),
          oldIds[name],
        );
        const quote = await pool.callStatic.marginTrade(...args, {
          gasLimit: 6000000,
        });
        assert(quote[0].gt(0) && quote[1].gt(0));
        const tx = await pool.marginTrade(...args, { gasLimit: 6000000 });
        const receipt = await tx.wait();
        assert.equal(receipt.status, 1);
        const trade = receipt.logs.find(
          (l) =>
            l.topics[0] ===
            "0xf640c1cfe1a912a0b0152b5a542e5c2403142eed75b06cde526cee54b1580e5c",
        );
        assert(trade, "successful control must emit Trade");
        assert((await token.balanceOf(trader)).eq(before.sub(margin)));
        const result = {
          pool: name,
          label: "mutation control: restored active SOV pointer",
          status: receipt.status,
          tx: tx.hash,
          loanId: trade.topics[3],
          principal: quote[0].toString(),
          collateral: quote[1].toString(),
        };
        results.push(result);
        console.log(JSON.stringify(result));
      }
    } finally {
      assert.equal(await p.send("evm_revert", [snapshot]), true);
      // Ethers caches block heights; use a fresh provider after rewinding the fork.
      p.removeAllListeners();
      p = makeProvider();
    }
  }
  assert.equal(results.length, 13);
  console.log(
    "PASS: 12 rejected opening transactions plus a successful pointer-restoration control.",
  );
})().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
