const csv = require("csv-parser");
const fs = require("fs");
const path = require("path");
const { createObjectCsvWriter } = require("csv-writer");

const Logs = require("node-logs");
const logger = new Logs().showInConsole(true);
const {
    impersonateAccount,
    mine,
    time,
    setBalance,
} = require("@nomicfoundation/hardhat-network-helpers");
const { sendWithMultisig, getSignerFromAccount } = require("../../deployment/helpers/helpers");
const { default: BigNumber } = require("bignumber.js");

const getImpersonatedSignerFromJsonRpcProvider = async (addressToImpersonate) => {
    //await impersonateAccount(addressToImpersonate);
    //return await ethers.getSigner(addressToImpersonate);
    const provider = new ethers.providers.JsonRpcProvider("http://127.0.0.1:8545");
    await provider.send("hardhat_impersonateAccount", [addressToImpersonate]);
    console.log(
        "provider.getSigner(addressToImpersonate):",
        provider.getSigner(addressToImpersonate).address
    );
    return provider.getSigner(addressToImpersonate);
};

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

async function getVestingsOf(hre, address) {
    return await (await ethers.getContract("VestingRegistry")).getVestingsOf(address);
}

async function getStakesOf(hre, address) {
    return await (await ethers.getContract("Staking")).getStakes(address);
}

async function getVotingPower(hre, stakerAddress, governorDeploymentName, blockNumber) {
    const { ethers } = hre;
    const stakingDeployment = await ethers.getContract("Staking");
    const staking = await ethers.getContractAt("IStaking", stakingDeployment.address);
    const governor = await ethers.getContract(governorDeploymentName);
    const sov = await ethers.getContract("SOV");
    const provider = ethers.provider;

    blockNumber = blockNumber ? blockNumber : (await provider.getBlock()).number;
    const block = await provider.getBlock(blockNumber);
    const referenceTimestamp = block.timestamp;
    const finalizedVotingBlock = Math.max(blockNumber - 1, 0);

    const [stakeData, balance, votingPower, proposalThreshold] = await Promise.all([
        staking.getStakes(stakerAddress, { blockTag: blockNumber }),
        sov.balanceOf(stakerAddress, { blockTag: blockNumber }),
        staking.getCurrentVotes(stakerAddress, { blockTag: blockNumber }),
        governor.proposalThreshold({ blockTag: blockNumber }),
    ]);

    const [dates, stakes] = stakeData;
    let lockedAmount = ethers.BigNumber.from(0);
    let selfStakedVotingPower = ethers.BigNumber.from(0);
    let delegatedAwayVotingPower = ethers.BigNumber.from(0);

    for (let i = 0; i < dates.length; i++) {
        const lockDate = dates[i];
        if (!lockDate.gt(referenceTimestamp)) continue;

        lockedAmount = lockedAmount.add(stakes[i]);

        const [delegatee, weightedStake] = await Promise.all([
            staking.delegates(stakerAddress, lockDate, { blockTag: blockNumber }),
            staking.weightedStakeByDate(
                stakerAddress,
                lockDate,
                referenceTimestamp,
                finalizedVotingBlock,
                { blockTag: blockNumber }
            ),
        ]);

        if (delegatee.toLowerCase() === stakerAddress.toLowerCase()) {
            selfStakedVotingPower = selfStakedVotingPower.add(weightedStake);
        } else {
            delegatedAwayVotingPower = delegatedAwayVotingPower.add(weightedStake);
        }
    }

    const receivedDelegatedVotingPower = votingPower.gte(selfStakedVotingPower)
        ? votingPower.sub(selfStakedVotingPower)
        : ethers.BigNumber.from(0);
    const ownStakeVotingPower = selfStakedVotingPower.add(delegatedAwayVotingPower);

    return {
        blockNumber,
        blockTimestamp: referenceTimestamp,
        finalizedVotingBlock,
        stakerAddress,
        balance,
        lockedAmount,
        votingPower,
        selfStakedVotingPower,
        delegatedAwayVotingPower,
        receivedDelegatedVotingPower,
        ownStakeVotingPower,
        proposalThreshold,
    };
}

const runWithConcurrency = async (items, limit, worker) => {
    const results = new Array(items.length);
    let nextIndex = 0;

    const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
        while (true) {
            const currentIndex = nextIndex++;
            if (currentIndex >= items.length) break;
            results[currentIndex] = await worker(items[currentIndex], currentIndex);
        }
    });

    await Promise.all(runners);
    return results;
};

