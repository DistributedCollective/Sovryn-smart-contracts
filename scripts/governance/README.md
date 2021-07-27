# Governance Interaction

## Setup

First install all the npm packages:

```
npm i
```

And then install all the python packages using pip3:

```
pip3 install -r requirements.txt
```

## Interacting with RSK Testnet

1. Add account with RBTC balance to brownie

```
brownie accounts new rskdeployer
```

2. Add network rsk-testnet

```
brownie networks add rsk rsk-testnet host=https://testnet.sovryn.app/rpc chainid=31
```

3. Interacting with Governance Contracts

There are 5 different functions:

- Calculate Voting Power
- Stake Tokens
- Current Voting Power
- Create Proposal
- Last Proposal Created

For all of these, it takes values for each run from `values.json`

To edit certain values, go to `values.json` and edit the concerned values.

To run:

- Calculate Voting Power

```
brownie run scripts/governance/calculate_voting_power.py --network rsk-testnet
```

- Stake Tokens

```
brownie run scripts/governance/stake_tokens.py --network rsk-testnet
```

- Current Voting Power

```
brownie run scripts/governance/current_voting_power.py --network rsk-testnet
```

- Create Proposal

```
brownie run scripts/governance/create_proposal.py --network rsk-testnet
```

- Last Proposal Created

```
brownie run scripts/governance/last_proposal_created.py --network rsk-testnet
```

## Values.json

- account : This is the account address used for checking the current voting power of that account, last proposal created by an account and also the account used for staking.
- delegatee : The address of the delegatee (who will have the right to vote for the staked token).
- SOV_Amount_To_Stake : This is the SOV amount to be staked. So, if you want to stake 1 SOV, then you only need to write `1`, not `1000000000000000000` (i.e. 1 \* 10^18). The internal function will multiple the value passed here with `10^18`.
- Time_To_Stake : This is the time in seconds to stake the tokens. Even though you pass a particular time, based on the closest two week block will be the stake time.
- Proposal_Target : The address where the proposal will be executed.
- Proposal_Signature : The function signature which will be called when the proposal is executed.
- Proposal_Data : The data parameters used in the function call when the proposal is executed.
- Proposal_Description : The description of the proposal with its ID, Name, Github Link and SHA256 of the Github Description Content.

## Things To Remember:

- Don't forget to edit the values at [values.json](./values.json)
- The proposal will be created by the address which you created using the `brownie` command in Step 1 at **Interacting with RSK Testnet**. The staking will also be done by this account.
- Only one proposal can be created at a time by a single staked address.
- The voting power has to be higher than proposal threshold to create a proposal.
- Only unique proposals are allowed at a particular time. Uniqueness is dependent on the target, signature and data. (All of which you can edit in [values.json](./values.json))
- Staking has to be done before creating the proposal, else the voting power won't be useful for that particular proposal.
