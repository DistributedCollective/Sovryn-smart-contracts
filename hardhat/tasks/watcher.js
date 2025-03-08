const fs = require("fs");
const cliProgress = require("cli-progress");

const Logs = require("node-logs");
const logger = new Logs().showInConsole(true);
const {
    impersonateAccount,
    mine,
    time,
    setBalance,
    setStorageAt,
} = require("@nomicfoundation/hardhat-network-helpers");
const { log } = require("console");
const { task } = require("hardhat/config");

const parseEthersLog = (parsed) => {
    let parsedEvent = {};
    for (let i = 0; i < parsed.args.length; i++) {
        const input = parsed.eventFragment.inputs[i];
        const arg = parsed.args[i];
        const newObj = { ...input, ...{ value: arg } };
        parsedEvent[input["name"]] = newObj;
    }
    return parsedEvent;
};

const getEthersLog = async (contract, filter) => {
    if (contract === undefined || filter === undefined) return;
    const events = await contract.queryFilter(filter);
    if (events.length === 0) return;
    let parsedEvents = [];
    for (let event of events) {
        const ethersParsed = contract.interface.parseLog(event);
        const customParsed = parseEthersLog(ethersParsed);
        parsedEvents.push(customParsed);
    }
    return parsedEvents;
};

const assetsList = {
    "0xb5999795be0ebb5bab23144aa5fd6a02d080299f": "XUSD",
    "0xe700691da7b9851f2f35f8b8182c69c53ccad9db": "DOC",
    "0x542fda317318ebf1d3deaf76e0b632741a7e677d": "WRBTC",
    "0xc1411567d2670e24d9c4daaa7cda95686e1250aa": "DLLR",
    "0xEf213441a85DF4d7acBdAe0Cf78004E1e486BB96": "rUSDT",
    "0x440cd83c160de5c96ddb20246815ea44c7abbca8": "BPro",
};

const loanIdExceptions = [
    "0x839c5e3e54c478d5b7b4f07914552f88c7fd974a067045ee20260bfed07b988f",
    "0x3a5e42c0a954113d0d9723a6feae1bd718e2ee3de6526e644ed2644d9452bde2",
    "0x7bd4dd1b477d9da2a05db6799bd64b57d551c8cfa08ce88a59855b7823dc284d",
    "0x78ac142f3e1b5a1ec8e2b6f0658455a8fedf35e647f0b598fbb4ae3f52c455ad",
    "0x025e12b1ef09ba962ea72b9cb591c6622aee9a7db83de361c1302501532b0a1a",
    "0xc95376a523540b7375fabd693a1175345242691aa5c844ccc21fc99943dc4c3a",
    "0xeff0550dcd9cc9b69b71fd10edc73df03cf934a78108ed71b4f038aebf0b46b4",
    "0x864c1b1c9d113968a61079e26d262a685a0eadc4cffae263f51830233b1737f1",
];