async function createVestings(hre, dryRun, path, multiplier, signerAcc, reissue = false) {
    /*
     * vested token sender script - takes addresses from the file by path
     * dryRun - true to check that the data will be processed correctly, false - execute distribution
     * multiplier - usually 10**16 considering the amount format should have 2 decimals
     * reIssue - re-issue team vestings: use to bypass deriving vesting creation type from vesting periods when need just to re-issue vestings to another address with the actual periods left
     */

    const { ethers } = hre;

    let signer = await getSignerFromAccount(hre, signerAcc);
    let signerAddress = signer.address;

    const vestingRegistry = await ethers.getContract("VestingRegistry", signer);

    const staking = await ethers.getContract("Staking", signer);

    const SOVtoken = await ethers.getContract("SOV", signer);

    const DAY = 24 * 60 * 60;
    const FOUR_WEEKS = 4 * 7 * DAY;

    const balanceBefore = await ethers.provider.getBalance(signerAddress);
    let totalAmount = ethers.BigNumber.from(0);

    // amounts examples: "6,516.85", 1200.00, 912.92 - 2 decimals strictly!
    const data = await parseVestingsFile(ethers, path, multiplier);
    totalAmount = totalAmount.add(data.totalAmount);

    for (const teamVesting of data.teamVestingList) {
        const tokenOwner = teamVesting[0].toLowerCase();
        const amount = teamVesting[1];
        const cliff = parseInt(teamVesting[2]) * FOUR_WEEKS;
        const duration = parseInt(teamVesting[3]) * FOUR_WEEKS;
        const isTeam = Boolean(teamVesting[4]);
        console.log(
            "=============================================================================="
        );
        console.log("Processing vesting creation for", tokenOwner, "...");
        console.log("isTeam", isTeam);
        console.log("amount", amount.toString());
        console.log("cliff", cliff);
        console.log("duration", duration);
        console.log("(duration - cliff) / FOUR_WEEKS + 1", (duration - cliff) / FOUR_WEEKS + 1);

        let vestingCreationType = 0;
        if (reissue) {
            vestingCreationType = 5;
            console.log("Make sure you are re-issuing team vesting contracts!");
        } else if (teamVesting[3] === 10) {
            vestingCreationType = 3;
        } else if (
            teamVesting[3] === 26 ||
            teamVesting[3] === 4 ||
            teamVesting[3] === 13 ||
            teamVesting[3] === 18 ||
            teamVesting[3] === 21 ||
            teamVesting[3] === 22
        ) {
            vestingCreationType = 1;
        } else if ([39, 22, 17, 34, 19].includes(teamVesting[3])) {
            vestingCreationType = 5;
            console.log("Make sure 3 year team 2 vesting split is really expected!");
        } else {
            console.log("ALERT!!!! ZERO VESTING CREATION TYPE FALLBACK!!!");
        }

        let vestingAddress;
        if (isTeam) {
            vestingAddress = await vestingRegistry.getTeamVesting(
                tokenOwner,
                cliff,
                duration,
                vestingCreationType
            );
        } else {
            vestingAddress = await vestingRegistry.getVestingAddr(
                tokenOwner,
                cliff,
                duration,
                vestingCreationType
            );
        }

        if (vestingAddress !== ethers.constants.AddressZero) {
            const vesting = await ethers.getContractAt("VestingLogic", vestingAddress);
            if (
                cliff.toString() !== (await vesting.cliff()).toString() ||
                duration.toString() !== (await vesting.duration()).toString()
            ) {
                throw new Error(
                    "Address already has team vesting contract with different schedule"
                );
            }
        }

        if (isTeam) {
            if (!dryRun) {
                console.log("Create or get Team Vesting...");
                await (
                    await vestingRegistry.createTeamVesting(
                        tokenOwner,
                        amount,
                        cliff,
                        duration,
                        vestingCreationType
                    )
                ).wait();
            }
            vestingAddress = await vestingRegistry.getTeamVesting(
                tokenOwner,
                cliff,
                duration,
                vestingCreationType
            );
            console.log("TeamVesting: ", vestingAddress);
        } else {
            if (!dryRun) {
                console.log("Create or get Vesting contract...");
                await (
                    await vestingRegistry.createVestingAddr(
                        tokenOwner,
                        amount,
                        cliff,
                        duration,
                        vestingCreationType
                    )
                ).wait();
            }
            vestingAddress = await vestingRegistry.getVestingAddr(
                tokenOwner,
                cliff,
                duration,
                vestingCreationType
            );
            console.log("Vesting: ", vestingAddress);
        }

        if (!dryRun) {
            if (vestingAddress === ethers.constants.AddressZero) {
                throw new Error("Vesting address is zero!");
            }
            console.log("signerAcc", signerAcc);
            if ((await SOVtoken.allowance(signerAddress, vestingAddress)) < amount) {
                console.log(
                    "Approving amount",
                    ethers.utils.formatEther(amount).toString(),
                    "to Vesting contract",
                    vestingAddress
                );
                await SOVtoken.approve(vestingAddress, amount);
                console.log("Approved:", ethers.utils.formatEther(amount).toString());
            }

            console.log("Staking ...");
            const vesting = await ethers.getContractAt("VestingLogic", vestingAddress, signer);
            const receipt = await (
                await vesting.stakeTokens(amount, {
                    gasLimit: 6800000,
                    gasPrice: 66000010,
                })
            ).wait();
            console.log("Transaction hash:", receipt.transactionHash);
        }

        const stakes = await staking.getStakes(vestingAddress);
        console.log("Stakes:");
        logger.warn(stakes.stakes.map((stake) => ethers.utils.formatEther(stake).toString()));
        logger.warn(stakes.dates.map((date) => new Date(date.toNumber() * 1000)));
    }

    console.log("=======================================");
    console.log("SOV amount:");
    console.log(ethers.utils.formatEther(totalAmount).toString());

    const balanceAfter = await ethers.provider.getBalance(signerAddress);
    console.log("deployment cost:");
    console.log(ethers.utils.formatEther(balanceBefore.sub(balanceAfter)).toString());
}

