from scripts.contractInteraction.protocol import *
import scripts.contractInteraction.config as conf
from scripts.contractInteraction.cron_funding import (
    PROTOCOL_WITHDRAWAL_GAS_LIMIT,
    check_signer_funding,
)


def main():
    check_signer_funding(
        "Fees Scheduler Protocol",
        conf.acct,
        PROTOCOL_WITHDRAWAL_GAS_LIMIT,
    )
    withdrawFees()
