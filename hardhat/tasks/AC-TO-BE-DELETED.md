## ACCEPTANCE CRITERIA  

* Source [here](https://sovryn.atlassian.net/browse/SOV-4378)  

### Description  

1. Create a PR for review.  
2. Rename `sendDirect` to `utils:send-direct`.  
3. Description of necessary changes to the `utils:send-direct`:  

    a. Rename function properly - you shouldn’t just put the function named `parseFile` in the `utils.js` because it is specific to the direct distribution only. Suggestion: `parseFileForSendDirect` and `parseFileForSendNATIVE`.  
    b. Task `utils:send-direct`:  

    i. Currencies should be added to the external deployment folder as deployment .json files.  
    ii. `dryRun` is a flag, decimals should be variable; see how it is implemented in the `governance:createVestings`.  
    iii. NATIVE currency should be replaced with the `--native` flag.  
    iv. there is no such a thing as `supported currencies list` - you should just get it and throw if no currency deployment found suggesting to add it to the external deployments.  
    v. What if the token is USDT with 6 decimals? see [here](https://github.com/DistributedCollective/Sovryn-smart-contracts/blob/bobDevelopment/hardhat/tasks/utils.js#L367) and [here](https://github.com/DistributedCollective/Sovryn-smart-contracts/blob/bobDevelopment/hardhat/tasks/utils.js#L371).  
    vi. `multiplier param` should not have a default value - it must be specified explicitly.  
    vii. Create tests for the script - this is critical because it is irreversible.  


4. Add tasks `canceltx` and `droptx` (both should do the same). The tasks will menat to be a shortcut for the `utils:replace-tx` for the replacement case of a dummy tx to cancel the original one. **IMPORTANT**: The purpose of this task is not to unstuck a delayed transaction to be confirmed faster, but to prevent a still pending transaction to be confirmed. Therefore, the syntax for this task must be brief, to type it as fast as possible. RSK and Ethereum are the best use cases for these tasks.  

    a. They will have one optional param `--hash`; if not provided then the last tx is being cancelled which is the most common case of replacing.
    b. A very recommended but also optional will be the param "nonce" to be summarized as `--n`. If provided we will know what it is the nonce of the dummy transaction for replacement.  
    c. Follow DRY principle - "don’t repeat yourself", in this case: the code - extract it from replace-tx to a function.  
    d. how it should work:  
       get the last tx sent and set   
       
       newGasPrice = pendingTx.gasPrice * 1.5;  
       newMaxFee = pendingTx.maxFeePerGas * 1.5  

       If the last tx is not available through the endpoint, deduct `gasPrice` and `maxFeePerGas` from `provider.getFeeData()`.  

    e. Create tests.  

5. When reviewed and approved - cherry-pick the tasks into the development branch.  

### Notes  

This task must fork the branch "bobDevelopment" in our core repo.  

//  RSK Case
ubuntu@ip-10-0-12-30:~/SOVRYN/CORE$ hh console --network rskSovrynMainnet
You have both ethereum-waffle and @nomicfoundation/hardhat-chai-matchers installed. They don't work correctly together, so please make sure you only use one.

We recommend you migrate to @nomicfoundation/hardhat-chai-matchers. Learn how to do it here: https://hardhat.org/migrate-from-waffle
CryptoEnv > Type your password to decrypt the env, or press enter to skip it

CryptoEnv > 3 keys decrypted
You have both ethereum-waffle and @nomicfoundation/hardhat-chai-matchers installed. They don't work correctly together, so please make sure you only use one.

We recommend you migrate to @nomicfoundation/hardhat-chai-matchers. Learn how to do it here: https://hardhat.org/migrate-from-waffle
Welcome to Node.js v16.20.0.
Type ".help" for more information.
> const {
...                 ethers: { provider },
...                 ethers,
...             } = hre;
undefined
> var x = await provider.getFeeData();
undefined
> x
{
  lastBaseFeePerGas: null,
  maxFeePerGas: null,
  maxPriorityFeePerGas: null,
  gasPrice: BigNumber { _hex: '0x03e252e0', _isBigNumber: true }
}
> x.gasPrice.toString()
'65164000'
> var newPrice = x.gasPrice.mul(3).div(2);
undefined
> newPrice.toString()
'97746000'
> 
//  BNB Case
ubuntu@ip-10-0-12-30:~/SOVRYN/CORE$ hh console --network bnbMainnet
You have both ethereum-waffle and @nomicfoundation/hardhat-chai-matchers installed. They don't work correctly together, so please make sure you only use one.

We recommend you migrate to @nomicfoundation/hardhat-chai-matchers. Learn how to do it here: https://hardhat.org/migrate-from-waffle
CryptoEnv > Type your password to decrypt the env, or press enter to skip it

CryptoEnv > 3 keys decrypted
You have both ethereum-waffle and @nomicfoundation/hardhat-chai-matchers installed. They don't work correctly together, so please make sure you only use one.

We recommend you migrate to @nomicfoundation/hardhat-chai-matchers. Learn how to do it here: https://hardhat.org/migrate-from-waffle
Welcome to Node.js v16.20.0.
Type ".help" for more information.
> const {
...                 ethers: { provider },
...                 ethers,
...             } = hre;
undefined
> var x = await provider.getFeeData();
undefined
> x
{
  lastBaseFeePerGas: BigNumber { _hex: '0x00', _isBigNumber: true },
  maxFeePerGas: BigNumber { _hex: '0x59682f00', _isBigNumber: true },
  maxPriorityFeePerGas: BigNumber { _hex: '0x59682f00', _isBigNumber: true },
  gasPrice: BigNumber { _hex: '0x3b9aca00', _isBigNumber: true }
}
> x.gasPrice.toString()
'1000000000'
> x.maxFeePerGas.toString()
'1500000000'
> var newPrice = x.gasPrice.mul(3).div(2);
undefined
> var newMaxFee = x.maxFeePerGas.mul(3).div(2);
undefined
> newPrice.toString()
'1500000000'
> newMaxFee.toString()
'2250000000'
> .exit
ubuntu@ip-10-0-12-30:~/SOVRYN/CORE$ 

// BOB Case

ubuntu@ip-10-0-12-30:~/SOVRYN/CORE$ hh console --network bobMainnet
You have both ethereum-waffle and @nomicfoundation/hardhat-chai-matchers installed. They don't work correctly together, so please make sure you only use one.

We recommend you migrate to @nomicfoundation/hardhat-chai-matchers. Learn how to do it here: https://hardhat.org/migrate-from-waffle
CryptoEnv > Type your password to decrypt the env, or press enter to skip it

CryptoEnv > 3 keys decrypted
You have both ethereum-waffle and @nomicfoundation/hardhat-chai-matchers installed. They don't work correctly together, so please make sure you only use one.

We recommend you migrate to @nomicfoundation/hardhat-chai-matchers. Learn how to do it here: https://hardhat.org/migrate-from-waffle
Welcome to Node.js v16.20.0.
Type ".help" for more information.
> const {
...                 ethers: { provider },
...                 ethers,
...             } = hre;
undefined
> var x = await provider.getFeeData();
undefined
> x
{
  lastBaseFeePerGas: BigNumber { _hex: '0xfc', _isBigNumber: true },
  maxFeePerGas: BigNumber { _hex: '0x596830f8', _isBigNumber: true },
  maxPriorityFeePerGas: BigNumber { _hex: '0x59682f00', _isBigNumber: true },
  gasPrice: BigNumber { _hex: '0x0f433c', _isBigNumber: true }
}
> x.gasPrice.toString()
'1000252'
> x.maxFeePerGas.toString()
'1500000504'
> var newPrice = x.gasPrice.mul(3).div(2);
undefined
> var newMaxFee = x.maxFeePerGas.mul(3).div(2);
undefined
> newPrice.toString()
'1500378'
> newMaxFee.toString()
'2250000756'
> .exit
ubuntu@ip-10-0-12-30:~/SOVRYN/CORE$ 


//  ETH case

ubuntu@ip-10-0-12-30:~/SOVRYN/CORE$ hh console --network ethMainnet
You have both ethereum-waffle and @nomicfoundation/hardhat-chai-matchers installed. They don't work correctly together, so please make sure you only use one.

We recommend you migrate to @nomicfoundation/hardhat-chai-matchers. Learn how to do it here: https://hardhat.org/migrate-from-waffle
CryptoEnv > Type your password to decrypt the env, or press enter to skip it

CryptoEnv > 3 keys decrypted
You have both ethereum-waffle and @nomicfoundation/hardhat-chai-matchers installed. They don't work correctly together, so please make sure you only use one.

We recommend you migrate to @nomicfoundation/hardhat-chai-matchers. Learn how to do it here: https://hardhat.org/migrate-from-waffle
Welcome to Node.js v16.20.0.
Type ".help" for more information.
> const {
...                 ethers: { provider },
...                 ethers,
...             } = hre;
undefined
> var x = await provider.getFeeData();
undefined
> x
{
  lastBaseFeePerGas: BigNumber { _hex: '0x049ae19559', _isBigNumber: true },
  maxFeePerGas: BigNumber { _hex: '0x098f2b59b2', _isBigNumber: true },
  maxPriorityFeePerGas: BigNumber { _hex: '0x59682f00', _isBigNumber: true },
  gasPrice: BigNumber { _hex: '0x049b78a539', _isBigNumber: true }
}
> x.gasPrice.toString()
'19788244281'
> x.maxFeePerGas.toString()
'41056688562'
> var newPrice = x.gasPrice.mul(3).div(2);
undefined
> var newMaxFee = x.maxFeePerGas.mul(3).div(2);
undefined
> newPrice.toString()
'29682366421'
> newMaxFee.toString()
'61585032843'
> .exit
ubuntu@ip-10-0-12-30:~/SOVRYN/CORE$ 