task("governance:cancelTeamVestingsOfAccount", "Cancel all team vesting contracts of account")
    .addPositionalParam("address", "Cancel this user's all team vestings")
    .addOptionalParam("startFrom", "Cancel starting from timestamp", 0, types.int)
    .addOptionalParam(
        "signer",
        "Cancelling multisig transaction creator",
        "deployer",
        types.string
    )
    .setAction(async ({ address: userAddress, signer: signerAcc, startFrom }, hre) => {
        const { ethers } = hre;
        const vestingRegistry = await ethers.getContract("VestingRegistry");
        const vestings = await vestingRegistry.getVestingsOf(userAddress);
        for (const vesting of vestings) {
            await cancelTeamVesting(hre, vesting.vestingAddress, startFrom, signerAcc);
        }
    });

task("governance:cancelTeamVesting", "Cancel team vesting contract")
    .addPositionalParam("address", "Team vesting contract to cancel")
    .addOptionalParam("startFrom", "Cancel starting from timestamp", 0, types.int)
    .addOptionalParam(
        "signer",
        "Cancelling multisig transaction creator",
        "deployer",
        types.string
    )
    .addOptionalParam("recipient", "Recipient address for cancelled tokens", "", types.string)
    .setAction(
        async ({ address: vestingAddress, signer: signerAcc, startFrom, recipient }, hre) => {
            await cancelTeamVesting(hre, vestingAddress, startFrom, signerAcc, recipient);
        }
    );

async function cancelTeamVesting(
    hre,
    vestingAddress,
    startFrom,
    signerAcc,
    recipientAddress = null
) {
    const {
        ethers,
        deployments: { get },
    } = hre;
    const staking = await ethers.getContract("Staking");
    const multisigDeployment = await get("MultiSigWallet");
    const vestingContract = await ethers.getContractAt("VestingLogic", vestingAddress);
    if ((await vestingContract.owner()) === multisigDeployment.address) {
        console.log(`Cancelling team vesting: ${vestingContract.address}`);
        const data = staking.interface.encodeFunctionData("cancelTeamVesting", [
            vestingContract.address,
            recipientAddress ? recipientAddress : multisigDeployment.address,
            startFrom,
        ]);
        console.log(`Creating multisig tx cancel team vesting ${vestingContract.address}...`);
        await sendWithMultisig(multisigDeployment.address, staking.address, data, signerAcc);
        logger.info(
            `>>> DONE. Requires Multisig (${multisigDeployment.address}) signing to execute tx <<<`
        );
    }
}

async function parseVestingsFile(ethers, fileName, multiplier) {
    console.log(`Parsing file ${fileName}...`);
    let totalAmount = ethers.BigNumber.from(0);
    const teamVestingList = [];
    let errorMsg = "";

    // Assuming you have the required CSV parsing library imported and set up
    // You may need to install a CSV parsing library like 'csv-parser' and import it accordingly
    return new Promise((resolve, reject) => {
        const data = [];
        fs.createReadStream(fileName)
            .pipe(csv({ headers: false }))
            .on("data", (row) => {
                data.push(row);
                // console.log("reading row:", row[3]);
                const tokenOwner = row[3].replace(" ", "");
                const decimals = row[0].split(".");
                // console.log("decimals:", decimals);
                // console.log("decimals.lengths:", decimals.length);
                // console.log("18 - decimals[1].length:", 18 - decimals[1].length);
                // console.log("Math.log10(multiplier):", Math.log10(multiplier));
                if (decimals.length !== 2 || 18 - decimals[1].length !== Math.log10(multiplier)) {
                    errorMsg += "\n" + tokenOwner + " amount: " + row[0];
                }
                let amount = row[0].replace(",", "").replace(".", "");
                // console.log("amount read:", amount);
                amount = ethers.BigNumber.from(amount).mul(ethers.BigNumber.from(multiplier));
                const cliff = parseInt(row[5]);
                const duration = parseInt(row[6]);
                const isTeam = row[7] === "OwnerVesting" ? false : true;
                totalAmount = totalAmount.add(amount);

                teamVestingList.push([tokenOwner, amount, cliff, duration, isTeam]);

                console.log("=======================================");
                console.log("'" + tokenOwner + "', ");
                console.log(ethers.utils.formatEther(amount).toString());
            })
            .on("end", () => {
                if (errorMsg !== "") {
                    throw new Error("Formatting error: " + errorMsg);
                }
                resolve({
                    totalAmount: totalAmount,
                    teamVestingList: teamVestingList,
                });
            })
            .on("error", (error) => {
                reject(error);
            });
    });
}

task("governance:createVestings", "Create vestings")
    .addParam("path", "The file path")
    .addParam("decimals", "Number of decimals for amount", 2, types.int)
    .addFlag("dryRun", "Dry run")
    .addFlag("reIssue", "Re-issuing vestings to another address")
    .addOptionalParam("signer", "Signer name: 'signer' or 'deployer'", "deployer")
    .setAction(async ({ path, signer, dryRun, decimals, reIssue }, hre) => {
        const multiplier = (10 ** (18 - decimals)).toString();
        await createVestings(hre, dryRun, path, multiplier, signer, reIssue ? true : false);
    });

const VestingType = {
    TeamVesting: 5,
    Vesting: 1,
};

function calculateUid(tokenOwner, vestingCreationType, cliff, duration) {
    /*const uid = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
            ["address", "uint256", "uint256", "uint256", "uint256"],
            [tokenOwner.toLowerCase(), VestingType.Vesting, cliff, duration, vestingCreationType]
        )
    );*/

    const encodedData = ethers.utils.solidityKeccak256(
        ["address", "uint256", "uint256", "uint256", "uint256"],
        [tokenOwner, VestingType.Vesting, cliff, duration, vestingCreationType]
    );

    return ethers.BigNumber.from(encodedData);
}

