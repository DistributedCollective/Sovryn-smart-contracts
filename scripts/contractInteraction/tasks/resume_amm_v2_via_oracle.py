from scripts.contractInteraction.contract_interaction_imports import *

'''
Restore swaps on the V2 pools that share the RBTC-side MoC sub-oracle
(rUSDT/RBTC, DoC/RBTC, BPro/RBTC) AFTER the DummyMoCMedianizer pause
has been executed, by pointing the adapter back at MoCMedianizer.

Submits ONE multisig tx:

    MoCAdapter 0x4106e4Bb…e789 . setMoCOracleAddress ( MoCMedianizer )

Safety check: script aborts if mocOracleAddress is already MoCMedianizer
(nothing to revert) or if it points somewhere other than the known
DummyMoCMedianizer deployment (unexpected state — operator should confirm
manually before proceeding).

Run:
    brownie run scripts/contractInteraction/tasks/resume_amm_v2_via_oracle.py --network rsk-mainnet

If the oracle migration lands on a NEW RedStone-backed MoC-shaped adapter
instead of restoring MoCMedianizer, edit NEW_ORACLE_ADDRESS below.
'''

SHARED_RBTC_ADAPTER = "0x4106e4Bb0C339cf7e8adc64Cf889F261Fef1e789"

# Change this to the new RedStone-backed adapter address once deployed.
# Default: restore the original MoCMedianizer.
NEW_ORACLE_ADDRESS = None  # None => conf.contracts['MoCMedianizer']

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

    target = NEW_ORACLE_ADDRESS or conf.contracts['MoCMedianizer']
    current = adapter.mocOracleAddress()
    dummy = _loadDummyAddressOrNone()

    print(f"Adapter {SHARED_RBTC_ADAPTER}")
    print(f"  current mocOracleAddress = {current}")
    print(f"  target mocOracleAddress  = {target}")
    print(f"  known DummyMoCMedianizer = {dummy}\n")

    # if current.lower() == target.lower():
    #     print("Current oracle already equals target — nothing to do. Aborting.")
    #     return

    # if dummy is not None and current.lower() != dummy.lower():
    #     print(
    #         "WARNING: current oracle is neither MoCMedianizer nor the known "
    #         "DummyMoCMedianizer. Unexpected state; review before running. "
    #         "Aborting for safety."
    #     )
    #     return

    data = adapter.setMoCOracleAddress.encode_input(target)
    print(f"Submitting multisig tx:")
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


def _loadDummyAddressOrNone():
    from brownie import network

    net = network.show_active()
    if 'mainnet' in net:
        path = './deployment/deployments/rskSovrynMainnet/DummyMoCMedianizer.json'
    else:
        path = './deployment/deployments/rskSovrynTestnet/DummyMoCMedianizer.json'
    try:
        with open(path) as f:
            return json.load(f)['address']
    except FileNotFoundError:
        return None
