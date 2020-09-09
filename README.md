


# Sovryn v 0.1 Smart Contracts

## Dependencies

* [python3](https://www.python.org/downloads/release/python-368/) version 3.6 or greater, python3-dev
* [ganache-cli](https://github.com/trufflesuite/ganache-cli) - tested with version [6.9.1](https://github.com/trufflesuite/ganache-cli/releases/tag/v6.9.1)
* [brownie](https://github.com/eth-brownie/brownie/) version 1.10.4 or greater

## Testing

To run the tests, first install the developer dependencies:

```bash
pip install -r requirements.txt
```

Run the all tests with:

```bash
brownie test
```

## Deployment on RSK testnet

1. Add account with RBTC balance to brownie
```bash
brownie accounts new rskdeployer
```
2. Add network Rsk-testnet
```bash
brownie networks add rsk testnet host=https://public-node.testnet.rsk.co chainid=31
```
3. Deploy contracts locally
```bash
brownie run deploy_everything.py
```

4. Deploy contracts on testnet

```bash
brownie run deploy_everything.py --network testnet
```

## Sovryn Swap joint testing for RSK (local)

1. Start `ganache` with
```bash
ganache-cli --gasLimit 6700000 --port 8545
```
Overriding default `brownie` port will make it connect to our local chain and keep it open.
If you changed the port in the brownie config, use that port instead.

2. Deploy contracts
```bash
brownie run deploy_everything.py
```

3. Copy `SUSD` and `RBTC` token addresses from the command line output

4. Use addresses from #2 as reserves in the SovrynSwap codebase (`solidity/utils/config`)

5. Deploy SovrynSwap contracts using the same chain and the updated config. Consult the README in `solidity/utils`.

6. After deployment, copy the address of the deployed `ContractRegistry` and update the `scripts/swap_test.json` accordingly.

7. Run the `swap_test.py` script to set the SovrynSwap ContractRegistry address
```bash
brownie run swap_test.py
```


## Smart Contract Usage

### 1. Parameter setup
##### 1.1 Loan Pool

To set the loan pool parameter, you need to call ```setLoanPool``` on the protocol contract.

```setLoanPool``` is expecting the following parameter:
```
address[] calldata pools,
address[] calldata assets
```

```pools``` is an array of iToken addresses.

```assets``` is an array of underlying asset addresses.

For example: The underlying asset of iSUSD is sUSD.

##### 1.2 Margin Pool

To set up the margin pool parameter, you need to call ```updateSettings``` on the iToken contract (LoanToken.sol).

```updateSettings``` is expecting the following parameter:
```
address settingsTarget,
bytes memory callData
```
```settingsTarget``` is the address of the settings contract (LoanTokenSettingsLowerAdmin.sol)

```callData``` is the encoded input for ```setupMarginLoanParams``` on the settings contract, which expects an array of ```LoanParams```, a struct defined in LoanParamsStruct.sol.

A ```LoanParams``` object consists of following fields:
```
bytes32 id;
bool active;
address owner;
address loanToken;
address collateralToken;
uint256 minInitialMargin;
uint256 maintenanceMargin;
uint256 maxLoanTerm;
```

```id``` is the id of loan params object. Can be any bytes32.

```active``` tells if this object can be used for future loans.

```owner```  owner of this object (typically the contract owner).

```loanToken``` the underlying token. For example: sUSD in case of  iSUSD. If calling ```updateSetting``` this value can be left empty, because it will be overwritten anyway.

```collateralToken``` the required collateral token. For example: rBTC in case of iRBTC.

```minInitialMargin``` The minimum initial margin in percent with 18 decimals. For example: 20e18 for 20%.

```maintenanceMargin``` The minimum margin in percent with 18 decimals. If the margin drops below this value, the loan can and should be liquidated.

```maxLoanTerm``` The maximum loan term.  If calling ```updateSetting``` this value can be left empty, because it will be overwritten anyway (28 days).

##### 1.3 Interest rates



### 2. Lending

##### 2.1 Providing funds to the pool

In order to provide funds to the pool, call ```mint``` on the respective iToken contract. This will take your deposit and give you iTokens in return. If you want to provide sUSD, call it to the iSUSD contract. If you want to provide rBTC, call it to the iRBTC contract.

```mint``` is expecting following parameter:
```
address receiver,
uint256 depositAmount
```
```receiver``` is the user address.

```depositAmount``` is the amount of tokens to be provided (not the number of iTokens to mint).

The function retrieves the tokens from the message sender, so make sure to first approve the iToken contract to access your funds. This is done by calling ```approve(address spender, uint amount)``` on the ERC20 token contract, where spender is the iToken contract address and amount is the amount to be deposited.

##### 2.2 Withdrawing funds from the pool

In order to withdraw funds to the pool, call ```burn```on the respective iToken contract. This will burn your iTokens and send you the underlying token in exchange.

```burn``` is expecting the following parameter:
```
address receiver,
uint256 burnAmount
```
```receiver``` is the user address.

```burnAmount``` is the amount of tokens to be burned (not the number of underlying tokens to withdraw).

### 3. Margin trade

##### 3.1 Enter a trade

In order to enter a trade, call ```marginTrade``` on the respective iToken contract.
Let's say you want to trade RBTC against SUSD. You enter a BTC long position by sending either of these currencies to the iSUSD contract and a short position by sending either of them to the iRBTC contract. The process is depicted below.

![margin trade](https://i.ibb.co/yVpDbVG/margin-Trade.png)

If you are sending ERC20 tokens as collateral, you first need to approve the iToken contract to access your funds. This is done by calling ```approve(address spender, uint amount)``` on the ERC20 token contract, where spender is the iToken contract address and amount is the required collateral.

```marginTrade``` is expecting the following parameter:
```
bytes32 loanId,
uint256 leverageAmount,
uint256 loanTokenSent,
uint256 collateralTokenSent,
address collateralTokenAddress,
address trader,
bytes memory loanDataBytes
````
```loanId``` is 0 in case a new loan is opened for this position (the case most of the time). If an existing loan is used, this ID needs to be passed.

```leverageAmount``` is telling, if the position should open with 2x, 3x, 4x or 5x leverage. It is expected to be passed with 18 decimals.

```loanTokenSent``` and ```collateralTokenSent```are telling the contract about the amount of tokens provided as margin. If the margin is provided in the underlying currency of the iToken contract (e.g. SUSD for iSUSD), the contract will swap it to the collateral token (e.g. RBTC). The user can provide either one of the currencies or both of them.

```collateralTokenAddress```specifies which collateral token is to be used. In theory an iToken contract can support multiple tokens as collateral. Which tokens are supported is specified during the margin pool setup (see above). In our case, there are just two tokens: RBTC and SUSD. RBTC is the collateral token for iSUSD and SUSD is the collateral token for iRBTC.

```trader``` is the user's wallet address.

```loanDataBytes``` is empty in case of ERC20 tokens.

##### 3.2 Close a position

There are 2 functions for ending a loan on the protocol contract: ```closeWithSwap``` and ```closeWithDeposit```. Margin trade positions  are always closed with a swap.

```closeWithSwap``` is expecting following parameter:
```
bytes32 loanId,
address receiver,
uint256 swapAmount,
bool returnTokenIsCollateral,
bytes memory loanDataBytes
```
```loanId``` is the ID of the loan, which is created on loan opening. It can be obtained either by parsing the Trade event or by reading the open loans from the contract by calling ```getActiveLoans``` or ```getUserLoans```.

```receiver``` is the user's address.

```swapAmount``` defines how much of the position should be closed and is denominated in collateral tokens (e.g. rBTC on a iSUSD contract). If ```swapAmount >= collateral```, the complete position will be closed. Else if `returnTokenIsCollateral == True` ```(swapAmount/collateral) * principal``` will be swapped (partial closure). Else the closure amount will be the principal's covered amount

```returnTokenIsCollateral```  pass ```true``` if you want to withdraw remaining collateral + profit in collateral tokens (e.g. rBTC on a iSUSD contract), ```false``` if you want to withdraw it in loan tokens (e.g. sUSD on a iSUSD contract).

```loanDataBytes``` is not used at this point. Pass empty bytes.

### 4. Loan Maintainanance

##### 4.1 Add margin

In order to add margin to a open position, call ```depositCollateral``` on the protocol contract.

```depositCollateral``` expects following parameter:
```
bytes32 loanId,
uint256 depositAmount
```
```loanId``` is the ID of the loan

```depositAmount``` is the amount of collateral tokens to deposit.

##### 4.2 Rollover

When the maximum loan duration has been exceeded, the position will need to be rolled over. The function ```rollover``` on the protocol contract extends the loan duration by the maximum term (28 days for margin trades at the moment of writing), pays the interest to the lender and refunds the caller for the gas cost by sending 2 * the gas cost using the fast gas price as base for the calculation.

```rollover``` expects following parameter:
```
bytes32 loanId,
bytes calldata loanDataBytes
```
```loanId``` is the ID of the loan.

```loanDataBytes``` is a placeholder for future use. Send an empty bytes array.


### 5. Liquidation Handling
##### 5.1 Liquidate a position
In order to liquidate an open position, call ```liquidate``` on the protocol contract. Requirements:
* current margin < maintenance margin
* liquidator approved the protocol to spend sufficient tokens

```liquidate``` will compute the maximum seizable amount and buy it using the caller's tokens. Therefore, the caller needs to possess enough funds to purchase the tokens. The liquidator gets an discount on the collateral token price. The discount is set on State.sol and is called ```liquidationIncentivePercent```. Currently, it is hardcoded to 5%.

```liquidate``` expects following parameter:
```
bytes32 loanId,
address receiver,
uint256 closeAmount
```
```loanId``` is the ID of the loan

```receiver``` is the address receiving the seized funds

```closeAmount``` is the amount to liquidate. If closeAmount > maxLiquidatable, the maximum amount will be liquidated.

### 6. Reading data from the contracts

##### 6.1 Loans

You can read all active loans from the smart contract calling ```getActiveLoans```. All active loans for a specific user can be retrieved with ``` getUserLoans```. Both function will return a array of ```LoanReturnData``` objects.
To query a single loan, use ```getLoan```.

```LoanReturnData``` objects contain following data:
```
bytes32 loanId;
address loanToken;
address collateralToken;
uint256 principal;
uint256 collateral;
uint256 interestOwedPerDay;
uint256 interestDepositRemaining;
uint256 startRate;
uint256 startMargin;
uint256 maintenanceMargin;
uint256 currentMargin;
uint256 maxLoanTerm;
uint256 endTimestamp;
uint256 maxLiquidatable;
uint256 maxSeizable;
```

``` loanId``` is the ID of the loan

```loanToken``` is the address of the loan token

```collateralToken``` is the address of the collateral token

```principal``` is the complete borrowed amount (in loan tokens)

```collateral``` is the complete position size (loan + margin) (in collateral tokens)

```interestOwedPerDay``` is the interest per day

```startRate``` is the exchange rate at the beginning (collateral token to loan token)

```startMargin``` is the margin at the beginning (in percent, 18 decimals)

```maintenanceMargin``` is the minimum margin. If the current margin drops below, the position will be partially liquidated

```currentMargin``` is the current margin

```maxLoanTerm``` is the max duration of the loan

```endTimestamp``` afterwards the loan needs to be rolled over

```maxLiquidatable``` is the amount which can be liquidated (in loan tokens)

```maxSeizable ``` is the amount which can be retrieved through liquidation (in collateral tokens)



### 7. Remarks

The loan token (iToken) contract as well as the protocol contract act as proxies, delegating all calls to underlying contracts. Therefore, if you want to interact with them using web3, you need to use the ABIs from the contracts containing the actual logic or the interface contract.

ABI for ```LoanToken``` contracts: ```LoanTokenLogicStandard```

ABI for ```Protocol``` contract: ```ISovryn```



## License

This project is licensed under the [Apache License, Version 2.0](LICENSE).
