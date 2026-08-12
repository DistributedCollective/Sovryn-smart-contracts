"""One-off sweep of the legacy fee-claimer RBTC balance.

This script intentionally pins both the source and destination addresses. Run it
once with the existing FEE_CLAIMER secret, verify the confirmed transaction, and
only then rotate FEE_CLAIMER to the new private key.
"""

from os import environ

from brownie import accounts, network, web3


EXPECTED_SOURCE = "0x511893483DCc1A9A98f153ec8298b63be010A99F"
DESTINATION = "0x1C1eE371D0A9B07272C24EB2B917288922479f8F"
EXPECTED_NETWORK = "rsk-mainnet"
EXPECTED_CHAIN_ID = 30
TRANSFER_GAS_LIMIT = 21_000


def main():
    active_network = network.show_active()
    if active_network != EXPECTED_NETWORK:
        raise ValueError(
            f"Refusing to sweep on {active_network}; expected {EXPECTED_NETWORK}"
        )

    chain_id = web3.eth.chain_id
    if chain_id != EXPECTED_CHAIN_ID:
        raise ValueError(
            f"Refusing to sweep on chain {chain_id}; expected {EXPECTED_CHAIN_ID}"
        )

    private_key = environ.get("FEE_CLAIMER")
    if not private_key:
        raise ValueError("FEE_CLAIMER is not set")

    source = accounts.add(private_key)
    if source.address.lower() != EXPECTED_SOURCE.lower():
        raise ValueError(
            f"FEE_CLAIMER derives {source.address}; expected {EXPECTED_SOURCE}"
        )

    if web3.eth.get_code(DESTINATION) != b"":
        raise ValueError(f"Destination {DESTINATION} is not an EOA")

    confirmed_nonce = web3.eth.get_transaction_count(source.address, "latest")
    pending_nonce = web3.eth.get_transaction_count(source.address, "pending")
    if pending_nonce != confirmed_nonce:
        raise ValueError(
            f"Refusing to sweep with a pending transaction: "
            f"confirmed nonce {confirmed_nonce}, pending nonce {pending_nonce}"
        )

    balance = source.balance()
    gas_price = web3.eth.gas_price
    maximum_fee = TRANSFER_GAS_LIMIT * gas_price
    if balance <= maximum_fee:
        raise ValueError(
            f"Balance {balance} wei does not cover the {maximum_fee} wei transfer fee"
        )

    sweep_amount = balance - maximum_fee
    print(f"Source: {source.address}")
    print(f"Destination: {DESTINATION}")
    print(f"Balance: {balance} wei")
    print(f"Gas price: {gas_price} wei")
    print(f"Maximum fee: {maximum_fee} wei")
    print(f"Sweep amount: {sweep_amount} wei")

    receipt = source.transfer(
        DESTINATION,
        sweep_amount,
        gas_limit=TRANSFER_GAS_LIMIT,
        gas_price=gas_price,
        required_confs=1,
    )

    remaining_balance = source.balance()
    if remaining_balance != 0:
        raise ValueError(
            f"Sweep confirmed but {remaining_balance} wei remains at {source.address}"
        )

    print(f"Sweep transaction: {receipt.txid}")
    print("Legacy fee-claimer balance: 0 wei")