async function createFourYearVestings(hre, path, signerAcc) {
    const {
        ethers,
        deployments: { get },
    } = hre;
    console.log(signerAcc);
    console.log(ethers.utils.isAddress(signerAcc));

    let signer;
    let signerAddress;
    if (ethers.utils.isAddress(signerAcc)) {
        signer = await getImpersonatedSignerFromJsonRpcProvider(signerAcc);
        signerAddress = signer._address;
    } else {
        signer = await ethers.getSigner((await hre.getNamedAccounts())[signerAcc]);
        signerAddress = signer.address;
    }

    const SOVtoken = await ethers.getContract("SOV", signer);

    const staking = await ethers.getContract("Staking", signer);

    const fourYearVestingFactory = await ethers.getContract("FourYearVestingFactory", signer);

    const MULTIPLIER = ethers.BigNumber.from(10).pow(16);
    const DAY = 24 * 60 * 60;
    const FOUR_WEEKS = 4 * 7 * DAY;
    const cliff = FOUR_WEEKS;
    const duration = 39 * FOUR_WEEKS;
    const vestingCreationType = 4;

    const balanceBefore = await ethers.provider.getBalance(signerAddress);
    console.log("SOV Balance Before:");
    console.log(
        (await SOVtoken.balanceOf(signerAddress)).div(ethers.constants.WeiPerEther).toString()
    );

    const data = [];
    await new Promise((resolve, reject) => {
        fs.createReadStream(path)
            .pipe(csv({ headers: false }))
            .on("data", (row) => {
                data.push(row);
            })
            .on("end", () => {
                resolve();
            })
            .on("error", (error) => {
                reject(error);
            });
    });

    const fourYearVestingLogicAddress = (await get("FourYearVestingLogic")).address;
    const vestingRegistry = await ethers.getContract("VestingRegistry", signer);
    const feeSharingAddress = (await get("FeeSharingCollector")).address;
    const multisigAddress = (await get("MultiSigWallet")).address;

    logger.warn(`SOVtoken.address: ${SOVtoken.address},`);
    logger.warn(`staking.address: ${staking.address},`);
    logger.warn(`feeSharingAddress: ${feeSharingAddress}`);
    logger.warn(`multisigAddress: ${multisigAddress}`);
    logger.warn(`fourYearVestingLogicAddress: ${fourYearVestingLogicAddress}`);
    console.log("=======================================");

    //const vestingsToRegister = [];
    //const tokenOwnersToRegister = [];

    const vestingsToRegister = {};
    const amounts = {};

    for (const row of data) {
        const tokenOwner = row[0].replace(" ", "");
        let amount = row[1].replace(",", "").replace(".", "");
        amount = ethers.BigNumber.from(amount).mul(MULTIPLIER);
        const extendDurationFor = row[2].replace(" ", "");

        const uid = calculateUid(
            tokenOwner.toLowerCase(),
            vestingCreationType.toString(),
            cliff,
            duration
        );
        let vestingAddress = (await vestingRegistry.vestings(uid)).vestingAddress;

        logger.warn(`vestingAddress: ${vestingAddress}`);
        logger.warn(`tokenOwner: ${tokenOwner}`);
        logger.warn(`extendDurationFor: ${extendDurationFor}`);

        if (vestingAddress === ethers.constants.AddressZero) {
            const tx = await fourYearVestingFactory.deployFourYearVesting(
                SOVtoken.address,
                staking.address,
                tokenOwner.toLowerCase(),
                feeSharingAddress,
                multisigAddress,
                fourYearVestingLogicAddress,
                extendDurationFor
            );
            const receipt = await tx.wait();
            vestingAddress = receipt.events.find(
                (event) => event.event === "FourYearVestingCreated"
            ).args.vestingAddress;
            logger.warning(`New 4 year vesting created: ${vestingAddress}`);
            vestingsToRegister[tokenOwner.toLowerCase()] = vestingAddress.toLowerCase();
            //tokenOwnersToRegister.push(tokenOwner);
        } else {
            logger.info(`Reusing 4 year vesting: ${vestingAddress}`);
        }
        amounts[vestingAddress.toLowerCase()] = amount;

        console.log("=======================================");
        console.log("Token Owner: ", tokenOwner);
        console.log("Vesting Contract Address: ", vestingAddress);
        console.log("Amount to stake: ", amount.toString());
    }

    if (Object.keys(vestingsToRegister).length > 0) {
        logger.info("Registering new vestings...");
        logger.warn(Object.keys(vestingsToRegister));
        logger.warn(Object.values(vestingsToRegister));
        await (
            await vestingRegistry.addFourYearVestings(
                Object.keys(vestingsToRegister),
                Object.values(vestingsToRegister)
            )
        ).wait();
        logger.info("New vestings registered");
    }

    for (const [vestingAddress, amount] of Object.entries(amounts)) {
        const fourYearVesting = await ethers.getContractAt(
            (await get("FourYearVestingLogic")).abi,
            vestingAddress,
            signer
        );
        logger.info(
            `Approving amount ${amount
                .div(ethers.utils.parseEther("1"))
                .toNumber()} for vesting ${vestingAddress}`
        );
        await SOVtoken.approve(vestingAddress, amount);
        logger.info("Approved");

        let remainingAmount = amount;
        let lastSchedule = ethers.BigNumber.from(0);
        while (remainingAmount.gt(0)) {
            console.log("remainingAmount before:", remainingAmount.toString());

            await (
                await fourYearVesting.stakeTokens(remainingAmount, lastSchedule, {
                    gasLimit: 6800000,
                    gasPrice: 65e6,
                })
            ).wait();
            lastSchedule = await fourYearVesting.lastStakingSchedule();
            console.log("lastSchedule:", lastSchedule.toString());
            remainingAmount = await fourYearVesting.remainingStakeAmount();
            console.log("remainingAmount after:", remainingAmount.toString());
        }

        const stakes = await staking.getStakes(vestingAddress);
        console.log("Stakes:");
        logger.warn(
            stakes.stakes.map((stake) => stake.div(ethers.constants.WeiPerEther).toString())
        );
        logger.warn(stakes.dates.map((date) => new Date(date.toNumber() * 1000)));
    }

    console.log("SOV Balance After:");
    console.log((await SOVtoken.balanceOf(signerAddress)) / ethers.constants.WeiPerEther);

    const balanceAfter = await ethers.provider.getBalance(signerAddress);
    console.log("deployment cost:");
    console.log(balanceBefore.sub(balanceAfter) / ethers.constants.WeiPerEther);
}

