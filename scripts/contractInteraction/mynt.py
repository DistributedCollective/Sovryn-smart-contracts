from brownie import *
from brownie.network.contract import InterfaceContainer
import json
import time
import copy
from scripts.utils import *
import scripts.contractInteraction.config as conf

def withdrawSovFromMyntReserved(amt):
    myntReserve = Contract.from_abi(
        "myntReserve", address=conf.contracts['MyntTreasury'], abi=interface.IMyntReserve.abi, owner=conf.acct)
    data = myntReserve.transfer.encode_input(conf.contracts["SOV"], conf.contracts["MyntFixedRateConverter"], amt)
    sendWithMultisig(conf.contracts['multisig'], myntReserve.address, data, conf.acct)