// how to: $ hh watcher:findUnhealthyByDrop
task(
    "watcher:findUnhealthyByDrop",
    "Find the list of unhealthy positions after a drop in BTC price is simulated"
)
    .addPositionalParam(
        "percentage",
        "How much the BTC price will simulate a drop/surge - must be less than 95% - 10% by defeult",
        "10"
    )
    .setAction(async ({ percentage }, hre) => {
        const {
            deployments: { get, getArtifact },
            ethers,
        } = hre;

        let percentage_number = parseFloat(percentage);
        if (isNaN(percentage_number)) {
            throw new Error("The percentage parameter must be a valid number.");
        }
        if (percentage_number > 95) {
            console.log("Percentage greater than 95 provided, capping it at 95.");
            percentage_number = 95;
        }
        const percentageBasePoints = Math.round(percentage_number * 100);
        const currentProvider = new hre.ethers.providers.JsonRpcProvider(
            "https://mainnet-dev.sovryn.app/rpc"
        );
        const latestBlockNumber = await currentProvider.getBlockNumber();
        logger.info(`Latest Block Number: ${latestBlockNumber}`);

        await hre.network.provider.request({
            method: "hardhat_reset",
            params: [
                {
                    forking: {
                        jsonRpcUrl: "https://mainnet-dev.sovryn.app/rpc",
                        blockNumber: latestBlockNumber - 30,
                    },
                },
            ],
        });

        // just testing the fork
        const testBlockNumber = await hre.ethers.provider.getBlockNumber();
        logger.info(
            `Test Block Number is the same as forked block number: ${testBlockNumber == latestBlockNumber - 30}`
        );
        const ISovryn = await hre.ethers.getContractAt(
            "ISovryn",
            "0x5A0D867e0D70Fcc6Ade25C3F1B89d618b5B4Eaa7".toLowerCase()
        );

        let start = 0;
        let end = 0;
        let foundEmptyArray = false;
        while (!foundEmptyArray) {
            const activeLoans = await ISovryn.getActiveLoansV2(end, 1, false);
            if (activeLoans.length === 0) {
                foundEmptyArray = true;
            } else {
                end += 1000;
            }
        }

        let netLoanPositions = null;
        while (start <= end) {
            const mid = Math.floor((start + end) / 2);
            const activeLoans = await ISovryn.getActiveLoansV2(mid, 1, false);
            if (activeLoans.length === 0) {
                netLoanPositions = mid;
                end = mid - 1;
            } else {
                start = mid + 1;
            }
        }

        console.log("Query Block Number:", latestBlockNumber - 30);
        console.log("Amount of active loan positions:", netLoanPositions);
        const data = {
            blockNumber: latestBlockNumber - 30,
            netLoanPositions: netLoanPositions,
        };

        const coinPairPriceAddress = "0xa288319ecb63301e21963e21ef3ca8fb720d2672".toLowerCase();
        const rawBTCPrice = await ethers.provider.getStorageAt(coinPairPriceAddress, 118);
        const BTCPrice = ethers.BigNumber.from(rawBTCPrice);
        const BTCPriceDropped = BTCPrice.mul(10000 - percentageBasePoints).div(10000);
        const BTCDroppedPriceBytes32 = ethers.utils.hexZeroPad(BTCPriceDropped.toHexString(), 32);

        await setStorageAt(coinPairPriceAddress, 118, BTCDroppedPriceBytes32);

        const newRawBTCPrice = await ethers.provider.getStorageAt(coinPairPriceAddress, 118);
        const newBTCPrice = ethers.BigNumber.from(newRawBTCPrice);
        logger.info(
            `Simulating a sudden BTC Price Drop from: ${ethers.utils.formatUnits(BTCPrice, 18)} to: ${ethers.utils.formatUnits(newBTCPrice, 18)}`
        );

        // This is too big, and sometimes it can even fail
        // // const unhealthyDropPositions = await ISovryn.getActiveLoansV2(0, netLoanPositions, true);

        let unhealthyDropPositions = [];

        // Determine the total number of steps (chunks of 10 - 50 take too much time)
        const chunkSize = 10;
        const totalSteps = Math.ceil(netLoanPositions / chunkSize);

        // Create and start the progress bar
        const progressBar = new cliProgress.SingleBar({
            format: "Progress |{bar}| {percentage}% || {value}/{total} Chunks",
            barCompleteChar: "\u2588",
            barIncompleteChar: "\u2591",
            hideCursor: true,
        });
        progressBar.start(totalSteps, 0);

        // Loop through the loan positions in chunks of 10 instead of 50
        for (let indexer = 0; indexer < netLoanPositions; indexer += chunkSize) {
            let nextIndex = indexer + chunkSize;
            if (nextIndex > netLoanPositions) {
                nextIndex = netLoanPositions;
            }

            // Query the contract for the current chunk
            const temporaryArray = await ISovryn.getActiveLoansV2(indexer, nextIndex, true);

            // Append the results to the overall array
            unhealthyDropPositions = unhealthyDropPositions.concat(temporaryArray);

            // Update progress bar
            progressBar.increment();

            // console.log(`Fetched loans from index ${indexer} to ${nextIndex}. Total positions so far: ${unhealthyDropPositions.length}`);
        }

        progressBar.stop();

        // ---------------------------
        // Sanity check: ensure each entry is unique.
        // ---------------------------
        const simplifiedArray = unhealthyDropPositions.map((position) => position[0]);
        const uniqueLoanIds = new Set(simplifiedArray);
        const uniqueSimplifiedArray = Array.from(uniqueLoanIds).filter(
            (loanId) => !loanIdExceptions.includes(loanId)
        );
        const dedupedArray = [];
        for (const loanId of uniqueSimplifiedArray) {
            const loanData = unhealthyDropPositions.find((position) => position[0] === loanId);
            if (loanData) {
                dedupedArray.push(loanData);
            } else {
                logger.error(`LoanId ${loanId} should've been found, but not found`);
            }
        }
        console.log("Sanity check passed: All entries are now unique.");

        console.log("All loan positions fetched:", dedupedArray.length);

        data.totalUnhealthyPositionsByDrop = dedupedArray.length;
        data.simulatedBTCPriceDropTo = ethers.utils.formatUnits(newBTCPrice, 18);
        data.unhealthyDropPositions = dedupedArray;

        // now, we will build an object: "fundsNeeded"
        const fundsNeeded = {};
        for (let i = 0; i < dedupedArray.length; i++) {
            const key = dedupedArray[i][1].toLowerCase();
            const value = dedupedArray[i][14];
            if (fundsNeeded[key]) {
                fundsNeeded[key] = fundsNeeded[key].add(value);
            } else {
                fundsNeeded[key] = value;
            }
        }

        // Convert fundsNeeded values to number strings
        for (const key in fundsNeeded) {
            fundsNeeded[key] = fundsNeeded[key].toString();
        }

        // Parse number strings as float numbers with 18 decimals
        for (const key in fundsNeeded) {
            fundsNeeded[key] = ethers.utils.formatUnits(fundsNeeded[key], 18);
        }

        const fundsNeededByAsset = {};

        for (let i = 0; i < Object.keys(fundsNeeded).length; i++) {
            const assetAddress = Object.keys(fundsNeeded)[i];
            const assetName = assetsList[assetAddress];
            fundsNeededByAsset[assetName] = fundsNeeded[assetAddress];
        }

        data.fundsNeeded = fundsNeeded;
        data.fundsNeededByAsset = fundsNeededByAsset;

        fs.writeFileSync(
            "./tmp/WATCHER/unhealthyDropPositions.json",
            JSON.stringify(data, null, 2)
        );

        logger.info("Data saved to file: ./tmp/WATCHER/unhealthyDropPositions.json");

        return data;
    });