task("governance:createFourYearVestings", "Create vestings")
    .addParam("path", "The file path")
    .addOptionalParam("signer", "Signer name: 'signer' or 'deployer'", "deployer")
    //.addOptionalParam("dryRun", "Dry run flag (default: true)", true, types.boolean)
    .setAction(async ({ path, signer }, hre) => {
        await createFourYearVestings(hre, path, signer);
    });

task("governance:getVestingsOf", "Get vesting contracts of an address")
    .addPositionalParam("address", "The address to get vestings of")
    .setAction(async ({ address }, hre) => {
        logger.warn(await getVestingsOf(hre, address));
    });

task(
    "governance:getVestingsWithSchedule",
    "Get vesting contracts and release schedule of an address"
)
    .addPositionalParam("address", "The address to get vestings of")
    .setAction(async ({ address }, hre) => {
        const vestings = await getVestingsOf(hre, address.toLowerCase());
        for (const vesting of vestings) {
            logger.warn(
                `Vesting contract ${vesting.vestingAddress}: vesting type ${
                    vesting.vestingType
                }, vesting creation type ${[vesting.vestingCreationType]}`
            );

            const [dates, stakes] = await getStakesOf(hre, vesting.vestingAddress);
            let stakesAndDates = dates.map((item, i) =>
                Object.assign({}, { date: item }, { stake: stakes[i] })
            );
            stakesAndDates.forEach((item) => {
                const date = new Date(item.date.mul(1000).toNumber());
                logger.info(`${date.toUTCString()} (${item.date}): ${item.stake / 1e18}`);
            });
            if (stakes.length > 0) {
                let totalStaked = stakes.reduce(
                    (accum, stake) => accum.add(stake),
                    ethers.BigNumber.from(0)
                );
                logger.info("=======================");
                logger.info(`Total vested: ${ethers.utils.formatEther(totalStaked.toString())}`);
            }
        }
    });

/*// Usage
    create4YUVestings().catch((error) => {
        console.error("Error:", error);
    });
    */

task("governance:getVotingPower", "Get a staker's voting power current or at a block")
    .addParam("address", "The staker's address to get current voting power for")
    .addParam("governor", "GovernorOwner or GovernorAdmin", "GovernorOwner", types.string)
    .addOptionalParam("atBlock", "Get VP at this block", undefined, types.int)
    .setAction(async ({ address, governor: governorDeploymentName, atBlock }, hre) => {
        address = address.toLowerCase();
        const data = await getVotingPower(hre, address, governorDeploymentName, atBlock);
        logger.warn(
            `
            ${atBlock ? "At" : "Current"} block: ${data.blockNumber}
            Block timestamp: ${new Date(data.blockTimestamp * 1000).toISOString()}
            Finalized voting checkpoint block: ${data.finalizedVotingBlock}
            Staker address: ${data.stakerAddress} 
            Staker SOV balance: ${data.balance / 1e18}
            Locked staked amount: ${data.lockedAmount / 1e18}
            Governor: ${governorDeploymentName}
            Voting power:       ${data.votingPower / 1e18}
            Own stake VP:       ${data.ownStakeVotingPower / 1e18}
            Self-staked VP:     ${data.selfStakedVotingPower / 1e18}
            Delegated away VP:  ${data.delegatedAwayVotingPower / 1e18}
            Received delegated: ${data.receivedDelegatedVotingPower / 1e18}
            Proposal threshold: ${data.proposalThreshold / 1e18}
            VP/threshold:       ${data.votingPower
                .mul(ethers.utils.parseEther("1"))
                .div(data.proposalThreshold)
                .div(ethers.utils.parseEther("0.01"))}%
            ${
                data.proposalThreshold.gt(data.votingPower)
                    ? `Staker VP lacks ${
                          data.proposalThreshold.sub(data.votingPower) / 1e18
                      } to create proposals`
                    : "Staker has enough VP to create proposals"
            } in ${governorDeploymentName}
            `
        );
    });

