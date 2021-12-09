import csv
from brownie import *
import scripts.contractInteraction.config as conf

def main():
    conf.loadConfig()

    tokenSender = Contract.from_abi("GenericTokenSender", address=conf.contracts['GenericTokenSender'], abi=GenericTokenSender.abi, owner=conf.acct)

    balanceBefore = conf.acct.balance()
    totalAmount = 0

    # amounts examples: 0.06, 0.07
    data = parseFile('./scripts/deployment/distribution/xusd1.csv', 10**16)
    totalAmount += data["totalAmount"]
    # tokenSender.transferTokensUsingList(conf.contracts['XUSD'], data["receivers"], data["amounts"])

    # 0.13
    print("=======================================")
    print("SOV amount:")
    print(totalAmount / 10**18)

    print("deployment cost:")
    print((balanceBefore - conf.acct.balance()) / 10**18)


def parseFile(fileName, multiplier):
    print(fileName)
    totalAmount = 0
    receivers = []
    amounts = []
    with open(fileName, 'r') as file:
        reader = csv.reader(file)
        for row in reader:
            tokenOwner = row[3].replace(" ", "")
            amount = row[0].replace(",", "").replace(".", "")
            amount = int(amount) * multiplier
            totalAmount += amount

            receivers.append(tokenOwner)
            amounts.append(amount)

            print("=======================================")
            print("'" + tokenOwner + "', ")
            print(amount)

    # print(receivers)
    # print(amounts)

    return {
        "totalAmount": totalAmount,
        "receivers": receivers,
        "amounts": amounts
    }
