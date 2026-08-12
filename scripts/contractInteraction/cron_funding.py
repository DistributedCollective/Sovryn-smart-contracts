from decimal import Decimal


CRON_GAS_PRICE_WEI = 26_000_000

SET_BLOCK_GAS_LIMIT = 100_000
PROTOCOL_WITHDRAWAL_GAS_LIMIT = 4_000_000
# Current-state measurements were 1,888,432 and 999,148 gas respectively.
AMM_FIRST_BATCH_GAS_LIMIT = 2_500_000
AMM_SECOND_BATCH_GAS_LIMIT = 1_500_000
# The isolated USDT0 claim estimated at 430,662 gas on 2026-08-13.
AMM_USDT0_GAS_LIMIT = 750_000


def _format_rbtc(value_wei):
    return format(Decimal(value_wei) / Decimal(10**18), "f")


def check_signer_funding(workflow_name, signer, maximum_gas_units):
    balance_wei = int(signer.balance())
    required_wei = maximum_gas_units * CRON_GAS_PRICE_WEI

    print("=== Fee claimer funding check ===")
    print("Workflow:", workflow_name)
    print("Signer address:", signer.address)
    print(
        "RBTC balance:",
        _format_rbtc(balance_wei),
        "RBTC ({} wei)".format(balance_wei),
    )
    print("Configured gas price:", CRON_GAS_PRICE_WEI, "wei")
    print("Maximum gas units for this run:", maximum_gas_units)
    print(
        "Required maximum gas funding:",
        _format_rbtc(required_wei),
        "RBTC ({} wei)".format(required_wei),
    )

    if balance_wei < required_wei:
        raise RuntimeError(
            "Insufficient signer balance: {} wei available, {} wei required".format(
                balance_wei, required_wei
            )
        )