task(
    "governance:getVotingPowerAllCurrentStakers",
    "Get voting power for all current stakers with locked stake > 0"
)
    .addOptionalParam("governor", "GovernorOwner or GovernorAdmin", "GovernorOwner", types.string)
    .addOptionalParam("atBlock", "Get VP at this block", undefined, types.int)
    .addOptionalParam("statsFile", "Progress file from data:getStakerStats")
    .addOptionalParam("output", "Output CSV file path")
    .addOptionalParam("concurrency", "Concurrent RPC calls", "10")
    .setAction(
        async (
            { governor: governorDeploymentName, atBlock, statsFile, output, concurrency },
            hre
        ) => {
            const { ethers } = hre;
            const contracts = require("../../scripts/contractInteraction/mainnet_contracts.json");
            const network = await ethers.provider.getNetwork();
            const blockNumber = atBlock
                ? parseInt(atBlock)
                : (await ethers.provider.getBlock()).number;
            const block = await ethers.provider.getBlock(blockNumber);
            const stakingAddress = ethers.utils.getAddress(contracts.Staking);
            const progressFile =
                statsFile ||
                path.join(
                    "temp",
                    `data-getStakerStats-${network.chainId}-3100263-${stakingAddress.toLowerCase()}.json`
                );
            const parallelism = Math.max(1, parseInt(concurrency));

            if (!fs.existsSync(progressFile)) {
                throw new Error(
                    `Staker stats progress file not found: ${progressFile}. Run data:getStakerStats first or pass --statsFile.`
                );
            }

            const progress = JSON.parse(fs.readFileSync(progressFile, "utf8"));
            const activeStakerAddresses = Object.keys(progress.activeStakers || {});
            const stakerAddresses =
                activeStakerAddresses.length > 0
                    ? activeStakerAddresses
                    : Object.keys(progress.stakers || {});
            const staking = await ethers.getContractAt("IStaking", contracts.Staking);
            const governor = await ethers.getContract(governorDeploymentName);
            const sov = await ethers.getContract("SOV");
            const proposalThreshold = await governor.proposalThreshold({ blockTag: blockNumber });
            const referenceTimestamp = block.timestamp;
            const finalizedVotingBlock = Math.max(blockNumber - 1, 0);

            logger.info(`Using staker stats file: ${progressFile}`);
            logger.info(
                `Reference block: ${blockNumber} (${new Date(block.timestamp * 1000).toISOString()})`
            );
            logger.info(
                `Finalized voting checkpoint block for stake-weight split: ${finalizedVotingBlock}`
            );
            if (activeStakerAddresses.length > 0) {
                logger.info(
                    `Loaded ${stakerAddresses.length} active stakers from stats snapshot at block ${progress.activeStakersSnapshotBlock}`
                );
            } else {
                logger.warn(
                    `No active staker snapshot in ${progressFile}; falling back to ${stakerAddresses.length} historical candidate stakers`
                );
            }

            const formatAmount = (value) => ethers.utils.formatEther(value);

            const processedRows = await runWithConcurrency(
                stakerAddresses,
                parallelism,
                async (stakerAddress, index) => {
                    const normalizedAddress = ethers.utils.getAddress(stakerAddress);
                    const [stakeData, votingPower, balance] = await Promise.all([
                        staking.getStakes(normalizedAddress, { blockTag: blockNumber }),
                        staking.getCurrentVotes(normalizedAddress, { blockTag: blockNumber }),
                        sov.balanceOf(normalizedAddress, { blockTag: blockNumber }),
                    ]);
                    const [dates, stakes] = stakeData;

                    let lockedAmount = ethers.BigNumber.from(0);
                    let selfStakedVotingPower = ethers.BigNumber.from(0);
                    let delegatedAwayVotingPower = ethers.BigNumber.from(0);
                    for (let i = 0; i < dates.length; i++) {
                        const lockDate = dates[i];
                        if (!lockDate.gt(referenceTimestamp)) continue;

                        lockedAmount = lockedAmount.add(stakes[i]);

                        const [delegatee, weightedStake] = await Promise.all([
                            staking.delegates(normalizedAddress, lockDate, {
                                blockTag: blockNumber,
                            }),
                            staking.weightedStakeByDate(
                                normalizedAddress,
                                lockDate,
                                referenceTimestamp,
                                finalizedVotingBlock,
                                { blockTag: blockNumber }
                            ),
                        ]);

                        if (delegatee.toLowerCase() === normalizedAddress.toLowerCase()) {
                            selfStakedVotingPower = selfStakedVotingPower.add(weightedStake);
                        } else {
                            delegatedAwayVotingPower = delegatedAwayVotingPower.add(weightedStake);
                        }
                    }

                    if (lockedAmount.isZero()) {
                        if ((index + 1) % 100 === 0 || index === stakerAddresses.length - 1) {
                            logger.info(
                                `Processed ${index + 1}/${stakerAddresses.length} stakers`
                            );
                        }
                        return null;
                    }

                    const receivedDelegatedVotingPower = votingPower.gte(selfStakedVotingPower)
                        ? votingPower.sub(selfStakedVotingPower)
                        : ethers.BigNumber.from(0);
                    const ownStakeVotingPower =
                        selfStakedVotingPower.add(delegatedAwayVotingPower);

                    const row = {
                        address: normalizedAddress,
                        lockedStake: formatAmount(lockedAmount),
                        votingPower: formatAmount(votingPower),
                        selfStakedVotingPower: formatAmount(selfStakedVotingPower),
                        receivedDelegatedVotingPower: formatAmount(receivedDelegatedVotingPower),
                        delegatedAwayVotingPower: formatAmount(delegatedAwayVotingPower),
                        ownStakeVotingPower: formatAmount(ownStakeVotingPower),
                        sovBalance: formatAmount(balance),
                        proposalThreshold: formatAmount(proposalThreshold),
                        thresholdPct: proposalThreshold.isZero()
                            ? "0"
                            : votingPower
                                  .mul(ethers.BigNumber.from(10000))
                                  .div(proposalThreshold)
                                  .toString(),
                        lockedStakeBn: lockedAmount.toString(),
                        votingPowerBn: votingPower.toString(),
                        selfStakedVotingPowerBn: selfStakedVotingPower.toString(),
                        receivedDelegatedVotingPowerBn: receivedDelegatedVotingPower.toString(),
                        delegatedAwayVotingPowerBn: delegatedAwayVotingPower.toString(),
                        ownStakeVotingPowerBn: ownStakeVotingPower.toString(),
                    };

                    if ((index + 1) % 100 === 0 || index === stakerAddresses.length - 1) {
                        logger.info(`Processed ${index + 1}/${stakerAddresses.length} stakers`);
                    }
                    return row;
                }
            );

            const rows = processedRows.filter(Boolean);
            let totalLocked = ethers.BigNumber.from(0);
            let totalVotingPower = ethers.BigNumber.from(0);
            let totalSelfStakedVotingPower = ethers.BigNumber.from(0);
            let totalReceivedDelegatedVotingPower = ethers.BigNumber.from(0);
            let totalDelegatedAwayVotingPower = ethers.BigNumber.from(0);
            let totalOwnStakeVotingPower = ethers.BigNumber.from(0);
            rows.forEach((row) => {
                totalLocked = totalLocked.add(row.lockedStakeBn);
                totalVotingPower = totalVotingPower.add(row.votingPowerBn);
                totalSelfStakedVotingPower = totalSelfStakedVotingPower.add(
                    row.selfStakedVotingPowerBn
                );
                totalReceivedDelegatedVotingPower = totalReceivedDelegatedVotingPower.add(
                    row.receivedDelegatedVotingPowerBn
                );
                totalDelegatedAwayVotingPower = totalDelegatedAwayVotingPower.add(
                    row.delegatedAwayVotingPowerBn
                );
                totalOwnStakeVotingPower = totalOwnStakeVotingPower.add(row.ownStakeVotingPowerBn);
            });

            const normalizedRows = rows
                .sort((a, b) => {
                    const aVotingPower = ethers.BigNumber.from(a.votingPowerBn);
                    const bVotingPower = ethers.BigNumber.from(b.votingPowerBn);
                    const aLockedStake = ethers.BigNumber.from(a.lockedStakeBn);
                    const bLockedStake = ethers.BigNumber.from(b.lockedStakeBn);

                    if (aVotingPower.eq(bVotingPower)) {
                        if (aLockedStake.eq(bLockedStake)) {
                            return a.address.localeCompare(b.address);
                        }
                        return aLockedStake.gt(bLockedStake) ? -1 : 1;
                    }
                    return aVotingPower.gt(bVotingPower) ? -1 : 1;
                })
                .map(
                    ({
                        votingPowerBn,
                        lockedStakeBn,
                        selfStakedVotingPowerBn,
                        receivedDelegatedVotingPowerBn,
                        delegatedAwayVotingPowerBn,
                        ownStakeVotingPowerBn,
                        ...row
                    }) => row
                );

            logger.info("=======================================");
            logger.info(`Current stakers with locked stake > 0: ${normalizedRows.length}`);
            logger.info(`Total locked stake: ${formatAmount(totalLocked)} SOV`);
            logger.info(`Total voting power: ${formatAmount(totalVotingPower)}`);
            logger.info(`Self-staked voting power: ${formatAmount(totalSelfStakedVotingPower)}`);
            logger.info(
                `Received delegated voting power: ${formatAmount(totalReceivedDelegatedVotingPower)}`
            );
            logger.info(
                `Delegated away voting power: ${formatAmount(totalDelegatedAwayVotingPower)}`
            );
            logger.info(`Own stake voting power: ${formatAmount(totalOwnStakeVotingPower)}`);
            logger.info(
                `Proposal threshold (${governorDeploymentName}): ${formatAmount(proposalThreshold)}`
            );
            logger.info("=======================================");

            normalizedRows.slice(0, 20).forEach((row, idx) => {
                logger.info(
                    `${String(idx + 1).padStart(2, " ")}. ${row.address} | locked ${row.lockedStake} | VP ${row.votingPower} | self ${row.selfStakedVotingPower} | recv ${row.receivedDelegatedVotingPower} | away ${row.delegatedAwayVotingPower}`
                );
            });

            if (output && normalizedRows.length > 0) {
                const csvWriter = createObjectCsvWriter({
                    path: output,
                    header: [
                        { id: "address", title: "Address" },
                        { id: "lockedStake", title: "Locked Stake" },
                        { id: "votingPower", title: "Voting Power" },
                        { id: "selfStakedVotingPower", title: "Self Staked Voting Power" },
                        {
                            id: "receivedDelegatedVotingPower",
                            title: "Received Delegated Voting Power",
                        },
                        { id: "delegatedAwayVotingPower", title: "Delegated Away Voting Power" },
                        { id: "ownStakeVotingPower", title: "Own Stake Voting Power" },
                        { id: "sovBalance", title: "SOV Balance" },
                        { id: "proposalThreshold", title: "Proposal Threshold" },
                        { id: "thresholdPct", title: "VP Bps Of Threshold" },
                    ],
                });
                await csvWriter.writeRecords(normalizedRows);
                logger.success(`Results exported to: ${output}`);
            }
        }
    );

