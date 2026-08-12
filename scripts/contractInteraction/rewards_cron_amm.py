from scripts.contractInteraction.protocol import *
import scripts.contractInteraction.config as conf
from scripts.contractInteraction.cron_funding import (
    AMM_FIRST_BATCH_GAS_LIMIT,
    AMM_SECOND_BATCH_GAS_LIMIT,
    AMM_USDT0_GAS_LIMIT,
    check_signer_funding,
)


def main():
    check_signer_funding(
        "Fees Scheduler AMM",
        conf.acct,
        AMM_FIRST_BATCH_GAS_LIMIT
        + AMM_SECOND_BATCH_GAS_LIMIT
        + AMM_USDT0_GAS_LIMIT,
    )
    withdrawFeesAMM()
