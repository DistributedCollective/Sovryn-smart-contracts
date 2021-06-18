# Origins

## FISH Sale

TODO: After FISH Sale, this to be made into a more generic turnkey solution.

### Pre-requisite

- Add multisigOwners in mainnet.json and testnet.json

IMPORTANT: Token Amount is multiplied by 10 raise to the number of decimals. So, if a token with 100 Million supply has to be created, the amount should be 100 Million and the decimals should be mentioned as required, the rest script will take care.

### Deployment

1. Run deploy_FISH.py (Don't forget to transfer ownership of token after everything is done.)

```
brownie run scripts/origins/deploy_FISH.py --network [ENTER DESIRED NETWORK]
```

It will ask for a choice between deployment and transfer of ownership. Initially we select deployment. After running step 2, we can go forward to transferring ownership anytime we want.

The deployment will take the token amount from `FISH_Token_Amount` and the decimals from `FISH_Token_Decimal` from the JSON files. `Amount * (10 ** Decimals)` will be done by the script.

It will also update the testnet/mainnet JSON file with the new contract address as well.

2. Run deploy_multisig.py

```
brownie run scripts/origins/deploy_multisig.py --network [ENTER DESIRED NETWORK]
```

NOTE: Before deploying, please make sure you add the correct key holders into `multisigOwners` in the JSON file based on the network.

3. Run deploy_stake_and_vest.py

```
brownie run scripts/origins/deploy_stake_and_vest.py --network [ENTER DESIRED NETWORK]
```

This will create the staking and vesting. It does not deploy feeSharing, as for FISH sale the governance was not deployed, thus for feeSharing, the address is taken from JSON and a dummy address is passed.