// how to: $ hh watcher:findUnhealthyBySurge <N%> <toal-active-pos> <block-number>
task(
    "watcher:findUnhealthyBySurge",
    "Find the list of unhealthy positions after a surge in BTC price is simulated"
)
    .addOptionalPositionalParam(
        "percentage",
        "How much the BTC price will simulate a drop/surge - must be less than 95% - 10% by defeult",
        "10"
    )
    .addOptionalPositionalParam("netLoanPositions", "The amount of net loan positions")
    .addOptionalPositionalParam("forkingBlockNumber", "The block number to fork from")
    .setAction(async ({ percentage, netLoanPositions, forkingBlockNumber }, hre) => {
        const {
            deployments: { get, getArtifact },
            ethers,
        } = hre;

        let percentage_number = parseFloat(percentage);
        if (isNaN(percentage_number)) {
            throw new Error("The percentage parameter must be a valid number.");
        }
        if (percentage_number > 95) {
            console.log("Percentage greater than 95 provided, capping it at 95.");
            percentage_number = 95;
        }
        const percentageBasePoints = Math.round(percentage_number * 100);
        const currentProvider = new hre.ethers.providers.JsonRpcProvider(
            "https://mainnet-dev.sovryn.app/rpc"
        );
        const latestBlockNumber = await currentProvider.getBlockNumber();
        const forkingBlock = forkingBlockNumber ? forkingBlockNumber * 1 : latestBlockNumber - 30;
        logger.info(`Latest Block Number: ${latestBlockNumber}`);

        await hre.network.provider.request({
            method: "hardhat_reset",
            params: [
                {
                    forking: {
                        jsonRpcUrl: "https://mainnet-dev.sovryn.app/rpc",
                        blockNumber: forkingBlock,
                    },
                },
            ],
        });

        // just testing the fork
        const testBlockNumber = await hre.ethers.provider.getBlockNumber();
        logger.info(
            `Test Block Number is the same as forked block number: ${testBlockNumber == forkingBlock}`
        );
        const ISovryn = await hre.ethers.getContractAt(
            "ISovryn",
            "0x5A0D867e0D70Fcc6Ade25C3F1B89d618b5B4Eaa7".toLowerCase()
        );

        let data = {};
        let net_LoanPositions = netLoanPositions ? netLoanPositions * 1 : null;
        if (!netLoanPositions) {
            let start = 0;
            let end = 0;
            let foundEmptyArray = false;
            while (!foundEmptyArray) {
                const activeLoans = await ISovryn.getActiveLoansV2(end, 1, false);
                if (activeLoans.length === 0) {
                    foundEmptyArray = true;
                } else {
                    end += 1000;
                }
            }

            while (start <= end) {
                const mid = Math.floor((start + end) / 2);
                const activeLoans = await ISovryn.getActiveLoansV2(mid, 1, false);
                if (activeLoans.length === 0) {
                    net_LoanPositions = mid;
                    end = mid - 1;
                } else {
                    start = mid + 1;
                }
            }
        }

        data.blockNumber = forkingBlock;
        data.netLoanPositions = net_LoanPositions;

        console.log("Query Block Number:", forkingBlock);
        console.log("Amount of active loan positions:", net_LoanPositions);

        const coinPairPriceAddress = "0xa288319ecb63301e21963e21ef3ca8fb720d2672".toLowerCase();
        const rawBTCPrice = await ethers.provider.getStorageAt(coinPairPriceAddress, 118);
        const BTCPrice = ethers.BigNumber.from(rawBTCPrice);
        const BTCPriceSurged = BTCPrice.mul(10000 + percentageBasePoints).div(10000);
        const BTCSurgedPriceBytes32 = ethers.utils.hexZeroPad(BTCPriceSurged.toHexString(), 32);

        await setStorageAt(coinPairPriceAddress, 118, BTCSurgedPriceBytes32);

        const newRawBTCPrice = await ethers.provider.getStorageAt(coinPairPriceAddress, 118);
        const newBTCPrice = ethers.BigNumber.from(newRawBTCPrice);
        logger.info(
            `Simulating a sudden BTC Price Surge from: ${ethers.utils.formatUnits(BTCPrice, 18)} to: ${ethers.utils.formatUnits(newBTCPrice, 18)}`
        );

        // This is too big, and sometimes it can even fail
        // // const unhealthyDropPositions = await ISovryn.getActiveLoansV2(0, net_LoanPositions, true);

        let unhealthySurgePositions = [];

        // Determine the total number of steps (chunks of 10 - 50 take too much time)
        const chunkSize = 10;
        const totalSteps = Math.ceil(net_LoanPositions / chunkSize);

        // Create and start the progress bar
        const progressBar = new cliProgress.SingleBar({
            format: "Progress |{bar}| {percentage}% || {value}/{total} Chunks",
            barCompleteChar: "\u2588",
            barIncompleteChar: "\u2591",
            hideCursor: true,
        });
        progressBar.start(totalSteps, 0);

        // Loop through the loan positions in chunks of 50
        for (let indexer = 0; indexer < net_LoanPositions; indexer += chunkSize) {
            let nextIndex = indexer + chunkSize;
            if (nextIndex > net_LoanPositions) {
                nextIndex = net_LoanPositions;
            }

            // Query the contract for the current chunk
            const temporaryArray = await ISovryn.getActiveLoansV2(indexer, nextIndex, true);

            // Append the results to the overall array
            unhealthySurgePositions = unhealthySurgePositions.concat(temporaryArray);

            // Update progress bar
            progressBar.increment();

            // console.log(`Fetched loans from index ${indexer} to ${nextIndex}. Total positions so far: ${unhealthySurgePositions.length}`);
        }

        progressBar.stop();

        // ---------------------------
        // Sanity check: ensure each entry is unique.
        // ---------------------------
        const simplifiedArray = unhealthySurgePositions.map((position) => position[0]);
        const uniqueLoanIds = new Set(simplifiedArray);
        const uniqueSimplifiedArray = Array.from(uniqueLoanIds).filter(
            (loanId) => !loanIdExceptions.includes(loanId)
        );
        const dedupedArray = [];
        for (const loanId of uniqueSimplifiedArray) {
            const loanData = unhealthySurgePositions.find((position) => position[0] === loanId);
            if (loanData) {
                dedupedArray.push(loanData);
            } else {
                logger.error(`LoanId ${loanId} should've been found, but not found`);
            }
        }
        console.log("Sanity check passed: All entries are now unique.");

        console.log("All loan positions fetched:", dedupedArray.length);

        data.totalUnhealthyPositionsBySurge = dedupedArray.length;
        data.simulatedBTCPriceSurgeTo = ethers.utils.formatUnits(newBTCPrice, 18);
        data.unhealthySurgePositions = dedupedArray;

        // now, we will build an object: "fundsNeeded"
        const fundsNeeded = {};
        for (let i = 0; i < dedupedArray.length; i++) {
            const key = dedupedArray[i][1].toLowerCase();
            const value = dedupedArray[i][14];
            if (fundsNeeded[key]) {
                fundsNeeded[key] = fundsNeeded[key].add(value);
            } else {
                fundsNeeded[key] = value;
            }
        }

        // Convert fundsNeeded values to number strings
        for (const key in fundsNeeded) {
            fundsNeeded[key] = fundsNeeded[key].toString();
        }

        // Parse number strings as float numbers with 18 decimals
        for (const key in fundsNeeded) {
            fundsNeeded[key] = ethers.utils.formatUnits(fundsNeeded[key], 18);
        }

        const fundsNeededByAsset = {};

        for (let i = 0; i < Object.keys(fundsNeeded).length; i++) {
            const assetAddress = Object.keys(fundsNeeded)[i];
            const assetName = assetsList[assetAddress];
            fundsNeededByAsset[assetName] = fundsNeeded[assetAddress];
        }

        data.fundsNeeded = fundsNeeded;
        data.fundsNeededByAsset = fundsNeededByAsset;

        fs.writeFileSync(
            "./tmp/WATCHER/unhealthySurgePositions.json",
            JSON.stringify(data, null, 2)
        );

        logger.info("Data saved to file: ./tmp/WATCHER/unhealthySurgePositions.json");

        return data;
    });

