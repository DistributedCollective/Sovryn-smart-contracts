'''
running sovryn distribution from GenericTokenSender
'''
import csv
from scripts.contractInteraction.contract_interaction import *

def sendDirectSOV(path, dryRun):
    '''
    direct token sender script - takes addresses from the file by path
    dryRun - to check that the data will be processed correctly
    '''

    tokenSender = Contract.from_abi("GenericTokenSender", address=conf.contracts['GenericTokenSender'], abi=GenericTokenSender.abi, owner=conf.acct)

    balanceBefore = conf.acct.balance()
    totalAmount = 0

    # amounts examples: 112.80, "2,387.64", 215.03 - mind 2 decimal places in the file for each number!
    # TODO: set proper file path of the distribution
    data = parseFile(path, 1e16) # 10**16 - because we remove decimal point char
    totalAmount += data["totalAmount"]
    # first do a dry run to check the amount then uncomment the next line to do actual distribution
    if(not dryRun):
        tokenSender.transferTokensUsingList(conf.contracts['SOV'], data["receivers"], data["amounts"])

    #
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

    print(receivers)
    print(amounts)

    return {
               "totalAmount": totalAmount,
               "receivers": receivers,
                "amounts": amounts
            }
