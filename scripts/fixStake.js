//TODO: this is a quick & dirty verification of Staking after stop functioning on a forked mainnet
const hre = require("hardhat");
const { BigNumber } = require("@ethersproject/bignumber");
// const { impersonateAccount } = require("@nomicfoundation/hardhat-network-helpers");
const ethers = hre.ethers;
const { BN } = require("@openzeppelin/test-helpers");
const stakingRewardProxyAddress = "0x8304FB3614c728B712e94F9D4DF6719fede6517F";
const stakingAddress = "0x5684a06CaB22Db16d901fEe2A5C081b4C91eA40e";
const sovAddress = "0xEFc78fc7d48b64958315949279Ba181c2114ABBd";
const multisigAddress = "0x924f5ad34698Fd20c90Fe5D5A8A0abd3b42dc711";
const wei = web3.utils.toWei;

async function checkStakerBalance(stakerAddress) {
    //await impersonateAccount(stakerAddress);
    await hre.network.provider.request({
        method: "hardhat_impersonateAccount",
        params: [stakerAddress],
    });
    const account = await hre.ethers.getSigner(stakerAddress);
    const stakingReward = await ethers.getContractAt(
        "StakingRewards",
        stakingRewardProxyAddress,
        account
    );
    console.log("Stop Block: ", (await stakingReward.stopBlock()).toString());
    console.log(
        "Staker lastWithdrawalInterval: ",
        (await stakingReward.getStakerCurrentReward(true, 0))[0].toString()
    );
    console.log(
        "Staker rewards: ",
        (await stakingReward.getStakerCurrentReward(true, 0))[1].toString()
    );
}

async function upgradeStakingRewards() {
    //await impersonateAccount(multisigAddress);
    await hre.network.provider.request({
        method: "hardhat_impersonateAccount",
        params: [multisigAddress],
    });
    const accountMultsig = await hre.ethers.getSigner(multisigAddress);

    // const stakingRewardProxyAddress = stakingRewardProxyAddress;
    const stakingRewardProxy = await ethers.getContractAt(
        "StakingRewardsProxy",
        stakingRewardProxyAddress,
        accountMultsig
    );

    const StakingRewardsLogic = await ethers.getContractFactory("StakingRewards");
    const stakinRewardsLogic = await StakingRewardsLogic.deploy();

    await stakinRewardsLogic.deployed();
    console.log("staking Rewards Logic Deployed: ", stakinRewardsLogic.address);

    await stakingRewardProxy.setImplementation(stakinRewardsLogic.address);
    console.log("new staking reward logic: ", await stakingRewardProxy.getImplementation());
}

async function stake(accountAddress) {
    //await impersonateAccount(accountAddress);
    await hre.network.provider.request({
        method: "hardhat_impersonateAccount",
        params: [accountAddress],
    });

    const account = await hre.ethers.getSigner(accountAddress);
    const stakingReward = await ethers.getContractAt(
        "StakingRewards",
        stakingRewardProxyAddress,
        account
    );

    const sov = await ethers.getContractAt("SOV", sovAddress, account);
    await sov.approve(stakingAddress, wei("10", "ether"));

    console.log(
        "Staker lastWithdrawalInterval: ",
        (await stakingReward.getStakerCurrentReward(true, 0))[0].toString()
    );
    console.log(
        "Staker rewards: ",
        (await stakingReward.getStakerCurrentReward(true, 0))[1].toString()
    );
    const staking = await ethers.getContractAt("Staking", stakingAddress, account);
    const kickoffTS = await staking.kickoffTS();
    const inOneYear = new BN(kickoffTS.toString()).add(new BN(1209600).mul(new BN(260)));
    await staking.stake(wei("1", "ether"), inOneYear.toString(), accountAddress, accountAddress);

    console.log("============");
    console.log(
        "Staker lastWithdrawalInterval: ",
        (await stakingReward.getStakerCurrentReward(true, 0))[0].toString()
    );
    console.log(
        "Staker rewards: ",
        (await stakingReward.getStakerCurrentReward(true, 0))[1].toString()
    );
}

async function main() {
    // MAKE SURE TO RUN THE FORK MAINNET BY RUNNING THIS COMMAND:
    // hardhat node --fork https://mainnet.sovryn.app/rpc --fork-block-number 4432300
    const staker1 = "0x893816e814acecb58301c73585d97493d76f928e";
    let stakerTest = "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266";
    await checkStakerBalance(staker1);

    await upgradeStakingRewards();

    await checkStakerBalance(staker1);

    await hre.network.provider.request({
        method: "hardhat_impersonateAccount",
        params: [multisigAddress],
    });
    const signer = await hre.ethers.getSigner(multisigAddress);

    const sov = await ethers.getContractAt("SOV", sovAddress, signer);
    await sov.transfer(stakerTest, wei("20", "ether"));

    /*await hre.network.provider.request({
        method: "hardhat_impersonateAccount",
        params: [stakerTest],
    });
    const testSigner = await hre.ethers.getSigner(ethers.stakerTest);
    */
    const [testSigner] = await hre.ethers.getSigners(); //ethers.stakerTest);

    stakerTest = testSigner.address;
    console.log("stakerTest address", stakerTest);

    console.log("testSigner.address", testSigner.address);

    console.log("Checking stakerTest address");
    await checkStakerBalance(stakerTest);

    console.log("stakerTest Staking");
    await stake(stakerTest);

    const twoWeeks = 1209600;
    const hexStrBlocksIn2Weeks = BigNumber.from(1209600 / 30).toHexString(); // count avg 30 sec as in the contract
    const hexStr30Seconds = BigNumber.from(30).toHexString();
    const hexStr1Hour = BigNumber.from(3600).toHexString();
    const hexStrBlocksIn1Hour = BigNumber.from(3600 / 30).toHexString(); // count avg 30 sec as in the contract

    stakingReward;
    console.log("Moving 2 weeks & 1 hour forward");
    await hre.network.provider.send("hardhat_mine", [hexStrBlocksIn2Weeks, hexStr30Seconds]);
    await hre.network.provider.send("hardhat_mine", [hexStrBlocksIn1Hour, hexStr30Seconds]);

    const stakingReward = await ethers.getContractAt(
        "StakingRewards",
        stakingRewardProxyAddress,
        testSigner
    );

    console.log("============");
    console.log(
        "Test Staker lastWithdrawalInterval: ",
        (await stakingReward.getStakerCurrentReward(true, 0))[0].toString()
    );
    console.log(
        "Test Staker rewards: ",
        (await stakingReward.getStakerCurrentReward(true, 0))[1].toString()
    );

    // const multisig1 = await ethers.getContractAt("MultiSigWallet", "0x924f5ad34698Fd20c90Fe5D5A8A0abd3b42dc711", account1);
    // const multisig2 = await ethers.getContractAt("MultiSigWallet", "0x924f5ad34698Fd20c90Fe5D5A8A0abd3b42dc711", account2);
    // const multisig3 = await ethers.getContractAt("MultiSigWallet", "0x924f5ad34698Fd20c90Fe5D5A8A0abd3b42dc711", account3);

    /*let StakingProxyABI = [
        //   // add "payable" to the Solidity signature
        "function setImplementation(address _implementation)",
    ];

    let iStakingRewardsProxy = new ethers.utils.Interface(StakingProxyABI);
    const data = iStakingRewardsProxy.encodeFunctionData("setImplementation", [
        stakinRewardsLogic.address,
    ]);
    */
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
