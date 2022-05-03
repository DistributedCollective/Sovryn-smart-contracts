'''
running sovryn distribution from GenericTokenSender
'''
import csv
from scripts.contractInteraction.contract_interaction import *

def sendDirectXUSD(path, dryRun, multiplier):
    '''
    direct token sender script - takes addresses from the file by path
    dryRun - to check that the data will be processed correctly
    '''
    tokenSender = Contract.from_abi("GenericTokenSender", address=conf.contracts['GenericTokenSender'], abi=GenericTokenSender.abi, owner=conf.acct)

    balanceBefore = conf.acct.balance()
    totalAmount = 0

    # amounts examples: "8,834", 7400, "800.01", 800.01
    # TODO: set proper file path of the distribution
    data = parseFile(path, multiplier) # multiplier usually 10**16 because we remove decimal point symbol
    totalAmount += data["totalAmount"]
    # first do a dry run to check the amount then uncomment the next line to do actual distribution
    if(not dryRun):
        tokenSender.transferTokensUsingList(conf.contracts['XUSD'], data["receivers"], data["amounts"])

    # 282.05, 564.10, 641.03
    print("=======================================")
    print("XUSD amount:")
    print(totalAmount / 1e18)

    print("deployment cost:")
    print((balanceBefore - conf.acct.balance()) / 1e18)


def parseFile(fileName, multiplier):
    print(fileName)
    totalAmount = 0
    receivers = []
    amounts = []
    errorMsg = ''
    with open(fileName, 'r') as file:
        reader = csv.reader(file)
        for row in reader:
            tokenOwner = row[0].replace(" ", "")
            decimals = row[1].split('.')
            if(len(decimals) != 2 or len(decimals[1]) != 2):
                errorMsg+="\n" + tokenOwner + ' amount: ' + row[1]
            amount = row[1].replace(",", "").replace(".", "")
            amount = int(amount) * multiplier
            totalAmount += amount

            receivers.append(tokenOwner)
            amounts.append(amount)

            print("=======================================")
            print("'" + tokenOwner + "', ")
            print(amount)

    print(receivers)
    print(amounts)
    if(errorMsg != ''):
        raise Exception('Formatting error: ' + errorMsg)
    return {
               "totalAmount": totalAmount,
               "receivers": receivers,
                "amounts": amounts
            }
