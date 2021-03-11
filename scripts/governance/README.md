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

2. Add network Rsk-testnet

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

## Things To Remember:

- Don't forget to edit the values at [values.json](./values.json)
- Only one proposal can be created at a time by a single staked address.
- The voting power has to be higher than proposal threshold to create a proposal.
- Only unique proposals are allowed at a particular time. Uniqueness is dependent on the target, signature and data. (All of which you can edit in [values.json](./values.json))
- Staking has to be done before creating the proposal, else the voting power won't be useful for that particular proposal.