// how to: $ hh watcher:checkBalances
task("watcher:checkBalances", "Check balances of the watcher contract").setAction(
    async ({}, hre) => {
        const { ethers } = hre;
        const provider = new ethers.providers.JsonRpcProvider(
            "https://mainnet-dev.sovryn.app/rpc"
        );
        const path = require("path");
        const watcherArtifact = require(
            path.join(process.cwd(), "external/deployments/rskMainnet/Watcher.json")
        );
        const watcherContract = new ethers.Contract(
            watcherArtifact.address,
            watcherArtifact.abi,
            provider
        );
        const watcherContractAddress = watcherContract.address;

        const balances = {};
        for (const assetAddress in assetsList) {
            const tokenContract = new ethers.Contract(
                assetAddress.toLowerCase(),
                ["function balanceOf(address) view returns (uint256)"],
                provider
            );
            const balance = await tokenContract.balanceOf(watcherContractAddress);
            balances[assetsList[assetAddress]] = ethers.utils.formatUnits(balance.toString(), 18);
        }

        console.log("Balances:", JSON.stringify(balances, null, 2));
        return balances;
    }
);

// how to: $ hh watcher:consolidate 15
// solving memory issues: $ export NODE_OPTIONS=--max_old_space_size=8192 && hh watcher:consolidate 15
task("watcher:consolidate", "Consolidate funds needed for both drop and surge scenarios")
    .addOptionalPositionalParam(
        "percentage",
        "Percentage of BTC price change to simulate (default: 10, max: 95)",
        "10"
    )
    .setAction(async ({ percentage }, hre) => {
        const { ethers } = hre;

        // percentage sanity check
        let percentageNumber = parseFloat(percentage);
        if (isNaN(percentageNumber)) {
            throw new Error("The percentage parameter must be a valid number.");
        }
        if (percentageNumber > 95) {
            console.log("Percentage greater than 95 provided, capping it at 95.");
            percentageNumber = 95;
        }

        // running watcher:findUnhealthyByDrop
        const dropData = await hre.run("watcher:findUnhealthyByDrop", {
            percentage: percentageNumber.toString(),
        });

        // running watcher:findUnhealthyBySurge
        const surgeData = await hre.run("watcher:findUnhealthyBySurge", {
            percentage: percentageNumber.toString(),
            netLoanPositions: dropData.netLoanPositions.toString(),
            forkingBlockNumber: dropData.blockNumber.toString(),
        });

        // getting the worst values of fundsNeededByAsset
        const totalFundsNeeded = {};
        const allAssets = new Set([
            ...Object.keys(dropData.fundsNeededByAsset),
            ...Object.keys(surgeData.fundsNeededByAsset),
        ]);

        for (const asset of allAssets) {
            const dropAmount = parseFloat(dropData.fundsNeededByAsset[asset] || "0");
            const surgeAmount = parseFloat(surgeData.fundsNeededByAsset[asset] || "0");
            totalFundsNeeded[asset] = Math.max(dropAmount, surgeAmount).toString();
        }

        // getting the balances of the watcher contract
        const balances = await hre.run("watcher:checkBalances");

        // comparing totalFundsNeeded with balances
        const lackingFunds = {};
        for (const asset in totalFundsNeeded) {
            const needed = parseFloat(totalFundsNeeded[asset]);
            const available = parseFloat(balances[asset] || "0");
            if (needed > available) {
                lackingFunds[asset] = (needed - available).toString();
            }
        }

        const formatNumber = (number) => {
            return Number(number).toLocaleString("en-US", {
                maximumFractionDigits: 18, // Adjusted according to the precision needed
            });
        };

        // returning the consolidated data
        const out = {
            dropData,
            surgeData,
            totalFundsNeeded,
            balances,
            lackingFunds,
        };
        fs.writeFileSync("./tmp/WATCHER/consolidatedData.json", JSON.stringify(out, null, 2));
        logger.info("Consolidated watcher data stored in ./tmp/WATCHER/consolidatedData.json");

        if (Object.keys(lackingFunds).length === 0) {
            logger.info("No lacking funds found");
            await hre.run("discord:sendCalmMessage", {
                channelId: process.env.DISCORD_CHANNEL_ID.toString(),
                percentage: percentageNumber.toString(),
            });
            return;
        } else {
            const message =
                `🔴 WATCHER: FUNDS LACKING ❌\n\n` +
                `Current Balances:\n${Object.entries(balances)
                    .map(([asset, amount]) => `${asset}: ${formatNumber(amount)}`)
                    .join("\n")}\n\n` +
                `Total Funds Needed:\n${Object.entries(totalFundsNeeded)
                    .map(([asset, amount]) => `${asset}: ${formatNumber(amount)}`)
                    .join("\n")}\n\n` +
                `Missing Funds for Simulated Scenarios:\n${Object.entries(lackingFunds)
                    .map(([asset, amount]) => `${asset}: ${formatNumber(amount)}`)
                    .join("\n")}\n\n` +
                `Simulation done with ±${percentage}% fluctuation on BTC price\n\n`;
            await hre.run("discord:sendAlertMessage", {
                channelId: process.env.DISCORD_CHANNEL_ID.toString(),
                userIds: [process.env.DISCORD_USER_ID].join(","),
                message: message,
            });
        }

        return out;
    });

// module.exports = {};
