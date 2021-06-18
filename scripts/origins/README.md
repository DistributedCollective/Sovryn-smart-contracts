Pre-requisite

1. Add multisigOwners in mainnet.json and testnet.json

NOTE: Token Amount is multiplied by 10 raise to the number of decimals. So, if a token with 100 Million supply has to be created, the amount should be 100 Million and the decimals should be mentioned as required, the rest script will take care.

Deployment

1. Run deploy_FISH.py (Don't forget to transfer ownership of token after everything is done.)
2. Run deploy_multisig.py
3. Run deploy_stake_and_vest.py