task(
    "governance:getGovernanceConfig",
    "Print GovernorOwner and GovernorAdmin settings with their timelock properties"
)
    .addOptionalParam("atBlock", "Read dynamic values at this block", undefined, types.int)
    .setAction(async ({ atBlock }, hre) => {
        const { ethers } = hre;
        const governorNames = ["GovernorOwner", "GovernorAdmin"];
        const blockNumber = atBlock
            ? parseInt(atBlock)
            : (await ethers.provider.getBlock()).number;
        const block = await ethers.provider.getBlock(blockNumber);

        const formatDuration = (secondsBn) => {
            const totalSeconds = ethers.BigNumber.from(secondsBn).toNumber();
            const days = Math.floor(totalSeconds / 86400);
            const hours = Math.floor((totalSeconds % 86400) / 3600);
            const minutes = Math.floor((totalSeconds % 3600) / 60);
            const seconds = totalSeconds % 60;
            const parts = [];

            if (days) parts.push(`${days}d`);
            if (hours) parts.push(`${hours}h`);
            if (minutes) parts.push(`${minutes}m`);
            if (seconds || parts.length === 0) parts.push(`${seconds}s`);

            return `${totalSeconds}s (${parts.join(" ")})`;
        };

        const formatBlocks = (blocksBn, secondsPerBlock = 30) => {
            const blocks = ethers.BigNumber.from(blocksBn).toNumber();
            const approxSeconds = blocks * secondsPerBlock;
            return `${blocks} blocks (~${formatDuration(approxSeconds)})`;
        };

        logger.info(
            `Reference block: ${blockNumber} (${new Date(block.timestamp * 1000).toISOString()})`
        );
        logger.info("=======================================");

        for (const governorName of governorNames) {
            const governor = await ethers.getContract(governorName);
            const timelockAddress = await governor.timelock({ blockTag: blockNumber });
            const timelock = await ethers.getContractAt("Timelock", timelockAddress);

            const [
                guardian,
                staking,
                quorumPercentageVotes,
                majorityPercentageVotes,
                votingDelay,
                votingPeriod,
                proposalMaxOperations,
                proposalThreshold,
                quorumVotes,
                proposalCount,
                timelockAdmin,
                timelockPendingAdmin,
                timelockDelay,
                timelockGracePeriod,
                timelockMinimumDelay,
                timelockMaximumDelay,
            ] = await Promise.all([
                governor.guardian({ blockTag: blockNumber }),
                governor.staking({ blockTag: blockNumber }),
                governor.quorumPercentageVotes({ blockTag: blockNumber }),
                governor.majorityPercentageVotes({ blockTag: blockNumber }),
                governor.votingDelay({ blockTag: blockNumber }),
                governor.votingPeriod({ blockTag: blockNumber }),
                governor.proposalMaxOperations({ blockTag: blockNumber }),
                governor.proposalThreshold({ blockTag: blockNumber }),
                governor.quorumVotes({ blockTag: blockNumber }),
                governor.proposalCount({ blockTag: blockNumber }),
                timelock.admin({ blockTag: blockNumber }),
                timelock.pendingAdmin({ blockTag: blockNumber }),
                timelock.delay({ blockTag: blockNumber }),
                timelock.GRACE_PERIOD({ blockTag: blockNumber }),
                timelock.MINIMUM_DELAY({ blockTag: blockNumber }),
                timelock.MAXIMUM_DELAY({ blockTag: blockNumber }),
            ]);

            logger.info(`${governorName}`);
            logger.info(`Governor address: ${governor.address}`);
            logger.info(`Guardian: ${guardian}`);
            logger.info(`Staking: ${staking}`);
            logger.info(`Proposal count: ${proposalCount.toString()}`);
            logger.info(`Voting delay: ${formatBlocks(votingDelay)}`);
            logger.info(`Voting period: ${formatBlocks(votingPeriod)}`);
            logger.info(`Proposal max operations: ${proposalMaxOperations.toString()}`);
            logger.info(`Quorum percentage votes: ${quorumPercentageVotes.toString()}%`);
            logger.info(`Majority percentage votes: ${majorityPercentageVotes.toString()}%`);
            logger.info(
                `Current proposal threshold: ${ethers.utils.formatEther(proposalThreshold)} VP`
            );
            logger.info(`Current quorum votes: ${ethers.utils.formatEther(quorumVotes)} VP`);
            logger.info(`Timelock address: ${timelock.address}`);
            logger.info(`Timelock admin: ${timelockAdmin}`);
            logger.info(`Timelock pending admin: ${timelockPendingAdmin}`);
            logger.info(`Timelock delay: ${formatDuration(timelockDelay)}`);
            logger.info(`Timelock grace period: ${formatDuration(timelockGracePeriod)}`);
            logger.info(`Timelock minimum delay: ${formatDuration(timelockMinimumDelay)}`);
            logger.info(`Timelock maximum delay: ${formatDuration(timelockMaximumDelay)}`);
            logger.info("---------------------------------------");
        }
    });
