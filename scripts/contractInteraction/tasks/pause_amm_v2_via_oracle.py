from scripts.contractInteraction.contract_interaction_imports import *

'''
Halt swaps on the V2 pools that share the RBTC-side MoC sub-oracle
(rUSDT/RBTC, DoC/RBTC, BPro/RBTC). Submits ONE multisig tx:

    MoCAdapter 0x4106e4Bb…e789 . setMoCOracleAddress ( DummyMoCMedianizer )

After execution, the adapter's latestAnswer() reverts -> V2 pool oracles
revert -> all three converters revert on convert/quote. LP deposits and
withdrawals are unaffected (empirically verified in
tests-onchain/ammV2PauseViaOracle.test.js — mint/burn are oracle-invariant
across a 0.5x–10x price spread, byte-identical).

Prereq: DummyMoCMedianizer deployed to rskSovrynMainnet. Deploy with:
    npx hardhat deploy --tags DummyMoCMedianizer --network rskSovrynMainnet

Run (submits one multisig tx; other signers confirm separately):
    brownie run scripts/contractInteraction/tasks/pause_amm_v2_via_oracle.py --network rsk-mainnet

To revert after the oracle migration is complete, run:
    brownie run scripts/contractInteraction/tasks/resume_amm_v2_via_oracle.py --network rsk-mainnet
'''

SHARED_RBTC_ADAPTER = "0x4106e4Bb0C339cf7e8adc64Cf889F261Fef1e789"

MOC_ADAPTER_ABI = [
    {
        "inputs": [{"internalType": "address", "name": "_mocOracleAddress", "type": "address"}],
        "name": "setMoCOracleAddress",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function",
    },
    {
        "inputs": [],
        "name": "mocOracleAddress",
        "outputs": [{"internalType": "address", "name": "", "type": "address"}],
        "stateMutability": "view",
        "type": "function",
    },
    {
        "inputs": [],
        "name": "owner",
        "outputs": [{"internalType": "address", "name": "", "type": "address"}],
        "stateMutability": "view",
        "type": "function",
    },
]


def main():
    adapter = _loadAdapter()
    _printCurrentState(adapter)

    dummy = _loadDummyAddress()
    print(f"\nPointing adapter at DummyMoCMedianizer: {dummy}")

    data = adapter.setMoCOracleAddress.encode_input(dummy)
    print(f"  target: {SHARED_RBTC_ADAPTER}")
    print(f"  data:   {data}\n")

    sendWithMultisig(conf.contracts['multisig'], SHARED_RBTC_ADAPTER, data, conf.acct)


def _loadAdapter():
    return Contract.from_abi(
        "MoCBTCToUSDOracle",
        address=SHARED_RBTC_ADAPTER,
        abi=MOC_ADAPTER_ABI,
        owner=conf.acct,
    )


def _printCurrentState(adapter):
    print(f"Adapter {SHARED_RBTC_ADAPTER}")
    print(f"  mocOracleAddress = {adapter.mocOracleAddress()}")
    print(f"  owner            = {adapter.owner()}")
    print(f"  (expected owner  = {conf.contracts['multisig']})")


def _loadDummyAddress():
    from brownie import network

    net = network.show_active()
    if 'mainnet' in net:
        path = './deployment/deployments/rskSovrynMainnet/DummyMoCMedianizer.json'
    else:
        path = './deployment/deployments/rskSovrynTestnet/DummyMoCMedianizer.json'
    with open(path) as f:
        return json.load(f)['address']
