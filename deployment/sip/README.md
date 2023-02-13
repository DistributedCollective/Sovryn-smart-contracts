# Sovryn Improvements Proposals creation script 
- Add a SIPs to sip.js, add to module.exports 
- Make sure to have `TESTNET_DEPLOYER_PRIVATE_KEY` or `MAINNET_DEPLOYER_PRIVATE_KEY` respectively in .env
- Modify createSIP to import and run the SIP 
- run from CLI `npx hardhat run deployment/sip/createSIP --network [rskSovrynMainnet | rskForkedMainnet | rskTestnet | rskForkedTestnet ]
