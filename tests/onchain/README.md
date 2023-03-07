# Running onchain tests
The onchain tests are supposed to run on a forked chains - mainnet or testnet.  
1. `npx hardhat node --fork https://mainnet-dev.sovryn.app/rpc --no-deploy --fork-block-number 4929553`
    --fork-block-number is optional - use to time travel back
2. run the test `npx hardhat test path/to/test.js --network X`
    network options: `rskForkedMainnet` or `rskForkedMainnetFlashback`
    use the former if all the hardhat deployments were deployed at the forked block number
    use the latter and put all the needed deployments to the `external/deployments/rskForkedMainnetFlashback` folder otherwise - you normally want to use this to exclude contracts that were not deployed by the time of the forked block