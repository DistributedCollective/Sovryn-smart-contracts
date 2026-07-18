#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const usage = () => {
    console.error(
        [
            "Usage:",
            "  node scripts/oneoff/patchStakerStatsActiveSnapshot.js <progress-file> <active-stakers-csv> [snapshot-block]",
            "",
            "CSV headers accepted:",
            "  Address,address",
            "  Total Staked,totalStaked",
            "  Current Balance,currentBalance",
        ].join("\n")
    );
    process.exit(1);
};

const [, , progressFileArg, csvFileArg, snapshotBlockArg] = process.argv;

if (!progressFileArg || !csvFileArg) {
    usage();
}

const progressFile = path.resolve(progressFileArg);
const csvFile = path.resolve(csvFileArg);

if (!fs.existsSync(progressFile)) {
    throw new Error(`Progress file not found: ${progressFile}`);
}

if (!fs.existsSync(csvFile)) {
    throw new Error(`CSV file not found: ${csvFile}`);
}

const normalizeHeader = (header) => header.trim().toLowerCase();

const parseCsv = (text) => {
    const lines = text
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);

    if (lines.length < 2) {
        throw new Error("CSV file is empty or has no data rows");
    }

    const headers = lines[0].split(",").map(normalizeHeader);
    const addressIndex = headers.findIndex((header) => header === "address");
    const totalStakedIndex = headers.findIndex(
        (header) => header === "total staked" || header === "totalstaked"
    );
    const currentBalanceIndex = headers.findIndex(
        (header) => header === "current balance" || header === "currentbalance"
    );

    if (addressIndex === -1 || totalStakedIndex === -1 || currentBalanceIndex === -1) {
        throw new Error("CSV must include Address, Total Staked, and Current Balance columns");
    }

    return lines.slice(1).map((line, index) => {
        const columns = line.split(",").map((value) => value.trim());
        const address = columns[addressIndex];
        const totalStaked = columns[totalStakedIndex];
        const currentBalance = columns[currentBalanceIndex];

        if (!address || !totalStaked || !currentBalance) {
            throw new Error(`Malformed CSV row ${index + 2}: ${line}`);
        }

        return { address, totalStaked, currentBalance };
    });
};

const toWeiString = (decimalValue) => {
    const value = decimalValue.trim();
    if (!/^\d+(\.\d+)?$/.test(value)) {
        throw new Error(`Invalid decimal value: ${decimalValue}`);
    }

    const [whole, fractionRaw = ""] = value.split(".");
    const fraction = `${fractionRaw}000000000000000000`.slice(0, 18);
    const wholeWei = BigInt(whole) * 10n ** 18n;
    const fractionWei = BigInt(fraction);
    return (wholeWei + fractionWei).toString();
};

const progress = JSON.parse(fs.readFileSync(progressFile, "utf8"));
const rows = parseCsv(fs.readFileSync(csvFile, "utf8"));
const snapshotBlock =
    snapshotBlockArg !== undefined
        ? Number(snapshotBlockArg)
        : Number(progress.targetEndBlock || progress.lastProcessedBlock);

if (!Number.isInteger(snapshotBlock) || snapshotBlock < 0) {
    throw new Error(`Invalid snapshot block: ${snapshotBlockArg}`);
}

const activeStakers = {};
let totalCurrentStaked = 0n;

for (const row of rows) {
    activeStakers[row.address] = {
        totalStaked: row.totalStaked,
        currentBalance: row.currentBalance,
    };
    totalCurrentStaked += BigInt(toWeiString(row.currentBalance));
}

progress.version = Math.max(Number(progress.version || 1), 2);
progress.activeStakersSnapshotBlock = snapshotBlock;
progress.activeStakers = activeStakers;
progress.activeStakersCount = rows.length;
progress.totalCurrentStaked = totalCurrentStaked.toString();

fs.writeFileSync(progressFile, JSON.stringify(progress, null, 2) + "\n");

console.log(`Patched ${progressFile}`);
console.log(`Active stakers: ${rows.length}`);
console.log(`Snapshot block: ${snapshotBlock}`);
console.log(`Total current staked (wei): ${progress.totalCurrentStaked}`);
